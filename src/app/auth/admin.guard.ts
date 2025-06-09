import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router, UrlTree } from '@angular/router';
import { Observable } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { map, take } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class AdminGuard implements CanActivate {

  constructor(private authService: AuthService, private router: Router) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot): Observable<boolean | UrlTree> | Promise<boolean | UrlTree> | boolean | UrlTree {

    return this.authService.isUserAdmin().pipe(
      take(1),
      map((isAdmin: boolean) => {
        if (isAdmin) {
          console.log('AdminGuard: Acceso permitido al administrador.');
          return true;
        } else {
          console.warn('AdminGuard: Acceso denegado. El usuario no es administrador. Redirigiendo al menú.');
          return this.router.createUrlTree(['/menu']);
        }
      })
    );
  }
}
