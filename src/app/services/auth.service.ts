// src/app/services/auth.service.ts
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { User } from '../interfaces/usuario.interface';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { tap, catchError, map } from 'rxjs/operators';

interface CheckEmailBackendResponse {
  ok: boolean;
  message?: string;
  data: {
    email_exists: boolean;
    is_enabled: boolean;
  };
  permises: any; // Mantengo tu nombre
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly USER_KEY = 'currentUser';
  private readonly JWT_TOKEN = 'jwtToken'; // JWT de tu backend

  // Claves de localStorage para los detalles de TMDB (por consistencia y persistencia)
  private readonly TMDB_API_MOVIES_KEY_LOCAL_STORAGE = 'tmdbApiMovies'; // Guarda la API Key V4 aquí
  private readonly TMDB_ACCOUNT_ID_KEY_LOCAL_STORAGE = 'tmdbAccountId'; // Guarda la API Key V3 aquí
  private readonly TMDB_SESSION_ID_KEY_LOCAL_STORAGE = 'tmdbSessionId'; // Guarda el Session ID de TMDB aquí
  private readonly PENDING_TMDB_REQUEST_TOKEN_KEY = 'pendingTmdbRequestToken';
  private readonly TMDB_V4_READ_ACCESS_TOKEN_LOCAL_STORAGE = 'tmdbV4ReadAccessToken'; // Nuevo para el campo explícito
  private readonly TMDB_USER_ACCOUNT_ID_LOCAL_STORAGE = 'tmdbUserAccountId'; // NUEVO para el ID de cuenta REAL de TMDB

  private userSubject: BehaviorSubject<User | undefined>;
  public currentUser: Observable<User | undefined>;

  private apiUrl = 'http://79.72.60.13/app.radfpd.es/api/peliculasApp/index.php';

