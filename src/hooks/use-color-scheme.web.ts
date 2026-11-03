import { useSyncExternalStore } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

const suscribir = () => () => {};
const enCliente = () => true;
const enServidor = () => false;

/** Mantiene el tema inicial claro durante el render estático y la hidratación. */
export function useColorScheme() {
  const hidratado = useSyncExternalStore(suscribir, enCliente, enServidor);
  const colorScheme = useRNColorScheme();
  return hidratado ? colorScheme : 'light';
}
