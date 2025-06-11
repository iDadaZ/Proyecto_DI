import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

// Definiciones de interfaces para las respuestas de la API de TMDB
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
  private apiUrl = 'https://api.themoviedb.org/3';
  // *** INSERTA TU CLAVE DE API DE TMDB AQUÍ ***
  // Puedes obtener una clave de API registrándote en The Movie Database (TMDB)
  // en https://www.themoviedb.org/documentation/api/getting-started
  private apiKey = 'TU_API_KEY_DE_TMDB_AQUI'; // <-- ¡IMPORTANTE! Reemplaza esto con tu clave real

  constructor(private http: HttpClient) { }

  /**
   * Genera una URL base para las peticiones a la API de TMDB.
   * @param path El path de la API (ej. '/authentication/token/new').
   * @returns La URL completa con la API Key.
   */
  private getBaseUrl(path: string): string {
    return `${this.apiUrl}${path}?api_key=${this.apiKey}`;
  }

  /**
   * Obtiene un request token temporal de TMDB.
   * Este token es el primer paso en el proceso de autenticación de usuario.
   * @returns Observable con el request token.
   */
  getRequestToken(): Observable<RequestTokenResponse> {
    const url = this.getBaseUrl('/authentication/token/new');
    return this.http.get<RequestTokenResponse>(url);
  }

  /**
   * Construye la URL de autorización de TMDB a la que el usuario debe ser redirigido.
   * El usuario debe aprobar el acceso de tu aplicación a su cuenta de TMDB en esta URL.
   * @param requestToken El request token obtenido previamente.
   * @param redirectTo La URL en tu aplicación a la que TMDB debe redirigir después de la autorización.
   * @returns La URL completa para redirigir al usuario a la página de autorización de TMDB.
   */
  authTMDB(requestToken: string, redirectTo: string): string {
    return `https://www.themoviedb.org/authenticate/${requestToken}?redirect_to=${encodeURIComponent(redirectTo)}`;
  }

  /**
   * Crea un session ID a partir de un request token que ha sido aprobado por el usuario.
   * Este session ID permite a tu aplicación realizar acciones en nombre del usuario.
   * @param requestToken El request token aprobado por el usuario.
   * @returns Observable con el session ID.
   */
  createSessionId(requestToken: string): Observable<SessionIdResponse> {
    const url = this.getBaseUrl('/authentication/session/new');
    return this.http.post<SessionIdResponse>(url, { request_token: requestToken });
  }

  /**
   * Obtiene los detalles de la cuenta de TMDB del usuario autenticado.
   * Esto requiere un session ID válido.
   * @param sessionId El session ID obtenido previamente.
   * @returns Observable con los detalles de la cuenta del usuario.
   */
  getTmdbAccountDetails(sessionId: string): Observable<AccountDetailsResponse> {
    // La API Key ya se añade con getBaseUrl, solo necesitamos el session_id como query param adicional.
    const url = `${this.getBaseUrl('/account')}&session_id=${sessionId}`;
    return this.http.get<AccountDetailsResponse>(url);
  }
}
