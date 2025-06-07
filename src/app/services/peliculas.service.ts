import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, catchError, map, of, tap } from 'rxjs';
import { CarteleraResponse, Movie } from '../interfaces/caretelera.interface';
import { MovieDetails } from '../interfaces/details.interface';
import { Cast, Credits } from '../interfaces/credits.interface';

@Injectable({
  providedIn: 'root'
})
export class PeliculasService {

  private URL='https://api.themoviedb.org/3';
  private apiKey = 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI0NzhmMTcxNjNmNzdjNWI0YzdhMTgzNGUwNGYyZWE0NyIsIm5iZiI6MTczOTQ1OTg5Ny4xNzQsInN1YiI6IjY3YWUwZDM5NDE0ODNkZDVjY2QwY2MwNiIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.9CdJc2SouQGy0J7O8QShxgGRgt9seBxJrJmDnsWFimA';
  private headers={Authorization:`Bearer ${this.apiKey}`};
  private cartelePage = 1;
  public cargando = false;

  constructor(private http:HttpClient) { }


  getCartelera():Observable<Movie[]>{

    if (this.cargando) {
      return of([]);
    }

    this.cargando=true;

    return this.http.get<CarteleraResponse>(`${this.URL}/movie/now_playing?language=es-ES&page=${this.cartelePage}`,{headers:this.headers}).pipe(
      map((response:any)=> response.results),

      tap(()=>{
        this.cartelePage+=1;
        this.cargando=false;
      })
    )

  }

  buscarPeliculas(texto:string):Observable<Movie[]>{


    return this.http.get<CarteleraResponse>(`${this.URL}/search/movie?query=${texto}&language=es-ES&page=1`,{headers:this.headers}).pipe(

      map(res=>res.results)

    )

  }

  peliculaDetalle(id:string){

    return this.http.get<MovieDetails>(`${this.URL}/movie/${id}?language=es-ES`,{headers:this.headers}).pipe(

      catchError(err=> of(null))



    )

  }

  peliculaCreditos(id:string):Observable<Cast[] | null>{

    return this.http.get<Credits>(`${this.URL}/movie/${id}/credits?language=es-ES`,{headers:this.headers}).pipe(

      map(res=>res.cast),
      catchError(err=> of(null))
      )




  }


  resetPeliculaPage(){

    this.cartelePage = 1;

  }


}
