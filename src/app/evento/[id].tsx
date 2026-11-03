import { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { Evento, Lugar, ErrorApi } from "../../tipos";
import { obtenerEvento } from "../../servicios/eventos";
import { obtenerLugar } from "../../servicios/lugares";
import { esError } from "../../servicios/_base";
import {
  estaGuardado,
  guardarEvento,
  quitarEvento,
} from "../../servicios/eventosGuardados";
import { activarRecordatorio, cancelarRecordatorio, obtenerEventoGuardado } from '../../servicios/eventos-guardados';
import { formatearTituloDia, formatearHora, formatearDuracion } from "../../utils/fechas";
import { PantallaError } from "../../componentes/pantallaError";

function textoPrecio(precio: number | null): string {
  if (precio === null) return "Consultar precio";
  if (precio === 0) return "Entrada gratuita";
  return `$${precio}`;
}

export default function PantallaDetalleEvento() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [evento, setEvento] = useState<Evento | null>(null);
  const [lugar, setLugar] = useState<Lugar | null>(null);
  const [guardado, setGuardado] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [tieneAviso, setTieneAviso] = useState(false);
  const bloqueoGuardado = useRef(false);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<ErrorApi | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    setLugar(null);

    try {
    const respuesta = await obtenerEvento(id);
    if (esError(respuesta)) {
      setError(respuesta.error);
      setCargando(false);
      return;
    }

    setEvento(respuesta.datos);
    setGuardado(await estaGuardado(respuesta.datos.id));
    let registro = await obtenerEventoGuardado(respuesta.datos.id);
    if (registro?.notificacionId && (registro.inicio !== respuesta.datos.inicio || respuesta.datos.estado !== 'programado')) {
      registro = await cancelarRecordatorio(respuesta.datos.id);
    }
    setTieneAviso(registro?.notificacionId != null);

    if (respuesta.datos.lugarId) {
      const rLugar = await obtenerLugar(respuesta.datos.lugarId);
      
      if (!esError(rLugar)) setLugar(rLugar.datos);
    }

    } catch {
      setError({ codigo: 'LECTURA_FALLIDA', mensaje: 'No pudimos cargar este evento. Intentá nuevamente.' });
    } finally {
      setCargando(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => {
    void cargar();
  }, [cargar]));

  if (cargando) {
    return (
      <View style={styles.centro}>
        <ActivityIndicator />
      </View>
    );
  }

  if (error) {
    return (
      <PantallaError
        mensaje={error.mensaje}
        onReintentar={error.codigo !== "EVENTO_NO_ENCONTRADO" ? cargar : undefined}
      />
    );
  }

  if (!evento) return null;

  const afectado = evento.estado === "suspendido" || evento.estado === "cancelado";

  async function alternarGuardado() {
    if (!evento || bloqueoGuardado.current) return;
    bloqueoGuardado.current = true;
    setGuardando(true);
    try {
    if (guardado) {
      await quitarEvento(evento.id);
      setGuardado(false);
      setTieneAviso(false);
      return;
    }

    const resultado = await guardarEvento(evento);
    setGuardado(true);
    setTieneAviso((await obtenerEventoGuardado(evento.id))?.notificacionId != null);

    if (resultado === 'pendiente') {
        Alert.alert('Guardado en este teléfono', 'La API no está disponible. Entrá a Mis eventos y tocá Actualizar cuando vuelva la conexión. El aviso todavía no está programado.');
        } else if (resultado === 'suspendido') {
        Alert.alert('Evento guardado', 'Está suspendido. Podés consultar su estado desde Mis eventos; no se programó un aviso.');
        } else if (resultado === "con-aviso") {
        Alert.alert("Guardado", "Te vamos a avisar una hora antes de que empiece.");
        } else if (resultado === "muy-cerca") {
        Alert.alert("Guardado", "Empieza en menos de una hora, así que no hay aviso.");
        } else if (resultado === "no-disponible") {
        Alert.alert("Guardado sin aviso", "Los avisos no están disponibles en esta versión de la app.");
        } else {
        Alert.alert(
            "Guardado sin aviso",
            "Para recibir el aviso, activá las notificaciones desde los ajustes del celular."
  );
}
    } catch (problema) {
      Alert.alert('No pudimos guardar el cambio', problema instanceof Error ? problema.message : 'Intentá nuevamente.');
    } finally {
      bloqueoGuardado.current = false;
      setGuardando(false);
    }
  }

  async function alternarAviso() {
    if (!evento || bloqueoGuardado.current) return;
    bloqueoGuardado.current = true;
    setGuardando(true);
    try {
      const registro = tieneAviso
        ? await cancelarRecordatorio(evento.id)
        : await activarRecordatorio(evento, 60);
      setTieneAviso(registro?.notificacionId != null);
    } catch (problema) {
      Alert.alert('Recordatorio', problema instanceof Error ? problema.message : 'No pudimos cambiar el aviso.');
    } finally {
      bloqueoGuardado.current = false;
      setGuardando(false);
    }
  }

  return (
    <ScrollView style={styles.contenedor}>
      {evento.imagenUrl && <Image source={{ uri: evento.imagenUrl }} style={styles.imagen} />}

      <View style={styles.cuerpo}>
        {afectado && <Text style={styles.aviso}>Este evento está {evento.estado}.</Text>}

        <Text style={styles.titulo}>{evento.titulo}</Text>

        <Fila
          titulo="Cuándo"
          valor={`${formatearTituloDia(evento.inicio)}, ${formatearHora(evento.inicio)}`}
        />
        {evento.fin && <Fila titulo="Duración" valor={formatearDuracion(evento.inicio, evento.fin)} />}
        <Fila titulo="Entrada" valor={textoPrecio(evento.precio)} />

        {lugar ? (
          <Pressable onPress={() => router.push({ pathname: '/lugar/[id]', params: { id: lugar.id } })} accessibilityRole="link">
            <Fila titulo="Dónde (tocá para ver el lugar)" valor={lugar.nombre} destacado />
          </Pressable>
        ) : (
          <Fila titulo="Dónde" valor={evento.direccionLibre ?? "A confirmar"} />
        )}

        <Text style={styles.descripcion}>{evento.descripcion}</Text>

        {(guardado || evento.estado === "programado" || evento.estado === "suspendido") && (
          <Pressable
            style={[styles.boton, guardado && styles.botonGuardado]}
            onPress={alternarGuardado}
            disabled={guardando}
            accessibilityState={{ disabled: guardando }}
            accessibilityRole="button"
          >
            <Text style={[styles.botonTexto, guardado && styles.botonTextoGuardado]}>
              {guardando ? "Guardando…" : guardado ? "Guardado ✓ (tocá para quitar)" : "Guardar evento"}
            </Text>
          </Pressable>
        )}
        {guardado && (
          <>
            <Text style={styles.descripcion}>
              {tieneAviso ? 'Aviso programado para una hora antes del inicio.' : 'Este teléfono no tiene un aviso programado para el evento.'}
            </Text>
            {(tieneAviso || evento.estado === 'programado') && (
              <Pressable accessibilityRole="button" disabled={guardando} onPress={alternarAviso} style={[styles.boton, styles.botonGuardado]}>
                <Text style={[styles.botonTexto, styles.botonTextoGuardado]}>
                  {guardando ? 'Esperá…' : tieneAviso ? 'Cancelar recordatorio' : 'Avisarme una hora antes'}
                </Text>
              </Pressable>
            )}
          </>
        )}
      </View>
    </ScrollView>
  );
}

