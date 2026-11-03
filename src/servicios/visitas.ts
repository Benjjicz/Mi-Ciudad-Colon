import * as Crypto from 'expo-crypto';
import * as Location from 'expo-location';
import * as Network from 'expo-network';
import type { Lugar } from '../tipos/lugar';
import type { Sesion } from '../tipos/sesion';
import type { OrigenVisita, Visita, VisitaLocal } from '../tipos/visita';
import { calcularDistanciaMetros as distanciaMetros } from '../utilidades/distancias';
import { eliminarFotoLocal, guardarFotoLocal, subirFotoAServidor } from './archivos';
import { obtenerListaCompleta } from './api';
import { obtenerDb } from './db';
import { pedirApi } from './http';
import { obtenerLugarPorId, obtenerLugares } from './lugares';
import { esSesionActual, exigirSesionAPI, obtenerSesionAPI } from './sesion';

const RADIO_VISITA_METROS = 100;

export interface NuevaVisita {
  lugarId: string;
  nota: string;
  fotoUri?: string | null;
}

interface FilaVisita {
  id: string;
  usuarioId: string;
  lugarId: string;
  fechaHora: string;
  origen: OrigenVisita;
  fotoUri: string | null;
  fotoRemota: string | null;
  nota: string | null;
  sincronizada: number;
}

function convertirFila(fila: FilaVisita): VisitaLocal {
  return {
    id: fila.id, lugarId: fila.lugarId, fechaHora: fila.fechaHora,
    origen: fila.origen, fotoUri: fila.fotoUri ?? fila.fotoRemota,
    nota: fila.nota, sincronizada: fila.sincronizada === 1,
  };
}

export async function obtenerVisitasLocales(): Promise<VisitaLocal[]> {
  const sesion = await obtenerSesionAPI();
  if (!sesion) return [];
  const filas = obtenerDb().getAllSync<FilaVisita>(
    'SELECT * FROM visitas WHERE usuarioId = ? ORDER BY fechaHora DESC',
    [sesion.usuario.id]
  );
  return filas.map(convertirFila);
}

