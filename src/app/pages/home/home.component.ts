import { CommonModule } from '@angular/common';
import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { PeliculasService } from '../../services/peliculas.service';
import { Movie } from '../../interfaces/caretelera.interface';
import { SlideshowComponent } from '../../components/slideshow/slideshow.component';
import { PeliculasPosterComponent } from '../../components/peliculas-poster/peliculas-poster.component';
import { ActivatedRoute, Router } from '@angular/router';
import { filter, Subscription, take } from 'rxjs';
import { TmdbService } from '../../services/tmdb.service';
import { AuthService } from '../../services/auth.service';

@Component({
 selector: 'app-home',
 standalone: true,
 imports: [CommonModule, SlideshowComponent, PeliculasPosterComponent],
 templateUrl: './home.component.html',
 styleUrl: './home.component.css'
})
export class HomeComponent implements OnInit, OnDestroy {

 public movies: Movie[] = [];
 public moviesSlideshow: Movie[] = [];
 private carteleraSubscription?: Subscription;
 private tmdbAuthSubscription?: Subscription; // Para la suscripción de TMDB auth
 private loadedMoviesIds = new Set<number>();

 @HostListener('window:scroll', ['$event'])
 onScroll(): void {
  const pos = (document.documentElement.scrollTop || document.body.scrollTop) + 1300;
  const max = (document.documentElement.scrollHeight || document.body.scrollHeight);

  if (pos > max) {
   if (this.peliculasSvc.cargando) {
    return;
   }
   console.log('HomeComponent: Detectado scroll al final, intentando cargar próxima página.');
   this.loadMoreMovies();
  }
 }

 constructor(
  private peliculasSvc: PeliculasService,
  private activatedRoute: ActivatedRoute,
  private router: Router,
  private tmdbService: TmdbService,
  private authService: AuthService
 ) {
  this.peliculasSvc.resetPeliculaPage();
 }

 ngOnInit(): void {
  this.loadMovies();
    this.handleTmdbAuthCallback();
 }

 ngOnDestroy(): void {
  if (this.carteleraSubscription) {
   this.carteleraSubscription.unsubscribe();
  }
    if (this.tmdbAuthSubscription) {
      this.tmdbAuthSubscription.unsubscribe();
    }
  this.peliculasSvc.resetPeliculaPage();
 }

 loadMovies(): void {
  this.carteleraSubscription = this.peliculasSvc.getCartelera().subscribe(movies => {
   this.movies = movies;
   this.moviesSlideshow = movies.slice(0, 6);
   this.updateLoadedMovieIds();
   console.log('HomeComponent: Carga inicial de cartelera completada.');
  });
 }

 loadMoreMovies(): void {
  this.carteleraSubscription = this.peliculasSvc.getCartelera().subscribe(res => {
   const newMovies = res.filter(movie => !this.loadedMoviesIds.has(movie.id));
   this.movies.push(...newMovies);
   this.updateLoadedMovieIds();
   console.log(`HomeComponent: Añadidas ${newMovies.length} nuevas películas al scroll.`);
  });
 }

 updateLoadedMovieIds(): void {
  this.movies.forEach(movie => this.loadedMoviesIds.add(movie.id));
 }


  private handleTmdbAuthCallback(): void {

    this.tmdbAuthSubscription = this.activatedRoute.queryParams.pipe(
      take(1),

      filter(params => !!params['request_token'])
    ).subscribe(params => {
      const requestToken = params['request_token'];
      console.log('HomeComponent: TMDB request_token autorizado recibido:', requestToken);

      this.router.navigate([], {
        queryParams: {
          'request_token': null
        },
        queryParamsHandling: 'merge',
        replaceUrl: true
      });

      this.tmdbAuthSubscription = this.tmdbService.createSessionId(requestToken).subscribe({
        next: (response) => {
          console.log('HomeComponent: Session ID creado exitosamente por el backend PHP:', response);
         // this.authService.updateUserAndRole();
          console.log('HomeComponent: Estado de usuario de AuthService actualizado tras conexión TMDB.');
          // Puedes añadir una notificación al usuario aquí (ej. "Cuenta TMDB conectada con éxito")
        },
        error: (error) => {
          console.error('HomeComponent: Error al crear session ID en backend PHP:', error);
          // Puedes mostrar un mensaje de error al usuario
        }
      });
    });
  }
}
