import { API_BASE_URL } from './configuracion-api';

export class ErrorApi extends Error {
  constructor(message: string, public status: number, public codigo?: string) {
    super(message);
    this.name = 'ErrorApi';
  }
}

export async function pedirApi<T>(ruta: string, opciones: RequestInit = {}): Promise<T> {
  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), 15000);
  try {
    const headers = new Headers(opciones.headers);
    headers.set('Accept', 'application/json');
    const respuesta = await fetch(`${API_BASE_URL}${ruta}`, {
      ...opciones, headers, signal: controlador.signal,
    });
    const texto = await respuesta.text();
    let contenido: unknown = null;
    try {
      contenido = texto ? JSON.parse(texto) : null;
    } catch {
      throw new Error('El servidor no devolvió una respuesta JSON válida.');
    }
    if (!respuesta.ok) {
      const sobre = contenido as { error?: { mensaje?: string; codigo?: string } } | null;
      throw new ErrorApi(
        sobre?.error?.mensaje ?? `La API respondió con código ${respuesta.status}.`,
        respuesta.status, sobre?.error?.codigo
      );
    }
    return contenido as T;
  } catch (error) {
    if (controlador.signal.aborted) {
      throw new Error('La API tardó demasiado. Revisá Docker y la dirección del servidor.');
    }
    throw error;
  } finally {
    clearTimeout(temporizador);
  }
}
