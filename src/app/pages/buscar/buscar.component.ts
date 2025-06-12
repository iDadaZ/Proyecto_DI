// src/app/pages/buscar/buscar.component.ts
import { CommonModule, DatePipe, NgIf, NgFor } from '@angular/common';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PeliculasPosterComponent } from '../../components/peliculas-poster/peliculas-poster.component';
import { ActivatedRoute, Router, Params } from '@angular/router';
import { PeliculasService } from '../../services/peliculas.service';
import { Movie, CarteleraResponse, Dates } from '../../interfaces/caretelera.interface';
import { Genero } from '../../interfaces/genero.interface';
import { MovieDetails, Genre as TMDBGenreDetail } from '../../interfaces/details.interface';
import { Subject, of, Observable, throwError, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, catchError, takeUntil, tap, map } from 'rxjs/operators';
import { AuthService } from '../../services/auth.service';
import { HttpErrorResponse } from '@angular/common/http';

// Interfaz para el uso de películas en la lista de resultados (extiende Movie con isFavorite)
interface MovieWithFavorite extends Movie {
  isFavorite?: boolean; // Propiedad opcional para indicar si es favorita
}

// Nueva interfaz para el modal de detalle (extiende MovieDetails para añadir isFavorite)
interface MovieDetailsWithFavorite extends MovieDetails {
  isFavorite?: boolean;
  images?: { file_path: string }[]; // Para las imágenes si las gestionas así
}

@Component({
  selector: 'app-buscar',
  standalone: true,
  imports: [
    CommonModule,
    PeliculasPosterComponent,
    FormsModule,
    DatePipe,
    NgIf, NgFor,
  ],
  templateUrl: './buscar.component.html',
  styleUrl: './buscar.component.css'
})
export class BuscarComponent implements OnInit, OnDestroy {

  // Propiedades existentes
  texto: string = '';
  movies: MovieWithFavorite[] = [];
  noMovie: string = '';

  // Propiedades para los filtros del enunciado
  searchQuery: string = '';
  // CAMBIO CLAVE AQUÍ: genres ahora es un Observable
  genres$: Observable<Genero[]> = of([]);
  selectedGenre: number | null = null;
  filterFavorites: 'all' | 'favorites' | 'not_favorites' = 'all';

  // Estados de la UI
  loading: boolean = false;
  errorMessage: string | null = null;

  // Paginación
  currentPage: number = 1;
  totalPages: number = 0;
  totalResults: number = 0;

  // Propiedades para la gestión de favoritos de TMDB
  tmdbAccountId: string | null = null;
  tmdbSessionId: string | null = null;
  favoriteMovieIds: Set<number> = new Set();

  private searchTerms = new Subject<string>();
  private filterTrigger = new Subject<void>();
  private unsubscribe$ = new Subject<void>();

  private subscriptions: Subscription = new Subscription();

  constructor(
    private activatedRoute: ActivatedRoute,
    private router: Router,
    public peliculasSvc: PeliculasService,
    private authService: AuthService
  ) {}

