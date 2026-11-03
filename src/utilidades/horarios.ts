import type { Horario } from '../tipos/lugar';

export type EstadoHorario =
  | 'abierto'
  | 'cerrado'
  | 'sin-informacion';

function convertirMinutos(hora: string): number | null {
  const coincidencia = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hora);

  if (!coincidencia) {
    return null;
  }

  return Number(coincidencia[1]) * 60 + Number(coincidencia[2]);
}

export function obtenerEstadoHorario(
  horarios: Horario[],
  fecha: Date = new Date()
): EstadoHorario {
  if (horarios.length === 0) {
    return 'sin-informacion';
  }

  // Usamos la fecha y hora de Argentina, aunque el teléfono
  // esté configurado con otra zona horaria.
  const partes = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(fecha);

  function leer(tipo: string): number {
    return Number(partes.find((parte) => parte.type === tipo)?.value);
  }

  const dia = new Date(
    Date.UTC(leer('year'), leer('month') - 1, leer('day'))
  ).getUTCDay();

  const diaAnterior = (dia + 6) % 7;
  const minutos = leer('hour') * 60 + leer('minute');
  let hayHorarioInvalido = false;

  for (const horario of horarios) {
    const apertura = convertirMinutos(horario.abre);
    const cierre = convertirMinutos(horario.cierra);

    if (
      apertura === null ||
      cierre === null ||
      apertura === cierre
    ) {
      // Sin una regla explícita, 00:00–00:00 no significa
      // automáticamente que el lugar abra las 24 horas.
      hayHorarioInvalido = true;
      continue;
    }

    if (apertura < cierre) {
      if (
        horario.dia === dia &&
        minutos >= apertura &&
        minutos < cierre
      ) {
        return 'abierto';
      }
    } else {
      // Ejemplo: viernes de 20:30 a sábado a la 01:00.
      const abiertoAntesDeMedianoche =
        horario.dia === dia && minutos >= apertura;

      const abiertoDespuesDeMedianoche =
        horario.dia === diaAnterior && minutos < cierre;

      if (
        abiertoAntesDeMedianoche ||
        abiertoDespuesDeMedianoche
      ) {
        return 'abierto';
      }
    }
  }

  return hayHorarioInvalido ? 'sin-informacion' : 'cerrado';
}

export function mostrarEstadoHorario(
  estado: EstadoHorario
): string {
  if (estado === 'abierto') {
    return 'Abierto ahora';
  }

  if (estado === 'cerrado') {
    return 'Cerrado ahora';
  }

  return 'Sin horario informado';
}