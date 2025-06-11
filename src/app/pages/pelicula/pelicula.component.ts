import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router'; // Asegúrate de importar Router
import { PeliculasService } from '../../services/peliculas.service';
import { CommonModule } from '@angular/common';
import { MovieDetails } from '../../interfaces/details.interface';
import { combineLatest } from 'rxjs';
import { Cast } from '../../interfaces/credits.interface';
import { PipesModule } from '../../pipes/pipes.module';
import { CastSlideShowComponent } from '../../components/cast-slide-show/cast-slide-show.component';

@Component({
  selector: 'app-pelicula',
  standalone: true,
  imports: [CommonModule, PipesModule, CastSlideShowComponent ],
  templateUrl: './pelicula.component.html',
  styleUrl: './pelicula.component.css'
})
export class PeliculaComponent implements OnInit {

  pelicula?: MovieDetails; // Puede ser undefined si la película no se encuentra
  cast: Cast[] = []; // Inicializado como array vacío

  constructor(
    private activatedRoute: ActivatedRoute,
    private peliculasSvc: PeliculasService,
    private router: Router // Inyecta Router para la navegación programática en regresar()
  ) {}

  ngOnInit() {
    const { id } = this.activatedRoute.snapshot.params;

    // Si no hay ID, o el ID es 'undefined' (posiblemente un error de ruta), redirige o maneja.
    if (!id) {
      console.error('ID de película no encontrado en la ruta.');
      this.router.navigateByUrl('/home'); // Redirige a la página de inicio si no hay ID
      return;
    }

    combineLatest([
      this.peliculasSvc.getPeliculaDetalle(id), // Obtiene los detalles de la película
      this.peliculasSvc.getCredits(id)          // Obtiene los créditos de la película
    ]).subscribe(([movie, castResponse]) => { // `movie` es MovieDetails | null, `castResponse` es Credits | null

      if (movie === null) {
        // Si la película no se encuentra (o el servicio devuelve null),
        // registramos el error y redirigimos.
        console.error('Error: La película no se encontró o hubo un problema al obtenerla.');
        this.router.navigateByUrl('/home'); // Redirige a la página de inicio
        return; // Detener la ejecución
      }

      // Asigna los detalles de la película si no es null
      this.pelicula = movie;

      // <--- CORRECCIÓN CLAVE AQUÍ: Manejar `castResponse` que puede ser null
      if (castResponse === null) {
        console.warn('Advertencia: El reparto de la película no se encontró o hubo un problema al obtenerlo.');
        this.cast = []; // Asigna un array vacío si `castResponse` es null
      } else {
        this.cast = castResponse.cast || []; // Accede a la propiedad 'cast' o usa un array vacío como fallback
      }

    }, error => {
      // Manejo de errores para cualquier fallo en el combineLatest
      console.error('Error al obtener detalles o créditos de la película:', error);
      this.router.navigateByUrl('/home'); // Redirige en caso de cualquier error en la suscripción
    });
  }

  getStars(voteAverage: number): number[] {
    // Ajusta la lógica si tus estrellas deben ser de 0-5 en lugar de 0-10.
    // TMDB vote_average es de 0-10, si quieres 5 estrellas, divide por 2.
    const starsCount = Math.floor(voteAverage / 2); // Divide por 2 para escalar a 5 estrellas
    return Array(starsCount).fill(0);
  }

  regresar(): void {
    // Permite al usuario volver a la página anterior en el historial del navegador.
    // Alternativamente, podrías usar `this.router.navigateByUrl('/home');` para ir siempre a la página de inicio.
    window.history.back();
  }

}
