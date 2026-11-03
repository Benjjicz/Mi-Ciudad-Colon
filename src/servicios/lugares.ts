import { responder } from './_base';
import type { RespuestaLista } from '../tipos/api';
import type { Lugar } from '../tipos/lugar';
import { obtenerListaCompleta } from './api';
import { obtenerConCache } from './cache-catalogo';

const CLAVE_CACHE = 'mi-ciudad:catalogo-lugares-api-v1';

async function consultarLugares(): Promise<
  RespuestaLista<Lugar>
> {
  return obtenerListaCompleta<Lugar>('/lugares');
}

export async function obtenerLugares(): Promise<
  RespuestaLista<Lugar>
> {
  return obtenerConCache<Lugar>(
    CLAVE_CACHE,
    consultarLugares
  );
}

export async function obtenerLugarPorId(
  id: string
): Promise<{ datos: Lugar }> {
  const respuesta = await obtenerLugares();

  const lugar = respuesta.datos.find(
    (elemento) => elemento.id === id
  );

  if (!lugar) {
    throw new Error(
      'No encontramos ese lugar en el catálogo disponible.'
    );
  }

  return { datos: lugar };
}
// Nombres usados por las pantallas de lugares del compañero.
export async function listarLugares() {
  return responder(async () => obtenerLugares());
}

export async function obtenerLugar(id: string) {
  return responder(async () => obtenerLugarPorId(id));
}
