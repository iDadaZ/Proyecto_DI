import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { PeliculaComponent } from './pages/pelicula/pelicula.component';
import { BuscarComponent } from './pages/buscar/buscar.component';
import { LoginComponent } from './auth/login/login.component';
import { MenuComponent } from './components/menu/menu.component';
import { AuthGuard } from './auth/auth.guard';
import { AdminGuard } from './auth/admin.guard';
import { GestionUsuariosComponent } from './pages/gestion-usuarios/gestion-usuarios.components';

const routes: Routes = [

  {path:'home', component:HomeComponent},
  {path:'pelicula/:id', component:PeliculaComponent},
  {path:'buscar/:texto', component:BuscarComponent, },
  {path:'buscar', component: BuscarComponent},
  {path:'login', component: LoginComponent},
  {path:'menu', component: MenuComponent, canActivate: [AuthGuard]},

  {
    path: 'gestion-usuarios', component: GestionUsuariosComponent, canActivate: [AuthGuard, AdminGuard]
  },

  {path:'', pathMatch:'full', redirectTo:'/login'},
  {path:'**', redirectTo:'/login'},

];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