function Fila({
  titulo,
  valor,
  destacado = false,
}: {
  titulo: string;
  valor: string;
  destacado?: boolean;
}) {
  return (
    <View style={styles.fila}>
      <Text style={styles.filaTitulo}>{titulo}</Text>
      <Text style={[styles.filaValor, destacado && styles.filaDestacada]}>{valor}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: "#fff" },
  centro: { flex: 1, alignItems: "center", justifyContent: "center" },
  imagen: { width: "100%", height: 200 },
  cuerpo: { padding: 16, gap: 8 },
  aviso: {
    backgroundColor: "#FBE9E7",
    color: "#A33",
    fontWeight: "700",
    padding: 10,
    borderRadius: 8,
    fontSize: 16,
  },
  titulo: { fontSize: 24, fontWeight: "800" },
  fila: { paddingVertical: 10, borderTopWidth: 1, borderTopColor: "#eee" },
  filaTitulo: { fontSize: 14, color: "#595959" },
  filaValor: { fontSize: 16, color: "#222", textTransform: "capitalize" },
  filaDestacada: { color: "#174F49", fontWeight: "700" },
  descripcion: { fontSize: 16, lineHeight: 24, color: "#333", marginTop: 8 },
  boton: {
    backgroundColor: "#174F49",
    minHeight: 48,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
  },
  botonGuardado: { backgroundColor: "#fff", borderWidth: 1.5, borderColor: "#174F49" },
  botonTexto: { color: "#fff", fontWeight: "700", fontSize: 16 },
  botonTextoGuardado: { color: "#174F49" },
});