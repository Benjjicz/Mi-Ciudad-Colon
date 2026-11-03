import type { Lugar } from '../tipos/lugar';

export const lugaresMock: Lugar[] = [
  {
    id: 'lug-001',
    nombre: 'Termas de Colón',
    categoriaId: 'cat-termas',
    descripcionCorta: 'Un lugar para disfrutar de las aguas termales.',
    descripcion:
      'Lugar de prueba para nuestra guía turística. Sus datos son ficticios.',
    coordenadas: {
      latitud: -32.208,
      longitud: -58.149,
    },
    direccion: 'Dirección de ejemplo de las termas',
    imagenes: [],
    horarios: [
      { dia: 0, abre: '09:00', cierra: '20:00' },
      { dia: 6, abre: '09:00', cierra: '20:00' },
    ],
    telefono: null,
    sitioWeb: null,
    precioEntrada: 5000,
    audioguia: {
      url: 'https://storage.googleapis.com/exoplayer-test-media-0/play.mp3',
      // El archivo de prueba obtiene su duración al cargar.
      duracionSegundos: 0,
      idioma: 'es',
    },
    codigoQr: 'COLON:lug-001',
    accesible: true,
    activo: true,
    actualizadoEn: '2026-10-19T09:00:00-03:00',
  },
  {
    id: 'lug-002',
    nombre: 'Playa de ejemplo',
    categoriaId: 'cat-playas',
    descripcionCorta: 'Una playa para descansar junto al río.',
    descripcion:
      'Segundo lugar ficticio para probar el listado de nuestra aplicación.',
    coordenadas: {
      latitud: -32.224,
      longitud: -58.135,
    },
    direccion: 'Dirección de ejemplo en la costanera',
    imagenes: [],
    horarios: [],
    telefono: null,
    sitioWeb: null,
    precioEntrada: 0,
    audioguia: null,
    codigoQr: null,
    accesible: false,
    activo: true,
    actualizadoEn: '2026-10-19T09:00:00-03:00',
  },
];