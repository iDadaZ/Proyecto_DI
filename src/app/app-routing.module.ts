import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { PeliculaComponent } from './pages/pelicula/pelicula.component';
import { BuscarComponent } from './pages/buscar/buscar.component';
import { LoginComponent } from './auth/login/login.component';
import { MenuComponent } from './components/menu/menu.component';
import { AuthGuard } from './auth/auth.guard';

const routes: Routes = [

  {path:'home', component:HomeComponent},
  {path:'pelicula/:id', component:PeliculaComponent},
  {path:'buscar/:texto', component:BuscarComponent},
  {path:'login', component: LoginComponent},
  {path:'menu', component: MenuComponent, canActivate: [AuthGuard]},

  {path:'', pathMatch:'full', redirectTo:'/login'},
  {path:'**', redirectTo:'/login'},

];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
