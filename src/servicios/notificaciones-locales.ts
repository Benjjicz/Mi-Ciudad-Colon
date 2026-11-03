import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';

type ModuloLocal = Pick<typeof import('expo-notifications'),
  'setNotificationHandler' | 'setNotificationChannelAsync' | 'getPermissionsAsync' |
  'requestPermissionsAsync' | 'scheduleNotificationAsync' | 'cancelScheduledNotificationAsync' |
  'AndroidImportance' | 'IosAuthorizationStatus' | 'SchedulableTriggerInputTypes'>;

let pendiente: Promise<ModuloLocal> | null = null;

// Adaptador para SDK 57: el índice del paquete carga también el módulo de topics
// de notificaciones remotas, ausente en Expo Go. Solo necesitamos APIs locales.
export function cargarNotificacionesLocales(): Promise<ModuloLocal> {
  if (pendiente) return pendiente;
  pendiente = cargar().catch(error => { pendiente = null; throw error; });
  return pendiente;
}
async function cargar(): Promise<ModuloLocal> {
  const necesarios = ['ExpoNotificationScheduler', 'ExpoNotificationPermissionsModule', 'ExpoNotificationsHandlerModule'];
  if (Platform.OS !== 'web' && necesarios.some(nombre => !requireOptionalNativeModule(nombre))) {
    throw new Error('Los avisos no están disponibles en esta instalación. Podés seguir usando la app sin ellos.');
  }
  try {
    const [handler, canales, permisos, programar, cancelar, importancia, autorizacion, tipos] = await Promise.all([
      import('expo-notifications/build/NotificationsHandler'),
      import('expo-notifications/build/setNotificationChannelAsync'),
      import('expo-notifications/build/NotificationPermissions'),
      import('expo-notifications/build/scheduleNotificationAsync'),
      import('expo-notifications/build/cancelScheduledNotificationAsync'),
      import('expo-notifications/build/NotificationChannelManager.types'),
      import('expo-notifications/build/NotificationPermissions.types'),
      import('expo-notifications/build/Notifications.types'),
    ]);
    const modulo: ModuloLocal = { ...handler, ...canales, ...permisos, ...programar, ...cancelar,
      AndroidImportance: importancia.AndroidImportance, IosAuthorizationStatus: autorizacion.IosAuthorizationStatus,
      SchedulableTriggerInputTypes: tipos.SchedulableTriggerInputTypes };
    modulo.setNotificationHandler({ handleNotification: async () => ({
      shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false,
    }) });
    return modulo;
  } catch {
    throw new Error('No pudimos preparar los avisos en esta instalación. Podés seguir usando la app sin ellos.');
  }
}
export async function autorizarAvisos(canal: string, nombre: string) {
  const modulo = await cargarNotificacionesLocales();
  if (Platform.OS === 'android') {
    await modulo.setNotificationChannelAsync(canal, { name: nombre, importance: modulo.AndroidImportance.HIGH, sound: 'default' });
  }
  let permiso = await modulo.getPermissionsAsync();
  if (!permiso.granted && permiso.canAskAgain) permiso = await modulo.requestPermissionsAsync();
  if (!permiso.granted && permiso.ios?.status !== modulo.IosAuthorizationStatus.PROVISIONAL) {
    throw new Error('Las notificaciones no están habilitadas. Podés permitirlas desde los ajustes del teléfono.');
  }
  return modulo;
}
