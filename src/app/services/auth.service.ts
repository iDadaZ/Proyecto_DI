import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { User } from '../interfaces/usuario.interface';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { tap, catchError, map } from 'rxjs/operators';

// Nueva interfaz para la respuesta completa del backend de check-email
interface CheckEmailBackendResponse {
  ok: boolean;
  message?: string;
  data: {
    email_exists: boolean;
    is_enabled: boolean;
  };
  permises: any; // O el tipo correcto si conoces la estructura de 'permises'
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly USER_KEY = 'currentUser';
  private readonly JWT_TOKEN = 'jwtToken';
  private readonly API_MOVIES_KEY = 'apiMoviesKey';
  private readonly ACCOUNT_ID_KEY = 'accountId';
  private readonly TMDB_SESSION_ID_KEY = 'tmdbSessionId';
  private readonly PENDING_TMDB_REQUEST_TOKEN = 'pendingTmdbRequestToken';

  private userSubject: BehaviorSubject<User | null>;
  public currentUser: Observable<User | null>;

  // Asegúrate de que esta URL sea correcta. Si 'index.php' no es necesario, quítalo.
  // Basado en tu URL anterior: http://79.72.60.13/app.radfpd.es/api/peliculasApp
  private apiUrl = 'http://79.72.60.13/app.radfpd.es/api/peliculasApp'; // Eliminado /index.php si los endpoints están directamente bajo /api/peliculasApp

  constructor(private router: Router, private http: HttpClient) {
    const storedUser = localStorage.getItem(this.USER_KEY);
    this.userSubject = new BehaviorSubject<User | null>(storedUser ? JSON.parse(storedUser) : null);
    this.currentUser = this.userSubject.asObservable();
  }

  public get currentUserValue(): User | null {
    return this.userSubject.value;
  }

