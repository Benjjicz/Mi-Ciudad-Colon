import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  activarRecordatorio,
  cancelarRecordatorio,
  guardarEvento,
  obtenerEventoGuardado,
  probarNotificacion,
  quitarEventoGuardado,
} from '../servicios/eventos-guardados';
import type { Evento } from '../tipos/evento';
import type { EventoGuardado } from '../tipos/evento-guardado';

export function AccionesEvento({ evento }: { evento: Evento }) {
  const bloqueo = useRef(false);

  const [registro, setRegistro] = useState<EventoGuardado | null>(
    null
  );
  const [cargando, setCargando] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let activo = true;

    async function cargar() {
      setCargando(true);
      setError(null);

      try {
        let guardado = await obtenerEventoGuardado(evento.id);

        const cambioDeHorario =
          guardado !== null &&
          guardado.inicio !== evento.inicio;

        const eventoNoProgramado = evento.estado !== 'programado';

        if (
          guardado?.notificacionId &&
          (cambioDeHorario || eventoNoProgramado)
        ) {
          guardado = await cancelarRecordatorio(evento.id);
        }

        if (activo) {
          setRegistro(guardado);
        }
      } catch {
        if (activo) {
          setError('No pudimos leer el evento guardado.');
        }
      } finally {
        if (activo) {
          setCargando(false);
        }
      }
    }

    cargar();

    return () => {
      activo = false;
    };
  }, [evento.id, evento.inicio, evento.estado, intento]);

  async function ejecutar(accion: () => Promise<void>) {
    if (bloqueo.current) {
      return;
    }

    bloqueo.current = true;
    setOcupado(true);

    try {
      await accion();
    } catch (problema) {
      Alert.alert(
        'No pudimos completar la acción',
        problema instanceof Error
          ? problema.message
          : 'Intentá nuevamente.'
      );
    } finally {
      // Volvemos a leer lo que realmente quedó guardado.
      setIntento((valor) => valor + 1);
      bloqueo.current = false;
      setOcupado(false);
    }
  }

  if (cargando) {
    return (
      <View style={styles.contenedor}>
        <ActivityIndicator
          color="#14665C"
          accessibilityLabel="Consultando evento guardado"
        />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.contenedor}>
        <Text style={styles.descripcion}>{error}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => setIntento((valor) => valor + 1)}
          style={styles.secundario}
        >
          <Text style={styles.textoSecundario}>Reintentar</Text>
        </Pressable>
      </View>
    );
  }

  const tieneAviso = registro?.notificacionId != null;

  return (
    <View style={styles.contenedor}>
      <Text style={styles.titulo}>Tu próximo plan</Text>

      <Text style={styles.descripcion}>
        {registro
          ? 'Este evento está guardado en tu teléfono.'
          : 'Guardalo para conservarlo en este teléfono.'}
      </Text>

      <Pressable
        accessibilityRole="button"
        disabled={ocupado}
        onPress={() =>
          ejecutar(async () => {
            if (registro) {
              await quitarEventoGuardado(evento.id);
            } else {
              await guardarEvento(evento);
            }
          })
        }
        style={[styles.boton, ocupado && styles.deshabilitado]}
      >
        <Text style={styles.textoBoton}>
          {registro ? 'Quitar evento guardado' : 'Guardar evento'}
        </Text>
      </Pressable>

      {registro && (
        <>
          <Text style={styles.descripcion}>
            {tieneAviso
              ? 'Aviso configurado para 15 minutos antes del inicio guardado.'
              : 'Todavía no tiene un recordatorio.'}
          </Text>

          <Pressable
            accessibilityRole="button"
            disabled={
              ocupado ||
              (!tieneAviso && evento.estado !== 'programado')
            }
            onPress={() =>
              ejecutar(async () => {
                if (tieneAviso) {
                  await cancelarRecordatorio(evento.id);
                } else {
                  await activarRecordatorio(evento);
                }
              })
            }
            style={[
              styles.secundario,
              (ocupado ||
                (!tieneAviso && evento.estado !== 'programado')) &&
                styles.deshabilitado,
            ]}
          >
            <Text style={styles.textoSecundario}>
              {tieneAviso
                ? 'Cancelar recordatorio'
                : 'Avisarme 15 minutos antes'}
            </Text>
          </Pressable>
        </>
      )}

      <Pressable
        accessibilityRole="button"
        disabled={ocupado}
        onPress={() =>
          ejecutar(async () => {
            await probarNotificacion();

            Alert.alert(
              'Prueba programada',
              'Debería aparecer una notificación en unos 10 segundos.'
            );
          })
        }
        style={styles.secundario}
      >
        <Text style={styles.textoSecundario}>
          Probar aviso en 10 segundos
        </Text>
      </Pressable>

      {ocupado && <ActivityIndicator color="#14665C" />}
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: {
    marginTop: 28,
    padding: 20,
    borderRadius: 20,
    backgroundColor: '#E7EEE8',
  },
  titulo: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#183B42',
  },
  descripcion: {
    fontSize: 17,
    lineHeight: 25,
    color: '#385354',
    marginTop: 12,
  },
  boton: {
    minHeight: 52,
    padding: 16,
    borderRadius: 14,
    backgroundColor: '#174F49',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 18,
  },
  textoBoton: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  secundario: {
    minHeight: 48,
    padding: 14,
    marginTop: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#849993',
    justifyContent: 'center',
    alignItems: 'center',
  },
  textoSecundario: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#14665C',
    textAlign: 'center',
  },
  deshabilitado: {
    opacity: 0.5,
  },
});