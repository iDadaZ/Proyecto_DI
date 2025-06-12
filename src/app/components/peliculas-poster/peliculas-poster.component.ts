import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Movie } from '../../interfaces/caretelera.interface';
import { NoImagePipe } from '../../pipes/no-image.pipe';
import { PipesModule } from "../../pipes/pipes.module";

import { AuthService } from '../../services/auth.service';
import { PeliculasService } from '../../services/peliculas.service';
import { Observable, Subscription, switchMap, take, map, throwError, catchError } from 'rxjs'; // Asegúrate de importar 'throwError'
import { User } from '../../interfaces/usuario.interface'; // Asegúrate de que esta interfaz es la correcta

@Component({
  selector: 'app-peliculas-poster',
  standalone: true,
  imports: [CommonModule, RouterLink, NoImagePipe, PipesModule],
  templateUrl: './peliculas-poster.component.html',
  styleUrl: './peliculas-poster.component.css'
})
export class PeliculasPosterComponent implements OnInit, OnDestroy {

  @Input() movies: Movie[] = [];

  // CORRECCIÓN: El EventEmitter ya tiene el tipo correcto.
  @Output() toggleFavorite = new EventEmitter<{ movieId: number; isCurrentlyFavorite: boolean | undefined }>();

  isLoggedIn: Observable<boolean>;
  isUserAdmin: Observable<boolean>;

  // === LA CORRECCIÓN CLAVE ESTÁ AQUÍ ===
  // Cambia 'User | null' a 'User | undefined' para que coincida con AuthService
  currentUser: Observable<User | undefined>;
  // ======================================

  private subscriptions: Subscription = new Subscription();

  constructor(
    private router: Router,
    private authService: AuthService,
    private peliculasService: PeliculasService
  ) {
    this.isLoggedIn = this.authService.isLoggedIn();
    this.isUserAdmin = this.authService.isUserAdmin();
    // Esta línea ahora es válida porque los tipos coinciden
    this.currentUser = this.authService.currentUser;
  }

  ngOnInit(): void { }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  onMovieClick(movie: Movie): void {
    this.router.navigate(['/pelicula', movie.id]);
  }

  getStars(voteAverage: number): number[] {
    // Asegúrate de que voteAverage sea un número válido y entre 0 y 10 para las estrellas
    const normalizedVote = Math.max(0, Math.min(10, voteAverage)); // Normaliza entre 0 y 10
    const starsCount = Math.floor(normalizedVote / 2); // Divide por 2 si las estrellas son sobre 5, o ajusta según tu escala
    return Array(starsCount).fill(0);
  }

  onToggleFavorite(movie: Movie, event: Event): void {
    event.stopPropagation(); // Evita que se propague el evento del clic, por ejemplo, al onMovieClick

    const currentUser = this.authService.currentUserValue; // Usa currentUserValue para el snapshot
    if (!currentUser || !currentUser.account_id || !this.authService.getTmdbApiKey() || !this.authService.getTmdbSessionId()) {
        console.error('Error: No se puede alternar favorito. Usuario no logueado, sin account_id TMDB, sin API Key TMDB o sin Session ID TMDB.');
        alert('Debes conectar tu cuenta de TMDB y tener una API Key configurada para gestionar tus películas favoritas.');
        return;
    }
    const accountId = currentUser.account_id;

    this.subscriptions.add(
      this.isFavorite(movie).pipe(
        take(1), // Tomar solo el estado actual una vez
        switchMap(isCurrentlyFavorite => { // isCurrentlyFavorite aquí ya es un boolean (el valor desempaquetado del observable)
          const newFavoriteStatus = !isCurrentlyFavorite; // Calcular el nuevo estado deseado
          console.log(`Intentando alternar favorito para película ${movie.id}. Estado actual: ${isCurrentlyFavorite}, Nuevo estado deseado: ${newFavoriteStatus}`);

          // Realizar la llamada a la API de toggle
          return this.peliculasService.toggleFavorite(accountId, movie.id, newFavoriteStatus).pipe(
            map(response => ({ response, newFavoriteStatus })), // Pasar la respuesta y el nuevo estado
            catchError(err => { // Manejo de errores específico para el toggleFavorite
              console.error(`Error al alternar favorito para ${movie.title}:`, err);
              // Podrías lanzar un error aquí para que el subscribe.error lo maneje
              return throwError(() => new Error(`No se pudo alternar el favorito: ${err.message || 'error desconocido'}`));
            })
          );
        })
      ).subscribe({
        next: ({ response, newFavoriteStatus }) => { // Desestructurar para obtener la respuesta y el nuevo estado
          console.log('Estado de favorito alternado con éxito:', response);

          // Emitir el evento con el ID de la película y el 'newFavoriteStatus' calculado
          this.toggleFavorite.emit({ movieId: movie.id, isCurrentlyFavorite: newFavoriteStatus });
        },
        error: (err) => {
          console.error('Error general en el proceso de toggleFavorite:', err.message || err);
          // Puedes mostrar una notificación al usuario aquí
          alert('Hubo un error al actualizar el estado de favorito. Por favor, inténtalo de nuevo.');
        }
      })
    );
  }

  isFavorite(movie: Movie): Observable<boolean> {
    // Este método llamará al servicio, que ahora solo observará el BehaviorSubject.
    return this.peliculasService.isMovieFavorite(movie.id);
  }
}
