import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import {
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
} from 'expo-audio';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  descargarAudioguia,
  eliminarAudioguiaDescargada,
  obtenerAudioguiaDescargada,
} from '../servicios/audioguias';
import type { Audioguia } from '../tipos/lugar';

// Expo Go Android no incluye el servicio de reproducción de nuestra compilación.
const segundoPlanoDisponible = !(Platform.OS === 'android' &&
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient);

function mostrarTiempo(segundos: number): string {
  const total = Number.isFinite(segundos)
    ? Math.max(0, Math.floor(segundos))
    : 0;

  return (
    `${Math.floor(total / 60)}:` +
    String(total % 60).padStart(2, '0')
  );
}

export function ReproductorAudioguia({
  audioguia,
  nombreLugar = 'Audioguía de Colón',
}: {
  audioguia: Audioguia | null;
  nombreLugar?: string;
}) {
  if (!audioguia) {
    return (
      <View style={styles.contenedor}>
        <Text style={styles.titulo}>Audioguía</Text>
        <Text style={styles.descripcion}>
          Este lugar todavía no tiene audioguía.
        </Text>
      </View>
    );
  }

  return (
    <GestorAudioguia
      key={audioguia.url}
      audioguia={audioguia}
      nombreLugar={nombreLugar}
    />
  );
}

