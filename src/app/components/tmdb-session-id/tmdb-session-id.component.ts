import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { TmdbService } from '../../services/tmdb.service';
import { take, catchError, finalize } from 'rxjs/operators';
import { of, throwError } from 'rxjs';

@Component({
  selector: 'app-tmdb-session-id', // Renombrado a app-tmdb-auth-callback es más descriptivo
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
    this.route.queryParams.pipe(take(1)).subscribe(params => {
      const requestToken = params['request_token'];
      const approved = params['approved'] === 'true';

      if (requestToken && approved) {
        // Primero, verificar si este requestToken coincide con el que esperamos
        const pendingToken = this.authService.getPendingTmdbRequestToken();

        if (pendingToken && pendingToken === requestToken) {
          console.log('TMDB Callback: Token de petición aprobado y coincide con el pendiente:', requestToken);
          this.createTmdbSession(requestToken);
        } else {
          // Token no coincide o no había token pendiente. Posible intento de ataque o token expirado.
          console.error('TMDB Callback: Request token no coincide o no había token pendiente. Posiblemente inválido o expirado.');
          this.errorMessage = 'Autenticación TMDB inválida o expirada. Por favor, inténtalo de nuevo.';
          this.isLoading = false;
          this.authService.clearPendingTmdbRequestToken(); // Limpiar por seguridad
          this.router.navigate(['/menu']);
        }
      } else if (requestToken && !approved) {
        this.errorMessage = 'Autenticación de TMDB denegada por el usuario.';
        this.isLoading = false;
        console.warn('Autenticación TMDB denegada por el usuario.');
        this.authService.clearPendingTmdbRequestToken(); // Limpiar el token pendiente
        this.router.navigate(['/menu']);
      } else {
        this.errorMessage = 'Parámetros de autenticación de TMDB inválidos o ausentes.';
        this.isLoading = false;
        console.error('No se encontraron los parámetros esperados para la autenticación TMDB.');
        this.authService.clearPendingTmdbRequestToken(); // Limpiar por si acaso
        this.router.navigate(['/menu']);
      }
    });
  }

  private createTmdbSession(requestToken: string): void {
    this.isLoading = true;
    this.errorMessage = null;

    this.tmdbService.createSessionId(requestToken).pipe(
      take(1),
      catchError(error => {
        console.error('Error al crear la sesión de TMDB:', error);
        this.errorMessage = `No se pudo crear la sesión de TMDB. Detalles: ${error.error?.status_message || error.message || 'Error desconocido'}`;
        this.isLoading = false;
        this.authService.clearPendingTmdbRequestToken();
        this.router.navigate(['/menu']);
        return throwError(() => new Error(this.errorMessage!));
      }),
      // El finalize no es necesario aquí si se usa en el último subscribe o catchError
    ).subscribe(sessionResponse => {
      if (sessionResponse && sessionResponse.success && sessionResponse.session_id) {
        const sessionId = sessionResponse.session_id;

        this.tmdbService.getTmdbAccountDetails(sessionId).pipe(
          take(1),
          catchError(error => {
            console.error('Error al obtener detalles de la cuenta de TMDB:', error);
            this.errorMessage = `No se pudieron cargar los detalles de tu cuenta de TMDB. Detalles: ${error.error?.status_message || error.message || 'Error desconocido'}`;
            this.isLoading = false;
            this.authService.clearPendingTmdbRequestToken();
            this.router.navigate(['/menu']);
            return throwError(() => new Error(this.errorMessage!));
          }),
          finalize(() => {
            // Este finalize se ejecuta después de ambas llamadas (createSessionId y getTmdbAccountDetails) o sus errores
            this.isLoading = false;
          })
        ).subscribe(accountDetails => {
          if (accountDetails && accountDetails.id) {
            this.authService.saveTmdbSessionDetails(sessionId, accountDetails.id.toString());
            this.authService.clearPendingTmdbRequestToken();

            console.log('Autenticación TMDB exitosa. ID de cuenta:', accountDetails.id);
            this.router.navigate(['/menu']);
          } else {
            this.errorMessage = 'No se encontraron detalles de la cuenta TMDB o la respuesta fue inválida.';
            this.isLoading = false;
            this.authService.clearPendingTmdbRequestToken();
            this.router.navigate(['/menu']);
          }
        });
      } else {
        if (!this.errorMessage) {
          this.errorMessage = 'Respuesta inesperada al crear la sesión TMDB (no exitosa).';
        }
        this.isLoading = false;
        this.authService.clearPendingTmdbRequestToken();
        this.router.navigate(['/menu']);
      }
    });
  }
}