  constructor(private router: Router, private http: HttpClient) {
    const storedUserJson = localStorage.getItem(this.USER_KEY);
    let initialUser: User | undefined = undefined;

    if (storedUserJson) {
      try {
        const parsedUser: User = JSON.parse(storedUserJson);

        // Asegúrate de que los detalles de TMDB se cargan correctamente desde localStorage
        parsedUser.api_movies = parsedUser.api_movies || localStorage.getItem(this.TMDB_API_MOVIES_KEY_LOCAL_STORAGE) || null;
        parsedUser.account_id = parsedUser.account_id || localStorage.getItem(this.TMDB_ACCOUNT_ID_KEY_LOCAL_STORAGE) || null; // La V3 Key
        parsedUser.tmdb_session_id = parsedUser.tmdb_session_id || localStorage.getItem(this.TMDB_SESSION_ID_KEY_LOCAL_STORAGE) || null;
        parsedUser.tmdb_v4_read_access_token = parsedUser.tmdb_v4_read_access_token || localStorage.getItem(this.TMDB_V4_READ_ACCESS_TOKEN_LOCAL_STORAGE) || null;
        parsedUser.tmdb_user_account_id = parsedUser.tmdb_user_account_id || localStorage.getItem(this.TMDB_USER_ACCOUNT_ID_LOCAL_STORAGE) || null; // NUEVO CAMPO

        initialUser = parsedUser;
        console.log('AuthService: Usuario cargado desde localStorage.', initialUser);
      } catch (e) {
        console.error('AuthService: Error al parsear usuario desde localStorage:', e);
        this.logout();
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
            let user: User = {
              id_usuario: decodedToken.id_usuario,
              email: decodedToken.email,
              role: decodedToken.role || 'user',
              is_enabled: decodedToken.is_enabled !== undefined ? decodedToken.is_enabled : true,
              api_movies: null, // Se poblará con la V4 token
              account_id: null, // Se poblará con la V3 key
              tmdb_session_id: null,
              tmdb_v4_read_access_token: null, // Nuevo campo
              tmdb_user_account_id: null // NUEVO CAMPO
            };

            // **Mapeo CLAVE según tu backend:**
            // `decodedToken.api_movies` es tu API Key V4 (JWT largo)
            if (decodedToken.api_movies) {
              user.api_movies = decodedToken.api_movies;
              user.tmdb_v4_read_access_token = decodedToken.api_movies; // Mapeo al nuevo campo también
            }

            // `decodedToken.account_id` es tu API Key V3 (alfanumérica corta)
            if (decodedToken.account_id) {
              user.account_id = decodedToken.account_id;
            }

            // Cargar también desde localStorage si no vienen en el JWT (fallback/persistencia)
            user.api_movies = user.api_movies || localStorage.getItem(this.TMDB_API_MOVIES_KEY_LOCAL_STORAGE) || null;
            user.account_id = user.account_id || localStorage.getItem(this.TMDB_ACCOUNT_ID_KEY_LOCAL_STORAGE) || null; // V3 Key
            user.tmdb_session_id = user.tmdb_session_id || localStorage.getItem(this.TMDB_SESSION_ID_KEY_LOCAL_STORAGE) || null;
            user.tmdb_v4_read_access_token = user.tmdb_v4_read_access_token || localStorage.getItem(this.TMDB_V4_READ_ACCESS_TOKEN_LOCAL_STORAGE) || null;
            user.tmdb_user_account_id = localStorage.getItem(this.TMDB_USER_ACCOUNT_ID_LOCAL_STORAGE) || null;

            localStorage.setItem(this.JWT_TOKEN, response.data.token);
            localStorage.setItem(this.USER_KEY, JSON.stringify(user));

            // Persiste las claves/IDs de TMDB en localStorage con sus nombres correctos
            if (user.api_movies) localStorage.setItem(this.TMDB_API_MOVIES_KEY_LOCAL_STORAGE, user.api_movies);
            if (user.account_id) localStorage.setItem(this.TMDB_ACCOUNT_ID_KEY_LOCAL_STORAGE, user.account_id); // V3 Key
            if (user.tmdb_session_id) localStorage.setItem(this.TMDB_SESSION_ID_KEY_LOCAL_STORAGE, user.tmdb_session_id);
            if (user.tmdb_v4_read_access_token) localStorage.setItem(this.TMDB_V4_READ_ACCESS_TOKEN_LOCAL_STORAGE, user.tmdb_v4_read_access_token);
            if (user.tmdb_user_account_id) localStorage.setItem(this.TMDB_USER_ACCOUNT_ID_LOCAL_STORAGE, user.tmdb_user_account_id); // NUEVO CAMPO

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
    localStorage.removeItem(this.TMDB_API_MOVIES_KEY_LOCAL_STORAGE); // V4 Key
    localStorage.removeItem(this.TMDB_ACCOUNT_ID_KEY_LOCAL_STORAGE); // V3 Key
    localStorage.removeItem(this.TMDB_SESSION_ID_KEY_LOCAL_STORAGE);
    localStorage.removeItem(this.PENDING_TMDB_REQUEST_TOKEN_KEY);
    localStorage.removeItem(this.TMDB_V4_READ_ACCESS_TOKEN_LOCAL_STORAGE); // Nuevo campo
    localStorage.removeItem(this.TMDB_USER_ACCOUNT_ID_LOCAL_STORAGE); // NUEVO CAMPO
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

  // Este método ahora guarda la API Key V3 (que viene de 'account_id' de tu backend)
  saveTmdbV3ApiKey(apiKeyV3: string): void {
    const user = this.currentUserValue;
    if (user) {
      const updatedUser: User = { ...user, account_id: apiKeyV3 }; // Actualiza 'account_id' que es la V3 key
      localStorage.setItem(this.USER_KEY, JSON.stringify(updatedUser));
      localStorage.setItem(this.TMDB_ACCOUNT_ID_KEY_LOCAL_STORAGE, apiKeyV3);
      this.userSubject.next(updatedUser);
      console.log('AuthService: TMDB V3 API Key (account_id) guardada y userSubject actualizado.');
    } else {
        localStorage.setItem(this.TMDB_ACCOUNT_ID_KEY_LOCAL_STORAGE, apiKeyV3);
        console.warn('AuthService: API Key V3 de TMDB guardada en localStorage, pero no hay usuario logueado en userSubject.');
    }
  }

  // Este método devolverá la API Key V3 (alfanumérica corta)
  // `TmdbService` lo usará como 'api_key' query param para llamadas V3 estándar.
  getTmdbApiKey(): string | null {
    const user = this.currentUserValue;
    return user?.account_id || localStorage.getItem(this.TMDB_ACCOUNT_ID_KEY_LOCAL_STORAGE) || null;
  }

  // Este método guarda el token V4 (que viene de 'api_movies' de tu backend)
  saveTmdbV4ReadAccessToken(token: string): void {
    const user = this.currentUserValue;
    if (user) {
      const updatedUser: User = { ...user, api_movies: token, tmdb_v4_read_access_token: token }; // Actualiza ambos
      localStorage.setItem(this.USER_KEY, JSON.stringify(updatedUser));
      localStorage.setItem(this.TMDB_API_MOVIES_KEY_LOCAL_STORAGE, token);
      localStorage.setItem(this.TMDB_V4_READ_ACCESS_TOKEN_LOCAL_STORAGE, token); // Guarda también el nuevo campo
      this.userSubject.next(updatedUser);
      console.log('AuthService: TMDB V4 Read Access Token (api_movies) guardado y userSubject actualizado.');
    } else {
        localStorage.setItem(this.TMDB_API_MOVIES_KEY_LOCAL_STORAGE, token);
        localStorage.setItem(this.TMDB_V4_READ_ACCESS_TOKEN_LOCAL_STORAGE, token);
        console.warn('AuthService: TMDB V4 Read Access Token guardado en localStorage, pero no hay usuario logueado en userSubject.');
    }
  }

  // Este método devolverá el token V4 (JWT largo)
  // `TmdbService` lo usará en la cabecera 'Authorization: Bearer' para autenticación.
  getTmdbV4ReadAccessToken(): string | null {
    const user = this.currentUserValue;
    // Prioriza el nuevo campo si existe, si no, usa api_movies
    return user?.tmdb_v4_read_access_token || user?.api_movies || localStorage.getItem(this.TMDB_V4_READ_ACCESS_TOKEN_LOCAL_STORAGE) || localStorage.getItem(this.TMDB_API_MOVIES_KEY_LOCAL_STORAGE) || null;
  }

  // Este método guarda el Session ID y el Account ID REAL de TMDB (numérico)
  saveTmdbSessionDetails(sessionId: string, actualTmdbUserAccountId: string): void { // CAMBIADO EL NOMBRE DEL PARÁMETRO
    console.log('AuthService: Intentando guardar detalles de sesión TMDB:', { sessionId, actualTmdbUserAccountId });
    localStorage.setItem(this.TMDB_SESSION_ID_KEY_LOCAL_STORAGE, sessionId);
    localStorage.setItem(this.TMDB_USER_ACCOUNT_ID_LOCAL_STORAGE, actualTmdbUserAccountId); // Guarda el ID de cuenta REAL de TMDB aquí

    const user = this.currentUserValue;
    if (user) {
      const updatedUser: User = {
        ...user,
        tmdb_session_id: sessionId,
        tmdb_user_account_id: actualTmdbUserAccountId // Asigna el ID de cuenta REAL al nuevo campo tmdb_user_account_id
      };
      localStorage.setItem(this.USER_KEY, JSON.stringify(updatedUser));
      this.userSubject.next(updatedUser);
      console.log('AuthService: Objeto de usuario actualizado con IDs de sesión y cuenta REAL de TMDB:', updatedUser);
    } else {
        console.warn('AuthService: saveTmdbSessionDetails llamado pero no hay usuario logueado en userSubject.');
    }
    console.log('AuthService: IDs de sesión y cuenta REAL de TMDB guardados en localStorage.');
  }

  clearTmdbSessionDetails(): void {
    localStorage.removeItem(this.TMDB_SESSION_ID_KEY_LOCAL_STORAGE);
    localStorage.removeItem(this.TMDB_USER_ACCOUNT_ID_LOCAL_STORAGE); // Limpia el ID de cuenta REAL

    const currentUser = this.userSubject.getValue();
    if (currentUser) {
      const updatedUser: User = {
        ...currentUser,
        tmdb_session_id: null,
        tmdb_user_account_id: null // Limpia este campo
      };
      localStorage.setItem(this.USER_KEY, JSON.stringify(updatedUser));
      this.userSubject.next(updatedUser);
      console.log('AuthService: Detalles de la sesión TMDB limpiados del usuario.');
    }
  }

  getTmdbSessionId(): string | null {
    const user = this.currentUserValue;
    return user?.tmdb_session_id || localStorage.getItem(this.TMDB_SESSION_ID_KEY_LOCAL_STORAGE) || null;
  }

  // Este método devuelve el ID de cuenta REAL de TMDB (el numérico, después de la auth)
  getTmdbAccountId(): string | null { // Mantengo el nombre del método para compatibilidad con PeliculasService/TmdbService
    const user = this.currentUserValue;
    return user?.tmdb_user_account_id || localStorage.getItem(this.TMDB_USER_ACCOUNT_ID_LOCAL_STORAGE) || null;
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