function GestorAudioguia({
  audioguia,
  nombreLugar,
}: {
  audioguia: Audioguia;
  nombreLugar: string;
}) {
  const [archivoLocal, setArchivoLocal] = useState<string | null>(
    null
  );
  const [consultando, setConsultando] = useState(true);
  const [errorConsulta, setErrorConsulta] =
    useState<string | null>(null);
  const [consulta, setConsulta] = useState(0);
  const [intentoAudio, setIntentoAudio] = useState(0);
  const [accion, setAccion] =
    useState<'descargar' | 'eliminar' | null>(null);

  useEffect(() => {
    let activo = true;

    async function consultar() {
      setConsultando(true);
      setErrorConsulta(null);

      try {
        const uri = await obtenerAudioguiaDescargada(
          audioguia.url
        );

        if (activo) {
          setArchivoLocal(uri);
        }
      } catch {
        if (activo) {
          setErrorConsulta(
            'No pudimos comprobar si hay una descarga guardada.'
          );
        }
      } finally {
        if (activo) {
          setConsultando(false);
        }
      }
    }

    consultar();

    return () => {
      activo = false;
    };
  }, [audioguia.url, consulta]);

  useEffect(() => {
    if (accion === null) {
      return;
    }

    let activo = true;

    async function gestionarArchivo() {
      try {
        if (accion === 'descargar') {
          const uri = await descargarAudioguia(audioguia.url);

          if (activo) {
            setArchivoLocal(uri);
          }
        } else {
          await eliminarAudioguiaDescargada(audioguia.url);

          if (activo) {
            setArchivoLocal(null);
          }
        }

        if (activo) {
          setIntentoAudio((valor) => valor + 1);
        }
      } catch {
        if (activo) {
          Alert.alert(
            accion === 'descargar'
              ? 'No pudimos descargar el audio'
              : 'No pudimos eliminar la descarga',
            'Revisá la conexión y el espacio disponible, y volvé a intentar.'
          );
        }
      } finally {
        if (activo) {
          setAccion(null);
        }
      }
    }

    gestionarArchivo();

    return () => {
      activo = false;
    };
  }, [accion, audioguia.url]);

  return (
    <View style={styles.contenedor}>
      <Text style={styles.etiqueta}>ESCUCHÁ EL LUGAR</Text>
      <Text style={styles.titulo}>Audioguía</Text>

      {!segundoPlanoDisponible && (
        <Text style={styles.descripcion}>
          En esta instalación, escuchá con la app abierta y la pantalla encendida.
        </Text>
      )}

      {audioguia.url.includes('semilla-audio-guide-') && (
        <Text style={styles.descripcion}>
          Audio de prueba de la API: contiene silencio. El contador permite comprobar la reproducción y la descarga.
        </Text>
      )}

      {audioguia.url.includes('exoplayer-test-media-0') && (
        <Text style={styles.descripcion}>
          Audio de muestra. No es una narración turística.
        </Text>
      )}

      {consultando ? (
        <View style={styles.carga}>
          <ActivityIndicator
            color="#14665C"
            accessibilityLabel="Comprobando descarga"
          />
          <Text style={styles.descripcion}>
            Comprobando descarga…
          </Text>
        </View>
      ) : errorConsulta ? (
        <>
          <Text style={styles.descripcion}>{errorConsulta}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => setConsulta((valor) => valor + 1)}
            style={styles.botonSecundario}
          >
            <Text style={styles.textoSecundario}>Reintentar</Text>
          </Pressable>
        </>
      ) : (
        <>
          <Text style={styles.estadoDescarga}>
            {archivoLocal
              ? 'Disponible sin conexión'
              : 'Reproducción por internet'}
          </Text>

          {accion !== null ? (
            <View style={styles.carga}>
              <ActivityIndicator
                color="#14665C"
                accessibilityLabel={
                  accion === 'descargar'
                    ? 'Descargando audioguía'
                    : 'Eliminando descarga'
                }
              />
              <Text style={styles.descripcion}>
                {accion === 'descargar'
                  ? 'Descargando audio…'
                  : 'Eliminando descarga…'}
              </Text>
            </View>
          ) : (
            <Reproductor
              key={`${archivoLocal ?? audioguia.url}-${intentoAudio}`}
              uri={archivoLocal ?? audioguia.url}
              nombreLugar={nombreLugar}
              reintentar={() =>
                setIntentoAudio((valor) => valor + 1)
              }
            />
          )}

          <Pressable
            accessibilityRole="button"
            disabled={accion !== null}
            onPress={() => {
              if (archivoLocal) {
                Alert.alert(
                  'Eliminar descarga',
                  'El audio dejará de estar disponible sin conexión. Podés descargarlo nuevamente más adelante.',
                  [
                    { text: 'Cancelar', style: 'cancel' },
                    {
                      text: 'Eliminar',
                      style: 'destructive',
                      onPress: () => setAccion('eliminar'),
                    },
                  ]
                );
              } else {
                setAccion('descargar');
              }
            }}
            style={[
              styles.botonSecundario,
              accion !== null && styles.deshabilitado,
            ]}
          >
            <Text style={styles.textoSecundario}>
              {archivoLocal
                ? 'Eliminar descarga'
                : 'Descargar para escuchar sin conexión'}
            </Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

function Reproductor({
  uri,
  nombreLugar,
  reintentar,
}: {
  uri: string;
  nombreLugar: string;
  reintentar: () => void;
}) {
  const reproductor = useAudioPlayer(uri, {
    updateInterval: 500,
  });

  const estado = useAudioPlayerStatus(reproductor);
  const bloqueo = useRef(false);

  const [configurado, setConfigurado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    let activo = true;

    async function configurar() {
      try {
        await setAudioModeAsync({
          playsInSilentMode: true,
          allowsRecording: false,
          shouldPlayInBackground: segundoPlanoDisponible,
          interruptionMode: 'doNotMix',
        });

        if (activo) {
          setConfigurado(true);
        }
      } catch {
        if (activo) {
          setError('No pudimos preparar el audio.');
        }
      }
    }

    configurar();

    return () => {
      activo = false;
    };
  }, []);

  useEffect(() => {
    if (estado.isLoaded) {
      return;
    }

    const temporizador = setTimeout(() => {
      setError(
        'No pudimos cargar el audio a tiempo. Revisá tu conexión o la descarga.'
      );
    }, 25000);

    return () => clearTimeout(temporizador);
  }, [estado.isLoaded]);

  useFocusEffect(
    useCallback(() => {
      return () => {
        try {
          reproductor.pause();
          if (segundoPlanoDisponible) reproductor.setActiveForLockScreen(false);
        } catch {
          // Puede haberse liberado al salir.
        }
      };
    }, [reproductor])
  );

  const errorDelAudio =
    'error' in estado && typeof estado.error === 'string'
      ? estado.error
      : null;

  const duracion = Number.isFinite(estado.duration)
    ? Math.max(0, estado.duration)
    : 0;

  const transcurrido = Number.isFinite(estado.currentTime)
    ? Math.max(0, estado.currentTime)
    : 0;

  const restante = Math.max(0, duracion - transcurrido);

  const progreso = duracion > 0
    ? Math.min(1, transcurrido / duracion)
    : 0;

  const listo = configurado && estado.isLoaded;

  async function ejecutar(accion: () => Promise<void>) {
    if (bloqueo.current || !listo) {
      return;
    }

    bloqueo.current = true;
    setOcupado(true);

    try {
      await accion();
    } catch {
      setError('No pudimos controlar la reproducción.');
    } finally {
      bloqueo.current = false;
      setOcupado(false);
    }
  }

  async function alternarReproduccion() {
    await ejecutar(async () => {
      if (reproductor.playing) {
        reproductor.pause();
        return;
      }

      if (
        duracion > 0 &&
        reproductor.currentTime >= duracion - 0.25
      ) {
        await reproductor.seekTo(0);
      }

      // Android necesita un reproductor activo con controles para sostener el audio bloqueado.
      if (segundoPlanoDisponible) {
        reproductor.setActiveForLockScreen(true, {
          title: nombreLugar,
          artist: 'Mi Ciudad · Colón',
          albumTitle: 'Audioguías',
        });
      }
      reproductor.play();
    });
  }

  async function desplazar(segundos: number) {
    await ejecutar(async () => {
      const destino = Math.max(
        0,
        Math.min(duracion, reproductor.currentTime + segundos)
      );

      await reproductor.seekTo(destino);
    });
  }

  if (error || errorDelAudio) {
    return (
      <View>
        <Text style={styles.descripcion}>
          {error ?? 'No pudimos cargar este audio.'}
        </Text>

        <Pressable
          accessibilityRole="button"
          onPress={reintentar}
          style={styles.botonPrincipal}
        >
          <Text style={styles.textoPrincipal}>Reintentar audio</Text>
        </Pressable>
      </View>
    );
  }

  if (!listo) {
    return (
      <View style={styles.carga}>
        <ActivityIndicator
          color="#14665C"
          accessibilityLabel="Cargando audio"
        />
        <Text style={styles.descripcion}>Preparando audio…</Text>
      </View>
    );
  }

  return (
    <View>
      <View
        style={styles.barra}
        accessibilityRole="progressbar"
        accessibilityLabel="Progreso del audio"
        accessibilityValue={{
          min: 0,
          max: Math.max(1, Math.round(duracion)),
          now: Math.min(
            Math.max(1, Math.round(duracion)),
            Math.round(transcurrido)
          ),
        }}
      >
        <View
          style={[
            styles.progreso,
            { width: `${Math.round(progreso * 100)}%` },
          ]}
        />
      </View>

      <View style={styles.tiempos}>
        <Text style={styles.tiempo}>
          {mostrarTiempo(transcurrido)}
        </Text>
        <Text style={styles.tiempo}>
          Faltan {mostrarTiempo(restante)}
        </Text>
      </View>

      <View style={styles.controles}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Retroceder 15 segundos"
          disabled={ocupado || duracion === 0}
          onPress={() => desplazar(-15)}
          style={styles.botonSecundario}
        >
          <Text style={styles.textoSecundario}>−15 s</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          disabled={ocupado}
          onPress={alternarReproduccion}
          style={styles.botonPrincipal}
        >
          <Text style={styles.textoPrincipal}>
            {estado.playing ? 'Pausar' : 'Reproducir'}
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Adelantar 15 segundos"
          disabled={ocupado || duracion === 0}
          onPress={() => desplazar(15)}
          style={styles.botonSecundario}
        >
          <Text style={styles.textoSecundario}>+15 s</Text>
        </Pressable>
      </View>

      {estado.isBuffering && (
        <Text style={styles.descripcion}>Cargando audio…</Text>
      )}
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
  etiqueta: {
    fontSize: 12,
    letterSpacing: 2,
    fontWeight: 'bold',
    color: '#14665C',
  },
  titulo: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#183B42',
    marginTop: 8,
  },
  descripcion: {
    fontSize: 16,
    lineHeight: 24,
    color: '#385354',
    marginTop: 12,
  },
  estadoDescarga: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#14665C',
    marginTop: 16,
  },
  carga: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  barra: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: '#BECEC4',
    marginTop: 24,
  },
  progreso: {
    height: '100%',
    backgroundColor: '#14665C',
  },
  tiempos: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 10,
  },
  tiempo: {
    fontSize: 15,
    color: '#385354',
  },
  controles: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 18,
  },
  botonPrincipal: {
    minHeight: 48,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#174F49',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  textoPrincipal: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  botonSecundario: {
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#849993',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
  },
  textoSecundario: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#183B42',
    textAlign: 'center',
  },
  deshabilitado: {
    opacity: 0.5,
  },
});