import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { UsersService } from '../../services/usuario.service';
import { AuthService } from '../../services/auth.service';
import { User } from '../../interfaces/usuario.interface';
import { tap, finalize } from 'rxjs/operators';
import { Router } from '@angular/router';

@Component({
  selector: 'app-gestion-usuarios',
  templateUrl: './gestion-usuarios.component.html',
  styleUrls: ['./gestion-usuarios.component.css']
})
export class GestionUsuariosComponent implements OnInit {
  users: User[] = [];
  loading: boolean = true;
  errorMessage: string | null = null;

  userForm!: FormGroup;
  isEditMode: boolean = false;
  showFormModal: boolean = false;
  selectedUserId: number | null = null;
  formLoading: boolean = false;

  constructor(
    private usersService: UsersService,
    private authService: AuthService,
    private fb: FormBuilder,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.userForm = this.fb.group({
      id_usuario: [null],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      role: ['user', Validators.required],
      is_enabled: [true],
      api_movies: ['', Validators.required],
      account_id: ['', Validators.required]
    });

    this.loadUsers();
  }

  loadUsers(): void {
    this.loading = true;
    this.errorMessage = null;
    this.usersService.getUsers().pipe(
      finalize(() => this.loading = false)
    ).subscribe({
      next: response => {
        if (response.ok) {
          this.users = response.data || [];
          if (this.users.length === 0) {
            this.errorMessage = 'No hay usuarios para mostrar.';
          } else {
            this.errorMessage = null;
          }
        } else {
          this.users = [];
          this.errorMessage = response.message || 'Error al cargar usuarios.';
          console.error('Error al cargar usuarios:', response);
        }
      },
      error: error => {
        this.loading = false;
        this.users = [];
        this.errorMessage = 'Error de conexión al cargar usuarios: ' + (error.message || 'Error desconocido.');
        console.error('Error HTTP al cargar usuarios:', error);
      }
    });
  }

  openCreateUserModal(): void {
    this.isEditMode = false;
    this.selectedUserId = null;
    this.userForm.reset({
      id_usuario: null,
      email: '', password: '',
      role: 'user', is_enabled: true, api_movies: '', account_id: ''
    });
    this.userForm.get('password')?.setValidators([Validators.required, Validators.minLength(6)]);
    this.userForm.get('password')?.updateValueAndValidity();
    this.showFormModal = true;
  }

  openEditUserModal(user: User): void {
    this.isEditMode = true;
    this.selectedUserId = user.id_usuario || null;
    this.userForm.patchValue({
      id_usuario: user.id_usuario,
      email: user.email,
      password: '',
      role: user.role, is_enabled: user.is_enabled, api_movies: user.api_movies, account_id: user.account_id
    });
    this.userForm.get('password')?.setValidators([]);
    this.userForm.get('password')?.updateValueAndValidity();
    this.showFormModal = true;
  }

  closeFormModal(): void {
    this.showFormModal = false;
    this.userForm.reset();
  }

  saveUser(): void {
    this.errorMessage = null;
    if (this.userForm.invalid) {
      this.userForm.markAllAsTouched();
      this.errorMessage = 'Por favor, rellena todos los campos obligatorios correctamente.';
      return;
    }

    this.formLoading = true;
    const userToSave: User = {
      id_usuario: this.userForm.value.id_usuario,
      email: this.userForm.value.email,
      password: this.userForm.value.password || undefined,
      role: this.userForm.value.role,
      is_enabled: this.userForm.value.is_enabled,
      api_movies: this.userForm.value.api_movies,
      account_id: this.userForm.value.account_id,
    };

    const operation = this.isEditMode ?
      this.usersService.updateUser(userToSave) :
      this.usersService.createUser(userToSave);

    operation.pipe(
      finalize(() => this.formLoading = false)
    ).subscribe({
      next: response => {
        if (response.ok) {
          console.log('Operación de usuario exitosa:', response.message);
          this.closeFormModal();
          this.loadUsers();
        } else {
          this.errorMessage = response.message || `Error al ${this.isEditMode ? 'actualizar' : 'crear'} usuario.`;
        }
      },
      error: error => {
        this.formLoading = false;
        this.errorMessage = `Error de conexión al ${this.isEditMode ? 'actualizar' : 'crear'} usuario: ` + (error.message || 'Error desconocido.');
        console.error(`Error HTTP al ${this.isEditMode ? 'actualizar' : 'crear'} usuario:`, error);
      }
    });
  }

  deleteUser(id_usuario: number | undefined): void {
    if (typeof id_usuario === 'undefined' || id_usuario === null) {
      this.errorMessage = 'ID de usuario no válido para eliminar.';
      return;
    }

    if (confirm('¿Estás seguro de que quieres eliminar este usuario?')) {
      this.loading = true;
      this.usersService.deleteUser(id_usuario).pipe(
        finalize(() => this.loading = false)
      ).subscribe({
        next: response => {
          if (response.ok) {
            console.log('Usuario eliminado:', response.message);
            this.loadUsers();
          } else {
            this.errorMessage = response.message || 'Error al eliminar usuario.';
          }
        },
        error: error => {
          this.loading = false;
          this.errorMessage = 'Error de conexión al eliminar usuario: ' + (error.message || 'Error desconocido.');
          console.error('Error HTTP al eliminar usuario:', error);
        }
      });
    }
  }

  toggleUserEnabled(user: User): void {
    if (typeof user.id_usuario === 'undefined' || user.id_usuario === null) {
      this.errorMessage = 'ID de usuario no válido para alternar estado.';
      return;
    }

    const newState = !user.is_enabled;
    this.usersService.toggleUserEnabled(user.id_usuario, newState).subscribe({
      next: response => {
        if (response.ok) {
          user.is_enabled = newState;
          console.log('Estado de usuario actualizado:', response.message);
        } else {
          this.errorMessage = response.message || 'Error al actualizar estado.';
          console.error('Error al actualizar estado:', response);
        }
      },
      error: error => {
        this.errorMessage = 'Error de conexión al actualizar estado: ' + (error.message || 'Error desconocido.');
        console.error('Error HTTP al actualizar estado:', error);
      }
    });
  }

  get f() { return this.userForm.controls; }

  getEnabledStatus(is_enabled: boolean): string {
    return is_enabled ? 'Habilitado' : 'Deshabilitado';
  }

  goToMenu(): void {
    this.router.navigate(['/menu']);
  }
}
