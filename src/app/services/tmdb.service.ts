import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, switchMap, map } from 'rxjs/operators';
import { AuthService } from './auth.service'; // ¡Importante: necesitamos AuthService para la API Key del usuario!

// Definiciones de interfaces para las respuestas de la API de TMDB (mantengo las tuyas, son correctas)
interface RequestTokenResponse {
  success: boolean;
  expires_at: string;
  request_token: string;
}

interface SessionIdResponse {
  success: boolean;
  session_id: string;
}

interface AccountDetailsResponse {
  avatar: {
    gravatar: {
      hash: string;
    };
    tmdb: {
      avatar_path: string | null;
    };
  };
  id: number; // El ID de la cuenta en TMDB es un número
  iso_639_1: string;
  iso_3166_1: string;
  name: string;
  include_adult: boolean;
  username: string;
}

@Injectable({
  providedIn: 'root'
})
export class TmdbService {
  private TMDB_API_URL = 'https://api.themoviedb.org/3';

  // Eliminado el 'apiKey' quemado aquí. Ahora se obtiene de AuthService.
  // private apiKey = 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI0Nzhm...';

  constructor(private http: HttpClient, private authService: AuthService) { }

  // Método para obtener la API Key de TMDB del usuario actual a través de AuthService
  getTmdbApiKeyForUser(): string | null {
    return this.authService.getTmdbApiKey(); // ¡Aquí obtenemos la API Key del usuario!
  }

  /**
   * Genera una URL base para las peticiones a la API de TMDB.
   * @param path El path de la API (ej. '/authentication/token/new').
   * @returns La URL completa con la API Key.
   */
  // Este método ya no es necesario si siempre se pasa la API Key explícitamente,
  // pero lo mantengo si lo usas en otros lugares con tu API Key principal.
  // Sin embargo, las llamadas que usen la API Key del usuario NO deberían usar este método.
  private getBaseUrl(path: string, apiKey: string): string {
    return `${this.TMDB_API_URL}${path}?api_key=${apiKey}`;
  }


  /**
   * Obtiene un request token temporal de TMDB.
   * Este token es el primer paso en el proceso de autenticación de usuario.
   * @returns Observable con el request token.
   */
  getRequestToken(): Observable<RequestTokenResponse> {
    const apiKey = this.getTmdbApiKeyForUser();
    if (!apiKey) {
      return throwError(() => new Error('TMDB API Key no disponible para obtener request token. Asegúrate de que el usuario la tiene configurada.'));
    }

    const params = new HttpParams().set('api_key', apiKey);
    return this.http.get<RequestTokenResponse>(`${this.TMDB_API_URL}/authentication/token/new`, { params }).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Construye la URL de autorización de TMDB a la que el usuario debe ser redirigido.
   * @param requestToken El request token obtenido previamente.
   * @param redirectTo La URL en tu aplicación a la que TMDB debe redirigir después de la autorización.
   * @returns La URL completa para redirigir al usuario a la página de autorización de TMDB.
   */
  authTMDB(requestToken: string, redirectTo: string): string {
    return `https://www.themoviedb.org/authenticate/${requestToken}?redirect_to=${encodeURIComponent(redirectTo)}`;
  }

  /**
   * Crea un session ID a partir de un request token que ha sido aprobado por el usuario.
   * También obtiene los detalles de la cuenta TMDB para obtener el account_id.
   * @param requestToken El request token aprobado por el usuario.
   */
  createSessionId(requestToken: string): Observable<{ success: boolean; session_id: string; account_id: string | null; username: string | null }> {
    const apiKey = this.getTmdbApiKeyForUser();
    if (!apiKey) {
      return throwError(() => new Error('TMDB API Key no disponible para crear sesión.'));
    }

    const params = new HttpParams().set('api_key', apiKey);
    const body = { request_token: requestToken };

    return this.http.post<SessionIdResponse>(`${this.TMDB_API_URL}/authentication/session/new`, body, { params }).pipe(
      switchMap(sessionResponse => {
        if (sessionResponse && sessionResponse.success && sessionResponse.session_id) {
          const sessionId = sessionResponse.session_id;
          return this.getTmdbAccountDetails(sessionId).pipe(
            map(accountDetails => ({
              success: true,
              session_id: sessionId,
              account_id: accountDetails.id ? String(accountDetails.id) : null, // Convertir a string
              username: accountDetails.username || null // Asegurarse de que sea string o null
            }))
          );
        } else {
          return throwError(() => new Error('No se pudo crear la sesión de TMDB.'));
        }
      }),
      catchError(this.handleError)
    );
  }

  /**
   * Obtiene los detalles de la cuenta TMDB del usuario.
   * @param sessionId La session_id de TMDB.
   */
  getTmdbAccountDetails(sessionId: string): Observable<AccountDetailsResponse> {
    const apiKey = this.getTmdbApiKeyForUser();
    if (!apiKey) {
      return throwError(() => new Error('TMDB API Key no disponible para obtener detalles de cuenta.'));
    }

    const params = new HttpParams()
      .set('api_key', apiKey)
      .set('session_id', sessionId);

    return this.http.get<AccountDetailsResponse>(`${this.TMDB_API_URL}/account`, { params }).pipe(
      catchError(this.handleError)
    );
  }

  private handleError(error: any): Observable<never> {
    console.error('Error en TmdbService:', error);
    let errorMessage = 'Error desconocido al interactuar con TMDB.';
    if (error.error instanceof ErrorEvent) {
      errorMessage = `Error del cliente: ${error.error.message}`;
    } else if (error.error && error.error.status_message) {
      errorMessage = `TMDB Error ${error.error.status_code}: ${error.error.status_message}`;
    } else {
      errorMessage = `Código de error: ${error.status || 'desconocido'}, Mensaje: ${error.message || 'desconocido'}`;
    }
    return throwError(() => new Error(errorMessage));
  }
}
