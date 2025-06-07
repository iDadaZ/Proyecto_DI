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
    return !!localStorage.getItem('jwt_token');
  }

  private getUserFromLocalStorage(): any | null {
    const token = localStorage.getItem('jwt_token');
    if (token) {
      try {

        const parts = token.split('.');
        if (parts.length === 3) {

          const payload = JSON.parse(atob(parts[1]));

          if (payload.exp && (payload.exp * 1000 < Date.now())) {
            console.warn('El token JWT ha expirado. Cerrando sesión automáticamente.');
            this.logout();
            return null;
          }
          return payload;
        }
      } catch (e) {
        console.error('Error decodificando o verificando token JWT del localStorage:', e);
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
  }


  private checkAdminRole(): boolean {
    const user = this.getUserFromLocalStorage();
    return user && user.role === 'admin';
  }

  checkEmail(email: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}?action=checkEmail`, { email }).pipe(
      delay(500),
      tap(response => {
        if (!response.ok) {
          console.error('Error al verificar email en backend:', response.message);
        }
      }),
      catchError(error => {
        console.error('Error en la petición checkEmail (HTTP):', error);
        return of({ ok: false, message: error.error?.message || 'Error de conexión con el servidor.', data: null });
      })
    );
  }

  // Método público para iniciar sesión
  login(email: string, password: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}?action=login`, { email, password }).pipe(
      tap(response => {
        if (response.ok && response.data?.token) {
          localStorage.setItem('jwt_token', response.data.token);
          this.loggedIn.next(true);
          this.updateUserAndRole();
          console.log('Login exitoso. Token JWT guardado y estado actualizado.');
          this.router.navigate(['/menu']);
        } else {
          console.error('Fallo en el login:', response.message);
        }
      }),
      catchError(error => {
        console.error('Error en la petición login (HTTP):', error);
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

  // Método público para cerrar la sesión del usuario.
  logout(): void {
    localStorage.removeItem('jwt_token'); // Elimina el token del almacenamiento local
    this.loggedIn.next(false); // Actualiza el estado de login a false
    this.currentUser.next(null); // Borra la información del usuario actual
    this.isAdmin.next(false); // Establece el rol de administrador a false
    this.router.navigate(['/login']); // Redirige al usuario a la página de login
    console.log('Sesión cerrada correctamente.');
  }

  // Para saber si esta logueado
  isLoggedIn(): Observable<boolean> {
    return this.loggedIn.asObservable();
  }

  // Para que los componentes puedan saber si el usuario es administrador.
  isUserAdmin(): Observable<boolean> {
    return this.isAdmin.asObservable();
  }

  // Devuelve la clave API para el usuario actual desde el token.
  getTmdbApiKey(): string | null {
    const user = this.currentUser.getValue();
    return user ? user.api_movies : null;
  }

  // Devuelve el ID para el usuario actual desde el token.
  getTmdbAccountId(): string | null {
    const user = this.currentUser.getValue();
    return user ? user.account_id : null;
  }

  // obtener el token JWT actual
  getToken(): string | null {
    return localStorage.getItem('jwt_token');
  }
}
