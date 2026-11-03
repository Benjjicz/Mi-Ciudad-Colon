// Acciones que ya tenía el detalle integrado, conservadas bajo la ficha nueva.
import { useCallback, useRef, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Lugar } from '../tipos/lugar';
import { obtenerFavoritos, guardarEstadoFavorito } from '../servicios/favoritos';
import { ReproductorAudioguia } from './reproductor-audioguia';

export default function AccionesLugar({ lugar }: { lugar: Lugar }) {
  const [favorito, setFavorito] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const bloqueo = useRef(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [conSesion, setConSesion] = useState(false);

  useFocusEffect(useCallback(() => {
    let activo = true;
    setCargando(true);
    setError(false);
    setFavorito(false);
    setAviso(null);
    void obtenerFavoritos().then(estado => {
      if (activo) {
        setFavorito(estado.ids.includes(lugar.id));
        setConSesion(estado.conSesion);
        setAviso(estado.aviso);
      }
    }).catch(() => { if (activo) setError(true); })
      .finally(() => { if (activo) setCargando(false); });
    return () => { activo = false; };
  }, [lugar.id]));

  async function alternar() {
    if (bloqueo.current || cargando || error) return;
    if (!conSesion) { router.push('/cuenta'); return; }
    bloqueo.current = true;
    setGuardando(true);
    try {
      const estado = await guardarEstadoFavorito(lugar.id, !favorito);
      setFavorito(estado.ids.includes(lugar.id));
      setAviso(estado.aviso);
    } catch (error) {
      Alert.alert('No pudimos guardar', error instanceof Error ? error.message : 'Intentá nuevamente.');
    } finally {
      bloqueo.current = false;
      setGuardando(false);
    }
  }

  async function llegar(modo: 'walking' | 'driving') {
    const destino = encodeURIComponent(`${lugar.coordenadas.latitud},${lugar.coordenadas.longitud}`);
    try {
      await Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${destino}&travelmode=${modo}`);
    } catch {
      Alert.alert('No se pudo abrir', 'No pudimos abrir la aplicación de mapas.');
    }
  }

  const deshabilitado = cargando || error || guardando;
  return (
    <View>
      <Pressable accessibilityRole="button" accessibilityState={{ selected: favorito, disabled: deshabilitado }}
        disabled={deshabilitado} onPress={alternar} style={[styles.boton, deshabilitado && styles.deshabilitado]}>
        <Text style={styles.texto}>{cargando ? 'Leyendo favorito…' : error ? 'Favoritos no disponibles' : guardando ? 'Guardando…' : !conSesion ? 'Ingresar para guardar favoritos' : favorito ? '♥ Quitar de favoritos' : '♡ Guardar favorito'}</Text>
      </Pressable>
      {aviso && <Text style={styles.aviso}>{aviso}</Text>}
      <ReproductorAudioguia key={lugar.id} audioguia={lugar.audioguia} nombreLugar={lugar.nombre} />
      <Text style={styles.titulo}>Cómo llegar</Text>
      <Pressable accessibilityRole="button" style={styles.boton} onPress={() => { void llegar('walking'); }}>
        <Text style={styles.texto}>Ir caminando</Text>
      </Pressable>
      <Pressable accessibilityRole="button" style={styles.boton} onPress={() => { void llegar('driving'); }}>
        <Text style={styles.texto}>Ir en auto</Text>
      </Pressable>
    </View>
  );
}
const styles = StyleSheet.create({
  boton: { minHeight: 48, padding: 16, backgroundColor: '#174F49', borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginVertical: 6 },
  texto: { fontSize: 17, fontWeight: 'bold', color: '#FFF', textAlign: 'center' },
  titulo: { fontSize: 20, fontWeight: 'bold', color: '#183B42', marginTop: 20, marginBottom: 8 },
  aviso: { fontSize: 14, lineHeight: 21, color: '#586C70', marginVertical: 6 },
  deshabilitado: { opacity: 0.5 },
});
