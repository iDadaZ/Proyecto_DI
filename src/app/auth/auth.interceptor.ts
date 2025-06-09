import { Injectable } from '@angular/core';
import { HttpRequest,HttpHandler,HttpEvent,HttpInterceptor } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from '../services/auth.service'; // Asegúrate de que la ruta a AuthService es correcta

@Injectable()
export class AuthInterceptor implements HttpInterceptor {

  constructor(private authService: AuthService) {}

  intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    console.log('AuthInterceptor: Interceptando petición a:', request.url); // LOG DE DEPURACIÓN
    const authToken = this.authService.getToken();
    console.log('AuthInterceptor: Token obtenido de AuthService:', authToken ? 'Presente' : 'Ausente', 'Longitud:', authToken ? authToken.length : 0); // LOG DE DEPURACIÓN CRÍTICO

    if (authToken) {
      request = request.clone({
        setHeaders: {
          Authorization: `Bearer ${authToken}`
        }
      });
      console.log('AuthInterceptor: Cabecera Authorization añadida a la petición.'); // LOG DE DEPURACIÓN
    } else {
      console.log('AuthInterceptor: No hay token en AuthService. No se añade cabecera Authorization.'); // LOG DE DEPURACIÓN
    }

    return next.handle(request);
  }
}
