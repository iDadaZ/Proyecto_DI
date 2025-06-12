import { Component, OnDestroy, OnInit } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';
import { TmdbService } from '../../services/tmdb.service';
import { Subscription } from 'rxjs';
import { User } from '../../interfaces/usuario.interface'; // Importa la interfaz User

@Component({
  selector: 'app-menu',
  templateUrl: './menu.component.html',
  styleUrls: ['./menu.component.css']
})
export class MenuComponent implements OnInit, OnDestroy {
  userEmail: string | null = null;
  isAdmin: boolean = false;

  // Propiedades que reflejan los datos del usuario de TMDB
  tmdbV3ApiKey: string | null = null;       // Contendrá la API Key V3 (del campo 'account_id' del backend)
  tmdbAccountIdReal: string | null = null;  // ¡NUEVO! Contendrá el ID de cuenta REAL de TMDB (numérico)
  tmdbSessionId: string | null = null;      // Contendrá el Session ID de TMDB
  tmdbV4ReadAccessToken: string | null = null; // Contendrá el token V4 (del campo 'api_movies' del backend)

  showTmdbAuthModal: boolean = false;

  private subscriptions: Subscription = new Subscription();

  constructor(
    private authService: AuthService,
    public router: Router,
    private tmdbService: TmdbService
  ) { }

  ngOnInit(): void {
    this.subscriptions.add(
      this.authService.currentUser.subscribe(user => {
        this.userEmail = user ? user.email : null;

        // Mapeo de los campos del objeto User a las propiedades del componente
        // Usamos '?? null' para asegurarnos de que undefined se convierta a null
        this.tmdbV3ApiKey = user?.account_id ?? null;
        this.tmdbAccountIdReal = user?.tmdb_user_account_id ?? null;
        this.tmdbSessionId = user?.tmdb_session_id ?? null;
        // Para tmdbV4ReadAccessToken, ya usabas '||', que también maneja undefined.
        // Lo hago más explícito con '?? null' al final para consistencia si ambos son nulos/undefined.
        this.tmdbV4ReadAccessToken = (user?.tmdb_v4_read_access_token || user?.api_movies) ?? null;

        console.log('MenuComponent: currentUser actualizado.', {
            email: this.userEmail,
            tmdbV3ApiKey: this.tmdbV3ApiKey ? 'Presente' : 'Ausente',
            tmdbAccountIdReal: this.tmdbAccountIdReal ? 'Presente' : 'Ausente',
            tmdbSessionId: this.tmdbSessionId ? 'Presente' : 'Ausente',
            tmdbV4ReadAccessToken: this.tmdbV4ReadAccessToken ? 'Presente (no mostrado completo)' : 'Ausente'
        });
      })
    );
    this.subscriptions.add(
      this.authService.isUserAdmin().subscribe(isAdmin => {
        this.isAdmin = isAdmin;
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  logout(): void {
    this.authService.logout();
  }

  openTmdbAuthModal(): void {
    this.showTmdbAuthModal = true;
  }

  closeTmdbAuthModal(): void {
    this.showTmdbAuthModal = false;
  }

  startTmdbAuthFlow(): void {
    // Para iniciar el flujo de autenticación de TMDB, necesitamos el token V4 en la cabecera
    const userTmdbV4Token = this.authService.getTmdbV4ReadAccessToken();

    if (!userTmdbV4Token) {
      console.error('No se puede iniciar el flujo de TMDB: TMDB V4 Read Access Token no disponible para el usuario.');
      alert('Error: Tu TMDB V4 Read Access Token no está configurado en tu perfil. Por favor, asegúrate de que esté correctamente asignado.');
      this.closeTmdbAuthModal();
      return;
    }

    this.closeTmdbAuthModal();

    this.subscriptions.add(
      this.tmdbService.getRequestToken().subscribe({
        next: (response) => {
          const requestToken = response.request_token;
          console.log('Request Token de TMDB obtenido:', requestToken);

          this.authService.setPendingTmdbRequestToken(requestToken);

          const redirectToUrl = `${window.location.origin}/auth/tmdb-approved`;

          const tmdbAuthUrl = this.tmdbService.authTMDB(requestToken, redirectToUrl);
          console.log('Redirigiendo a TMDB para autorización:', tmdbAuthUrl);

          window.location.href = tmdbAuthUrl;
        },
        error: (error) => {
          console.error('Error al obtener el request token de TMDB:', error);
          alert('No se pudo conectar con TMDB. Por favor, inténtalo de nuevo más tarde. (Detalles: ' + (error.message || 'error desconocido') + ')');
        }
      })
    );
  }
}
