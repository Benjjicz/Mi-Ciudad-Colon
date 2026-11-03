import Storage from 'expo-sqlite/kv-store';
import * as Network from 'expo-network';
import { obtenerListaCompleta } from './api';
import { pedirApi } from './http';
import { esSesionActual, obtenerSesionAPI } from './sesion';
import type { Sesion } from '../tipos/sesion';

interface Copia {
  ids: string[];
  pendientes: Record<string, boolean>;
  registros?: Record<string, unknown>[];
}
export interface EstadoColeccion {
  registros: Record<string, unknown>[];
  ids: string[];
  pendientes: number;
  conSesion: boolean;
  aviso: string | null;
}

// Comparte el mecanismo de favoritos y eventos: cada cuenta tiene su propia copia.
export function crearColeccionCuenta(nombre: string, ruta: string, campoId: string, verificarPropietario = true) {
  let cola: Promise<unknown> = Promise.resolve();
  function enOrden<T>(accion: () => Promise<T>): Promise<T> {
    const tarea = cola.then(accion);
    cola = tarea.catch(() => undefined);
    return tarea;
  }
  const clave = (sesion: Sesion) => `mi-ciudad:${nombre}:cuenta-v1:${sesion.usuario.id}`;
  async function leer(sesion: Sesion): Promise<Copia> {
    const texto = await Storage.getItem(clave(sesion));
    if (!texto) return { ids: [], pendientes: {} };
    const datos = JSON.parse(texto) as Copia;
    if (!Array.isArray(datos.ids) || !datos.ids.every(id => typeof id === 'string') ||
      !datos.pendientes || typeof datos.pendientes !== 'object' || Array.isArray(datos.pendientes) ||
      !Object.values(datos.pendientes).every(valor => typeof valor === 'boolean')) {
      throw new Error('No pudimos leer los datos guardados de esta cuenta.');
    }
    if (datos.registros !== undefined && !Array.isArray(datos.registros)) throw new Error('La copia guardada no es válida.');
    return datos;
  }
  async function verificar(sesion: Sesion) {
    if (!(await esSesionActual(sesion))) throw new Error('Cambió la cuenta. Volvé a abrir esta pantalla.');
  }
  async function escribir(sesion: Sesion, copia: Copia) {
    await verificar(sesion);
    await Storage.setItem(clave(sesion), JSON.stringify(copia));
  }
  function resultado(copia: Copia, aviso: string | null = null): EstadoColeccion {
    return { registros: copia.registros ?? [], ids: [...copia.ids], pendientes: Object.keys(copia.pendientes).length, conSesion: true, aviso };
  }
  async function sincronizar(sesion: Sesion, copia: Copia): Promise<EstadoColeccion> {
    let avisoRechazo: string | null = null;
    try {
      const red = await Network.getNetworkStateAsync();
      // La API está en la red local; no exigimos acceso a internet.
      if (red.isConnected === false) throw new Error('Sin conexión');
      for (const [id, seleccionado] of Object.entries(copia.pendientes)) {
        await verificar(sesion);
        try {
        await pedirApi(`${ruta}/${encodeURIComponent(id)}`, {
          method: seleccionado ? 'PUT' : 'DELETE',
          headers: { Authorization: `Bearer ${sesion.token}` },
        });
        } catch (error) {
          const status = (error as { status?: number } | null)?.status;
          if (!seleccionado || (status !== 404 && status !== 422)) throw error;
          await verificar(sesion);
          copia.ids = copia.ids.filter(actual => actual !== id);
          copia.registros = copia.registros?.filter(fila => fila[campoId] !== id);
          avisoRechazo = 'Un elemento ya no está disponible para guardar y fue retirado de la selección.';
        }
        await verificar(sesion);
        delete copia.pendientes[id];
        // Persistimos cada confirmación: PUT y DELETE son idempotentes si se pierde la respuesta.
        await escribir(sesion, copia);
      }
      const respuesta = await obtenerListaCompleta<Record<string, unknown>>(ruta, {
        headers: { Authorization: `Bearer ${sesion.token}` },
      });
      await verificar(sesion);
      if (!respuesta.datos.every(fila => (!verificarPropietario || fila.usuarioId === sesion.usuario.id) && typeof fila[campoId] === 'string')) {
        throw new Error('Respuesta de cuenta inválida');
      }
      copia.registros = respuesta.datos;
      copia.ids = [...new Set(respuesta.datos.map(fila => fila[campoId] as string))];
      await escribir(sesion, copia);
      return resultado(copia, avisoRechazo);
    } catch {
      await verificar(sesion);
      return resultado(copia, Object.keys(copia.pendientes).length > 0
        ? 'Cambios guardados en este teléfono. Tocá Actualizar para reintentar guardarlos en tu cuenta.'
        : 'No pudimos actualizar tu cuenta. Mostramos la copia guardada en este teléfono.');
    }
  }
  return {
    leerLocal: () => enOrden(async () => {
      const sesion = await obtenerSesionAPI();
      if (!sesion) return [];
      const copia = await leer(sesion);
      await verificar(sesion);
      return copia.ids;
    }),
    leerEstado: () => enOrden(async (): Promise<EstadoColeccion> => {
      const sesion = await obtenerSesionAPI();
      if (!sesion) return { registros: [], ids: [], pendientes: 0, conSesion: false, aviso: null };
      const copia = await leer(sesion);
      await verificar(sesion);
      return resultado(copia);
    }),
    actualizar: () => enOrden(async (): Promise<EstadoColeccion> => {
      const sesion = await obtenerSesionAPI();
      if (!sesion) return { registros: [], ids: [], pendientes: 0, conSesion: false, aviso: 'Ingresá en Mi cuenta para guardar tus elecciones.' };
      return sincronizar(sesion, await leer(sesion));
    }),
    cambiar: async (id: string, seleccionado: boolean, registro?: Record<string, unknown>) => {
      const sesion = await obtenerSesionAPI();
      if (!sesion) throw new Error('Ingresá en Mi cuenta para guardar tus elecciones.');
      return enOrden(async () => {
      await verificar(sesion);
      if (!id) throw new Error('Falta el identificador.');
      const copia = await leer(sesion);
      copia.ids = seleccionado ? [...new Set([...copia.ids, id])] : copia.ids.filter(actual => actual !== id);
      if (registro && registro[campoId] !== id) throw new Error('El identificador no coincide.');
      copia.registros = (copia.registros ?? []).filter(fila => fila[campoId] !== id);
      if (seleccionado && registro) copia.registros.push(registro);
      copia.pendientes[id] = seleccionado;
      await escribir(sesion, copia);
      return sincronizar(sesion, copia);
      });
    },
  };
}
