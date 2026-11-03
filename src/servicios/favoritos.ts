import { crearColeccionCuenta } from './coleccion-cuenta';

const favoritos = crearColeccionCuenta('favoritos', '/yo/favoritos', 'lugarId');

// Conservamos los nombres usados por las pantallas existentes.
export const obtenerFavoritosLocales = favoritos.leerLocal;
export const obtenerFavoritos = favoritos.actualizar;
export const guardarEstadoFavorito = favoritos.cambiar;
