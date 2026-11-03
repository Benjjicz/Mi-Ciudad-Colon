import type { Horario } from '../tipos/lugar';
import { obtenerEstadoHorario, mostrarEstadoHorario } from '../utilidades/horarios';

export interface EstadoApertura { abierto: boolean; texto: string; }
const NOMBRES_DIA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

// El mapa y el detalle deben interpretar igual turnos, medianoche y zona horaria.
export function calcularEstadoApertura(horarios: Horario[], ahora: Date = new Date()): EstadoApertura {
  const estado = obtenerEstadoHorario(horarios, ahora);
  return { abierto: estado === 'abierto', texto: mostrarEstadoHorario(estado) };
}

export function horarioSemanal(horarios: Horario[]): { dia: string; texto: string }[] {
  const orden: Horario['dia'][] = [1, 2, 3, 4, 5, 6, 0];
  return orden.map(dia => {
    const franjas = horarios.filter(h => h.dia === dia);
    return {
      dia: NOMBRES_DIA[dia],
      texto: franjas.length ? franjas.map(h => `${h.abre} a ${h.cierra}`).join(' / ') : 'Cerrado',
    };
  });
}
