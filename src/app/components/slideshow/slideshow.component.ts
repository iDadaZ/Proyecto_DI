import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, Input, OnChanges, OnDestroy, OnInit, SimpleChanges } from '@angular/core'; // Añadir OnChanges, OnDestroy
import { Router } from '@angular/router';
import Swiper from 'swiper';
import { Movie } from '../../interfaces/caretelera.interface';
import { PipesModule } from "../../pipes/pipes.module";

@Component({
 selector: 'app-slideshow',
 standalone: true,
 imports: [CommonModule, PipesModule],
 templateUrl: './slideshow.component.html', // Asumo que este es el HTML del slideshow de películas
 styleUrl: './slideshow.component.css'
})
export class SlideshowComponent implements OnInit, AfterViewInit, OnDestroy, OnChanges { // Implementar OnChanges, OnDestroy

 @Input() movies: Movie[] = []; // Cambiado a 'movies' para que sea el slideshow de películas

 mySwiper?: Swiper;

 constructor(private router: Router) {}

 ngOnInit(): void {
  // console.log(this.movies);
 }

 ngOnChanges(changes: SimpleChanges): void {
  // Si las películas cambian y Swiper ya está inicializado, actualiza Swiper
  if (changes['movies'] && this.mySwiper && this.movies.length > 0) {
   this.mySwiper.destroy(true, true); // Destruye la instancia anterior
   this.initializeSwiper(); // Y la vuelve a inicializar
  }
 }

 ngAfterViewInit(): void {
  // Retrasar la inicialización de Swiper para asegurar que los elementos del DOM estén disponibles
  setTimeout(() => {
   this.initializeSwiper();
  }, 0);
 }

 private initializeSwiper(): void {
  if (this.movies && this.movies.length > 0) {
   this.mySwiper = new Swiper('.swiper', {
    loop: true,
    slidesPerView: 2, // Ajusta según necesites
    spaceBetween: 10,
    autoplay: {
     delay: 3000,
     disableOnInteraction: false,
    },
    navigation: {
     nextEl: '.swiper-button-next',
     prevEl: '.swiper-button-prev',
    },
    pagination: {
     el: '.swiper-pagination',
     clickable: true,
    },
   });
  }
 }

 ngOnDestroy(): void {
  if (this.mySwiper) {
   this.mySwiper.destroy(); // Destruye la instancia de Swiper al destruir el componente
  }
 }

 onSlidePrev(): void {
  this.mySwiper?.slidePrev();
 }

 onSlideNext(): void {
  this.mySwiper?.slideNext();
 }

 onMovieClick(movie: Movie): void {
  this.router.navigate(['/pelicula', movie.id]);
 }
}
