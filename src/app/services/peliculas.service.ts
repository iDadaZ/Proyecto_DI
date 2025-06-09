import { HttpClient, HttpParams } from '@angular/common/http'; // Importamos HttpParams
import { Injectable } from '@angular/core';
import { Observable, catchError, map, of, tap } from 'rxjs';
import { CarteleraResponse, Movie } from '../interfaces/caretelera.interface';
import { MovieDetails } from '../interfaces/details.interface';
import { Cast, Credits } from '../interfaces/credits.interface';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class PeliculasService {

  private URL='https://api.themoviedb.org/3';
  private apiKey = '478f17163f77c5b4c7a1834e04f2ea47';

  private cartelePage = 1;
  public cargando = false;

  constructor(private http:HttpClient, AuthService: AuthService) { }

  // Método auxiliar para construir los parámetros HTTP base (api_key y language).
  private getBaseHttpParams(): HttpParams {
    if (!this.apiKey || this.apiKey.length === 0) {
      console.error('PeliculasService: La API Key de TMDB no está configurada.');
      throw new Error('API Key de TMDB no configurada.');
    }
    return new HttpParams()
      .set('api_key', this.apiKey)
      .set('language', 'es-ES');
  }

  getCartelera():Observable<Movie[]>{

    if (this.cargando) {
      return of([]);
    }

    this.cargando=true;


    const params = new HttpParams()
      .set('api_key', this.apiKey)
      .set('language', 'es-ES')
      .set('page', this.cartelePage.toString());


    return this.http.get<CarteleraResponse>(`${this.URL}/movie/now_playing`, { params }).pipe(
      map((response:any)=> response.results),
      tap(()=>{
        this.cartelePage+=1;
        this.cargando=false;
      }),
      catchError(err => {
        console.error('Error en getCartelera:', err);
        this.cargando = false;
        return of([]);
      })
    )
  }

  buscarPeliculas(texto:string):Observable<Movie[]>{
    const params = new HttpParams()
      .set('api_key', this.apiKey)
      .set('language', 'es-ES')
      .set('query', texto)
      .set('page', '1');

    return this.http.get<CarteleraResponse>(`${this.URL}/search/movie`, { params }).pipe(
      map(res=>res.results),
      catchError(err => {
        console.error('Error en buscarPeliculas:', err);
        return of([]);
      })
    )
  }

  peliculaDetalle(id:string){
    const params = new HttpParams()
      .set('api_key', this.apiKey)
      .set('language', 'es-ES');


    return this.http.get<MovieDetails>(`${this.URL}/movie/${id}`, { params }).pipe(
      catchError(err=> {
        console.error('Error en peliculaDetalle:', err);
        return of(null);
      })
    )
  }

  peliculaCreditos(id:string):Observable<Cast[] | null>{
    const params = new HttpParams()
      .set('api_key', this.apiKey)
      .set('language', 'es-ES');


    return this.http.get<Credits>(`${this.URL}/movie/${id}/credits`, { params }).pipe(
      map(res=>res.cast),
      catchError(err=> {
        console.error('Error en peliculaCreditos:', err);
        return of(null);
      })
    )
  }

  resetPeliculaPage(){
    this.cartelePage = 1;
  }
}
