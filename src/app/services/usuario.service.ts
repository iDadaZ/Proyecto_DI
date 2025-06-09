import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { User, UsersApiResponse, UserOperationApiResponse } from '../interfaces/usuario.interface';

const API_URL = 'http://79.72.60.13/app.radfpd.es/api/peliculasApp';
const ENDPOINT_USERS = '/index.php';

@Injectable({
  providedIn: 'root'
})
export class UsersService {

  constructor(private http: HttpClient) { }

  getUsers(): Observable<UsersApiResponse> {
    return this.http.get<UsersApiResponse>(`${API_URL}${ENDPOINT_USERS}?action=users`);
  }

  createUser(user: User): Observable<UserOperationApiResponse> {
    return this.http.post<UserOperationApiResponse>(`${API_URL}${ENDPOINT_USERS}?action=users`, user);
  }


  updateUser(user: User): Observable<UserOperationApiResponse> {
    return this.http.put<UserOperationApiResponse>(`${API_URL}${ENDPOINT_USERS}?action=users&id=${user.id_usuario}`, user);
  }


  deleteUser(id_usuario: number): Observable<UserOperationApiResponse> {
    return this.http.delete<UserOperationApiResponse>(`${API_URL}${ENDPOINT_USERS}?action=users&id=${id_usuario}`);
  }

  toggleUserEnabled(id_usuario: number, is_enabled: boolean): Observable<UserOperationApiResponse> {
    return this.http.put<UserOperationApiResponse>(`${API_URL}${ENDPOINT_USERS}?action=users&id=${id_usuario}`, { is_enabled: is_enabled });
  }
}
