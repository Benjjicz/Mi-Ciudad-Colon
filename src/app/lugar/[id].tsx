import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  Image,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Linking,
  useWindowDimensions,
} from "react-native";
import AccionesLugar from "../../components/acciones-lugar";
import { useLocalSearchParams } from "expo-router";
import { Lugar, ErrorApi } from "../../tipos";
import { obtenerLugar } from "../../servicios/lugares";
import { esError } from "../../servicios/_base";
import { calcularEstadoApertura, horarioSemanal } from "../../utils/horarios";
import { PantallaError } from "../../componentes/pantallaError";

function textoPrecio(precio: number | null): string {
  if (precio === null) return "Consultar precio";
  if (precio === 0) return "Entrada gratuita";
  return `$${precio}`;
}

export default function PantallaDetalleLugar() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { width } = useWindowDimensions();

  const [lugar, setLugar] = useState<Lugar | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<ErrorApi | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    const respuesta = await obtenerLugar(id);
    if (esError(respuesta)) {
      setError(respuesta.error);
    } else {
      setLugar(respuesta.datos);
    }
    setCargando(false);
  }, [id]);

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
    // Reintentar solo tiene sentido si falló la conexión, no si el lugar no existe.
    return (
      <PantallaError
        mensaje={error.mensaje}
        onReintentar={error.codigo === "SIN_CONEXION" ? cargar : undefined}
      />
    );
  }

  if (!lugar) return null;

  const estado = calcularEstadoApertura(lugar.horarios);
  const { sitioWeb } = lugar;

  return (
    <ScrollView style={styles.contenedor}>
      {lugar.imagenes.length > 0 ? (
        <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
          {lugar.imagenes.map((uri) => (
            <Image key={uri} source={{ uri }} style={{ width, height: 230 }} />
          ))}
        </ScrollView>
      ) : (
        <View style={[styles.fotoVacia, { width }]}>
          <Text style={styles.fotoVaciaTexto}>Sin fotos</Text>
        </View>
      )}

      <View style={styles.cuerpo}>
        <Text style={styles.nombre}>{lugar.nombre}</Text>

        <Text style={[styles.estado, estado.abierto ? styles.abierto : styles.cerrado]}>
          {estado.texto}
        </Text>

        <Text style={styles.descripcion}>{lugar.descripcion}</Text>

        <Fila titulo="Dirección" valor={lugar.direccion} />
        <Fila titulo="Teléfono" valor={lugar.telefono ?? "Sin teléfono cargado"} />
        <Fila titulo="Entrada" valor={textoPrecio(lugar.precioEntrada)} />
        <Fila
          titulo="Accesibilidad"
          valor={lugar.accesible ? "Accesible para silla de ruedas" : "No accesible"}
        />

        {sitioWeb && (
          <Pressable
            style={styles.fila}
            accessibilityRole="link"
            onPress={() => Linking.openURL(sitioWeb).catch(() => {})}
          >
            <Text style={styles.filaTitulo}>Sitio web (tocá para abrir)</Text>
            <Text style={[styles.filaValor, styles.link]}>{sitioWeb}</Text>
          </Pressable>
        )}

        {lugar.horarios.length > 0 && (
          <View style={styles.fila}>
            <Text style={styles.filaTitulo}>Horarios</Text>
            {horarioSemanal(lugar.horarios).map(({ dia, texto }) => (
              <View key={dia} style={styles.filaHorario}>
                <Text style={styles.dia}>{dia}</Text>
                <Text style={styles.horas}>{texto}</Text>
              </View>
            ))}
          </View>
        )}
        <AccionesLugar key={lugar.id} lugar={lugar} />
        <Text style={styles.filaTitulo}>Catálogo de demostración del TP. Verificá horarios y precios antes de visitar.</Text>
      </View>
    </ScrollView>
  );
}

function Fila({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <View style={styles.fila}>
      <Text style={styles.filaTitulo}>{titulo}</Text>
      <Text style={styles.filaValor}>{valor}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: "#fff" },
  centro: { flex: 1, alignItems: "center", justifyContent: "center" },
  fotoVacia: { height: 230, backgroundColor: "#eee", alignItems: "center", justifyContent: "center" },
  fotoVaciaTexto: { color: "#595959", fontSize: 16 },
  cuerpo: { padding: 16, gap: 8 },
  nombre: { fontSize: 24, fontWeight: "800" },
  estado: { fontSize: 16, fontWeight: "700" },
  abierto: { color: "#1F8A70" },
  cerrado: { color: "#A33" },
  descripcion: { fontSize: 16, lineHeight: 24, color: "#333", marginVertical: 8 },
  fila: { paddingVertical: 10, borderTopWidth: 1, borderTopColor: "#eee" },
  filaTitulo: { fontSize: 14, color: "#595959" },
  filaValor: { fontSize: 16, color: "#222" },
  link: { color: "#1F6FB5", textDecorationLine: "underline" },
  filaHorario: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  dia: { fontSize: 16, color: "#222", textTransform: "capitalize" },
  horas: { fontSize: 16, color: "#222" },
});