// src/app/services/auth.service.ts
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { User } from '../interfaces/usuario.interface'; // Asegúrate de que esta interfaz se actualice
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { tap, catchError, map } from 'rxjs/operators';

interface CheckEmailBackendResponse {
  ok: boolean;
  message?: string;
  data: {
    email_exists: boolean;
    is_enabled: boolean;
  };
  permises: any; // Mantengo tu nombre si es un typo
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly USER_KEY = 'currentUser';
  private readonly JWT_TOKEN = 'jwtToken';
  // Claves de localStorage para los detalles de TMDB (pueden ser redundantes si siempre se guardan en USER_KEY)
  private readonly TMDB_API_KEY_LOCAL_STORAGE = 'tmdbApiKey'; // Clave para la API Key de TMDB en localStorage
  private readonly TMDB_ACCOUNT_ID_KEY = 'tmdbAccountId'; // ID de la cuenta TMDB del usuario en localStorage
  private readonly TMDB_SESSION_ID_KEY = 'tmdbSessionId'; // Session ID de TMDB del usuario en localStorage
  private readonly PENDING_TMDB_REQUEST_TOKEN_KEY = 'pendingTmdbRequestToken'; // Request token temporal

  private userSubject: BehaviorSubject<User | undefined>; // Cambiado a undefined para que el valor inicial sea claro
  public currentUser: Observable<User | undefined>; // Cambiado a undefined

  // Asegúrate de que esta URL es la correcta para tu backend de autenticación
  private apiUrl = 'http://79.72.60.13/app.radfpd.es/api/peliculasApp/index.php';

  constructor(private router: Router, private http: HttpClient) {
    // Al iniciar el servicio, carga el usuario desde localStorage
    const storedUserJson = localStorage.getItem(this.USER_KEY);
    let initialUser: User | undefined = undefined;

    if (storedUserJson) {
      try {
        const parsedUser: User = JSON.parse(storedUserJson);

        // Asegúrate de que los detalles de TMDB se cargan correctamente si existen en localStorage
        // y no están ya en el objeto de usuario (esto es por si el JWT no los incluyó)
        parsedUser.tmdb_session_id = parsedUser.tmdb_session_id || localStorage.getItem(this.TMDB_SESSION_ID_KEY) || null;
        parsedUser.account_id = parsedUser.account_id || localStorage.getItem(this.TMDB_ACCOUNT_ID_KEY) || null;
        parsedUser.api_movies = parsedUser.api_movies || localStorage.getItem(this.TMDB_API_KEY_LOCAL_STORAGE) || null;

        initialUser = parsedUser;
        console.log('AuthService: Usuario cargado desde localStorage.', initialUser);
      } catch (e) {
        console.error('AuthService: Error al parsear usuario desde localStorage:', e);
        this.logout(); // Limpiar datos corruptos
      }
    }
    this.userSubject = new BehaviorSubject<User | undefined>(initialUser);
    this.currentUser = this.userSubject.asObservable();
  }

