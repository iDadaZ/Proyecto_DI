import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { TmdbService } from '../../services/tmdb.service';
import { take, catchError, finalize } from 'rxjs/operators';
import { of } from 'rxjs';

@Component({
  selector: 'app-tmdb-session-id',
  templateUrl: './tmdb-session-id.component.html',
  styleUrls: ['./tmdb-session-id.component.css']
})
export class TmdbSessionIdComponent implements OnInit {
  isLoading = true; // Para mostrar un spinner o mensaje de carga
  errorMessage: string | null = null; // Para mostrar errores

  constructor(
    private route: ActivatedRoute,
    public router: Router,
    private authService: AuthService,
    private tmdbService: TmdbService
  ) { }

  ngOnInit(): void {
    // Suscríbete a los parámetros de la ruta para obtener el request_token y el estado de aprobación
    this.route.queryParams.pipe(take(1)).subscribe(params => {
      const requestToken = params['request_token'];
      const approved = params['approved'] === 'true'; // Convertir 'true'/'false' a booleano

      if (requestToken && approved) {
        // Si el usuario aprobó la solicitud
        this.createTmdbSession(requestToken);
      } else if (requestToken && !approved) {
        // Si el usuario denegó la solicitud
        this.errorMessage = 'Autenticación de TMDB denegada por el usuario.';
        this.isLoading = false;
        // Puedes redirigir a alguna página o mostrar un mensaje específico
        console.warn('Autenticación TMDB denegada.');
        this.router.navigate(['/menu']); // Redirigir al menú o donde sea apropiado
      } else {
        // Si no hay request_token o parámetros inesperados
        this.errorMessage = 'Parámetros de autenticación de TMDB inválidos.';
        this.isLoading = false;
        console.error('No se encontraron los parámetros esperados para la autenticación TMDB.');
        this.router.navigate(['/menu']); // Redirigir si no hay un flujo de autenticación claro
      }
    });
  }

  /**
   * Procesa la creación de la sesión de TMDB y obtiene los detalles de la cuenta.
   * @param requestToken El token de solicitud aprobado por el usuario.
   */
  private createTmdbSession(requestToken: string): void {
    this.isLoading = true;
    this.errorMessage = null;

    // Guarda el requestToken pendiente para ser usado después del callback
    this.authService.setPendingTmdbRequestToken(requestToken);

    this.tmdbService.createSessionId(requestToken).pipe(
      take(1),
      catchError(error => {
        console.error('Error al crear la sesión de TMDB:', error);
        this.errorMessage = 'No se pudo crear la sesión de TMDB. Inténtalo de nuevo.';
        this.isLoading = false;
        this.authService.clearPendingTmdbRequestToken(); // Limpia el token pendiente en caso de error
        this.router.navigate(['/menu']); // Redirigir en caso de error
        return of(null); // Retorna un observable nulo para que la cadena no se rompa
      }),
      finalize(() => {
        // La carga se detendrá al final de todo el proceso.
      })
    ).subscribe(sessionResponse => {
      if (sessionResponse && sessionResponse.success && sessionResponse.session_id) {
        const sessionId = sessionResponse.session_id;

        // Ahora, usa el session_id para obtener los detalles de la cuenta
        this.tmdbService.getTmdbAccountDetails(sessionId).pipe(
          take(1),
          catchError(error => {
            console.error('Error al obtener detalles de la cuenta de TMDB:', error);
            this.errorMessage = 'No se pudieron cargar los detalles de tu cuenta de TMDB.';
            this.isLoading = false;
            this.authService.clearPendingTmdbRequestToken(); // Limpia el token pendiente en caso de error
            this.router.navigate(['/menu']);
            return of(null);
          }),
          finalize(() => {
            this.isLoading = false; // Finaliza la carga una vez completadas ambas llamadas o sus errores
          })
        ).subscribe(accountDetails => {
          if (accountDetails && accountDetails.id) {
            // Guarda los detalles de la sesión y la cuenta en AuthService
            // El ID de cuenta de TMDB es un número, lo convertimos a string para 'account_id' si es necesario.
            this.authService.saveTmdbSessionDetails(sessionId, accountDetails.id.toString());
            this.authService.clearPendingTmdbRequestToken(); // Limpia el token pendiente

            console.log('Autenticación TMDB exitosa. ID de cuenta:', accountDetails.id);
            this.router.navigate(['/menu']); // Navega al menú principal
          } else {
            this.errorMessage = 'No se encontraron detalles de la cuenta TMDB.';
            this.isLoading = false;
            this.authService.clearPendingTmdbRequestToken();
            this.router.navigate(['/menu']);
          }
        });
      } else {
        // Esto se manejaría si sessionResponse es nulo o no tiene éxito (capturado por catchError)
        if (!this.errorMessage) { // Si no hay un mensaje de error previo del catchError
             this.errorMessage = 'Respuesta inesperada al crear la sesión TMDB.';
        }
        this.isLoading = false;
        this.authService.clearPendingTmdbRequestToken();
        this.router.navigate(['/menu']);
      }
    });
  }
}
