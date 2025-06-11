import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators, FormControl } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit, OnDestroy {
  loginForm!: FormGroup;

  currentStep: 'email' | 'password' = 'email';

  errorMessage: string = '';
  successMessage: string = '';
  emailVerified: boolean = false;
  loading: boolean = false;
  userEmail: string = '';

  private destroy$ = new Subject<void>();

  constructor(
    private formBuilder: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loginForm = this.formBuilder.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required]]
    });

    this.authService.isLoggedIn().pipe(takeUntil(this.destroy$)).subscribe(loggedIn => {
      if (loggedIn) {
        this.router.navigate(['/menu']);
      }
    });
  }

  get f() {
    return this.loginForm.controls;
  }

  checkEmail(): void {
    this.errorMessage = '';
    this.successMessage = '';
    this.loading = true;

    this.f['email'].markAsTouched();

    if (this.f['email'].invalid) {
      if (this.f['email'].errors?.['required']) {
        this.errorMessage = 'El correo electrónico es obligatorio.';
      } else if (this.f['email'].errors?.['email']) {
        this.errorMessage = 'Introduce un correo electrónico válido.';
      }
      this.loading = false;
      return;
    }

    this.authService.checkEmail(this.f['email'].value).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: response => {
        this.loading = false;
        // ¡CAMBIO CLAVE AQUÍ! Ahora 'response' contendrá 'ok' y 'data'
        if (response && response.ok && response.data && response.data.email_exists && response.data.is_enabled) {
          this.successMessage = response.message || 'Email verificado. Usuario habilitado.';
          this.emailVerified = true;
          this.currentStep = 'password';
          this.userEmail = this.f['email'].value;
          // Opcional: Deshabilitar el campo de email después de la verificación
          // this.loginForm.get('email')?.disable();
        } else {
          // Si ok es false, o data no existe, o email_exists/is_enabled son false
          this.errorMessage = response.message || 'El email no está registrado o el usuario no está habilitado.';
          this.emailVerified = false;
          this.currentStep = 'email'; // Asegurarse de que se quede en el paso de email
        }
      },
      error: error => {
        this.loading = false;
        console.error('Error en checkEmail del LoginComponent:', error);
        // El error ya viene formateado desde AuthService, o un error genérico
        this.errorMessage = error.message || 'Error al verificar el email con el servidor. Inténtalo de nuevo.';
        this.emailVerified = false;
        this.currentStep = 'email'; // Asegurarse de que se quede en el paso de email
      }
    });
  }

  submitLogin(): void {
    this.errorMessage = '';
    this.successMessage = '';
    this.loading = true;

    this.f['password'].markAsTouched();

    if (this.f['password'].invalid) {
      this.errorMessage = 'La contraseña es obligatoria.';
      this.loading = false;
      return;
    }

    const email = this.f['email'].value;
    const password = this.f['password'].value;

    this.authService.login(email, password).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: response => {
        this.loading = false;
        console.log('LoginComponent: Login exitoso, manejado por AuthService.');
        this.successMessage = '¡Inicio de sesión exitoso! Redirigiendo...';
      },
      error: error => {
        this.loading = false;
        console.error('LoginComponent: Error al iniciar sesión:', error);
        this.errorMessage = error.message || 'Error al iniciar sesión. Verifica tus credenciales.';
      }
    });
  }

  resetLogin(): void {
    this.currentStep = 'email';
    this.errorMessage = '';
    this.successMessage = '';
    this.f['password'].reset();
    this.emailVerified = false;
    this.userEmail = '';
    this.loading = false;
    this.loginForm.get('email')?.enable(); // Habilitar el campo de email si se deshabilitó
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
