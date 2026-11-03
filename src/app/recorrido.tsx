import { Link, router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { obtenerLugares } from '../servicios/lugares';
import { intentarSincronizar, obtenerVisitasLocales } from '../servicios/visitas';
import { obtenerSesionAPI, esSesionActual } from '../servicios/sesion';
import type { Lugar } from '../tipos/lugar';
import type { VisitaLocal } from '../tipos/visita';

function FotoVisita({ uri }: { uri: string }) {
  const [fallo, setFallo] = useState(false);

  if (fallo) {
    return (
      <View style={styles.placeholderErrorFoto}>
        <Text style={styles.textoErrorFoto}>No pudimos abrir la foto</Text>
      </View>
    );
  }

  return (
    <Image
      source={{ uri }}
      style={styles.miniatura}
      resizeMode="cover"
      accessibilityLabel="Foto de la visita"
      onError={() => setFallo(true)}
    />
  );
}

export default function PantallaMiRecorrido() {
  const [visitas, setVisitas] = useState<VisitaLocal[]>([]);
  const [lugares, setLugares] = useState<Lugar[]>([]);

  const [cargando, setCargando] = useState(true);
  const [conSesion, setConSesion] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [intento, setIntento] = useState(0);

  useFocusEffect(useCallback(() => {
    let activo = true;
    setCargando(true);
    setConSesion(false);
    setVisitas([]);
    setLugares([]);
    setAviso(null);
    async function cargar() {
      try {
        const sesion = await obtenerSesionAPI();
        if (!activo || !sesion) return;
        setConSesion(true);
        const locales = await obtenerVisitasLocales();
        if (!activo || !(await esSesionActual(sesion))) return;
        setVisitas(locales);
        setCargando(false);
        try {
          const catalogo = await obtenerLugares();
          if (activo && await esSesionActual(sesion)) setLugares(catalogo.datos);
        } catch {
          if (activo) setAviso('No pudimos cargar los nombres de los lugares. Las visitas locales siguen disponibles.');
        }
        if (!activo || !(await esSesionActual(sesion))) return;
        try {
          await intentarSincronizar();
        } catch (error) {
          if (activo) setAviso(error instanceof Error ? error.message : 'La sincronización quedó pendiente.');
        }
        if (!activo || !(await esSesionActual(sesion))) return;
        const actualizadas = await obtenerVisitasLocales();
        if (activo && await esSesionActual(sesion)) setVisitas(actualizadas);
      } catch (error) {
        if (activo) setAviso(error instanceof Error ? error.message : 'No pudimos leer tus visitas.');
      } finally {
        if (activo) setCargando(false);
      }
    }
    void cargar();
    return () => { activo = false; };
  // intento permite repetir la carga al tocar Actualizar.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intento]));

  const renderItem = ({ item }: { item: VisitaLocal }) => {
    const lugar = lugares.find(l => l.id === item.lugarId);
    const fechaFormateada = new Date(item.fechaHora).toLocaleString('es-AR', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });

    return (
      <View style={styles.tarjeta}>
        {item.fotoUri !== null && <FotoVisita key={item.fotoUri} uri={item.fotoUri} />}

        <View style={styles.infoTarjeta}>
          <View style={styles.filaEncabezadoTarjeta}>
            <Text style={styles.textoFecha}>{fechaFormateada}</Text>
            <Text style={styles.etiquetaOrigen}>{item.origen.toUpperCase()}</Text>
          </View>

          <TouchableOpacity accessibilityRole="button" onPress={() => router.push({ pathname: '/lugar/[id]', params: { id: item.lugarId } })}>
            <Text style={styles.nombreLugar}>{lugar?.nombre ?? `Lugar ${item.lugarId}`}</Text>
          </TouchableOpacity>

          {item.nota !== null && (
            <Text style={styles.textoNota}>{item.nota}</Text>
          )}

          <Text
            style={[
              styles.textoSincronizacion,
              { color: item.sincronizada ? '#14665C' : '#B85D00' },
            ]}
          >
            {item.sincronizada
              ? '✓ Guardada en tu cuenta'
              : 'Guardada en este teléfono. Pendiente de subir a tu cuenta.'}
          </Text>
        </View>
      </View>
    );
  };

  if (cargando) return <View style={styles.contenedor}><ActivityIndicator color="#14665C" size="large" /></View>;
  if (!conSesion) return (
    <View style={styles.contenedor}>
      <Text style={styles.titulo}>Tu recorrido</Text>
      <Text style={styles.textoMensaje}>{aviso ?? 'Ingresá con tu cuenta para ver y guardar tus visitas.'}</Text>
      <Link href="/cuenta" asChild><TouchableOpacity style={styles.boton}><Text style={styles.textoBoton}>Ir a Mi cuenta</Text></TouchableOpacity></Link>
    </View>
  );

  return (
    <View style={styles.contenedor}>
      <Text style={styles.titulo}>Mi Recorrido</Text>
      {aviso && <Text style={styles.aviso}>{aviso}</Text>}
      <TouchableOpacity accessibilityRole="button" onPress={() => setIntento(v => v + 1)} style={styles.actualizar}>
        <Text style={styles.textoActualizar}>Actualizar</Text>
      </TouchableOpacity>
      <Text style={styles.contadorVisitas}>
        {visitas.length} {visitas.length === 1 ? 'visita registrada' : 'visitas registradas'}
      </Text>

      <Link href="/registrar-visita" asChild>
        <TouchableOpacity accessibilityRole="button" style={styles.boton}>
          <Text style={styles.textoBoton}>+ Registrar visita</Text>
        </TouchableOpacity>
      </Link>

      <FlatList
        data={visitas}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: 20 }}
        ListEmptyComponent={
          <Text style={styles.textoMensaje}>Todavía no tenés visitas registradas.</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  aviso: { fontSize: 15, lineHeight: 22, color: '#8A431B', marginVertical: 10 },
  actualizar: { minHeight: 48, justifyContent: 'center', marginVertical: 8 },
  textoActualizar: { fontSize: 16, color: '#14665C', fontWeight: 'bold' },
  contenedor: { flex: 1, backgroundColor: '#F7F7F2', padding: 24 },
  titulo: { fontSize: 32, fontWeight: 'bold', color: '#183B42', marginTop: 12 },
  contadorVisitas: { fontSize: 17, color: '#586C70', marginBottom: 20, marginTop: 12 },
  boton: { backgroundColor: '#174F49', padding: 16, borderRadius: 14, marginBottom: 20 },
  textoBoton: { color: '#FFF', fontSize: 18, fontWeight: 'bold', textAlign: 'center' },
  textoMensaje: { fontSize: 18, color: '#555', textAlign: 'center', marginTop: 30, lineHeight: 26 },
  tarjeta: { backgroundColor: '#FFFFFF', padding: 22, marginBottom: 18, borderRadius: 22, borderWidth: 1, borderColor: '#E1E6DE' },
  miniatura: { width: '100%', aspectRatio: 4/3, borderRadius: 16, marginBottom: 18, backgroundColor: '#E7EEE8' },
  placeholderErrorFoto: { width: '100%', height: 80, borderRadius: 10, marginBottom: 12, backgroundColor: '#EEE', justifyContent: 'center', alignItems: 'center' },
  textoErrorFoto: { fontSize: 15, color: '#666' },
  infoTarjeta: { flex: 1 },
  filaEncabezadoTarjeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  textoFecha: { fontSize: 15, color: '#586C70', fontWeight: '600' },
  etiquetaOrigen: { fontSize: 13, fontWeight: 'bold', backgroundColor: '#E0E0E0', color: '#000', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  nombreLugar: { fontSize: 23, fontWeight: 'bold', color: '#183B42' },
  textoNota: { fontSize: 18, color: '#385354', marginTop: 14, lineHeight: 27 },
  textoSincronizacion: { fontSize: 14, marginTop: 18, fontWeight: 'bold' },
});