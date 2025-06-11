import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'noImage',
  standalone: true
})
export class NoImagePipe implements PipeTransform {

  // URL de la imagen por defecto que se mostrará si no hay un póster de película disponible.
  // Puedes cambiar esta URL por una imagen local en tu proyecto (ej: 'assets/img/no-image.jpg')

  private defaultImageUrl: string = 'https://via.placeholder.com/150x225?text=No+Image'; // Ejemplo de imagen por defecto


  transform(img: string | null): string {
    // Verifica si la URL de la imagen es nula, indefinida, una cadena vacía,
    // o si es una URL de TMDB que indica una imagen faltante (como "/null" o "/undefined").
    if (!img || img.length === 0 || img === '/null' || img === '/undefined') {
      return this.defaultImageUrl; // Si no hay imagen válida, devuelve la URL de la imagen por defecto.
    }
    // Si hay una URL de imagen válida, construye la URL completa de TMDB para el póster.
    // 'https://image.tmdb.org/t/p/w500' es el tamaño de póster común.

    return `https://image.tmdb.org/t/p/w500${img}`;
  }

}
