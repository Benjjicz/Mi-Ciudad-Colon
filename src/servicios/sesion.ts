import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import type { Sesion } from '../tipos/sesion';
import type { Usuario } from '../tipos/usuario';
import { pedirApi } from './http';

const CLAVE_SESION = 'mi-ciudad.sesion-api-v1';
// Se guarda un sobre único para que token e identidad correspondan entre sí.
export async function obtenerSesionAPI(): Promise<Sesion | null> {
  const texto = await SecureStore.getItemAsync(CLAVE_SESION);
  if (!texto) return null;
  const datos = JSON.parse(texto) as Partial<Sesion>;
  if (
    typeof datos.token !== 'string' || !datos.token ||
    typeof datos.usuario?.id !== 'string' ||
    typeof datos.usuario?.nombre !== 'string' ||
    typeof datos.usuario?.email !== 'string'
  ) {
    throw new Error('La sesión guardada no es válida. Ingresá nuevamente.');
  }
  return datos as Sesion;
}

export async function exigirSesionAPI(): Promise<Sesion> {
  const sesion = await obtenerSesionAPI();
  if (!sesion) throw new Error('Ingresá en Mi cuenta antes de guardar una visita.');
  return sesion;
}

export async function esSesionActual(sesion: Sesion): Promise<boolean> {
  const actual = await obtenerSesionAPI();
  return actual?.usuario.id === sesion.usuario.id && actual.token === sesion.token;
}

export async function iniciarSesionAPI(email: string, contrasena: string): Promise<Usuario> {
  const respuesta = await pedirApi<{ datos: Sesion }>('/auth/ingreso', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim(), contrasena }),
  });
  const sesion = respuesta.datos;
  if (
    typeof sesion?.token !== 'string' || !sesion.token ||
    typeof sesion.usuario?.id !== 'string' ||
    typeof sesion.usuario?.nombre !== 'string' ||
    typeof sesion.usuario?.email !== 'string'
  ) throw new Error('La API no devolvió una sesión válida.');
  await SecureStore.setItemAsync(CLAVE_SESION, JSON.stringify(sesion));
  return sesion.usuario;
}

export async function validarSesionAPI(sesion: Sesion): Promise<void> {
  const respuesta = await pedirApi<{ datos: Usuario }>('/yo', {
    headers: { Authorization: `Bearer ${sesion.token}` },
  });
  if (respuesta.datos?.id !== sesion.usuario.id) {
    throw new Error('La identidad del servidor no coincide con la sesión.');
  }
}

export async function cerrarSesionAPI(): Promise<void> {
  // No se borran visitas: cada usuario recupera las suyas al volver a ingresar.
  await SecureStore.deleteItemAsync(CLAVE_SESION);
}

export async function reingresoBiometrico(): Promise<boolean> {
  if (!(await obtenerSesionAPI())) return false;
  const hardware = await LocalAuthentication.hasHardwareAsync();
  const configurada = await LocalAuthentication.isEnrolledAsync();
  if (!hardware || !configurada) {
    // Alternativa explícita: volver al formulario de email y contraseña.
    return false;
  }
  const resultado = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Desbloqueá Mi Ciudad',
    cancelLabel: 'Cancelar',
    fallbackLabel: 'Usar código del dispositivo',
    disableDeviceFallback: false,
  });
  return resultado.success;
}
