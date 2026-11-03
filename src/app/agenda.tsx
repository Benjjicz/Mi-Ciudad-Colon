import { useState, useEffect, useCallback } from "react";
import { View, Text, SectionList, StyleSheet, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { Evento, ErrorApi } from "../tipos";
import { listarEventosDesde } from "../servicios/eventos";
import { esError } from "../servicios/_base";
import { agruparPorDia, inicioDeHoy, formatearTituloDia } from "../utils/fechas";
import { TarjetaEvento } from "../componentes/tarjetaEvento";
import { PantallaError } from "../componentes/pantallaError";

export default function PantallaAgenda() {
  const router = useRouter();
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<ErrorApi | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    const respuesta = await listarEventosDesde(inicioDeHoy());
    if (esError(respuesta)) {
      setError(respuesta.error);
    } else {
      setEventos(respuesta.datos);
    }
    setCargando(false);
  }, []);

  useEffect(() => {
    // Conservamos la carga inicial y el callback de reintento de la pantalla original.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargar();
  }, [cargar]);

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

  const secciones = agruparPorDia(eventos);

  return (
    <SectionList
      style={styles.contenedor}
      sections={secciones}
      keyExtractor={(evento) => evento.id}
      renderSectionHeader={({ section }) => (
        <Text style={styles.encabezadoDia}>{formatearTituloDia(section.referencia)}</Text>
      )}
      renderItem={({ item }) => (
        <TarjetaEvento evento={item} onPress={() => router.push({ pathname: '/evento/[id]', params: { id: item.id } })} />
      )}
      ListEmptyComponent={<Text style={styles.vacio}>No hay eventos cargados por ahora.</Text>}
    />
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, padding: 16 },
  centro: { flex: 1, alignItems: "center", justifyContent: "center" },
  encabezadoDia: {
    fontSize: 18,
    fontWeight: "800",
    marginTop: 12,
    marginBottom: 8,
    textTransform: "capitalize",
    backgroundColor: "#fff",
  },
  vacio: { textAlign: "center", color: "#595959", marginTop: 40, fontSize: 16 },
});