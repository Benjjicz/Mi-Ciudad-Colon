import { responder } from './_base';
import type { RespuestaLista } from '../tipos/api';
import type { Categoria } from '../tipos/categoria';
import { obtenerListaCompleta } from './api';
import { obtenerConCache } from './cache-catalogo';

const CLAVE_CACHE =
  'mi-ciudad:catalogo-categorias-api-v1';

async function consultarCategorias(): Promise<
  RespuestaLista<Categoria>
> {
  const respuesta =
    await obtenerListaCompleta<Categoria>(
      '/categorias'
    );

  return {
    ...respuesta,
    datos: [...respuesta.datos].sort(
      (a, b) => a.orden - b.orden
    ),
  };
}

export async function obtenerCategorias(): Promise<
  RespuestaLista<Categoria>
> {
  return obtenerConCache<Categoria>(
    CLAVE_CACHE,
    consultarCategorias
  );
}
export async function listarCategorias() {
  return responder(async () => obtenerCategorias());
}