  ngOnInit() {
    this.tmdbAccountId = this.authService.getTmdbAccountId();
    this.tmdbSessionId = this.authService.getTmdbSessionId();

    // CAMBIO CLAVE AQUÍ: Asignamos el Observable de géneros
    this.genres$ = this.peliculasSvc.getGenresObservable();

    // SUSCRIPCIÓN CRÍTICA: Actualiza el estado `isFavorite` de las películas en la lista
    // cuando el listado de favoritos del servicio cambia.
    this.peliculasSvc.favoriteMovies$.pipe(
      takeUntil(this.unsubscribe$)
    ).subscribe((favMovies: Movie[]) => {
      this.favoriteMovieIds = new Set(favMovies.map(movie => movie.id));
      // Actualiza la propiedad isFavorite de cada película en tu lista `movies`
      this.movies = this.movies.map((movie: MovieWithFavorite) => ({
        ...movie,
        isFavorite: this.favoriteMovieIds.has(movie.id)
      }));
      // Si tienes un modal de detalle abierto, también actualiza su estado
      if (this.selectedMovie) {
        this.selectedMovie.isFavorite = this.favoriteMovieIds.has(this.selectedMovie.id);
      }
      // Vuelve a aplicar el filtro de favoritos por si el estado actual ha cambiado
      // y la película ya no cumple el criterio (ej. si era favorita y se eliminó).
      // Esto solo si el filtro de favoritos está activo.
      if (this.filterFavorites === 'favorites' || this.filterFavorites === 'not_favorites') {
        this.performSearchLogic().subscribe(); // Re-ejecuta la búsqueda para aplicar el filtro
      }
    });

    this.searchTerms.pipe(
      debounceTime(400),
      distinctUntilChanged(),
      switchMap((term: string) => {
        this.currentPage = 1;
        return this.performSearchLogic();
      }),
      takeUntil(this.unsubscribe$)
    ).subscribe();

    this.filterTrigger.pipe(
      switchMap(() => {
        this.currentPage = 1;
        return this.performSearchLogic();
      }),
      takeUntil(this.unsubscribe$)
    ).subscribe();

    this.activatedRoute.queryParams.pipe(
      takeUntil(this.unsubscribe$)
    ).subscribe((queryParams: Params) => {
      this.searchQuery = queryParams['query'] || '';
      this.selectedGenre = queryParams['genreId'] ? +queryParams['genreId'] : null;
      this.filterFavorites = queryParams['favorites'] || 'all';
      this.currentPage = queryParams['page'] ? parseInt(queryParams['page'], 10) : 1;

      // Unir la carga inicial con la respuesta de la ruta,
      // para evitar duplicidad o desincronización
      // Este bloque solo debe ejecutar una búsqueda si los queryParams cambian
      // O si es la carga inicial y no hay queryParams que disparen la búsqueda
      if (this.searchQuery || this.selectedGenre || this.filterFavorites !== 'all' || this.currentPage > 1 || (Object.keys(queryParams).length === 0 && this.movies.length === 0)) {
        this.loading = true;
        this.errorMessage = null;
        this.noMovie = '';
        this.performSearchLogic().subscribe();
      } else if (this.movies.length === 0) { // Si no hay queryParams y aún no hay películas, carga la cartelera por defecto.
        this.peliculasSvc.getCartelera().subscribe(movies => {
          this.movies = movies.map((movie: Movie) => ({
            ...movie,
            isFavorite: this.favoriteMovieIds.has(movie.id)
          }));
          this.noMovie = (this.movies.length === 0) ? '😌 No se encontró la película' : '';
        });
      }
    });

    this.activatedRoute.params.pipe(
      takeUntil(this.unsubscribe$)
    ).subscribe((params: Params) => {
      const routeText = params['texto'];
      if (routeText && (!this.searchQuery || this.searchQuery === '') && !this.selectedGenre && this.filterFavorites === 'all' && this.currentPage === 1) {
        this.texto = routeText;
        this.searchQuery = routeText;
        this.clearAdvancedFiltersExceptText();
        this.loading = true;
        this.noMovie = '';
        this.peliculasSvc.buscarPeliculas(this.texto).pipe(
          takeUntil(this.unsubscribe$)
        ).subscribe((movies: Movie[]) => {
          this.loading = false;
          this.movies = movies.map((movie: Movie) => ({
            ...movie,
            isFavorite: this.favoriteMovieIds.has(movie.id)
          }));
          this.noMovie = (this.movies.length === 0) ? '😌 No se encontró la película' : '';
          this.totalPages = 0; // O la lógica correcta si buscarPeliculas devuelve info de paginación
          this.totalResults = this.movies.length;
          this.updateUrlParams();
        }, (error: HttpErrorResponse) => {
          this.loading = false;
          this.errorMessage = error.message || 'Error al cargar películas.';
          console.error(error);
          this.noMovie = '';
        });
      }
    });
  }

  private performSearchLogic(): Observable<CarteleraResponse> {
    this.loading = true;
    this.errorMessage = null;
    this.noMovie = '';

    const filters = {
      genreId: this.selectedGenre !== null ? this.selectedGenre : undefined,
    };

    return this.peliculasSvc.searchMoviesAdvanced(
      this.searchQuery.trim(),
      this.currentPage,
      filters
    ).pipe(
      map((response: CarteleraResponse) => this.applyClientSideFavoriteFilter(response)),
      tap((response: CarteleraResponse) => {
        this.movies = response.results.map((movie: Movie) => ({
          ...movie,
          isFavorite: this.favoriteMovieIds.has(movie.id)
        }));
        this.totalPages = response.total_pages;
        this.totalResults = response.total_results;
        this.noMovie = (this.movies.length === 0) ? '😌 No se encontró la película con los filtros seleccionados.' : '';
        this.loading = false;
        this.updateUrlParams();
      }),
      catchError((err: HttpErrorResponse) => {
        this.loading = false;
        this.errorMessage = err.message || 'Hubo un error al realizar la búsqueda.';
        console.error(err);
        this.noMovie = '';
        return of({
          results: [],
          total_pages: 0,
          total_results: 0,
          page: 0,
          dates: { maximum: '', minimum: '' } as Dates
        } as CarteleraResponse);
      })
    );
  }