  public get currentUserValue(): User | undefined {
    return this.userSubject.getValue();
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
            // Construye el objeto User. Prioriza lo que viene del JWT.
            const user: User = {
              id_usuario: decodedToken.id_usuario, // ¡REVERTIDO! Usa id_usuario como number
              email: decodedToken.email,
              role: decodedToken.role || 'user',
              is_enabled: decodedToken.is_enabled !== undefined ? decodedToken.is_enabled : true,
              api_movies: decodedToken.api_movies || localStorage.getItem(this.TMDB_API_KEY_LOCAL_STORAGE) || null,
              account_id: decodedToken.account_id || localStorage.getItem(this.TMDB_ACCOUNT_ID_KEY) || null,
              tmdb_session_id: decodedToken.tmdb_session_id || localStorage.getItem(this.TMDB_SESSION_ID_KEY) || null
            };

            localStorage.setItem(this.JWT_TOKEN, response.data.token);
            localStorage.setItem(this.USER_KEY, JSON.stringify(user));

            if (user.api_movies) localStorage.setItem(this.TMDB_API_KEY_LOCAL_STORAGE, user.api_movies);
            if (user.account_id) localStorage.setItem(this.TMDB_ACCOUNT_ID_KEY, user.account_id);
            if (user.tmdb_session_id) localStorage.setItem(this.TMDB_SESSION_ID_KEY, user.tmdb_session_id);

            this.userSubject.next(user);
            console.log('AuthService: Login exitoso. Token y usuario guardados. Redirigiendo a /menu.');
            this.router.navigate(['/menu']);
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

  checkEmail(email: string): Observable<CheckEmailBackendResponse> {
    return this.http.post<CheckEmailBackendResponse>(`${this.apiUrl}/check-email`, { email }).pipe(
      tap(response => console.log('AuthService: Respuesta del backend a check-email:', response)),
      catchError((error: HttpErrorResponse) => {
        console.error('Error al verificar el email con el backend:', error);
        const errorMessage = error.error?.message || 'Error de comunicación con el servidor. Inténtalo de nuevo.';
        return throwError(() => new Error(errorMessage));
      })
    );
  }

  logout(): void {
    localStorage.removeItem(this.USER_KEY);
    localStorage.removeItem(this.JWT_TOKEN);
    localStorage.removeItem(this.TMDB_API_KEY_LOCAL_STORAGE);
    localStorage.removeItem(this.TMDB_ACCOUNT_ID_KEY);
    localStorage.removeItem(this.TMDB_SESSION_ID_KEY);
    localStorage.removeItem(this.PENDING_TMDB_REQUEST_TOKEN_KEY);
    this.userSubject.next(undefined);
    this.router.navigate(['/login']);
    console.log('AuthService: Sesión cerrada y localStorage limpiado.');
  }

  isLoggedIn(): Observable<boolean> {
    return this.userSubject.asObservable().pipe(
      map(user => user !== undefined && !!this.getToken())
    );
  }

  getToken(): string | null {
    return localStorage.getItem(this.JWT_TOKEN);
  }

  hasRole(role: 'admin' | 'user'): boolean {
    const user = this.currentUserValue;
    return user !== undefined && user.role === role;
  }

  isUserAdmin(): Observable<boolean> {
    return this.currentUser.pipe(
      map(user => user ? user.role === 'admin' : false)
    );
  }

  saveTmdbApiKey(apiKey: string): void {
    const user = this.currentUserValue;
    if (user) {
      const updatedUser: User = { ...user, api_movies: apiKey };
      localStorage.setItem(this.USER_KEY, JSON.stringify(updatedUser));
      localStorage.setItem(this.TMDB_API_KEY_LOCAL_STORAGE, apiKey);
      this.userSubject.next(updatedUser);
      console.log('AuthService: TMDB API Key guardada y userSubject actualizado.');
    } else {
        localStorage.setItem(this.TMDB_API_KEY_LOCAL_STORAGE, apiKey);
        console.warn('AuthService: API Key de TMDB guardada en localStorage, pero no hay usuario logueado en userSubject.');
    }
  }

  getTmdbApiKey(): string | null {
    const user = this.currentUserValue;
    return user?.api_movies || localStorage.getItem(this.TMDB_API_KEY_LOCAL_STORAGE) || null;
  }

  saveTmdbSessionDetails(sessionId: string, accountId: string): void {
    console.log('AuthService: Intentando guardar detalles de sesión TMDB:', { sessionId, accountId });
    localStorage.setItem(this.TMDB_SESSION_ID_KEY, sessionId);
    localStorage.setItem(this.TMDB_ACCOUNT_ID_KEY, accountId);

    const user = this.currentUserValue;
    if (user) {
      const updatedUser: User = {
        ...user,
        account_id: accountId,
        tmdb_session_id: sessionId
      };
      localStorage.setItem(this.USER_KEY, JSON.stringify(updatedUser));
      this.userSubject.next(updatedUser);
      console.log('AuthService: Objeto de usuario actualizado con IDs de sesión y cuenta de TMDB:', updatedUser);
    } else {
        console.warn('AuthService: saveTmdbSessionDetails llamado pero no hay usuario logueado en userSubject.');
    }
    console.log('AuthService: IDs de sesión y cuenta de TMDB guardados en localStorage.');
  }

  clearTmdbSessionDetails(): void {
    localStorage.removeItem(this.TMDB_SESSION_ID_KEY);
    localStorage.removeItem(this.TMDB_ACCOUNT_ID_KEY);

    const currentUser = this.userSubject.getValue();
    if (currentUser) {
      const updatedUser: User = {
        ...currentUser,
        tmdb_session_id: null,
        account_id: null
      };
      localStorage.setItem(this.USER_KEY, JSON.stringify(updatedUser));
      this.userSubject.next(updatedUser);
      console.log('AuthService: Detalles de la sesión TMDB limpiados del usuario.');
    }
  }

  getTmdbSessionId(): string | null {
    const user = this.currentUserValue;
    return user?.tmdb_session_id || localStorage.getItem(this.TMDB_SESSION_ID_KEY) || null;
  }

  getTmdbAccountId(): string | null {
    const user = this.currentUserValue;
    return user?.account_id || localStorage.getItem(this.TMDB_ACCOUNT_ID_KEY) || null;
  }

  setPendingTmdbRequestToken(requestToken: string): void {
    localStorage.setItem(this.PENDING_TMDB_REQUEST_TOKEN_KEY, requestToken);
  }

  getPendingTmdbRequestToken(): string | null {
    return localStorage.getItem(this.PENDING_TMDB_REQUEST_TOKEN_KEY);
  }

  clearPendingTmdbRequestToken(): void {
    localStorage.removeItem(this.PENDING_TMDB_REQUEST_TOKEN_KEY);
  }
}
