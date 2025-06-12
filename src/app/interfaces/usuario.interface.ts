export interface User {
  id_usuario?: number;
  email: string;
  password?: string;
  role: 'admin' | 'user';
  is_enabled: boolean;
  api_movies: string | null;
  account_id: string | null;
  tmdb_session_id?:string | null;
}

// Interfaz para la respuesta de la API al obtener usuarios
export interface UsersApiResponse {
  ok: number;
  message: string;
  data: User[] | null;
}

// Interfaz para la respuesta de la API de una sola operación (crear, editar, eliminar)
export interface UserOperationApiResponse {
  ok: number;
  message: string;
  data: User | null;
}

