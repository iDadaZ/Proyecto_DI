import { Component, OnDestroy, OnInit } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';
import { TmdbService } from '../../services/tmdb.service'; // Asegúrate de tener este servicio
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-menu',
  templateUrl: './menu.component.html',
  styleUrls: ['./menu.component.css']
})
export class MenuComponent implements OnInit, OnDestroy { // Implementar OnDestroy
  userEmail: string | null = null;
  isAdmin: boolean = false;
  tmdbApiKey: string | null = null; // Se poblará desde authService o tmdbService
  tmdbAccountId: string | null = null;
  showTmdbAuthModal: boolean = false;

  private subscriptions: Subscription = new Subscription(); // Para gestionar las suscripciones

  constructor(
    private authService: AuthService,
    public router: Router,
    private tmdbService: TmdbService // Inyectar TmdbService
  ) { }

  ngOnInit(): void {
    this.subscriptions.add(
      this.authService.currentUser.subscribe(user => {
        this.userEmail = user ? user.email : null;
        // Ahora se obtiene de AuthService, ya que es parte del perfil del usuario
        this.tmdbAccountId = user ? user.account_id : null;
        // La API Key de TMDB se obtiene del TmdbService, asumiendo que este la gestiona.
        // O si tu backend la devuelve en el objeto user, entonces sería user.tmdb_api_key
        // Por la forma en que lo tienes en el HTML, asumiré que sigue viniendo de AuthService
        this.tmdbApiKey = this.authService.getTmdbApiKey(); // Mantengo como lo tenías
      })
    );
    this.subscriptions.add(
      this.authService.isUserAdmin().subscribe(isAdmin => {
        this.isAdmin = isAdmin;
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe(); // Desuscribirse de todas las suscripciones
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

  // Primero obtiene un request_token de tu backend, luego redirige al usuario a TMDB.
  startTmdbAuthFlow(): void {
    // La API Key se obtiene del AuthService o TmdbService.
    // Si tu TmdbService encapsula la lógica de TMDB, debería tener su propia forma de obtener la API key.
    // Pero si la API key es por usuario y se guarda en el usuario logueado, entonces de AuthService.
    // Por cómo lo tienes en el HTML (tmdbApiKey desde authService), lo mantengo de authService.
    const userTmdbApiKey = this.authService.getTmdbApiKey(); // Obtener la API Key del usuario

    if (!userTmdbApiKey) {
      console.error('No se puede iniciar el flujo de TMDB: TMDB API Key no disponible para el usuario.');
      alert('Error: Tu API Key de TMDB no está configurada en tu perfil. Por favor, contacta con soporte o configúrala.');
      this.closeTmdbAuthModal();
      return;
    }

    // Cerrar el modal
    this.closeTmdbAuthModal();

    // Obtener el request_token del TmdbService
    this.subscriptions.add(
      this.tmdbService.getRequestToken().subscribe({
        next: (response) => {
          const requestToken = response.request_token;
          console.log('Request Token de TMDB obtenido:', requestToken);

          // Guardar el request_token temporalmente para validarlo en el callback
          this.authService.setPendingTmdbRequestToken(requestToken);

          const redirectToUrl = `${window.location.origin}/auth/tmdb-approved`;

          const tmdbAuthUrl = this.tmdbService.authTMDB(requestToken, redirectToUrl);
          console.log('Redirigiendo a TMDB para autorización:', tmdbAuthUrl);

          // Redirigir a la página de autorización de TMDB
          window.location.href = tmdbAuthUrl;
        },
        error: (error) => {
          console.error('Error al obtener el request token de TMDB:', error);
          alert('No se pudo conectar con TMDB. Por favor, inténtalo de nuevo más tarde.');
        }
      })
    );
  }
}
