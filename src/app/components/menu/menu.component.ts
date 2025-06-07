import { Component, OnInit } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-menu',
  templateUrl: './menu.component.html',
  styleUrls: ['./menu.component.css']
})
export class MenuComponent implements OnInit {
  userEmail: string | null = null;
  isAdmin: boolean = false;
  tmdbApiKey: string | null = null;
  tmdbAccountId: string | null = null;

  constructor(private authService: AuthService, private router: Router) { }

  ngOnInit(): void {
    this.authService.currentUser.subscribe(user => {
      this.userEmail = user ? user.email : null;
      this.tmdbApiKey = this.authService.getTmdbApiKey();
      this.tmdbAccountId = this.authService.getTmdbAccountId();
    });
    this.authService.isUserAdmin().subscribe(isAdmin => {
      this.isAdmin = isAdmin;
    });
  }

  logout(): void {
    this.authService.logout();
  }
}
