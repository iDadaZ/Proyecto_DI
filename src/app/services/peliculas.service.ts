import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { catchError, map, tap, filter, take, switchMap } from 'rxjs/operators'; // Añadido switchMap

import { CarteleraResponse, Movie } from '../interfaces/caretelera.interface';
import { Genero, GeneroResponse as TMDBGeneroResponse} from '../interfaces/genero.interface';
import { AuthService } from './auth.service';
import { User } from '../interfaces/usuario.interface'; // Asegúrate de que esta interfaz se ha actualizado
import { MovieDetails } from '../interfaces/details.interface';
import { Credits } from '../interfaces/credits.interface';
import { TmdbService } from './tmdb.service'; // ¡Importar TmdbService!


@Injectable({
  providedIn: 'root'
})
export class PeliculasService {

  // Esta API Key es la tuya, no la del usuario. Se usa para las llamadas "generales" de la app
  // (ej. cartelera, búsqueda general, géneros)
  private apiKeyV3 = '478f17163f77c5b4c7a1834e04f2ea47';
  private URL = 'https://api.themoviedb.org/3';
  private carteleraPage = 1;
  public cargando: boolean = false;

  private _favoriteMovies = new BehaviorSubject<Movie[]>([]);
  public favoriteMovies$ = this._favoriteMovies.asObservable();

