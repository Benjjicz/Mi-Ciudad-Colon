import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { obtenerFavoritos } from '../servicios/favoritos';
import { obtenerLugares } from '../servicios/lugares';
import type { Lugar } from '../tipos/lugar';

export default function FavoritosScreen() {
  const [lugares, setLugares] = useState<Lugar[]>([]);
  const [cargando, setCargando] = useState(true);
  const [aviso, setAviso] = useState<string | null>(null);
  const [conSesion, setConSesion] = useState(true);
  const [intento, setIntento] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let activo = true;

      async function cargarFavoritos() {
        setCargando(true);
        setError(null);
        setLugares([]);
        setAviso(null);

        try {
          const [estado, respuestaLugares] = await Promise.all([
            obtenerFavoritos(),
            obtenerLugares(),
          ]);

          const lugaresFavoritos = respuestaLugares.datos.filter(
            (lugar) =>
              lugar.activo && estado.ids.includes(lugar.id)
          );

          if (activo) {
            setLugares(lugaresFavoritos);
            setAviso(estado.aviso);
            setConSesion(estado.conSesion);
          }
        } catch {
          if (activo) {
            setError('No pudimos cargar tus favoritos.');
          }
        } finally {
          if (activo) {
            setCargando(false);
          }
        }
      }

      cargarFavoritos();

      return () => {
        activo = false;
      };
    // El contador permite volver a cargar al tocar Actualizar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [intento])
  );

  return (
    <SafeAreaView edges={['bottom']} style={styles.container}>
      <View style={styles.cabecera}>
        <Pressable accessibilityRole="button" disabled={cargando} onPress={() => setIntento(valor => valor + 1)} style={styles.actualizar}>
          <Text style={styles.enlace}>{cargando ? 'Actualizando…' : 'Actualizar'}</Text>
        </Pressable>
        {aviso && <Text style={styles.descripcion}>{aviso}</Text>}
        {!conSesion && <Pressable accessibilityRole="button" onPress={() => router.push('/cuenta')} style={styles.actualizar}><Text style={styles.enlace}>Ir a Mi cuenta →</Text></Pressable>}
      </View>
      {cargando ? (
        <View style={styles.centrado}>
          <ActivityIndicator
            size="large"
            color="#16324F"
            accessibilityLabel="Cargando favoritos"
          />
        </View>
      ) : error ? (
        <View style={styles.centrado}>
          <Text style={styles.error}>{error}</Text>
        </View>
      ) : (
        <FlatList
          data={lugares}
          keyExtractor={(lugar) => lugar.id}
          contentContainerStyle={styles.lista}
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Ver detalle de ${item.nombre}`}
              onPress={() =>
                router.push({
                  pathname: '/lugar/[id]',
                  params: { id: item.id },
                })
              }
              style={({ pressed }) => [
                styles.tarjeta,
                pressed && styles.tarjetaPresionada,
              ]}
            >
              <Text style={styles.nombre}>{item.nombre}</Text>

              <Text style={styles.descripcion}>
                {item.descripcionCorta}
              </Text>

              <Text style={styles.enlace}>Ver detalle →</Text>
            </Pressable>
          )}
          ListEmptyComponent={
            <View style={styles.vacio}>
              <Text style={styles.nombre}>
                Todavía no tenés favoritos
              </Text>

              <Text style={styles.descripcion}>
                Abrí el detalle de un lugar y tocá “Guardar favorito”
                para encontrarlo acá.
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  cabecera: { paddingHorizontal: 24, paddingBottom: 12 },
  actualizar: { minHeight: 48, justifyContent: 'center' },
  container: {
    flex: 1,
    backgroundColor: '#F7F7F2',
  },
  centrado: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  lista: {
    padding: 24,
    flexGrow: 1,
  },
  tarjeta: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
  },
  tarjetaPresionada: {
    backgroundColor: '#E2EAF3',
  },
  nombre: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#174F49',
  },
  descripcion: {
    fontSize: 17,
    color: '#465569',
    marginTop: 8,
  },
  enlace: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#174F49',
    marginTop: 16,
  },
  vacio: {
    paddingVertical: 24,
  },
  error: {
    fontSize: 18,
    color: '#A32020',
  },
});