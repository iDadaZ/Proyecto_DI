import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Movie } from '../../interfaces/caretelera.interface';
import { NoImagePipe } from '../../pipes/no-image.pipe';
import { PipesModule } from "../../pipes/pipes.module";

import { AuthService } from '../../services/auth.service';
import { PeliculasService } from '../../services/peliculas.service';
import { Observable, Subscription, switchMap, take } from 'rxjs';
import { User } from '../../interfaces/usuario.interface';

@Component({
 selector: 'app-peliculas-poster',
 standalone: true,
 imports: [CommonModule, RouterLink, NoImagePipe, PipesModule],
 templateUrl: './peliculas-poster.component.html',
 styleUrl: './peliculas-poster.component.css'
})
export class PeliculasPosterComponent implements OnInit, OnDestroy {

 @Input() movies: Movie[] = [];
 @Output() toggleFavorite = new EventEmitter<Movie>();

 isLoggedIn: Observable<boolean>;
 isUserAdmin: Observable<boolean>;
 currentUser: Observable<User | null>;

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

 ngOnInit(): void { }

 ngOnDestroy(): void {
  this.subscriptions.unsubscribe();
 }

 onMovieClick(movie: Movie): void {
  this.router.navigate(['/pelicula', movie.id]);
 }

 getStars(voteAverage: number): number[] {
  const starsCount = Math.floor(voteAverage);
  return Array(starsCount).fill(0);
 }

 onToggleFavorite(movie: Movie, event: Event): void {
  event.stopPropagation();

  const currentUser = this.authService.currentUserValue;
  if (!currentUser || !currentUser.account_id) {
   console.error('Error: No se puede alternar favorito. Usuario no logueado o sin account_id.');
   return;
  }
  const accountId = currentUser.account_id;

  this.subscriptions.add(
   this.isFavorite(movie).pipe(
    take(1),
    switchMap(isCurrentlyFavorite => {
     const newFavoriteStatus = !isCurrentlyFavorite;
     console.log(`Intentando alternar favorito para película ${movie.id}. Estado actual: ${isCurrentlyFavorite}, Nuevo estado deseado: ${newFavoriteStatus}`);
     return this.peliculasService.toggleFavorite(accountId, movie.id, newFavoriteStatus);
    })
   ).subscribe({
    next: (response) => {
     console.log('Estado de favorito alternado con éxito:', response);
     this.toggleFavorite.emit(movie);
    },
    error: (err) => {
     console.error('Error al alternar favorito:', err);
    }
   })
  );
 }

 isFavorite(movie: Movie): Observable<boolean> {
    // Este método llamará al servicio, que ahora solo observará el BehaviorSubject.
  return this.peliculasService.isMovieFavorite(movie.id);
 }
}
