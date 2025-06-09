export interface Genero {
  id: number;
  name: string;
}

// estructura que define cómo esperamos que sean los datos que recibimos de una API
export interface GeneroResponse {
  genero: Genero[];
}
