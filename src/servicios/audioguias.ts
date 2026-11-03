import * as Crypto from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';

const descargas = new Map<string, Promise<string>>();

async function obtenerArchivo(url: string): Promise<File> {
  const direccion = new URL(url);

  if (
    direccion.protocol !== 'https:' &&
    direccion.protocol !== 'http:'
  ) {
    throw new Error('La dirección de la audioguía no es válida.');
  }

  const identificador = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    url
  );

  const coincidencia = direccion.pathname.match(
    /(\.[a-z0-9]{1,10})$/i
  );

  const extension = coincidencia?.[1] ?? '.audio';
  const carpeta = new Directory(Paths.document, 'audioguias');

  return new File(carpeta, `${identificador}${extension}`);
}

export async function obtenerAudioguiaDescargada(
  url: string
): Promise<string | null> {
  const archivo = await obtenerArchivo(url);

  return archivo.exists && archivo.size > 0
    ? archivo.uri
    : null;
}

export function descargarAudioguia(url: string): Promise<string> {
  const pendiente = descargas.get(url);

  if (pendiente) {
    return pendiente;
  }

  const tarea = realizarDescarga(url);
  descargas.set(url, tarea);

  tarea.then(
    () => descargas.delete(url),
    () => descargas.delete(url)
  );

  return tarea;
}

async function realizarDescarga(url: string): Promise<string> {
  const destino = await obtenerArchivo(url);

  if (destino.exists && destino.size > 0) {
    return destino.uri;
  }

  const carpeta = new Directory(Paths.document, 'audioguias');

  carpeta.create({
    idempotent: true,
    intermediates: true,
  });

  const temporal = new File(
    Paths.cache,
    `audio-${Crypto.randomUUID()}.tmp`
  );

  // move() actualiza la URI del objeto File; la limpieza usa la ruta original.
  const uriTemporal = temporal.uri;

  try {
    const descargado = await File.downloadFileAsync(url, temporal);

    if (!descargado.exists || descargado.size === 0) {
      throw new Error('La descarga no contiene un archivo válido.');
    }

    if (destino.exists) {
      destino.delete();
    }

    await descargado.move(destino);

    if (!destino.exists || destino.size === 0) {
      throw new Error('No pudimos conservar el audio descargado.');
    }

    return destino.uri;
  } finally {
    const sobrante = new File(uriTemporal);
    if (sobrante.exists) {
      try {
        sobrante.delete();
      } catch {
        // La limpieza no debe ocultar el resultado de la descarga.
      }
    }
  }
}

export async function eliminarAudioguiaDescargada(
  url: string
): Promise<void> {
  const pendiente = descargas.get(url);

  if (pendiente) {
    try {
      await pendiente;
    } catch {
      // También permitimos eliminar después de una descarga fallida.
    }
  }

  const archivo = await obtenerArchivo(url);

  if (archivo.exists) {
    archivo.delete();
  }
}