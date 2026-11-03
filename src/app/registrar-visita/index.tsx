import { router, Stack } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { obtenerLugares } from '../../servicios/lugares';
import { detectarLugarCercano } from '../../servicios/visitas';
import type { Lugar } from '../../tipos/lugar';

export default function PantallaMenuRegistro() {
  const ocupadoRef = useRef(false);
  const activoRef = useRef(true);
  useEffect(() => { activoRef.current = true; return () => { activoRef.current = false; }; }, []);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [modoManual, setModoManual] = useState(false);
  const [lugares, setLugares] = useState<Lugar[]>([]);
  const [cargando, setCargando] = useState(true);
  
  // Nuevo estado para que el botón de GPS gire mientras busca la señal
  const [buscandoGps, setBuscandoGps] = useState(false);

  useEffect(() => {
    let activo = true;
    void obtenerLugares().then(res => {
      if (activo) setLugares(res.datos.filter(lugar => lugar.activo));
    }).catch(() => {
      if (activo) setErrorCarga('No pudimos cargar los lugares. Volvé atrás y probá nuevamente.');
    }).finally(() => { if (activo) setCargando(false); });
    return () => { activo = false; };
  }, []);

  const irAlGps = async () => {
    if (ocupadoRef.current) return;
    ocupadoRef.current = true;
    setBuscandoGps(true);
    try {
      const lugarDetectado = await detectarLugarCercano();
      if (!activoRef.current) return;

      // Si encontró uno, navegamos a la siguiente pantalla pasándole EL ID DETECTADO
      router.push({ 
        pathname: '/registrar-visita/[id]', 
        params: { id: lugarDetectado.id, origen: 'gps' } 
      });

    } catch (error) {
      if (!activoRef.current) return;
      let mensajeError = error instanceof Error ? error.message : 'No pudimos obtener tu ubicación.';

      // Atajamos el error crudo de Expo Location (GPS apagado o sin señal satelital)
      if (mensajeError.includes('unsatisfied device settings') || mensajeError.includes('Location request failed')) {
        mensajeError = 'No pudimos obtener tu ubicación. Asegurate de tener el GPS encendido en tu teléfono.';
      }

      Alert.alert("Atención", mensajeError);
    } finally {
      ocupadoRef.current = false;
      if (activoRef.current) setBuscandoGps(false);
    }
  };

  if (modoManual) {
    return (
      <View style={styles.contenedor}>
        <Stack.Screen options={{ title: 'Buscar lugar' }} />
        <Text style={styles.texto}>Elegí el lugar de la lista</Text>
        {errorCarga && <Text style={styles.direccionLista}>{errorCarga}</Text>}
        {cargando ? (
          <ActivityIndicator size="large" color="#174F49" style={{ marginTop: 20 }} />
        ) : (
          <FlatList
            data={lugares}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.botonLista}
                onPress={() => router.push({ pathname: '/registrar-visita/[id]', params: { id: item.id, origen: 'manual' } })}
              >
                <Text style={styles.textoBotonLista}>{item.nombre}</Text>
                <Text style={styles.direccionLista}>{item.direccion}</Text>
              </TouchableOpacity>
            )}
          />
        )}
        <TouchableOpacity style={styles.botonVolver} onPress={() => setModoManual(false)}>
          <Text style={styles.textoBotonSecundario}>Volver atrás</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.contenedorCentro}>
      <Stack.Screen options={{ title: 'Nueva Visita' }} />
      
      <Text style={styles.tituloMenu}>¿Cómo querés registrar tu visita?</Text>

      <TouchableOpacity style={styles.botonPrincipal} onPress={() => router.push('/escanear')}>
        <Text style={styles.textoBoton}>Escanear código QR</Text>
      </TouchableOpacity>

      {/* Botón de GPS actualizado con spinner de carga */}
      <TouchableOpacity 
        style={styles.botonPrincipal} 
        onPress={irAlGps}
        disabled={buscandoGps}
      >
        {buscandoGps ? (
          <ActivityIndicator color="#FFF" />
        ) : (
          <Text style={styles.textoBoton}>Estoy acá (Usar GPS)</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity style={styles.botonPrincipal} onPress={() => setModoManual(true)}>
        <Text style={styles.textoBoton}>Buscar en la lista (Manual)</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.botonVolver} onPress={() => router.back()}>
        <Text style={styles.textoBotonSecundario}>Cancelar</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: '#F7F7F2' },
  contenedorCentro: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: '#F7F7F2' },
  tituloMenu: { fontSize: 28, fontWeight: 'bold', marginBottom: 30, textAlign: 'center', color: '#183B42' },
  texto: { fontSize: 24, paddingTop: 40, paddingBottom: 20, paddingHorizontal: 20, color: '#183B42', fontWeight: 'bold' },
  botonPrincipal: { backgroundColor: '#174F49', padding: 22, borderRadius: 12, marginBottom: 18 },
  botonVolver: { padding: 18, marginVertical: 10, borderRadius: 10, alignItems: 'center' },
  textoBoton: { color: '#FFF', fontSize: 18, fontWeight: 'bold', textAlign: 'center' },
  textoBotonSecundario: { color: '#586C70', fontSize: 18, fontWeight: 'bold', textAlign: 'center' },
  botonLista: { padding: 20, borderBottomWidth: 1, borderBottomColor: '#ccc' },
  textoBotonLista: { fontSize: 22, color: '#183B42', fontWeight: 'bold' },
  direccionLista: { fontSize: 16, color: '#586C70', marginTop: 4 },
});