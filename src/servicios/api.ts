import type { RespuestaLista } from '../tipos/api';

import { pedirApi } from './http';

async function consultarPagina<T>(
  ruta: string,
  pagina: number,
  opciones: RequestInit = {}
): Promise<RespuestaLista<T>> {
  const contenido: unknown = await pedirApi(
    `${ruta}${ruta.includes('?') ? '&' : '?'}pagina=${pagina}&porPagina=100`,
    opciones
  );

  if (
    typeof contenido !== 'object' ||
    contenido === null ||
    !('datos' in contenido) ||
    !Array.isArray(contenido.datos) ||
    !('meta' in contenido) ||
    typeof contenido.meta !== 'object' ||
    contenido.meta === null
  ) {
    throw new Error(
      'La API devolvió una respuesta con un formato inesperado.'
    );
  }

  const meta = contenido.meta;

  if (
    !('total' in meta) ||
    typeof meta.total !== 'number' ||
    !Number.isSafeInteger(meta.total) ||
    meta.total < 0 ||
    !('pagina' in meta) ||
    meta.pagina !== pagina ||
    !('porPagina' in meta) ||
    typeof meta.porPagina !== 'number' ||
    !Number.isSafeInteger(meta.porPagina) ||
    meta.porPagina <= 0
  ) {
    throw new Error(
      'La información de paginación no es válida.'
    );
  }

  // Validamos el sobre y la paginación.
  // T describe los elementos según el contrato de la API.
  return contenido as RespuestaLista<T>;
}

export async function obtenerListaCompleta<T>(
  ruta: string,
  opciones: RequestInit = {}
): Promise<RespuestaLista<T>> {
  const elementos: T[] = [];
  let pagina = 1;

  while (true) {
    const respuesta = await consultarPagina<T>(
      ruta,
      pagina,
      opciones
    );

    elementos.push(...respuesta.datos);

    const ultimaPagina = Math.max(
      1,
      Math.ceil(
        respuesta.meta.total / respuesta.meta.porPagina
      )
    );

    if (pagina >= ultimaPagina) {
      break;
    }

    if (respuesta.datos.length === 0) {
      throw new Error(
        'La API devolvió una página vacía antes de completar la lista.'
      );
    }

    if (pagina >= 1000) {
      throw new Error(
        'La consulta superó el límite de páginas permitido.'
      );
    }

    pagina += 1;
  }

  // Devolvemos una sola lista reunida para las pantallas actuales.
  return {
    datos: elementos,
    meta: {
      total: elementos.length,
      pagina: 1,
      porPagina: Math.max(1, elementos.length),
    },
  };
}