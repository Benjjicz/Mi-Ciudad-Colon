// Puente para conservar la pantalla de detalle de Agenda.
import type { Evento } from '../tipos/evento';
import {
  activarRecordatorio, guardarEventoEnCuenta, actualizarEventosGuardados,
  quitarEventoGuardado,
} from './eventos-guardados';

export type ResultadoGuardado = 'con-aviso' | 'sin-permiso' | 'muy-cerca' | 'no-disponible' | 'pendiente' | 'suspendido';

export async function estaGuardado(id: string): Promise<boolean> {
  const estado = await actualizarEventosGuardados();
  return estado.ids.includes(id);
}

export async function guardarEvento(evento: Evento): Promise<ResultadoGuardado> {
  const estado = await guardarEventoEnCuenta(evento);
  if (estado.pendientes > 0) return 'pendiente';
  if (evento.estado === 'suspendido') return 'suspendido';
  if (Date.parse(evento.inicio) - 60 * 60 * 1000 <= Date.now()) return 'muy-cerca';
  try {
    await activarRecordatorio(evento, 60);
    return 'con-aviso';
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : '';
    return mensaje.includes('no están habilitadas') ? 'sin-permiso' : 'no-disponible';
  }
}
export const quitarEvento = quitarEventoGuardado;