  private decodeJwtTokenPayload(token: string): any {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      return JSON.parse(jsonPayload);
    } catch (e) {
      console.error('Error decoding JWT token:', e);
      return null;
    }
  }

  login(email: string, password: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/login`, { email, password }).pipe(
      tap(response => {
        if (response && response.data && response.data.token) {
          const decodedToken = this.decodeJwtTokenPayload(response.data.token);
          if (decodedToken) {
            const user: User = {
              id_usuario: decodedToken.id_usuario,
              email: decodedToken.email,
              role: decodedToken.role || 'user',
              is_enabled: decodedToken.is_enabled || true,
              api_movies: localStorage.getItem(this.API_MOVIES_KEY) || '',
              account_id: localStorage.getItem(this.ACCOUNT_ID_KEY) || ''
            };
            localStorage.setItem(this.USER_KEY, JSON.stringify(user));
            localStorage.setItem(this.JWT_TOKEN, response.data.token);
            this.userSubject.next(user);
            this.router.navigate(['/menu']); // REDIRECCIÓN AL MENÚ
            console.log('Login exitoso. Token guardado y redirigiendo a /menu.');
          } else {
            console.error('AuthService: Login exitoso pero el token JWT no se pudo decodificar. Respuesta:', response);
            throw new Error('No se pudo decodificar el token de la respuesta de login.');
          }
        } else {
          console.error('AuthService: Login exitoso pero no se encontró el token en response.data.token. Respuesta:', response);
          throw new Error('No se pudo obtener el token de la respuesta de login.');
        }
      }),
      catchError((error: HttpErrorResponse | Error) => {
        console.error('Login failed:', error);
        let errorMessage = 'Error al iniciar sesión. Verifica tus credenciales.';

        if (error instanceof HttpErrorResponse) {
          if (error.status === 401) {
            errorMessage = 'Credenciales incorrectas. Vuelve a intentarlo.';
          } else if (error.error && error.error.message) {
            errorMessage = error.error.message;
          }
        } else if (error instanceof Error) {
          errorMessage = error.message;
        }

        return throwError(() => new Error(errorMessage));
      })
    );
  }

  /**
   * Verifica si un email está registrado en el sistema Y habilitado
   * mediante una llamada real al backend.
   * Ahora devuelve la estructura completa que el backend envía.
   * @param email El email a verificar.
   * @returns Un Observable que emite la estructura completa de CheckEmailBackendResponse.
   */
  checkEmail(email: string): Observable<CheckEmailBackendResponse> {
    // CAMBIO CLAVE AQUÍ: El tipo de retorno de http.post ahora es CheckEmailBackendResponse
    return this.http.post<CheckEmailBackendResponse>(`${this.apiUrl}/check-email`, { email }).pipe(
      tap(response => console.log('AuthService: Respuesta del backend a check-email:', response)), // Añadido para depuración
      catchError((error: HttpErrorResponse) => {
        console.error('Error al verificar el email con el backend:', error);
        // Si hay un error HTTP, lanzamos un error que el componente puede manejar.
        // El componente decidirá si mostrar un mensaje de error o no.
        const errorMessage = error.error?.message || 'Error de comunicación con el servidor. Inténtalo de nuevo.';
        return throwError(() => new Error(errorMessage)); // Lanzar el error para que el componente lo capture
      })
    );
  }

  logout(): void {
    localStorage.removeItem(this.USER_KEY);
    localStorage.removeItem(this.JWT_TOKEN);
    localStorage.removeItem(this.API_MOVIES_KEY);
    localStorage.removeItem(this.ACCOUNT_ID_KEY);
    localStorage.removeItem(this.TMDB_SESSION_ID_KEY);
    localStorage.removeItem(this.PENDING_TMDB_REQUEST_TOKEN);
    this.userSubject.next(null);
    this.router.navigate(['/login']);
  }

  isLoggedIn(): Observable<boolean> {
    return this.userSubject.asObservable().pipe(
      map(user => user !== null)
    );
  }

  getToken(): string | null {
    return localStorage.getItem(this.JWT_TOKEN);
  }

  hasRole(role: 'admin' | 'user'): boolean {
    const user = this.currentUserValue;
    return user !== null && user.role === role;
  }

  isUserAdmin(): Observable<boolean> {
    const user = this.currentUserValue;
    if (user && user.role === 'admin') {
      return of(true);
    }
    return of(false);
  }

  saveTmdbApiKey(apiKey: string): void {
    localStorage.setItem(this.API_MOVIES_KEY, apiKey);
    const user = this.currentUserValue;
    if (user) {
      const updatedUser: User = { ...user, api_movies: apiKey };
      localStorage.setItem(this.USER_KEY, JSON.stringify(updatedUser));
      this.userSubject.next(updatedUser);
    }
  }

  getTmdbApiKey(): string | null {
    return localStorage.getItem(this.API_MOVIES_KEY);
  }

  saveTmdbSessionDetails(sessionId: string, accountId: string): void {
    localStorage.setItem(this.TMDB_SESSION_ID_KEY, sessionId);
    localStorage.setItem(this.ACCOUNT_ID_KEY, accountId);

    const user = this.currentUserValue;
    if (user) {
      const updatedUser: User = { ...user, account_id: accountId };
      localStorage.setItem(this.USER_KEY, JSON.stringify(updatedUser));
      this.userSubject.next(updatedUser);
    }
  }

  getTmdbSessionId(): string | null {
    return localStorage.getItem(this.TMDB_SESSION_ID_KEY);
  }

  getTmdbAccountId(): string | null {
    return localStorage.getItem(this.ACCOUNT_ID_KEY);
  }

  setPendingTmdbRequestToken(requestToken: string): void {
    localStorage.setItem(this.PENDING_TMDB_REQUEST_TOKEN, requestToken);
  }

  getPendingTmdbRequestToken(): string | null {
    return localStorage.getItem(this.PENDING_TMDB_REQUEST_TOKEN);
  }

  clearPendingTmdbRequestToken(): void {
    localStorage.removeItem(this.PENDING_TMDB_REQUEST_TOKEN);
  }
}