  private favoritesLoadedForCurrentSession: boolean = false;
  private currentAccountId: string | null = null;
  private _genres = new BehaviorSubject<Genero[]>([]);
  public genres$: Observable<Genero[]> = this._genres.asObservable();


  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private tmdbService: TmdbService // ¡Inyectar TmdbService!
  ) {
    // Suscribirse a los cambios del usuario para resetear/cargar favoritos
    this.authService.currentUser.pipe(
      // Solo actuar cuando el usuario no es undefined (logueado o con datos cargados)
      filter(user => user !== undefined),
      tap(user => {
        const newAccountId = user ? user.account_id : null;
        const newSessionId = user ? user.tmdb_session_id : null;
        const newTmdbApiKey = user ? user.api_movies : null;

        // Si el account_id ha cambiado o si no hemos cargado favoritos para esta sesión aún
        // y el usuario tiene un account_id, session_id y API Key válidos
        if (this.currentAccountId !== newAccountId || (newAccountId && newSessionId && newTmdbApiKey && !this.favoritesLoadedForCurrentSession)) {
          this.resetFavoriteMovies(); // Resetear siempre al cambiar de usuario o si no se han cargado
          this.currentAccountId = newAccountId; // Actualizar el ID de cuenta actual

          if (newAccountId && newSessionId && newTmdbApiKey) {
            console.log(`PeliculasService: Detectado nuevo usuario o sesión (${newAccountId}). Cargando favoritos.`);
            this.loadFavoriteMovies(newAccountId).subscribe({
              next: () => console.log('PeliculasService: Favoritos cargados exitosamente para el nuevo usuario.'),
              error: (err) => console.error('PeliculasService: Error al cargar favoritos para el nuevo usuario:', err.message || err)
            });
          } else {
            console.log('PeliculasService: Usuario deslogueado o sin credenciales TMDB. Favoritos reseteados.');
          }
        }
      })
    ).subscribe();

    this.loadGenres(); // Carga los géneros al inicializar el servicio
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

  // Este método usa tu API Key general para la aplicación
  private getBaseHttpParamsV3(): HttpParams {
    return new HttpParams()
      .set('api_key', this.apiKeyV3) // Usar la API Key V3 del servicio (tuya)
      .set('language', 'es-ES');
  }

  getCartelera(): Observable<Movie[]> {
    if (this.cargando) {
      console.log('PeliculasService: Ya hay una carga de cartelera en progreso. Devolviendo vacío.');
      return of([]);
    }
    this.cargando = true;

    const params = this.getBaseHttpParamsV3().set('page', this.carteleraPage.toString());

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
    const params = this.getBaseHttpParamsV3().set('query', texto);

    return this.http.get<CarteleraResponse>(`${this.URL}/search/movie`, { params }).pipe(
      map(resp => resp.results),
      catchError(error => {
        console.error('PeliculasService: Error al buscar películas:', error);
        return of([]);
      })
    );
  }

  getPeliculaDetalle(id: string): Observable<MovieDetails | null> {
    const params = this.getBaseHttpParamsV3();

    return this.http.get<MovieDetails>(`${this.URL}/movie/${id}`, { params }).pipe(
      catchError(err => {
        console.error('PeliculasService: Error al obtener detalle de película:', err);
        return of(null);
      })
    );
  }

  getCredits(id: string): Observable<Credits | null> {
    const params = this.getBaseHttpParamsV3();

    return this.http.get<Credits>(`${this.URL}/movie/${id}/credits`, { params }).pipe(
      catchError(error => {
        console.error('PeliculasService: Error al obtener créditos:', error);
        return of(null);
      })
    );
  }

  private loadGenres(): void {
    const url = `${this.URL}/genre/movie/list`;
    const params = this.getBaseHttpParamsV3();

    this.http.get<{ genres: Genero[] }>(url, { params }).pipe(
      tap(response => {
        this._genres.next(response.genres);
        console.log('TMDB Géneros cargados:', this._genres.getValue());
      }),
      catchError(error => {
        console.error('Error cargando géneros de TMDB:', error);
        this._genres.next([]);
        return of({ genres: [] });
      })
    ).subscribe();
  }

  public getGenresObservable(): Observable<Genero[]> {
    return this.genres$;
  }

  public getGenresSnapshot(): Genero[] {
    return this._genres.getValue();
  }

  searchMoviesAdvanced(
    query: string = '',
    page: number = 1,
    filters: {
      genreId?: number;
      year?: number;
      includeAdult?: boolean;
      sortBy?: string;
    } = {}
  ): Observable<CarteleraResponse> {
    let params = this.getBaseHttpParamsV3()
      .set('page', page.toString());

    let url: string;

    if (query) {
      url = `${this.URL}/search/movie`;
      params = params.set('query', query);
    } else {
      url = `${this.URL}/discover/movie`;
      if (filters.genreId) {
        params = params.set('with_genres', filters.genreId.toString());
      }
      if (filters.year) {
        params = params.set('primary_release_year', filters.year.toString());
      }
      if (filters.includeAdult !== undefined) {
        params = params.set('include_adult', filters.includeAdult.toString());
      }
      params = params.set('sort_by', filters.sortBy || 'popularity.desc');
    }

    return this.http.get<CarteleraResponse>(url, { params }).pipe(
      catchError(error => {
        console.error('PeliculasService: Error en la búsqueda avanzada/discover de películas:', error);
        return throwError(() => new Error('No se pudieron obtener los resultados de la búsqueda avanzada.'));
      })
    );
  }

  loadFavoriteMovies(accountId: string): Observable<Movie[]> {
    const userTmdbSessionId = this.authService.getTmdbSessionId();
    const userTmdbApiKey = this.authService.getTmdbApiKey(); // ¡Obtener la API Key del usuario!

    if (this.favoritesLoadedForCurrentSession && this.currentAccountId === accountId && this._favoriteMovies.getValue().length > 0) {
      console.log('PeliculasService: Favoritos ya cargados para la sesión actual y usuario. Devolviendo caché.');
      return this._favoriteMovies.asObservable().pipe(take(1));
    }

    // Verificar si todos los datos necesarios para TMDB están disponibles
    if (!userTmdbSessionId || !accountId || !userTmdbApiKey) {
      const errorMessage = 'TMDB session_id, account_id, o API Key no disponible para cargar favoritos.';
      console.error('PeliculasService: ERROR -', errorMessage);
      this.favoritesLoadedForCurrentSession = true; // Marcar como "intentado cargar" para evitar bucles
      this._favoriteMovies.next([]); // Asegurarse de que el stream esté vacío si no hay datos
      return throwError(() => new Error(errorMessage));
    }

    const params = new HttpParams()
      .set('api_key', userTmdbApiKey) // ¡Usar la API Key del usuario!
      .set('session_id', userTmdbSessionId)
      .set('language', 'es-ES')
      .set('page', '1');

    console.log(`PeliculasService: Realizando petición HTTP para cargar favoritos para cuenta ${accountId} (usando session_id V3 y API Key del usuario).`);

    return this.http.get<CarteleraResponse>(`${this.URL}/account/${accountId}/favorite/movies`, { params }).pipe(
      map(response => response.results),
      tap(movies => {
        console.log('PeliculasService: Favoritos cargados de TMDB (V3):', movies);
        this._favoriteMovies.next(movies);
        this.favoritesLoadedForCurrentSession = true;
      }),
      catchError(error => {
        console.error('PeliculasService: Error al obtener películas favoritas de TMDB (V3):', error);
        if (error.status === 401) {
          console.error('PeliculasService: ERROR 401 - TMDB session_id o API Key no válido o expirado. Limpiando credenciales TMDB.');
          this.authService.clearTmdbSessionDetails(); // Llama al método para limpiar las credenciales TMDB
        }
        this._favoriteMovies.next([]);
        this.favoritesLoadedForCurrentSession = true;
        return throwError(() => new Error(`Error al cargar películas favoritas: ${error.error?.status_message || error.message}`));
      })
    );
  }

  toggleFavorite(accountId: string, movieId: number, favorite: boolean): Observable<any> {
    const userTmdbSessionId = this.authService.getTmdbSessionId();
    const userTmdbApiKey = this.authService.getTmdbApiKey(); // ¡Obtener la API Key del usuario!

    // Verificar si todos los datos necesarios para TMDB están disponibles
    if (!userTmdbSessionId || !accountId || !userTmdbApiKey) {
      const errorMessage = 'TMDB session_id, account_id, o API Key no disponible para alternar favorito.';
      console.error('PeliculasService: ERROR -', errorMessage);
      return throwError(() => new Error(errorMessage));
    }

    const body = {
      media_type: 'movie',
      media_id: movieId,
      favorite: favorite
    };

    const params = new HttpParams()
      .set('api_key', userTmdbApiKey) // ¡Usar la API Key del usuario!
      .set('session_id', userTmdbSessionId);

    console.log(`PeliculasService: Alternando favorito para película ${movieId}, estado: ${favorite} (usando session_id V3 y API Key del usuario).`);

    return this.http.post(`${this.URL}/account/${accountId}/favorite`, body, { params }).pipe(
      tap(response => {
        console.log('PeliculasService: Respuesta de TMDB al alternar favorito (V3):', response);
        this.favoritesLoadedForCurrentSession = false; // Invalidar caché
        console.log('PeliculasService: Forzando recarga de favoritos después del toggle (invalidando caché).');
        this.loadFavoriteMovies(accountId).subscribe({
          next: () => console.log('PeliculasService: Favoritos recargados con éxito tras toggle.'),
          error: (err) => console.error('PeliculasService: Error al recargar favoritos después del toggle:', err.message || err)
        });
      }),
      catchError(error => {
        console.error('PeliculasService: Error al alternar favorito en TMDB (V3):', error);
        if (error.status === 401) {
          console.error('PeliculasService: ERROR 401 - TMDB session_id o API Key no válido o expirado. Limpiando credenciales TMDB.');
          this.authService.clearTmdbSessionDetails(); // Llama al método para limpiar las credenciales TMDB
        }
        this.favoritesLoadedForCurrentSession = false;
        return throwError(() => new Error(`Error al alternar favorito: ${error.error?.status_message || error.message}`));
      })
    );
  }

  isMovieFavorite(movieId: number): Observable<boolean> {
    const currentUser = this.authService.currentUserValue;
    // Ahora también verificamos si hay TMDB session_id y API Key para que la funcionalidad de favoritos sea consistente
    if (!currentUser || currentUser.account_id === null || currentUser.tmdb_session_id === null || this.authService.getTmdbApiKey() === null) {
      return of(false); // No puede ser favorito si no hay credenciales TMDB
    }

    return this._favoriteMovies.asObservable().pipe(
      map(favoriteMovies => favoriteMovies.some(favMovie => favMovie.id === movieId))
    );
  }

  getPosterUrl(posterPath: string | null, size: string = 'w500'): string {
    if (!posterPath) {
      return 'assets/no-poster.png';
    }
    return `https://image.tmdb.org/t/p/${size}${posterPath}`;
  }
}