  private applyClientSideFavoriteFilter(response: CarteleraResponse): CarteleraResponse {
    if (this.filterFavorites === 'favorites') {
      if (!this.tmdbAccountId) {
        console.warn('Inicia sesión con TMDB para filtrar por favoritos.');
        return { ...response, results: [], total_results: 0 };
      }
      const filteredResults = response.results.filter(movie => this.favoriteMovieIds.has(movie.id));
      return { ...response, results: filteredResults, total_results: filteredResults.length };
    } else if (this.filterFavorites === 'not_favorites') {
      if (!this.tmdbAccountId) {
        console.warn('Inicia sesión con TMDB para usar el filtro de "No Favoritas".');
        return { ...response, results: [], total_results: 0 };
      }
      const filteredResults = response.results.filter(movie => !this.favoriteMovieIds.has(movie.id));
      return { ...response, results: filteredResults, total_results: filteredResults.length };
    }
    return response;
  }

  onSearchInputChanged(): void {
    this.searchTerms.next(this.searchQuery);
  }

  onFilterChange(): void {
    this.filterTrigger.next();
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.loading = true;
      this.errorMessage = null;
      this.noMovie = '';
      this.peliculasSvc.searchMoviesAdvanced(
        this.searchQuery.trim(),
        this.currentPage,
        { genreId: this.selectedGenre !== null ? this.selectedGenre : undefined }
      ).pipe(
        map((response: CarteleraResponse) => this.applyClientSideFavoriteFilter(response)),
        takeUntil(this.unsubscribe$)
      ).subscribe((response: CarteleraResponse) => {
        this.loading = false;
        this.movies = response.results.map((movie: Movie) => ({
          ...movie,
          isFavorite: this.favoriteMovieIds.has(movie.id)
        }));
        this.totalPages = response.total_pages;
        this.totalResults = response.total_results;
        this.noMovie = (this.movies.length === 0) ? '😌 No se encontró la película con los filtros seleccionados.' : '';
        this.updateUrlParams();
      }, (error: HttpErrorResponse) => {
        this.loading = false;
        this.errorMessage = error.message || 'Error al cargar más películas.';
        console.error(error);
        this.noMovie = '';
      });
    }
  }

  clearAllFilters(): void {
    this.searchQuery = '';
    this.selectedGenre = null;
    this.filterFavorites = 'all';
    this.currentPage = 1;
    this.movies = [];
    this.totalPages = 0;
    this.totalResults = 0;
    this.noMovie = '';
    this.errorMessage = null;
    this.updateUrlParams();
    this.searchTerms.next('');
  }

  private clearAdvancedFiltersExceptText(): void {
    this.selectedGenre = null;
    this.filterFavorites = 'all';
    this.currentPage = 1;
    this.totalPages = 0;
    this.totalResults = 0;
    this.errorMessage = null;
  }

  private updateUrlParams(): void {
    const queryParams: Params = {};
    if (this.searchQuery.trim()) {
      queryParams['query'] = this.searchQuery.trim();
    }
    if (this.selectedGenre !== null) {
      queryParams['genreId'] = this.selectedGenre;
    }
    if (this.filterFavorites !== 'all') {
      queryParams['favorites'] = this.filterFavorites;
    }
    if (this.currentPage > 1) {
      queryParams['page'] = this.currentPage;
    }

    this.router.navigate([], {
      relativeTo: this.activatedRoute,
      queryParams: queryParams,
      queryParamsHandling: '',
      replaceUrl: true
    });
  }

  ngOnDestroy(): void {
    this.unsubscribe$.next();
    this.unsubscribe$.complete();
  }

  viewMovieDetails(movieId: number): void {
    this.router.navigate(['/pelicula', movieId]);
  }

  // --- MÉTODOS PARA EL MODAL DE DETALLES ---
  selectedMovie: MovieDetailsWithFavorite | null = null;
  showDetailModal: boolean = false;

  async openMovieDetails(movie: MovieWithFavorite): Promise<void> {
    this.selectedMovie = null;
    this.showDetailModal = true;
    this.loading = true;
    this.errorMessage = null;

    try {
      const details: MovieDetails | null | undefined = await this.peliculasSvc.getPeliculaDetalle(movie.id.toString()).toPromise();

      if (details) {
        this.selectedMovie = {
          ...details,
          isFavorite: this.favoriteMovieIds.has(movie.id)
        };
      } else {
        throw new Error('No se encontraron detalles para la película.');
      }
    } catch (err: any) {
      this.errorMessage = err.message || 'Error al cargar detalles de la película.';
      console.error(err);
    } finally {
      this.loading = false;
    }
  }

  closeMovieDetails(): void {
    this.showDetailModal = false;
    this.selectedMovie = null;
    this.errorMessage = null;
  }

  toggleFavorite(movieId: number, isCurrentlyFavorite: boolean | undefined): void {
    // Asegúrate de que el ID de cuenta TMDB esté disponible
    const tmdbAccountIdReal = this.authService.currentUserValue?.tmdb_user_account_id;

    if (!tmdbAccountIdReal || this.authService.getTmdbSessionId() === null || this.authService.getTmdbApiKey() === null) {
      console.warn('Necesitas iniciar sesión con TMDB y tener todas las credenciales configuradas para marcar favoritos.');
      alert('Por favor, conecta tu cuenta de TMDB para gestionar tus películas favoritas.');
      return;
    }

    this.loading = true;
    this.errorMessage = null;

    // Llamar al servicio PeliculasService para alternar el favorito
    this.subscriptions.add(
      this.peliculasSvc.toggleFavorite(tmdbAccountIdReal, movieId, !isCurrentlyFavorite).pipe(
        // El `tap` en PeliculasService ya se encarga de recargar los favoritos globales
        // por lo que no necesitamos un `.subscribe()` aquí para actualizar la lista.
        // La suscripción a `favoriteMovies$` en ngOnInit se encargará de eso.
        catchError((err: any) => {
          this.errorMessage = err.error?.status_message || err.message || 'Error al actualizar favoritos.';
          console.error('Error en toggleFavorite del modal:', err);
          return throwError(() => new Error(this.errorMessage ?? 'Ocurrió un error desconocido.'));
        })
      ).subscribe({
        next: (response) => {
          console.log('Toggle favorito desde modal exitoso:', response);
          // Opcional: Si quieres actualizar `selectedMovie.isFavorite` inmediatamente sin esperar al BehaviorSubject,
          // puedes hacerlo aquí, pero la suscripción a `favoriteMovies$` ya lo hará poco después.
          if (this.selectedMovie && this.selectedMovie.id === movieId) {
            this.selectedMovie.isFavorite = !isCurrentlyFavorite;
          }
        },
        error: (err) => {
          this.errorMessage = err.message; // El catchError ya ajustó el mensaje
          alert('Hubo un error al actualizar el estado de favorito. Por favor, inténtalo de nuevo.');
        },
        complete: () => {
          this.loading = false; // Finaliza la carga independientemente del resultado
        }
      })
    );
  }

  // --- MANEJO DEL EVENTO DE FAVORITO DEL COMPONENTE HIJO (peliculas-poster) ---
  // Este método recibe el evento del componente peliculas-poster.
  // Ya NO LLAMA al servicio para alternar el favorito, porque eso ya lo hace el hijo.
  // Solo se usa si necesitas una lógica adicional en el padre después de que el toggle ocurra.
  // En tu caso, la sincronización de `movies` y `selectedMovie` ya se hace a través de favoriteMovies$.
  onMovieToggleFavoriteFromChild(event: { movieId: number; newFavoriteStatus: boolean }): void {
    console.log(`[BuscarComponent] Evento de favorito recibido del componente hijo para película ${event.movieId}. Nuevo estado: ${event.newFavoriteStatus}`);
    // No hagas NADA más aquí que pueda disparar otra llamada a la API o un estado incorrecto.
    // El servicio ya se encarga de recargar los favoritos globalmente y eso actualizará la UI.
  }
}
