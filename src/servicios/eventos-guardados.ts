import type { Evento } from '../tipos/evento';
import type { EventoGuardado } from '../tipos/evento-guardado';
import { crearColeccionCuenta } from './coleccion-cuenta';
import { obtenerSesionAPI, esSesionActual } from './sesion';
import * as Recordatorios from './recordatorios-eventos';

// La API devuelve eventos completos, no filas con usuarioId/eventoId.
const guardados = crearColeccionCuenta('eventos-guardados', '/yo/eventos-guardados', 'id', false);
export const actualizarEventosGuardados = guardados.actualizar;
export const obtenerEstadoEventosGuardados = guardados.leerEstado;

export async function obtenerEventoGuardado(id: string): Promise<EventoGuardado | null> {
  const sesion = await obtenerSesionAPI();
  if (!sesion) return null;
  const estado = await guardados.leerEstado();
  if (!(await esSesionActual(sesion))) throw new Error('Cambió la cuenta. Volvé a abrir esta pantalla.');
  if (!estado.ids.includes(id)) return null;
  const aviso = await Recordatorios.obtenerEventoGuardado(id, sesion);
  const evento = estado.registros.find(fila => fila.id === id);
  return aviso ?? { eventoId: id, inicio: typeof evento?.inicio === 'string' ? evento.inicio : '', notificacionId: null };
}

export async function guardarEventoEnCuenta(evento: Evento) {
  if (evento.estado !== 'programado' && evento.estado !== 'suspendido') {
    throw new Error('Solo podés guardar eventos programados o suspendidos.');
  }
  const estado = await guardados.cambiar(evento.id, true, { ...evento });
  if (!estado.ids.includes(evento.id)) throw new Error(estado.aviso ?? 'El evento ya no está disponible.');
  return estado;
}
export async function guardarEvento(evento: Evento): Promise<EventoGuardado> {
  await guardarEventoEnCuenta(evento);
  return { eventoId: evento.id, inicio: evento.inicio, notificacionId: null };
}

export async function activarRecordatorio(evento: Evento, minutosAntes = 15): Promise<EventoGuardado> {
  const sesion = await obtenerSesionAPI();
  if (!sesion || !(await obtenerEventoGuardado(evento.id))) throw new Error('Guardá primero el evento en tu cuenta.');
  return Recordatorios.activarRecordatorio(evento, minutosAntes, sesion);
}
export const cancelarRecordatorio = Recordatorios.cancelarRecordatorio;
export const probarNotificacion = Recordatorios.probarNotificacion;

export async function quitarEventoGuardado(id: string) {
  const sesion = await obtenerSesionAPI();
  if (!sesion) throw new Error('Ingresá en Mi cuenta.');
  // Si existía un aviso, primero lo cancelamos para no dejarlo activo al quitar el evento.
  await Recordatorios.quitarEventoGuardado(id, sesion);
  if (!(await esSesionActual(sesion))) throw new Error('Cambió la cuenta. Volvé a abrir esta pantalla.');
  return guardados.cambiar(id, false);
}
