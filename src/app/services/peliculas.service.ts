import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { catchError, map, tap, filter, take } from 'rxjs/operators';
import { CarteleraResponse, Movie } from '../interfaces/caretelera.interface';
import { AuthService } from './auth.service';
import { User } from '../interfaces/usuario.interface';
import { MovieDetails } from '../interfaces/details.interface';
import { Credits } from '../interfaces/credits.interface';

@Injectable({
  providedIn: 'root'
})
export class PeliculasService {

  private apiKey = '478f17163f77c5b4c7a1834e04f2ea47'; // Tu API Key, asegúrate de que sea correcta
  private URL = 'https://api.themoviedb.org/3';
  private carteleraPage = 1;
  public cargando: boolean = false;

  private _favoriteMovies = new BehaviorSubject<Movie[]>([]);
  public favoriteMovies$ = this._favoriteMovies.asObservable();

  private favoritesLoadedForCurrentSession: boolean = false;
  private currentAccountId: string | null = null;

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {
    this.authService.currentUser.pipe(
      filter(user => user !== undefined) // Asegura que no se procese 'undefined' si el sujeto está inicializando
    ).subscribe(user => {
      const newAccountId = user ? user.account_id : null;

      if (this.currentAccountId !== newAccountId) {
        this.resetFavoriteMovies();
        this.currentAccountId = newAccountId;

        if (newAccountId) {
          console.log(`PeliculasService: Detectado nuevo usuario (${newAccountId}). Cargando favoritos.`);
          this.loadFavoriteMovies(newAccountId).subscribe({
            next: () => console.log('PeliculasService: Favoritos cargados exitosamente para el nuevo usuario.'),
            error: (err) => console.error('PeliculasService: Error al cargar favoritos para el nuevo usuario:', err)
          });
        } else {
          console.log('PeliculasService: Usuario deslogueado. Favoritos reseteados.');
        }
      }
    });
  }

  private resetFavoriteMovies(): void {
    this._favoriteMovies.next([]);
    this.favoritesLoadedForCurrentSession = false;
    console.log('PeliculasService: Caché de favoritos reseteada.');
  }

  resetPeliculaPage(): void {
    this.carteleraPage = 1;
    this.cargando = false;
    console.log('PeliculasService: Página de cartelera reseteada a 1.');
  }

  getBaseHttpParams(): HttpParams {
    return new HttpParams()
      .set('api_key', this.apiKey)
      .set('language', 'es-ES');
  }

  getCartelera(): Observable<Movie[]> {
    if (this.cargando) {
      console.log('PeliculasService: Ya hay una carga de cartelera en progreso. Devolviendo vacío.');
      return of([]);
    }
    this.cargando = true;
    console.log(`PeliculasService: Cargando cartelera página ${this.carteleraPage}...`);

    const params = this.getBaseHttpParams().set('page', this.carteleraPage.toString());

    return this.http.get<CarteleraResponse>(`${this.URL}/movie/now_playing`, { params }).pipe(
      map(resp => resp.results),
      tap(() => {
        this.carteleraPage++;
        this.cargando = false;
        console.log(`PeliculasService: Cartelera cargada. Próxima página: ${this.carteleraPage}.`);
      }),
      catchError(error => {
        console.error('PeliculasService: Error al obtener cartelera:', error);
        this.cargando = false;
        return of([]);
      })
    );
  }

  buscarPeliculas(texto: string): Observable<Movie[]> {
    const params = this.getBaseHttpParams().set('query', texto);

    return this.http.get<CarteleraResponse>(`${this.URL}/search/movie`, { params }).pipe(
      map(resp => resp.results),
      catchError(error => {
        console.error('PeliculasService: Error al buscar películas:', error);
        return of([]);
      })
    );
  }

  getPeliculaDetalle(id: string): Observable<MovieDetails | null> {
    const params = this.getBaseHttpParams();

    return this.http.get<MovieDetails>(`${this.URL}/movie/${id}`, { params }).pipe(
      catchError(err => {
        console.error('PeliculasService: Error al obtener detalle de película:', err);
        return of(null);
      })
    );
  }

  getCredits(id: string): Observable<Credits | null> {
    const params = this.getBaseHttpParams();

    return this.http.get<Credits>(`${this.URL}/movie/${id}/credits`, { params }).pipe(
      catchError(error => {
        console.error('PeliculasService: Error al obtener créditos:', error);
        return of(null);
      })
    );
  }

