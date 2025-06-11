import { Component, OnDestroy, OnInit } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';
import { TmdbService } from '../../services/tmdb.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-menu',
  templateUrl: './menu.component.html',
  styleUrls: ['./menu.component.css']
})
export class MenuComponent implements OnInit, OnDestroy { // Implementar OnDestroy
  userEmail: string | null = null;
  isAdmin: boolean = false;
  tmdbApiKey: string | null = null;
  tmdbAccountId: string | null = null;
  showTmdbAuthModal: boolean = false; // Controla la visibilidad del modal

  private subscriptions: Subscription = new Subscription(); // Para gestionar las suscripciones

  constructor(
    private authService: AuthService,
    public router: Router,
    private tmdbService: TmdbService
  ) { }

  ngOnInit(): void {
    this.subscriptions.add(
      this.authService.currentUser.subscribe(user => {
        this.userEmail = user ? user.email : null;
        this.tmdbApiKey = this.authService.getTmdbApiKey();
        this.tmdbAccountId = this.authService.getTmdbAccountId();
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
    if (!this.tmdbApiKey) {
      console.error('No se puede iniciar el flujo de TMDB: API Key no disponible para el usuario.');
      alert('Error: Tu API Key de TMDB no está configurada. Por favor, contacta con soporte.');
      this.closeTmdbAuthModal();
      return;
    }

    // Cerrar el modal
    this.closeTmdbAuthModal();

    // Obtener el request_token del backend
    this.subscriptions.add(
      this.tmdbService.getRequestToken().subscribe({
        next: (response) => {
          const requestToken = response.request_token;
          console.log('Request Token de TMDB obtenido:', requestToken);

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
