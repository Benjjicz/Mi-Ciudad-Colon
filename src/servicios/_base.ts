// Adaptación del sobre de respuesta que usan las pantallas del compañero.
import type { Respuesta, RespuestaError, RespuestaExito } from '../tipos';
import { ErrorApi } from './http';

export function esError<T>(respuesta: Respuesta<T>): respuesta is RespuestaError {
  return 'error' in respuesta;
}

export async function responder<T>(
  consultar: () => Promise<RespuestaExito<T>>
): Promise<Respuesta<T>> {
  try {
    return await consultar();
  } catch (error) {
    return {
      error: {
        codigo: error instanceof ErrorApi ? error.codigo ?? `HTTP_${error.status}` : 'SIN_CONEXION',
        mensaje: error instanceof Error ? error.message : 'No pudimos cargar los datos. Intentá nuevamente.',
      },
    };
  }
}
