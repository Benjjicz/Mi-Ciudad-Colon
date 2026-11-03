import type { RespuestaLista } from '../tipos/api';
import type { Evento } from '../tipos/evento';
import { obtenerListaCompleta } from './api';
import { obtenerConCache } from './cache-catalogo';
import { pedirApi } from './http';
import { responder } from './_base';
import { claveDia } from '../utils/fechas';

export async function obtenerEventos(): Promise<RespuestaLista<Evento>> {
  return consultarDesde(new Date());
}

async function consultarDesde(desde: Date): Promise<RespuestaLista<Evento>> {
  const dia = claveDia(desde.toISOString());
  return obtenerConCache<Evento>(
    `mi-ciudad:eventos-api-v1:${dia}`,
    () => obtenerListaCompleta<Evento>(`/eventos?desde=${encodeURIComponent(dia)}`)
  );
}

export async function obtenerEventoPorId(id: string): Promise<{ datos: Evento }> {
  const respuesta = await obtenerConCache<Evento>(
    `mi-ciudad:evento-api-v1:${id}`,
    async () => {
      const sobre = await pedirApi<{ datos: Evento }>(`/eventos/${encodeURIComponent(id)}`);
      if (!sobre.datos || sobre.datos.id !== id) throw new Error('La API no devolvió el evento solicitado.');
      return { datos: [sobre.datos], meta: { total: 1, pagina: 1, porPagina: 1 } };
    }
  );
  if (!respuesta.datos[0]) throw new Error('No existe ese evento.');
  return { datos: respuesta.datos[0] };
}

export function listarEventosDesde(desde: Date) {
  return responder(() => consultarDesde(desde));
}

export function obtenerEvento(id: string) {
  return responder(() => obtenerEventoPorId(id));
}
