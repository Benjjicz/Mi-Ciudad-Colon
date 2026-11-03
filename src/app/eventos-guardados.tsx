import { useCallback, useRef, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  actualizarEventosGuardados,
  cancelarRecordatorio,
  obtenerEventoGuardado,
  quitarEventoGuardado,
} from '../servicios/eventos-guardados';
import type { Evento } from '../tipos/evento';
import type { EventoGuardado } from '../tipos/evento-guardado';

interface FilaEvento {
  evento: Evento;
  guardado: EventoGuardado;
}

function mostrarFecha(fecha: string) {
  return new Date(fecha).toLocaleString('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export default function EventosGuardadosScreen() {
  const bloqueo = useRef(false);

  const [filas, setFilas] = useState<FilaEvento[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quitando, setQuitando] = useState<string | null>(null);
  const [intento, setIntento] = useState(0);
  const [aviso, setAviso] = useState<string | null>(null);
  const [conSesion, setConSesion] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let activo = true;

      async function cargar() {
        setCargando(true);
        setError(null);
        setFilas([]);
        setAviso(null);

        try {
          const respuesta = await actualizarEventosGuardados();
          if (activo) {
            setAviso(respuesta.aviso);
            setConSesion(respuesta.conSesion);
          }
          const eventos = respuesta.registros.filter((fila) =>
            respuesta.ids.includes(String(fila.id)) &&
            typeof fila.titulo === 'string' && typeof fila.inicio === 'string'
          ) as unknown as Evento[];

          const resultados = await Promise.all(
            eventos.map(async (evento) => {
              let guardado = await obtenerEventoGuardado(evento.id);

              if (!guardado) {
                return null;
              }

              if (guardado.notificacionId && (guardado.inicio !== evento.inicio || evento.estado !== 'programado')) {
                guardado = await cancelarRecordatorio(evento.id) ?? guardado;
              }
              return { evento, guardado };
            })
          );

          const encontrados = resultados.filter(
            (fila): fila is FilaEvento => fila !== null
          );

          encontrados.sort(
            (a, b) =>
              Date.parse(a.evento.inicio) -
              Date.parse(b.evento.inicio)
          );

          if (activo) {
            setFilas(encontrados);
          }
        } catch {
          if (activo) {
            setError('No pudimos cargar tus eventos guardados.');
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
    // intento permite repetir la carga al tocar Reintentar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [intento])
  );

  async function quitar(eventoId: string) {
    if (bloqueo.current) {
      return;
    }

    bloqueo.current = true;
    setQuitando(eventoId);

    try {
      const estado = await quitarEventoGuardado(eventoId);
      setAviso(estado.aviso);

      setFilas((actuales) =>
        actuales.filter((fila) => fila.evento.id !== eventoId)
      );
    } catch {
      Alert.alert(
        'No pudimos quitar el evento',
        'Si tenía un recordatorio, también necesitamos poder cancelarlo. Intentá nuevamente más adelante.'
      );
    } finally {
      bloqueo.current = false;
      setQuitando(null);
    }
  }

  if (cargando) {
    return (
      <View style={styles.centrado}>
        <ActivityIndicator
          size="large"
          color="#14665C"
          accessibilityLabel="Cargando eventos guardados"
        />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centrado}>
        <Text style={styles.descripcion}>{error}</Text>

        <Pressable
          accessibilityRole="button"
          onPress={() => setIntento((valor) => valor + 1)}
          style={styles.boton}
        >
          <Text style={styles.textoBoton}>Reintentar</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <SafeAreaView edges={['bottom']} style={styles.container}>
      <FlatList
        data={filas}
        keyExtractor={(fila) => fila.evento.id}
        contentContainerStyle={styles.lista}
        ListHeaderComponent={
          <View style={styles.encabezado}>
            <Pressable accessibilityRole="button" onPress={() => setIntento(valor => valor + 1)} style={styles.botonQuitar}>
              <Text style={styles.textoActualizar}>Actualizar</Text>
            </Pressable>
            {aviso && <Text style={styles.aviso}>{aviso}</Text>}
            {!conSesion && <Pressable accessibilityRole="button" onPress={() => router.push('/cuenta')} style={styles.boton}><Text style={styles.textoBoton}>Ir a Mi cuenta</Text></Pressable>}
            <Text style={styles.etiqueta}>TUS EVENTOS</Text>
            <Text style={styles.titulo}>Una salida para recordar.</Text>

            <Text style={styles.descripcion}>
              {filas.length}{' '}
              {filas.length === 1
                ? 'evento guardado'
                : 'eventos guardados'}
              {'.'}
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const { evento, guardado } = item;
          const cambioHorario = guardado.inicio !== evento.inicio;

          return (
            <View style={styles.tarjeta}>
              <Text style={styles.fecha}>
                {mostrarFecha(evento.inicio)}
              </Text>

              <Text style={styles.nombre}>{evento.titulo}</Text>

              <Text style={styles.estado}>
                {evento.estado === 'programado'
                  ? 'Programado'
                  : evento.estado === 'suspendido'
                    ? 'Suspendido'
                    : evento.estado === 'cancelado'
                      ? 'Cancelado'
                      : 'Finalizado'}
              </Text>

              {cambioHorario && (
                <Text style={styles.aviso}>
                  El horario cambió desde que lo guardaste.
                  Abrí el detalle para revisar la información.
                </Text>
              )}

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Ver evento ${evento.titulo}`}
                onPress={() =>
                  router.push({
                    pathname: '/evento/[id]',
                    params: { id: evento.id },
                  })
                }
                style={styles.boton}
              >
                <Text style={styles.textoBoton}>Ver evento</Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Quitar ${evento.titulo} de mis eventos`}
                disabled={quitando !== null}
                onPress={() => quitar(evento.id)}
                style={[
                  styles.botonQuitar,
                  quitando !== null && styles.deshabilitado,
                ]}
              >
                <Text style={styles.textoQuitar}>
                  {quitando === evento.id
                    ? 'Quitando…'
                    : 'Quitar de mis eventos'}
                </Text>
              </Pressable>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.tarjeta}>
            <Text style={styles.nombre}>
              Todavía no guardaste eventos
            </Text>

            <Text style={styles.descripcion}>
              Explorá la agenda, abrí un evento y tocá
              “Guardar evento”.
            </Text>

            <Pressable
              accessibilityRole="button"
              onPress={() => router.replace('/agenda')}
              style={styles.boton}
            >
              <Text style={styles.textoBoton}>Explorar agenda</Text>
            </Pressable>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  textoActualizar: { fontSize: 16, fontWeight: 'bold', color: '#174F49' },
  container: {
    flex: 1,
    backgroundColor: '#F7F7F2',
  },
  centrado: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F7F7F2',
  },
  lista: {
    padding: 24,
    paddingBottom: 40,
  },
  encabezado: {
    marginBottom: 26,
  },
  etiqueta: {
    fontSize: 13,
    fontWeight: 'bold',
    letterSpacing: 2,
    color: '#14665C',
  },
  titulo: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#183B42',
    marginTop: 12,
  },
  descripcion: {
    fontSize: 17,
    lineHeight: 26,
    color: '#586C70',
    marginTop: 12,
  },
  tarjeta: {
    padding: 22,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E1E6DE',
    marginBottom: 18,
  },
  fecha: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#14665C',
    marginBottom: 12,
  },
  nombre: {
    fontSize: 23,
    fontWeight: 'bold',
    color: '#183B42',
  },
  estado: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#385354',
    marginTop: 12,
  },
  aviso: {
    fontSize: 16,
    lineHeight: 24,
    color: '#8A431B',
    marginTop: 14,
  },
  boton: {
    minHeight: 48,
    padding: 16,
    borderRadius: 14,
    backgroundColor: '#174F49',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  textoBoton: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  botonQuitar: {
    minHeight: 48,
    padding: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  textoQuitar: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#A32020',
    textAlign: 'center',
  },
  deshabilitado: {
    opacity: 0.5,
  },
});