  /**
   * Carga las películas favoritas del usuario desde TMDB.
   * Este método debe ser llamado internamente por el servicio (ej. en el constructor o tras un toggle).
   * Contiene la lógica de caché para evitar peticiones repetidas.
   */
  loadFavoriteMovies(accountId: string): Observable<Movie[]> {
    if (this.favoritesLoadedForCurrentSession && this.currentAccountId === accountId && this._favoriteMovies.getValue().length > 0) {
      console.log('PeliculasService: Favoritos ya cargados para la sesión actual y usuario. Devolviendo caché.');
      return this._favoriteMovies.asObservable().pipe(take(1));
    }

    // Usar getTmdbSessionId() para obtener el session_id
    const userTmdbSessionId = this.authService.getTmdbSessionId(); // <--- Aquí se corrige: usar getTmdbSessionId()
    if (!userTmdbSessionId) {
      console.error('PeliculasService: ERROR 401 - "session_id" de TMDB no disponible para cargar favoritos.');
      this.favoritesLoadedForCurrentSession = true;
      this._favoriteMovies.next([]);
      return throwError(() => new Error('session_id de TMDB no disponible para cargar favoritos.'));
    }

    let params = this.getBaseHttpParams()
      .set('session_id', userTmdbSessionId);
    params = params.set('page', '1');

    console.log(`PeliculasService: Realizando petición HTTP para cargar favoritos para cuenta ${accountId}.`);

    return this.http.get<CarteleraResponse>(`${this.URL}/account/${accountId}/favorite/movies`, { params }).pipe(
      map(response => response.results),
      tap(movies => {
        console.log('PeliculasService: Favoritos cargados de TMDB:', movies);
        this._favoriteMovies.next(movies);
        this.favoritesLoadedForCurrentSession = true;
      }),
      catchError(error => {
        console.error('PeliculasService: Error al obtener películas favoritas de TMDB:', error);
        if (error.status === 401) {
          console.error('PeliculasService: ERROR 401 - "session_id" no válido o expirado. Asegúrate de que el backend proporciona un "session_id" real de TMDB.');
        }
        this._favoriteMovies.next([]);
        this.favoritesLoadedForCurrentSession = true;
        return throwError(() => new Error(`Error al cargar películas favoritas: ${error.message}`));
      })
    );
  }

  /**
   * Verifica si una película es favorita para el usuario actual.
   * Este método NO INICIA peticiones HTTP. Solo observa el estado actual
   * del `BehaviorSubject` de películas favoritas.
   * @param movieId El ID de la película a verificar.
   * @returns Un Observable que emite `true` si es favorita, `false` en caso contrario.
   */
  isMovieFavorite(movieId: number): Observable<boolean> {
    // CORRECCIÓN AQUÍ: Se usa currentUserValue en lugar de currentUser.getValue()
    const currentUser = this.authService.currentUserValue;
    if (!currentUser || !currentUser.account_id) {
      return of(false); // No logueado o sin account_id, no puede ser favorita
    }

    return this._favoriteMovies.asObservable().pipe(
      map(favoriteMovies => favoriteMovies.some(favMovie => favMovie.id === movieId))
    );
  }

  /**
   * Alterna el estado de favorito de una película en TMDB.
   * Tras el éxito, invalida la caché y fuerza una recarga de la lista de favoritos.
   * @param accountId El ID de la cuenta de TMDB del usuario.
   * @param movieId El ID de la película a alternar.
   * @param favorite `true` para añadir a favoritos, `false` para quitar.
   * @returns Un Observable con la respuesta de la API de TMDB.
   */
  toggleFavorite(accountId: string, movieId: number, favorite: boolean): Observable<any> {
    // Usar getTmdbSessionId() para obtener el session_id
    const userTmdbSessionId = this.authService.getTmdbSessionId(); // <--- Aquí se corrige: usar getTmdbSessionId()
    if (!userTmdbSessionId) {
      console.error('PeliculasService: ERROR 401 - "session_id" de TMDB no disponible para alternar favorito.');
      return throwError(() => new Error('session_id de TMDB no disponible para alternar favorito.'));
    }

    const body = {
      media_type: 'movie',
      media_id: movieId,
      favorite: favorite
    };

    const params = new HttpParams()
      .set('api_key', this.apiKey)
      .set('session_id', userTmdbSessionId);

    return this.http.post(`${this.URL}/account/${accountId}/favorite`, body, { params }).pipe(
      tap(response => {
        console.log('PeliculasService: Respuesta de TMDB al alternar favorito:', response);
        this.favoritesLoadedForCurrentSession = false; // Invalida la caché para forzar recarga
        console.log('PeliculasService: Forzando recarga de favoritos después del toggle (invalidando caché).');
        this.loadFavoriteMovies(accountId).subscribe({
          next: () => console.log('PeliculasService: Favoritos recargados con éxito tras toggle.'),
          error: (err) => console.error('PeliculasService: Error al recargar favoritos después del toggle:', err)
        });
      }),
      catchError(error => {
        console.error('PeliculasService: Error al alternar favorito en TMDB:', error);
        if (error.status === 401) {
          console.error('PeliculasService: ERROR 401 - "session_id" no válido o expirado al alternar favorito.');
        }
        this.favoritesLoadedForCurrentSession = false;
        return throwError(() => error);
      })
    );
  }
}
