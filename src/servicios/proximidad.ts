import Storage from 'expo-sqlite/kv-store';
import type { LocationObject } from 'expo-location';
import type { Lugar } from '../tipos/lugar';
import { calcularDistanciaMetros } from '../utilidades/distancias';
import { autorizarAvisos } from './notificaciones-locales';

export type RadioProximidad = 100 | 250 | 500;
export interface AjustesProximidad { activados: boolean; radio: RadioProximidad }
const CLAVE = 'mi-ciudad:avisos-cercanos-ajustes-v1';
const CANAL = 'lugares-cercanos';
let cola: Promise<unknown> = Promise.resolve();

export async function obtenerAjustesProximidad(): Promise<AjustesProximidad> {
  const texto = await Storage.getItem(CLAVE);
  if (!texto) return { activados: false, radio: 250 };
  const datos = JSON.parse(texto) as AjustesProximidad;
  return { activados: datos.activados === true, radio: [100, 250, 500].includes(datos.radio) ? datos.radio : 250 };
}
export async function guardarAjustesProximidad(ajustes: AjustesProximidad) {
  if (![100, 250, 500].includes(ajustes.radio)) throw new Error('Radio no válido.');
  await Storage.setItem(CLAVE, JSON.stringify(ajustes));
}
export function prepararAvisosProximidad() { return autorizarAvisos(CANAL, 'Lugares cercanos'); }

function diaLocal(fecha: Date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit' }).format(fecha);
}
export function elegirLugarCercano(lugares: Lugar[], posicion: LocationObject, radio: RadioProximidad) {
  const { latitude, longitude, accuracy } = posicion.coords;
  if (!Number.isFinite(latitude) || Math.abs(latitude) > 90 || !Number.isFinite(longitude) || Math.abs(longitude) > 180 ||
    typeof accuracy !== 'number' || !Number.isFinite(accuracy) || accuracy < 0 ||
    !Number.isFinite(posicion.timestamp) || Math.abs(Date.now() - posicion.timestamp) > 60000) return [];
  return lugares.filter(lugar => lugar.activo && Number.isFinite(lugar.coordenadas.latitud) && Number.isFinite(lugar.coordenadas.longitud))
    .map(lugar => ({ lugar, distancia: calcularDistanciaMetros({ latitud: latitude, longitud: longitude }, lugar.coordenadas) }))
    .filter(fila => fila.distancia + accuracy <= radio)
    .sort((a, b) => a.distancia - b.distancia);
}

export function avisarLugarCercano(lugares: Lugar[], posicion: LocationObject, radio: RadioProximidad,
  sigueActivo: () => boolean = () => true): Promise<string | null> {
  const tarea = cola.then(async () => {
    if (!sigueActivo()) return null;
    const ajustes = await obtenerAjustesProximidad();
    if (!ajustes.activados || !sigueActivo()) return null;
    const dia = diaLocal(new Date());
    const claveDia = `mi-ciudad:avisos-cercanos:${dia}`;
    const texto = await Storage.getItem(claveDia);
    const historial = texto ? JSON.parse(texto) as { ids: string[]; ultimoAviso: number } : { ids: [], ultimoAviso: 0 };
    const leidos = historial.ids;
    if (!Array.isArray(leidos) || !leidos.every(id => typeof id === 'string') || !Number.isFinite(historial.ultimoAviso)) throw new Error('No pudimos leer los avisos del día.');
    if (Date.now() - historial.ultimoAviso < 5 * 60 * 1000) return null;
    const fila = elegirLugarCercano(lugares, posicion, radio).find(fila => !leidos.includes(fila.lugar.id));
    if (!fila) return null;
    const modulo = await prepararAvisosProximidad();
    if (!sigueActivo()) return null;
    const id = `cerca-${dia}-${fila.lugar.id}`;
    // Primero reservamos el aviso para impedir repeticiones al reiniciar la app.
    await Storage.setItem(claveDia, JSON.stringify({ ids: [...leidos, fila.lugar.id], ultimoAviso: Date.now() }));
    try {
      if (!sigueActivo()) { await Storage.setItem(claveDia, JSON.stringify(historial)); return null; }
      await modulo.scheduleNotificationAsync({
        identifier: id,
        content: { title: 'Un lugar para descubrir', body: `${fila.lugar.nombre} está a unos ${Math.round(fila.distancia)} metros.`, sound: 'default', data: { lugarId: fila.lugar.id } },
        trigger: { type: modulo.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 1, repeats: false, channelId: CANAL },
      });
      return fila.lugar.nombre;
    } catch (error) {
      await Storage.setItem(claveDia, JSON.stringify(historial));
      throw error;
    }
  });
  cola = tarea.catch(() => undefined);
  return tarea;
}
