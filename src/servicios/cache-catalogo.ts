import * as Network from 'expo-network';
import Storage from 'expo-sqlite/kv-store';

import type { RespuestaLista } from '../tipos/api';

async function leerCache<T>(
  clave: string
): Promise<RespuestaLista<T> | null> {
  try {
    const texto = await Storage.getItem(clave);

    if (texto === null) {
      return null;
    }

    const guardado = JSON.parse(texto);

    if (
      !guardado ||
      !Array.isArray(guardado.datos) ||
      !guardado.meta ||
      typeof guardado.meta.total !== 'number' ||
      typeof guardado.meta.pagina !== 'number' ||
      typeof guardado.meta.porPagina !== 'number'
    ) {
      return null;
    }

    // La copia fue escrita por este mismo servicio.
    // Los tipos de cada entidad se controlan en los mocks.
    return guardado as RespuestaLista<T>;
  } catch {
    return null;
  }
}

export async function obtenerConCache<T>(
  clave: string,
  consultar: () => Promise<RespuestaLista<T>>
): Promise<RespuestaLista<T>> {
  let sinConexion = false;

  try {
    const estado = await Network.getNetworkStateAsync();

    sinConexion =
      estado.isConnected === false ||
      estado.isInternetReachable === false;
  } catch {
    // Si no podemos determinar la conexión, intentamos consultar.
  }

  if (sinConexion) {
    const guardado = await leerCache<T>(clave);

    if (guardado !== null) {
      console.log(`[Catálogo] ${clave}: copia local sin conexión.`);
      return guardado;
    }

    throw new Error(
      'No hay una copia del catálogo disponible. Abrí la app con conexión primero.'
    );
  }

  let respuesta: RespuestaLista<T>;

  try {
    respuesta = await consultar();
  } catch (errorConsulta) {
    const guardado = await leerCache<T>(clave);

    if (guardado !== null) {
      console.log(
        `[Catálogo] ${clave}: copia local porque falló la consulta.`
      );
      return guardado;
    }

    throw errorConsulta;
  }

  try {
    await Storage.setItem(clave, JSON.stringify(respuesta));
    console.log(`[Catálogo] ${clave}: copia local actualizada.`);
  } catch {
    console.warn(
      `[Catálogo] ${clave}: los datos se obtuvieron, pero no pudimos guardar la copia.`
    );
  }

  return respuesta;
}