async function guardarVisita(
  entrada: NuevaVisita, origen: OrigenVisita,
  sesion: Sesion
): Promise<VisitaLocal> {
  const lugarId = entrada.lugarId.trim();
  const nota = entrada.nota.trim();
  if (!lugarId) throw new Error('Falta seleccionar el lugar.');
  if (nota.length > 300) throw new Error('La nota admite hasta 300 caracteres.');

  const id = `vis-${Crypto.randomUUID().replace(/-/g, '')}`;
  const fechaHora = new Date().toISOString();
  let fotoLocal: string | null = null;
  try {
    if (entrada.fotoUri) fotoLocal = await guardarFotoLocal(entrada.fotoUri, id);
    if (!(await esSesionActual(sesion))) {
      throw new Error('La cuenta cambió. Volvé a abrir el formulario.');
    }
    obtenerDb().runSync(
      `INSERT INTO visitas
        (id, usuarioId, lugarId, fechaHora, origen, fotoUri, nota, sincronizada)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
      [id, sesion.usuario.id, lugarId, fechaHora, origen, fotoLocal, nota || null]
    );
  } catch (error) {
    if (fotoLocal) {
      try { await eliminarFotoLocal(fotoLocal); } catch { /* Mantener el error original. */ }
    }
    throw error;
  }
  // Primero queda guardada; una falla de red nunca pierde la visita.
  void intentarSincronizar().catch(() => undefined);
  return { id, lugarId, fechaHora, origen, fotoUri: fotoLocal, nota: nota || null, sincronizada: false };
}

export async function registrarVisitaManual(entrada: NuevaVisita): Promise<VisitaLocal> {
  const sesion = await exigirSesionAPI();
  return guardarVisita(entrada, 'manual', sesion);
}
export async function buscarLugarPorQr(
  codigo: string
): Promise<Lugar> {
  const coincidencia = /^COLON:([a-zA-Z0-9_-]{1,100})$/.exec(
    codigo.trim()
  );

  if (!coincidencia) {
    throw new Error('Este QR no pertenece a Mi Ciudad.');
  }

  const respuesta = await obtenerLugarPorId(coincidencia[1]);
  const lugar = respuesta.datos;

  if (!lugar.activo || lugar.codigoQr !== codigo.trim()) {
    throw new Error('El QR no corresponde a un lugar disponible.');
  }

  return lugar;
}

export async function registrarVisitaPorQr(
  codigo: string,
  nota: string,
  fotoUri: string | null = null
): Promise<VisitaLocal> {
  const sesion = await exigirSesionAPI();
  const lugar = await buscarLugarPorQr(codigo);

  return guardarVisita(
    {
      lugarId: lugar.id,
      nota,
      fotoUri,
    },
    'qr',
    sesion
  );
}


export async function registrarVisitaPorGps(
  entrada: NuevaVisita
): Promise<VisitaLocal> {
  const sesion = await exigirSesionAPI();
  const respuesta = await obtenerLugarPorId(entrada.lugarId);
  const lugar = respuesta.datos;

  if (!lugar.activo) {
    throw new Error('Este lugar no está disponible.');
  }

  const permiso = await Location.requestForegroundPermissionsAsync();

  if (!permiso.granted) {
    throw new Error(
      'No tenemos permiso de ubicación. Podés habilitarlo en los ajustes de Expo Go o registrar la visita manualmente.'
    );
  }

  const serviciosActivos = await Location.hasServicesEnabledAsync();

  if (!serviciosActivos) {
    throw new Error(
      'Activá la ubicación del teléfono o elegí el registro manual.'
    );
  }

  let posicion: Location.LocationObject;

  try {
    posicion = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
  } catch {
    throw new Error(
      'No pudimos obtener tu ubicación. Probá nuevamente o usá el registro manual.'
    );
  }

  const { latitude, longitude, accuracy } = posicion.coords;

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    !Number.isFinite(posicion.timestamp) ||
    Date.now() - posicion.timestamp > 60000
  ) {
    throw new Error(
      'No recibimos una ubicación reciente y válida. Intentá nuevamente.'
    );
  }

  const distancia = distanciaMetros(
    { latitud: latitude, longitud: longitude },
    lugar.coordenadas
  );

  if (distancia > RADIO_VISITA_METROS) {
    const textoDistancia = distancia >= 1000
      ? `${(distancia / 1000).toFixed(1)} km`
      : `${Math.round(distancia)} metros`;

    throw new Error(
      `Estás aproximadamente a ${textoDistancia} del lugar. Para registrarlo por GPS tenés que estar a menos de ${RADIO_VISITA_METROS} metros. También podés usar el registro manual.`
    );
  }

  if (
    accuracy === null ||
    !Number.isFinite(accuracy) ||
    accuracy < 0 ||
    distancia + accuracy > RADIO_VISITA_METROS
  ) {
    throw new Error(
      'La precisión de la ubicación no alcanza para confirmar la cercanía. Probá al aire libre o usá el registro manual.'
    );
  }

  return guardarVisita(entrada, 'gps', sesion);
}
// Una sincronización por vez evita subir dos veces la misma foto.
let sincronizacion: Promise<void> | null = null;

export function intentarSincronizar(): Promise<void> {
  if (sincronizacion) return sincronizacion;
  const tarea = sincronizar();
  sincronizacion = tarea;
  void tarea.then(
    () => { sincronizacion = null; },
    () => { sincronizacion = null; }
  );
  return tarea;
}

async function sincronizar(): Promise<void> {
  const sesion = await obtenerSesionAPI();
  if (!sesion) return;
  const red = await Network.getNetworkStateAsync();
  if (red.isConnected === false) {
    throw new Error('Sin conexión. Tus visitas siguen guardadas en este teléfono.');
  }
  // No exigimos internet público: la API puede estar en la red local.
  const db = obtenerDb();
  const usuarioId = sesion.usuario.id;
  const headers = { Authorization: `Bearer ${sesion.token}` };
  const pendientes = db.getAllSync<FilaVisita>(
    'SELECT * FROM visitas WHERE usuarioId = ? AND sincronizada = 0 ORDER BY fechaHora',
    [usuarioId]
  );
  const errores: string[] = [];
  for (const visita of pendientes) {
    if (!(await esSesionActual(sesion))) return;
    try {
      let fotoRemota = visita.fotoRemota;
      if (!fotoRemota && visita.fotoUri) {
        fotoRemota = await subirFotoAServidor(visita.fotoUri, sesion.token);
        if (!(await esSesionActual(sesion))) return;
        db.runSync(
          'UPDATE visitas SET fotoRemota = ? WHERE id = ? AND usuarioId = ?',
          [fotoRemota, visita.id, usuarioId]
        );
      }
      // Comprobar la cuenta tras cada operación que espera a la red.
      if (!(await esSesionActual(sesion))) return;
      const respuesta = await pedirApi<{ datos: Visita }>('/yo/visitas', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: visita.id, lugarId: visita.lugarId,
          fechaHora: visita.fechaHora, origen: visita.origen,
          fotoUri: fotoRemota, nota: visita.nota,
        }),
      });
      if (!(await esSesionActual(sesion))) return;
      if (respuesta.datos?.id !== visita.id || respuesta.datos.usuarioId !== usuarioId) {
        throw new Error('El servidor devolvió una visita de otra identidad.');
      }
      db.runSync(
        'UPDATE visitas SET sincronizada = 1 WHERE id = ? AND usuarioId = ?',
        [visita.id, usuarioId]
      );
    } catch (error) {
      errores.push(error instanceof Error ? error.message : 'No pudimos subir una visita.');
    }
  }
  if (!(await esSesionActual(sesion))) return;
  const remotas = await obtenerListaCompleta<Visita>('/yo/visitas', { headers });
  if (!(await esSesionActual(sesion))) return;
  for (const remota of remotas.datos) {
    if (remota.usuarioId !== usuarioId) {
      throw new Error('La API devolvió visitas de otra cuenta.');
    }
  }
  db.withTransactionSync(() => {
    for (const remota of remotas.datos) {
      db.runSync(
        `INSERT INTO visitas
          (id, usuarioId, lugarId, fechaHora, origen, fotoUri, fotoRemota, nota, sincronizada)
         VALUES (?, ?, ?, ?, ?, NULL, ?, ?, 1)
         ON CONFLICT(id) DO UPDATE SET
           fotoRemota = excluded.fotoRemota, nota = excluded.nota,
           fechaHora = excluded.fechaHora, origen = excluded.origen
         WHERE visitas.usuarioId = excluded.usuarioId AND visitas.sincronizada = 1`,
        [remota.id, usuarioId, remota.lugarId, remota.fechaHora,
          remota.origen, remota.fotoUri, remota.nota]
      );
    }
  });
  if (errores.length) {
    throw new Error(`Quedaron visitas pendientes: ${errores[0]}`);
  }
}

// Incorporado desde v8: detectar el lugar más cercano sin elegirlo a mano.
// Se usa el catálogo completo y la misma validación GPS al guardar.
export async function detectarLugarCercano(): Promise<Lugar> {
  await exigirSesionAPI();
  const permiso = await Location.requestForegroundPermissionsAsync();
  if (!permiso.granted) throw new Error('Necesitamos permiso de ubicación.');
  if (!(await Location.hasServicesEnabledAsync())) throw new Error('Activá la ubicación del teléfono.');
  let posicion: Location.LocationObject;
  try {
    posicion = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
  } catch {
    throw new Error('No pudimos obtener tu ubicación. Probá al aire libre o elegí el lugar manualmente.');
  }
  const { latitude, longitude, accuracy } = posicion.coords;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
      !Number.isFinite(posicion.timestamp) || Date.now() - posicion.timestamp > 60000) {
    throw new Error('No recibimos una ubicación reciente y válida. Intentá nuevamente.');
  }
  const respuesta = await obtenerLugares();
  let detectado: Lugar | null = null;
  let distanciaMinima = RADIO_VISITA_METROS + 1;
  for (const lugar of respuesta.datos) {
    if (!lugar.activo) continue;
    const distancia = distanciaMetros({ latitud: latitude, longitud: longitude }, lugar.coordenadas);
    if (distancia <= RADIO_VISITA_METROS && distancia < distanciaMinima) {
      distanciaMinima = distancia;
      detectado = lugar;
    }
  }
  if (!detectado) throw new Error('No estás a menos de 100 metros de ningún lugar turístico registrado.');
  if (accuracy === null || !Number.isFinite(accuracy) || accuracy < 0 || distanciaMinima + accuracy > RADIO_VISITA_METROS) {
    throw new Error('La ubicación no tiene suficiente precisión. Probá al aire libre o elegí el lugar manualmente.');
  }
  return detectado;
}

export async function registrarVisitaUbicacionActual(nota: string, fotoUri?: string | null): Promise<VisitaLocal> {
  const sesion = await exigirSesionAPI();
  const lugar = await detectarLugarCercano();
  if (!(await esSesionActual(sesion))) throw new Error('La cuenta cambió. Volvé a intentar.');
  return guardarVisita({ lugarId: lugar.id, nota, fotoUri }, 'gps', sesion);
}
