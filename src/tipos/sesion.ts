import type { Usuario } from './usuario';

export interface Sesion {
  token: string;
  usuario: Usuario;
}
