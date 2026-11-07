import * as Location from "expo-location";
import { useFocusEffect } from "expo-router";
import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  AppState,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import {
  avisarLugarCercano,
  guardarAjustesProximidad,
  obtenerAjustesProximidad,
  prepararAvisosProximidad,
  type AjustesProximidad,
  type RadioProximidad,
} from "../servicios/proximidad";
import { probarNotificacion } from "../servicios/recordatorios-eventos";
import type { Lugar } from "../tipos/lugar";

export default function AvisosProximidad({
  lugares,
  abierto,
  onAlternar,
  botonFiltro,
}: {
  lugares: Lugar[];
  abierto: boolean;
  onAlternar: () => void;
  botonFiltro: ReactNode;
}) {
  const [ajustes, setAjustes] = useState<AjustesProximidad | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [appActiva, setAppActiva] = useState(
    AppState.currentState === "active",
  );
  const bloqueo = useRef(false);
  const montado = useRef(true);

  useEffect(() => {
    montado.current = true;
    const listener = AppState.addEventListener("change", (estado) =>
      setAppActiva(estado === "active"),
    );
    void obtenerAjustesProximidad()
      .then((valor) => {
        if (montado.current) setAjustes(valor);
      })
      .catch(() => {
        if (montado.current)
          setMensaje("No pudimos leer los ajustes de avisos.");
      });
    return () => {
      montado.current = false;
      listener.remove();
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!ajustes?.activados || !appActiva) return;
      let vigente = true;
      let suscripcion: Location.LocationSubscription | null = null;
      async function iniciar() {
        try {
          const permiso = await Location.getForegroundPermissionsAsync();
          if (!permiso.granted)
            throw new Error(
              "Permití la ubicación para recibir avisos cercanos.",
            );
          if (!(await Location.hasServicesEnabledAsync()))
            throw new Error(
              "Activá la ubicación del teléfono para recibir avisos cercanos.",
            );
          if (!vigente) return;
          const nueva = await Location.watchPositionAsync(
            {
              accuracy: Location.Accuracy.Balanced,
              distanceInterval: 25,
              timeInterval: 15000,
            },
            (posicion) => {
              if (!vigente || AppState.currentState !== "active") return;
              void avisarLugarCercano(
                lugares,
                posicion,
                ajustes!.radio,
                () => vigente && AppState.currentState === "active",
              )
                .then((nombre) => {
                  if (vigente && nombre)
                    setMensaje(`Te avisamos sobre ${nombre}.`);
                })
                .catch((error) => {
                  if (vigente)
                    setMensaje(
                      error instanceof Error
                        ? error.message
                        : "No pudimos mostrar el aviso.",
                    );
                });
            },
            () => {
              if (vigente)
                setMensaje(
                  "No pudimos actualizar tu ubicación. Revisá los permisos y el GPS.",
                );
            },
          );
          if (vigente) suscripcion = nueva;
          else nueva.remove();
        } catch (error) {
          if (vigente)
            setMensaje(
              error instanceof Error
                ? error.message
                : "No pudimos iniciar los avisos.",
            );
        }
      }
      void iniciar();
      return () => {
        vigente = false;
        suscripcion?.remove();
      };
    }, [ajustes, appActiva, lugares]),
  );

  async function cambiar(
    activados: boolean,
    radio: RadioProximidad = ajustes?.radio ?? 250,
  ) {
    if (bloqueo.current) return;
    bloqueo.current = true;
    setOcupado(true);
    setMensaje(null);
    try {
      if (activados) {
        const permiso = await Location.requestForegroundPermissionsAsync();
        if (!permiso.granted)
          throw new Error(
            "Podés usar el mapa sin avisos. Para activarlos necesitás permitir la ubicación.",
          );
        if (!(await Location.hasServicesEnabledAsync()))
          throw new Error(
            "Activá la ubicación del teléfono y volvé a intentar.",
          );
        await prepararAvisosProximidad();
      }
      const nuevos = { activados, radio };
      await guardarAjustesProximidad(nuevos);
      if (montado.current) setAjustes(nuevos);
    } catch (error) {
      if (montado.current)
        setMensaje(
          error instanceof Error
            ? error.message
            : "No pudimos guardar el ajuste.",
        );
    } finally {
      bloqueo.current = false;
      if (montado.current) setOcupado(false);
    }
  }
  async function probar() {
    if (bloqueo.current) return;
    bloqueo.current = true;
    setOcupado(true);
    try {
      await probarNotificacion();
      if (montado.current)
        Alert.alert("Aviso de prueba", "Debería aparecer en unos 10 segundos.");
    } catch (error) {
      if (montado.current)
        setMensaje(
          error instanceof Error
            ? error.message
            : "No pudimos programar la prueba.",
        );
    } finally {
      bloqueo.current = false;
      if (montado.current) setOcupado(false);
    }
  }
  return (
    <View style={styles.contenedor}>
      <View style={styles.barra}>
        {botonFiltro}
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: abierto }}
          onPress={onAlternar}
          style={styles.botonAvisos}
        >
          <Text style={styles.titulo}>
            Avisos cercanos{ajustes?.activados ? " ✓" : ""}
          </Text>
        </Pressable>
      </View>
      {abierto && (
        <ScrollView style={styles.panel} nestedScrollEnabled>
          <Text style={styles.texto}>
            Recibí como máximo un aviso por lugar y por día, con al menos cinco
            minutos entre avisos, mientras tengas este mapa abierto y la
            pantalla encendida.
          </Text>
          <View style={styles.fila}>
            <Text style={styles.texto}>Avisarme cuando esté cerca</Text>
            <Switch
              accessibilityLabel="Activar avisos de lugares cercanos"
              value={ajustes?.activados ?? false}
              disabled={ocupado || !ajustes}
              onValueChange={(valor) => {
                void cambiar(valor);
              }}
              trackColor={{ true: "#174F49" }}
            />
          </View>
          <View style={styles.radios}>
            {([100, 250, 500] as const).map((radio) => (
              <Pressable
                key={radio}
                accessibilityRole="button"
                accessibilityState={{
                  selected: ajustes?.radio === radio,
                  disabled: ocupado || !ajustes,
                }}
                disabled={ocupado || !ajustes}
                onPress={() => {
                  void cambiar(ajustes?.activados ?? false, radio);
                }}
                style={[
                  styles.boton,
                  ajustes?.radio === radio && styles.seleccionado,
                ]}
              >
                <Text
                  style={[
                    styles.textoRadio,
                    ajustes?.radio === radio && styles.textoSeleccionado,
                  ]}
                >
                  {radio} m
                </Text>
              </Pressable>
            ))}
          </View>
          <Pressable
            accessibilityRole="button"
            disabled={ocupado}
            onPress={() => {
              void probar();
            }}
            style={styles.boton}
          >
            <Text style={styles.textoRadio}>
              {ocupado ? "Esperá…" : "Probar un aviso en 10 segundos"}
            </Text>
          </Pressable>
          {mensaje && <Text style={styles.texto}>{mensaje}</Text>}
        </ScrollView>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  contenedor: { marginTop: 8 },
  barra: { flexDirection: "row", gap: 8 },
  botonAvisos: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#CBD7D0",
    justifyContent: "center",
    alignItems: "center",
  },
  panel: { maxHeight: 180 },
  fila: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  titulo: { fontSize: 15, fontWeight: "bold", color: "#174F49", flexShrink: 1 },
  texto: {
    fontSize: 14,
    lineHeight: 20,
    color: "#586C70",
    flexShrink: 1,
    marginVertical: 6,
  },
  radios: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  boton: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#CBD7D0",
    padding: 12,
    justifyContent: "center",
    alignItems: "center",
    marginVertical: 4,
  },
  seleccionado: { backgroundColor: "#174F49", borderColor: "#174F49" },
  textoRadio: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#174F49",
    textAlign: "center",
  },
  textoSeleccionado: { color: "#FFFFFF" },
});
