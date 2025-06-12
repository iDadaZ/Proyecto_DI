// src/app/components/peliculas-poster/peliculas-poster.component.ts
import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Movie } from '../../interfaces/caretelera.interface';
import { NoImagePipe } from '../../pipes/no-image.pipe';
import { PipesModule } from "../../pipes/pipes.module";

import { AuthService } from '../../services/auth.service';
import { PeliculasService } from '../../services/peliculas.service';
import { Observable, Subscription, switchMap, take, map, throwError, catchError } from 'rxjs'; // Asegúrate de importar 'throwError' y 'catchError'
import { User } from '../../interfaces/usuario.interface';

@Component({
  selector: 'app-peliculas-poster',
  standalone: true,
  imports: [CommonModule, RouterLink, NoImagePipe, PipesModule],
  templateUrl: './peliculas-poster.component.html',
  styleUrl: './peliculas-poster.component.css'
})
export class PeliculasPosterComponent implements OnInit, OnDestroy {

  @Input() movies: Movie[] = []; // Correcto: Este componente recibe una lista de películas

  // Renombramos el Output para evitar confusión con cualquier método interno o propiedad
  @Output() movieToggleFavorite = new EventEmitter<{ movieId: number; newFavoriteStatus: boolean }>();

  isLoggedIn: Observable<boolean>;
  isUserAdmin: Observable<boolean>;
  currentUser: Observable<User | undefined>;

  private subscriptions: Subscription = new Subscription();

  constructor(
    private router: Router,
    private authService: AuthService,
    private peliculasService: PeliculasService
  ) {
    this.isLoggedIn = this.authService.isLoggedIn();
    this.isUserAdmin = this.authService.isUserAdmin();
    this.currentUser = this.authService.currentUser;
  }

  ngOnInit(): void {
    // No se necesita inicialización especial aquí para el estado de favoritos de cada película,
    // ya que `isFavorite(movie)` lo manejará a través del servicio.
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  onMovieClick(movie: Movie): void {
    this.router.navigate(['/pelicula', movie.id]);
  }

  getStars(voteAverage: number): number[] {
    const normalizedVote = Math.max(0, Math.min(10, voteAverage));
    const starsCount = Math.floor(normalizedVote / 2);
    return Array(starsCount).fill(0);
  }

  // Este método es el que el HTML llama para determinar si una película es favorita.
  // Siempre devuelve un Observable<boolean>.
  isFavorite(movie: Movie): Observable<boolean> {
    return this.peliculasService.isMovieFavorite(movie.id);
  }

  // Este método es el que el HTML llama cuando se hace clic en el botón de favorito.
  onToggleFavorite(movie: Movie, event: Event): void {
    event.stopPropagation(); // Evita que el clic se propague a elementos padres.

    const currentUser = this.authService.currentUserValue;

    // Verificar si el usuario está logueado y tiene las credenciales TMDB necesarias
    if (!currentUser || !currentUser.tmdb_user_account_id || !this.authService.getTmdbApiKey() || !this.authService.getTmdbSessionId()) {
        console.error('Error: No se puede alternar favorito. Usuario no logueado, sin ID de cuenta TMDB (numérico), sin API Key TMDB o sin Session ID TMDB.');
        alert('Debes conectar tu cuenta de TMDB y tener una API Key configurada para gestionar tus películas favoritas.');
        return;
    }

    const tmdbAccountIdReal = currentUser.tmdb_user_account_id;

    // OBTENEMOS el estado actual de favorito del servicio ANTES de calcular el nuevo estado.
    this.subscriptions.add(
      this.isFavorite(movie).pipe( // Llama al método isFavorite para obtener el Observable
        take(1), // Toma solo el valor actual y completa
        switchMap(isCurrentlyFavoriteFromService => { // isCurrentlyFavoriteFromService es el boolean real
          const newFavoriteStatus = !isCurrentlyFavoriteFromService; // Calcula el nuevo estado deseado
          console.log(`[PeliculasPosterComponent] Dentro de switchMap para ${movie.id}. Estado actual (del servicio): ${isCurrentlyFavoriteFromService}, Nuevo estado deseado: ${newFavoriteStatus}`);

          // Realiza la llamada a la API de toggle a través del servicio
          return this.peliculasService.toggleFavorite(tmdbAccountIdReal, movie.id, newFavoriteStatus).pipe(
            map(response => ({ response, newFavoriteStatus })), // Pasa la respuesta y el nuevo estado
            catchError(err => {
              console.error(`[PeliculasPosterComponent] Error al alternar favorito para ${movie.title}:`, err);
              // Lanza el error para que el bloque `error` del subscribe lo capture
              return throwError(() => new Error(`No se pudo alternar el favorito: ${err.message || 'error desconocido'}`));
            })
          );
        })
      ).subscribe({
        next: ({ response, newFavoriteStatus }) => {
          console.log(`[PeliculasPosterComponent] toggleFavorite exitoso para ${movie.id}. Respuesta:`, response, `Nuevo estado: ${newFavoriteStatus}`);
          // Emitir el evento para que el componente padre reaccione si es necesario
          this.movieToggleFavorite.emit({ movieId: movie.id, newFavoriteStatus: newFavoriteStatus });

          // No necesitamos actualizar una propiedad `this.isFavorite` aquí,
          // porque el `PeliculasService` ya emite el nuevo estado a través de su BehaviorSubject
          // y el `isFavorite(movie) | async` en el HTML se actualizará automáticamente.
        },
        error: (err) => {
          console.error('[PeliculasPosterComponent] Error general en el proceso de toggleFavorite (subscribe error):', err.message || err);
          alert('Hubo un error al actualizar el estado de favorito. Por favor, inténtalo de nuevo.');
        }
      })
    );
  }
}
