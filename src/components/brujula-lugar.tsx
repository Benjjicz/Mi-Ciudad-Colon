import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import * as Location from 'expo-location';
import {
  ActivityIndicator,
  AppState,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type { Coordenadas, Lugar } from '../tipos/lugar';
import {
  calcularDistanciaMetros,
  mostrarDistancia,
} from '../utilidades/distancias';

interface Props {
  lugar: Lugar;
  ubicacion: Location.LocationObject;
}

function calcularRumbo(
  origen: Coordenadas,
  destino: Coordenadas
): number {
  const radianes = (grados: number) =>
    grados * Math.PI / 180;

  const latitudOrigen = radianes(origen.latitud);
  const latitudDestino = radianes(destino.latitud);
  const diferenciaLongitud = radianes(
    destino.longitud - origen.longitud
  );

  const y =
    Math.sin(diferenciaLongitud) *
    Math.cos(latitudDestino);

  const x =
    Math.cos(latitudOrigen) * Math.sin(latitudDestino) -
    Math.sin(latitudOrigen) *
      Math.cos(latitudDestino) *
      Math.cos(diferenciaLongitud);

  const grados = Math.atan2(y, x) * 180 / Math.PI;

  return (grados + 360) % 360;
}

export default function BrujulaLugar({
  lugar,
  ubicacion,
}: Props) {
  const [orientacion, setOrientacion] =
    useState<Location.LocationHeadingObject | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [estadoApp, setEstadoApp] = useState(
    AppState.currentState
  );

  useEffect(() => {
    const suscripcion = AppState.addEventListener(
      'change',
      setEstadoApp
    );

    return () => suscripcion.remove();
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (estadoApp !== 'active') {
        return;
      }

      let activo = true;
      let suscripcion: Location.LocationSubscription | null =
        null;

      setOrientacion(null);
      setError(null);

      const temporizador = setTimeout(() => {
        if (activo) {
          setError(
            'No recibimos una orientación válida. Mantené el teléfono horizontal y probá moverlo suavemente.'
          );
        }
      }, 15000);

      async function iniciar() {
        try {
          const escucha = await Location.watchHeadingAsync(
            (lectura) => {
              if (!activo) {
                return;
              }

              // El rumbo hacia el lugar se calcula respecto
              // del norte geográfico. Usamos la misma referencia.
              const valida =
                Number.isFinite(lectura.trueHeading) &&
                lectura.trueHeading >= 0 &&
                lectura.trueHeading < 360 &&
                lectura.accuracy > 0;

              if (!valida) {
                setOrientacion(null);
                return;
              }

              clearTimeout(temporizador);
              setOrientacion(lectura);
              setError(null);
            },
            () => {
              if (activo) {
                setOrientacion(null);
                setError(
                  'No pudimos leer la brújula de este teléfono.'
                );
              }
            }
          );

          if (activo) {
            suscripcion = escucha;
          } else {
            escucha.remove();
          }
        } catch {
          if (activo) {
            setError(
              'No pudimos iniciar la brújula de este teléfono.'
            );
          }
        }
      }

      void iniciar();

      // Al salir de la pantalla o mandar la app al fondo,
      // dejamos de escuchar el sensor.
      return () => {
        activo = false;
        clearTimeout(temporizador);
        suscripcion?.remove();
      };
    }, [estadoApp])
  );

  const origen: Coordenadas = {
    latitud: ubicacion.coords.latitude,
    longitud: ubicacion.coords.longitude,
  };

  const distancia = calcularDistanciaMetros(
    origen,
    lugar.coordenadas
  );

  const rumbo = calcularRumbo(origen, lugar.coordenadas);

  const giro = orientacion
    ? (rumbo - orientacion.trueHeading + 360) % 360
    : 0;

  const margenUbicacion = Math.max(
    10,
    ubicacion.coords.accuracy ?? 10
  );

  const demasiadoCerca = distancia <= margenUbicacion;

  return (
    <View style={styles.contenedor}>
      <Text style={styles.titulo}>
        Dirección hacia el lugar
      </Text>

      <Text style={styles.nombre}>{lugar.nombre}</Text>

      <Text style={styles.distancia}>
        {mostrarDistancia(distancia)} en línea recta
      </Text>

      {demasiadoCerca ? (
        <Text style={styles.aviso}>
          Estás dentro del margen de precisión de tu ubicación.
          La flecha no puede indicar una dirección confiable
          a esta distancia.
        </Text>
      ) : error ? (
        <Text style={styles.aviso}>{error}</Text>
      ) : orientacion ? (
        <>
          <View
            style={styles.circulo}
            accessible
            accessibilityLabel={
              `Dirección aproximada hacia ${lugar.nombre}: ` +
              `${Math.round(giro)} grados en sentido horario ` +
              'desde la parte superior del teléfono.'
            }
          >
            <Text
              style={[
                styles.flecha,
                {
                  transform: [
                    { rotate: `${giro}deg` },
                  ],
                },
              ]}
            >
              ↑
            </Text>
          </View>

          <Text style={styles.aviso}>
            Mantené el teléfono horizontal. Girá hasta que
            la flecha apunte hacia la parte superior de la pantalla.
          </Text>

          {orientacion.accuracy < 2 && (
            <Text style={styles.advertencia}>
              La brújula informa baja precisión. Alejá el
              teléfono de imanes y objetos metálicos.
            </Text>
          )}
        </>
      ) : (
        <View style={styles.cargando}>
          <ActivityIndicator color="#14665C" />
          <Text style={styles.aviso}>
            Esperando orientación del teléfono…
          </Text>
        </View>
      )}

      <Text style={styles.nota}>
        Usa la última ubicación consultada. Indica la dirección
        directa al lugar, no un recorrido por calles.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#EFF6F1',
    borderWidth: 1,
    borderColor: '#CBD7D0',
  },
  titulo: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#183B42',
  },
  nombre: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#174F49',
    marginTop: 8,
  },
  distancia: {
    fontSize: 16,
    color: '#385354',
    marginTop: 5,
  },
  circulo: {
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 2,
    borderColor: '#CBD7D0',
    backgroundColor: '#FFFFFF',
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 14,
  },
  flecha: {
    fontSize: 82,
    lineHeight: 100,
    color: '#14665C',
    textAlign: 'center',
  },
  aviso: {
    fontSize: 15,
    lineHeight: 22,
    color: '#385354',
    marginTop: 8,
  },
  advertencia: {
    fontSize: 15,
    lineHeight: 22,
    color: '#8A431B',
    marginTop: 8,
  },
  nota: {
    fontSize: 13,
    lineHeight: 19,
    color: '#586C70',
    marginTop: 12,
  },
  cargando: {
    alignItems: 'center',
    paddingVertical: 16,
  },
});