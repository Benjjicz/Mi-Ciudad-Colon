import { Directory, File, Paths } from 'expo-file-system';
import * as FileSystemLegacy from 'expo-file-system/legacy';
import { API_BASE_URL } from './configuracion-api';

export async function guardarFotoLocal(uri: string, id: string): Promise<string> {
  const carpeta = new Directory(Paths.document, 'fotos-visitas');
  await carpeta.create({ idempotent: true, intermediates: true });
  const origen = new File(uri);
  const extension = /^\.[a-z0-9]{1,10}$/i.test(origen.extension)
    ? origen.extension : '.jpg';
  const destino = new File(carpeta, `${id}${extension}`);
  try {
    await origen.copy(destino);
    return destino.uri;
  } catch (error) {
    try { if (destino.exists) await destino.delete(); } catch { /* Conservar el error original. */ }
    throw error;
  }
}

export async function eliminarFotoLocal(uri: string): Promise<void> {
  const archivo = new File(uri);
  if (archivo.exists) await archivo.delete();
}

export async function subirFotoAServidor(uri: string, token: string): Promise<string> {
  if (/^https?:\/\//i.test(uri)) return uri;
  const extension = uri.split('.').pop()?.toLowerCase();
  const mimeType = extension === 'png' ? 'image/png'
    : extension === 'webp' ? 'image/webp' : 'image/jpeg';

  const tarea = FileSystemLegacy.createUploadTask(`${API_BASE_URL}/archivos`, uri, {
    httpMethod: 'POST',
    uploadType: FileSystemLegacy.FileSystemUploadType.MULTIPART,
    fieldName: 'archivo', mimeType,
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  const temporizador = setTimeout(() => {
    void tarea.cancelAsync().catch(() => undefined);
  }, 30000);
  try {
    const respuesta = await tarea.uploadAsync();
    if (!respuesta) throw new Error('La subida de la foto fue cancelada o tardó demasiado.');
    const json = JSON.parse(respuesta.body) as {
      datos?: { url?: string }; error?: { mensaje?: string };
    };
    if (respuesta.status < 200 || respuesta.status >= 300) {
      throw new Error(json.error?.mensaje ?? 'No pudimos subir la foto.');
    }
    if (typeof json.datos?.url !== 'string' || !/^https?:\/\//i.test(json.datos.url)) {
      throw new Error('El servidor no devolvió una dirección válida para la foto.');
    }
    return json.datos.url;
  } finally {
    clearTimeout(temporizador);
  }
}
