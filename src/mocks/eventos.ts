import type { Evento } from '../tipos/evento';

function fechaEvento(dias: number, hora: number): string {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const obtener = (tipo: string) =>
    partes.find((parte) => parte.type === tipo)?.value;

  const fecha = new Date(
    `${obtener('year')}-${obtener('month')}-${obtener('day')}` +
      `T${String(hora).padStart(2, '0')}:00:00-03:00`
  );

  fecha.setTime(fecha.getTime() + dias * 24 * 60 * 60 * 1000);

  return fecha.toISOString();
}

export const eventosMock: Evento[] = [
  {
    id: 'evt-001',
    titulo: 'Atardecer junto al río',
    descripcion:
      'Una caminata de ejemplo para descubrir la costanera y disfrutar del paisaje. Actividad ficticia para el TP.',
    lugarId: 'lug-002',
    direccionLibre: null,
    coordenadas: null,
    inicio: fechaEvento(0, 18),
    fin: fechaEvento(0, 19),
    imagenUrl: null,
    precio: 0,
    estado: 'programado',
  },
  {
    id: 'evt-002',
    titulo: 'Noche de música en Colón',
    descripcion:
      'Encuentro musical de prueba con artistas de la región. Los datos no corresponden a un evento real.',
    lugarId: null,
    direccionLibre: 'Anfiteatro de ejemplo, costanera de Colón',
    coordenadas: {
      latitud: -32.224,
      longitud: -58.135,
    },
    inicio: fechaEvento(0, 21),
    fin: fechaEvento(0, 23),
    imagenUrl: null,
    precio: 2500,
    estado: 'programado',
  },
  {
    id: 'evt-003',
    titulo: 'Feria de artesanías',
    descripcion:
      'Evento ficticio suspendido para comprobar cómo mostramos los cambios de estado en la agenda.',
    lugarId: null,
    direccionLibre: 'Plaza de ejemplo, Colón',
    coordenadas: null,
    inicio: fechaEvento(1, 16),
    fin: fechaEvento(1, 20),
    imagenUrl: null,
    precio: 0,
    estado: 'suspendido',
  },
];