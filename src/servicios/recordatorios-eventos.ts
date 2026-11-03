import Storage from 'expo-sqlite/kv-store';
import { cargarNotificacionesLocales, autorizarAvisos } from './notificaciones-locales';
import { obtenerSesionAPI, esSesionActual } from './sesion';
import type { Sesion } from '../tipos/sesion';

import type { Evento } from '../tipos/evento';
import type { EventoGuardado } from '../tipos/evento-guardado';

const CANAL = 'recordatorios-eventos';

const cargarNotificaciones = cargarNotificacionesLocales;

async function cuenta(sesion?: Sesion): Promise<Sesion> {
  const actual = sesion ?? await obtenerSesionAPI();
  if (!actual || !(await esSesionActual(actual))) throw new Error('Ingresá nuevamente en Mi cuenta.');
  return actual;
}
function clave(eventoId: string, sesion: Sesion) {
  return `mi-ciudad:recordatorio:${sesion.usuario.id}:${eventoId}`;
}

async function escribir(registro: EventoGuardado, sesion: Sesion) {
  await cuenta(sesion);
  await Storage.setItem(
    clave(registro.eventoId, sesion),
    JSON.stringify(registro)
  );
}

export async function obtenerEventoGuardado(
  eventoId: string, sesionRecibida?: Sesion
): Promise<EventoGuardado | null> {
  const sesion = await cuenta(sesionRecibida);
  const texto = await Storage.getItem(clave(eventoId, sesion));

  if (texto === null) {
    return null;
  }

  const datos: unknown = JSON.parse(texto);

  if (
    typeof datos !== 'object' ||
    datos === null ||
    !('eventoId' in datos) ||
    datos.eventoId !== eventoId ||
    !('inicio' in datos) ||
    typeof datos.inicio !== 'string' ||
    !('notificacionId' in datos) ||
    (datos.notificacionId !== null &&
      typeof datos.notificacionId !== 'string')
  ) {
    throw new Error('El evento guardado tiene un formato inválido.');
  }

  await cuenta(sesion);
  return {
    eventoId,
    inicio: datos.inicio,
    notificacionId: datos.notificacionId,
  };
}

export async function guardarEvento(
  evento: Evento, sesionRecibida?: Sesion
): Promise<EventoGuardado> {
  const sesion = await cuenta(sesionRecibida);
  const existente = await obtenerEventoGuardado(evento.id, sesion);

  if (existente) {
    return existente;
  }

  const registro: EventoGuardado = {
    eventoId: evento.id,
    inicio: evento.inicio,
    notificacionId: null,
  };

  await escribir(registro, sesion);
  return registro;
}

function pedirPermisoNotificaciones() {
  return autorizarAvisos(CANAL, 'Recordatorios de eventos');
}

export async function activarRecordatorio(
  evento: Evento,
  minutosAntes: number = 15, sesionRecibida?: Sesion
): Promise<EventoGuardado> {
  const sesion = await cuenta(sesionRecibida);
  if (evento.estado !== 'programado') {
    throw new Error(
      'Solo podés activar avisos para eventos programados.'
    );
  }

  const fechaAviso = new Date(
    Date.parse(evento.inicio) - minutosAntes * 60 * 1000
  );

  if (
    !Number.isFinite(fechaAviso.getTime()) ||
    fechaAviso.getTime() <= Date.now()
  ) {
    throw new Error(
      `Este evento ya comenzó o faltan menos de ${minutosAntes} minutos. Podés guardarlo sin programar este aviso.`
    );
  }

  const modulo = await pedirPermisoNotificaciones();
  const registro = await guardarEvento(evento, sesion);

  if (registro.notificacionId !== null) {
    await modulo.cancelScheduledNotificationAsync(
      registro.notificacionId
    );

    await escribir({
      ...registro,
      notificacionId: null,
    }, sesion);
  }

  if (fechaAviso.getTime() <= Date.now()) {
    throw new Error('Ya pasó el horario del recordatorio.');
  }

  await cuenta(sesion);
  const notificacionId = await modulo.scheduleNotificationAsync({
    content: {
      title: 'Tu próximo plan en Colón',
      body: `${evento.titulo} empieza en ${minutosAntes} minutos.`,
      sound: 'default',
      data: { eventoId: evento.id },
    },
    trigger: {
      type: modulo.SchedulableTriggerInputTypes.DATE,
      date: fechaAviso,
      channelId: CANAL,
    },
  });

  const actualizado: EventoGuardado = {
    eventoId: evento.id,
    inicio: evento.inicio,
    notificacionId,
  };

  try {
    await escribir(actualizado, sesion);
  } catch (error) {
    await modulo.cancelScheduledNotificationAsync(
      notificacionId
    );
    throw error;
  }

  return actualizado;
}

export async function cancelarRecordatorio(
  eventoId: string, sesionRecibida?: Sesion
): Promise<EventoGuardado | null> {
  const sesion = await cuenta(sesionRecibida);
  const registro = await obtenerEventoGuardado(eventoId, sesion);

  if (!registro) {
    return null;
  }

  if (registro.notificacionId !== null) {
    const modulo = await cargarNotificaciones();

    await modulo.cancelScheduledNotificationAsync(
      registro.notificacionId
    );
  }

  const actualizado: EventoGuardado = {
    ...registro,
    notificacionId: null,
  };

  await escribir(actualizado, sesion);
  return actualizado;
}

export async function quitarEventoGuardado(
  eventoId: string, sesionRecibida?: Sesion
): Promise<void> {
  const sesion = await cuenta(sesionRecibida);
  await cancelarRecordatorio(eventoId, sesion);
  await cuenta(sesion);
  await Storage.removeItem(clave(eventoId, sesion));
}

export async function probarNotificacion(): Promise<void> {
  const modulo = await pedirPermisoNotificaciones();
  const identificador = 'mi-ciudad-prueba-recordatorio';

  await modulo.cancelScheduledNotificationAsync(identificador);

  await modulo.scheduleNotificationAsync({
    identifier: identificador,
    content: {
      title: '¡Mi Ciudad te avisa!',
      body: 'La prueba de notificaciones locales funciona.',
      sound: 'default',
    },
    trigger: {
      type: modulo.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 10,
      repeats: false,
      channelId: CANAL,
    },
  });
}