import type { Evento } from '../tipos/evento';
const ZONA = 'America/Argentina/Buenos_Aires';

export function formatearHora(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-AR', {
    timeZone: ZONA, hour: '2-digit', minute: '2-digit',
  });
}

export function formatearTituloDia(iso: string): string {
  return new Date(iso).toLocaleDateString('es-AR', {
    timeZone: ZONA, weekday: 'long', day: 'numeric', month: 'long',
  });
}

export function claveDia(iso: string): string {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(iso));
  const leer = (tipo: string) => partes.find(p => p.type === tipo)?.value;
  return `${leer('year')}-${leer('month')}-${leer('day')}`;
}

export function inicioDeHoy(): Date {
  return new Date(`${claveDia(new Date().toISOString())}T00:00:00-03:00`);
}

export interface SeccionDia { clave: string; referencia: string; data: Evento[]; }

export function agruparPorDia(eventos: Evento[], desde: Date = inicioDeHoy()): SeccionDia[] {
  const grupos = new Map<string, SeccionDia>();
  const primerDia = claveDia(desde.toISOString());
  for (const evento of eventos) {
    const comienzo = claveDia(evento.inicio);
    const ultimoDia = claveDia(evento.fin ?? evento.inicio);
    const inicial = comienzo < primerDia ? primerDia : comienzo;
    const cursor = new Date(`${inicial}T00:00:00Z`);
    // Un evento de 21:00 a 02:00 aparece en ambos días que toca.
    while (cursor.toISOString().slice(0, 10) <= ultimoDia) {
      const dia = cursor.toISOString().slice(0, 10);
      const seccion = grupos.get(dia) ?? {
        clave: dia, referencia: `${dia}T12:00:00-03:00`, data: [],
      };
      seccion.data.push(evento);
      grupos.set(dia, seccion);
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }
  return [...grupos.values()].sort((a, b) => a.clave.localeCompare(b.clave));
}

export function formatearDuracion(inicioIso: string, finIso: string): string {
  const minutos = Math.max(0, Math.round((Date.parse(finIso) - Date.parse(inicioIso)) / 60000));
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  if (horas === 0) return `${resto} min`;
  return resto === 0 ? `${horas} h` : `${horas} h ${resto} min`;
}
