import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, of } from 'rxjs';
import { tap, catchError, delay } from 'rxjs/operators';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = 'http://79.72.60.13/app.radfpd.es/api/peliculasApp/index.php';

  private loggedIn = new BehaviorSubject<boolean>(this.hasToken());
  currentUser = new BehaviorSubject<any>(this.getUserFromLocalStorage());
  isAdmin = new BehaviorSubject<boolean>(this.checkAdminRole());

  constructor(private http: HttpClient, private router: Router) {
    if (this.hasToken()) {
      this.loggedIn.next(true);
      this.updateUserAndRole();
    }
  }

  private hasToken(): boolean {
    const has = !!localStorage.getItem('jwt_token');
    console.log('AuthService: hasToken() -> Token presente en localStorage:', has); // LOG DE DEPURACIÓN
    return has;
  }

  private getUserFromLocalStorage(): any | null {
    const token = localStorage.getItem('jwt_token');
    console.log('AuthService: Token desde localStorage (getUserFromLocalStorage):', token ? 'Presente' : 'Ausente', 'Longitud:', token ? token.length : 0); // LOG DE DEPURACIÓN
    if (token) {
      try {
        const parts = token.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1]));
          console.log('AuthService: Payload decodificado del token (getUserFromLocalStorage):', payload); // LOG DE DEPURACIÓN

          if (payload.exp && (payload.exp * 1000 < Date.now())) {
            console.warn('AuthService: El token JWT ha expirado en el frontend. Cerrando sesión automáticamente.');
            this.logout();
            return null;
          }
          return payload;
        }
      } catch (e) {
        console.error('AuthService: Error decodificando o verificando token JWT del localStorage (getUserFromLocalStorage):', e);
        this.logout();
        return null;
      }
    }
    return null;
  }

  private updateUserAndRole(): void {
    const user = this.getUserFromLocalStorage();
    this.currentUser.next(user);
    this.isAdmin.next(user && user.role === 'admin');
    console.log('AuthService: Usuario y rol actualizados (updateUserAndRole). Admin:', this.isAdmin.getValue()); // LOG DE DEPURACIÓN
  }

  private checkAdminRole(): boolean {
    const user = this.getUserFromLocalStorage();
    return user && user.role === 'admin';
  }

  checkEmail(email: string): Observable<any> {
    console.log('AuthService: checkEmail para:', email); // LOG DE DEPURACIÓN
    return this.http.post<any>(`${this.apiUrl}?action=checkEmail`, { email }).pipe(
      delay(500),
      tap(response => {
        if (!response.ok) {
          console.error('AuthService: Error al verificar email en backend:', response.message);
        } else {
          console.log('AuthService: checkEmail exitoso. Respuesta:', response); // LOG DE DEPURACIÓN
        }
      }),
      catchError(error => {
        console.error('AuthService: Error en la petición checkEmail (HTTP):', error);
        return of({ ok: false, message: error.error?.message || 'Error de conexión con el servidor.', data: null });
      })
    );
  }

  login(email: string, password: string): Observable<any> {
    console.log('AuthService: Intentando login para:', email); // LOG DE DEPURACIÓN
    return this.http.post<any>(`${this.apiUrl}?action=login`, { email, password }).pipe(
      tap(response => {
        if (response.ok && response.data?.token) {
          localStorage.setItem('jwt_token', response.data.token);
          this.loggedIn.next(true);
          this.updateUserAndRole();
          console.log('AuthService: Login exitoso. Token JWT guardado en localStorage y estado actualizado.'); // LOG DE DEPURACIÓN
          this.router.navigate(['/menu']);
        } else {
          console.error('AuthService: Fallo en el login:', response.message); // LOG DE DEPURACIÓN
        }
      }),
      catchError(error => {
        console.error('AuthService: Error en la petición login (HTTP):', error); // LOG DE DEPURACIÓN
        let errorMessage = 'Ocurrió un error inesperado al intentar iniciar sesión.';
        if (error.status === 401) {
          errorMessage = 'Credenciales incorrectas. Por favor, verifica tu email y contraseña.';
        } else if (error.status === 403) {
          errorMessage = 'Tu cuenta está deshabilitada. Contacta con el administrador.';
        } else if (error.error?.message) {
          errorMessage = error.error.message;
        }
        return of({ ok: false, message: errorMessage, data: null });
      })
    );
  }

  logout(): void {
    console.log('AuthService: Ejecutando logout.'); // LOG DE DEPURACIÓN
    localStorage.removeItem('jwt_token');
    this.loggedIn.next(false);
    this.currentUser.next(null);
    this.isAdmin.next(false);
    this.router.navigate(['/login']);
    console.log('AuthService: Sesión cerrada correctamente.'); // LOG DE DEPURACIÓN
  }

  isLoggedIn(): Observable<boolean> {
    return this.loggedIn.asObservable();
  }

  isUserAdmin(): Observable<boolean> {
    return this.isAdmin.asObservable();
  }

  getTmdbApiKey(): string | null {
    const user = this.currentUser.getValue();
    return user ? user.api_movies : null;
  }

  getTmdbAccountId(): string | null {
    const user = this.currentUser.getValue();
    return user ? user.account_id : null;
  }

  getToken(): string | null {
    const token = localStorage.getItem('jwt_token');
    console.log('AuthService: getToken() llamado. Token retornado:', token ? 'Presente' : 'Ausente. Longitud:', token ? token.length : 0); // LOG DE DEPURACIÓN CRÍTICO
    return token;
  }
}
