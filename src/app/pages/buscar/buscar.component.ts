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
import { Subject, of, Observable } from 'rxjs';
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

    this.peliculasSvc.favoriteMovies$.pipe(
      takeUntil(this.unsubscribe$)
    ).subscribe((favMovies: Movie[]) => {
      this.favoriteMovieIds = new Set(favMovies.map(movie => movie.id));
      this.movies = this.movies.map((movie: MovieWithFavorite) => ({
        ...movie,
        isFavorite: this.favoriteMovieIds.has(movie.id)
      }));
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

      if (this.searchQuery || this.selectedGenre || this.filterFavorites !== 'all' || this.currentPage > 1) {
        this.loading = true;
        this.errorMessage = null;
        this.noMovie = '';
        this.peliculasSvc.searchMoviesAdvanced(
          this.searchQuery.trim(),
          this.currentPage,
          { genreId: this.selectedGenre !== null ? this.selectedGenre : undefined }
        ).pipe(
          map((response: CarteleraResponse) => this.applyClientSideFavoriteFilter(response)),
          catchError((err: HttpErrorResponse) => {
            this.loading = false;
            this.errorMessage = err.message || 'Error al cargar películas.';
            console.error(err);
            return of({
              results: [],
              total_pages: 0,
              total_results: 0,
              page: 0,
              dates: { maximum: '', minimum: '' } as Dates
            } as CarteleraResponse);
          }),
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
        });
      } else {
        this.movies = [];
        this.noMovie = '';
        this.totalPages = 0;
        this.totalResults = 0;
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
          this.totalPages = 0;
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

  async toggleFavorite(movieId: number, isCurrentlyFavorite: boolean | undefined): Promise<void> {
    if (!this.tmdbAccountId) {
      console.warn('Necesitas iniciar sesión con TMDB para marcar favoritos.');
      return;
    }

    this.loading = true;
    this.errorMessage = null;
    try {
      const response = await this.peliculasSvc.toggleFavorite(this.tmdbAccountId, movieId, !isCurrentlyFavorite).toPromise();

      if (response && (response.success || response.status_code === 12 || response.status_code === 13)) {
        console.log(!isCurrentlyFavorite ? 'Película añadida a favoritos.' : 'Película eliminada de favoritos.');

        const movieIndex = this.movies.findIndex(m => m.id === movieId);
        if (movieIndex > -1) {
          this.movies[movieIndex].isFavorite = !isCurrentlyFavorite;
        }
        if (this.selectedMovie && this.selectedMovie.id === movieId) {
          this.selectedMovie.isFavorite = !isCurrentlyFavorite;
        }

        this.peliculasSvc.loadFavoriteMovies(this.tmdbAccountId!).subscribe({
          next: () => console.log('PeliculasService: Favoritos recargados con éxito tras toggle.'),
          error: (err) => console.error('PeliculasService: Error al recargar favoritos después del toggle:', err)
        });

      } else {
        throw new Error(response?.status_message || 'Fallo al actualizar el estado de favoritos.');
      }
    } catch (err: any) {
      this.errorMessage = err.message || 'Error al actualizar favoritos.';
      console.error(err);
    } finally {
      this.loading = false;
    }
  }

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
}
