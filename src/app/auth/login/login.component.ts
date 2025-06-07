import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit {
  loginForm!: FormGroup;
  currentStep: 'email' | 'password' = 'email';
  errorMessage: string | null = null;
  loading: boolean = false;
  userEmail: string = '';

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required]
    });


    this.authService.isLoggedIn().subscribe(loggedIn => {
      if (loggedIn) {
        this.router.navigate(['/menu']);
      }
    });
  }


  get f() { return this.loginForm.controls; }


  checkEmail(): void {
    this.errorMessage = null;
    this.loading = true;

    if (this.f['email'].invalid) {
      this.errorMessage = 'Por favor, introduce un email válido.';
      this.loading = false;
      return;
    }

    const email = this.f['email'].value;
    this.authService.checkEmail(email).subscribe(
      response => {
        this.loading = false;
        if (response.ok) {
          this.userEmail = email;
          this.currentStep = 'password';
        } else {
          this.errorMessage = response.message;
        }
      },
      error => {
        this.loading = false;
        this.errorMessage = 'Ocurrió un error de conexión al verificar el email.';
        console.error('Error en checkEmail del componente:', error);
      }
    );
  }

  submitLogin(): void {
    this.errorMessage = null;
    this.loading = true;

    if (this.f['password'].invalid) {
      this.errorMessage = 'Por favor, introduce tu contraseña.';
      this.loading = false;
      return;
    }

    const email = this.userEmail;
    const password = this.f['password'].value;
    this.authService.login(email, password).subscribe(
      response => {
        this.loading = false;
        if (response.ok) {
          console.log('Login exitoso desde el componente.');
        } else {
          this.errorMessage = response.message;
        }
      },
      error => {
        this.loading = false;
        this.errorMessage = 'Ocurrió un error de conexión al intentar iniciar sesión.';
        console.error('Error en submitLogin del componente:', error);
      }
    );
  }

  // Permite al usuario volver al paso de introducir el email
  resetLogin(): void {
    this.currentStep = 'email'; // Vuelve al primer paso
    this.loginForm.reset(); // Reiniciamos el formulario
    this.errorMessage = null;
  }
}
