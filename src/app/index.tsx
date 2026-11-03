import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Pressable,
} from "react-native";
import { useRouter } from "expo-router";
import { Lugar, Categoria, ErrorApi } from "../tipos";
import { listarLugares } from "../servicios/lugares";
import { listarCategorias } from "../servicios/categorias";
import { esError } from "../servicios/_base";
import { TarjetaLugar } from "../componentes/tarjetaLugar";
import { FiltroCategorias } from "../componentes/filtroCategorias";
import { PantallaError } from "../componentes/pantallaError";
import { useUbicacion } from "../hooks/useUbicacion";
import { distanciaEnMetros } from "../utils/distancia";
import { normalizar } from "../utils/texto";

export default function PantallaInicio() {
  const router = useRouter();
  const { coordenadas, permiso } = useUbicacion();

  const [lugares, setLugares] = useState<Lugar[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<ErrorApi | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [categoriaId, setCategoriaId] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);

    const [rLugares, rCategorias] = await Promise.all([listarLugares(), listarCategorias()]);

    if (esError(rLugares)) {
      setError(rLugares.error);
    } else if (esError(rCategorias)) {
      setError(rCategorias.error);
    } else {
      setLugares(rLugares.datos);
      setCategorias(rCategorias.datos);
    }
    setCargando(false);
  }, []);

  useEffect(() => {
    // Conservamos la carga inicial y el callback de reintento de la pantalla original.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargar();
  }, [cargar]);

  const textoBuscado = normalizar(busqueda);

  const lugaresFiltrados = lugares.filter((lugar) => {
    const coincideTexto = normalizar(lugar.nombre).includes(textoBuscado);
    const coincideCategoria = categoriaId === null || lugar.categoriaId === categoriaId;
    return coincideTexto && coincideCategoria;
  });

  const lugaresConDistancia = lugaresFiltrados.map((lugar) => ({
    lugar,
    distancia: coordenadas ? distanciaEnMetros(coordenadas, lugar.coordenadas) : null,
  }));

  if (coordenadas) {
    lugaresConDistancia.sort((a, b) => (a.distancia ?? 0) - (b.distancia ?? 0));
  }

  if (cargando) {
    return (
      <View style={styles.centro}>
        <ActivityIndicator />
      </View>
    );
  }

  if (error) {
    return <PantallaError mensaje={error.mensaje} onReintentar={cargar} />;
  }

  return (
    <ScrollView style={styles.contenedor} keyboardShouldPersistTaps="handled">
      <Text style={styles.bienvenida}>BIENVENIDO A COLÓN</Text>
      <Text style={styles.tituloInicio}>Tu próxima salida empieza acá</Text>
      <Text style={styles.introduccion}>Descubrí lugares, elegí qué visitar y armá tu propio recorrido.</Text>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Explorar el mapa de Colón y los lugares cercanos"
        onPress={() => router.push('/mapa')}
        style={({ pressed }) => [styles.tarjetaMapa, pressed && styles.presionado]}
      >
        <View style={styles.filaMapa}>
          <Text style={styles.insigniaMapa}>MAPA Y CERCANÍA</Text>
          <Text style={styles.flechaMapa}>↗</Text>
        </View>
        <Text style={styles.tituloMapa}>Explorá Colón en el mapa</Text>
        <Text style={styles.descripcionMapa}>Encontrá qué tenés cerca y cómo llegar a cada lugar.</Text>
        <View style={styles.enlaceMapa}><Text style={styles.textoEnlaceMapa}>Abrir mapa →</Text></View>
      </Pressable>

      <View style={styles.accesos}>
        <Pressable accessibilityRole="button" onPress={() => router.push('/agenda')} style={styles.acceso}>
          <View style={styles.circuloAcceso}><Text accessible={false} style={styles.iconoAcceso}>▦</Text></View>
          <Text style={styles.textoAcceso}>Agenda</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => router.push('/favoritos')} style={styles.acceso}>
          <View style={styles.circuloAcceso}><Text accessible={false} style={styles.iconoAcceso}>♡</Text></View>
          <Text style={styles.textoAcceso}>Favoritos</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Mi recorrido" onPress={() => router.push('/recorrido')} style={styles.acceso}>
          <View style={styles.circuloAcceso}><Text accessible={false} style={styles.iconoAcceso}>↝</Text></View>
          <Text style={styles.textoAcceso}>Recorrido</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Escanear código QR de un lugar" onPress={() => router.push('/escanear')} style={styles.acceso}>
          <View style={styles.circuloAcceso}><Text accessible={false} style={styles.iconoAcceso}>▣</Text></View>
          <Text style={styles.textoAcceso}>QR</Text>
        </Pressable>
      </View>

      <Text style={styles.titulo}>Lugares para explorar</Text>

      {permiso === "denegado" && (
        <Text style={styles.aviso}>
          Sin tu ubicación no podemos mostrarte distancias, pero podés ver todos los lugares.
        </Text>
      )}
      {permiso === "pendiente" && <Text style={styles.aviso}>Buscando tu ubicación...</Text>}

      <TextInput
        style={styles.buscador}
        placeholder="Buscar por nombre..."
        value={busqueda}
        onChangeText={setBusqueda}
      />

      <FiltroCategorias
        categorias={categorias}
        seleccionada={categoriaId}
        onSeleccionar={setCategoriaId}
      />

      {lugaresConDistancia.length === 0 && (
        <Text style={styles.vacio}>No encontramos nada con ese filtro.</Text>
      )}

      {lugaresConDistancia.map(({ lugar, distancia }) => (
        <TarjetaLugar
          key={lugar.id}
          lugar={lugar}
          distanciaMetros={distancia}
          onPress={() => router.push({ pathname: '/lugar/[id]', params: { id: lugar.id } })}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, padding: 16 },
  bienvenida: { fontSize: 12, fontWeight: '700', letterSpacing: 1.5, color: '#14665C', marginTop: 8 },
  tituloInicio: { fontSize: 30, lineHeight: 36, fontWeight: '700', color: '#183B42', marginTop: 8 },
  introduccion: { fontSize: 16, lineHeight: 24, color: '#586C70', marginTop: 10, marginBottom: 20 },
  tarjetaMapa: { backgroundColor: '#174F49', borderRadius: 22, padding: 22, marginBottom: 16 },
  presionado: { opacity: 0.85 },
  filaMapa: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  insigniaMapa: { fontSize: 12, fontWeight: '700', letterSpacing: 1, color: '#D7EAE0', flex: 1 },
  flechaMapa: { fontSize: 28, color: '#FFFFFF' },
  tituloMapa: { fontSize: 24, lineHeight: 30, fontWeight: '700', color: '#FFFFFF', marginTop: 12 },
  descripcionMapa: { fontSize: 16, lineHeight: 24, color: '#E1EEE8', marginTop: 8 },
  enlaceMapa: { alignSelf: 'flex-start', backgroundColor: '#EDF5EF', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, marginTop: 20 },
  textoEnlaceMapa: { fontSize: 16, fontWeight: '700', color: '#174F49' },
  accesos: { flexDirection: 'row', gap: 8, marginBottom: 26 },
  acceso: { flex: 1, minHeight: 88, paddingVertical: 6, alignItems: 'center', gap: 8 },
  circuloAcceso: { width: 52, height: 52, borderRadius: 18, backgroundColor: '#174F49', justifyContent: 'center', alignItems: 'center' },
  iconoAcceso: { fontSize: 30, color: '#FFFFFF', textAlign: 'center' },
  textoAcceso: { fontSize: 13, fontWeight: '700', color: '#174F49', textAlign: 'center' },
  centro: { flex: 1, alignItems: "center", justifyContent: "center" },
  titulo: { fontSize: 22, fontWeight: "700", color: "#183B42", marginBottom: 12 },
  aviso: {
    backgroundColor: "#FFF4DB",
    color: "#7A5B00",
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
    fontSize: 14,
  },
  buscador: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    marginBottom: 12,
  },
  vacio: { textAlign: "center", color: "#595959", marginTop: 20, fontSize: 16 },
});