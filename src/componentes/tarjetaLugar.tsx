import { Pressable, Text, StyleSheet, View } from "react-native";
import { Lugar } from "../tipos";
import { formatearDistancia } from "@/utils/distancia";

interface Props {
    lugar: Lugar;
    distanciaMetros?: number | null;
    onPress: () => void;
}

export function TarjetaLugar({ lugar, distanciaMetros = null, onPress}: Props) {
    return (
        <Pressable style={styles.tarjeta} onPress={onPress}>
            <View style={styles.fila}>
                <Text style={styles.nombre}>{lugar.nombre}</Text>
                {distanciaMetros !== null && (
                    <Text style={styles.distancia}>{formatearDistancia(distanciaMetros)}</Text>
                )}
            </View>
            <Text style={styles.descripcion}>{lugar.descripcionCorta}</Text>
        </Pressable>
);
    
}

const styles = StyleSheet.create({
  tarjeta: { backgroundColor: "#eee", padding: 14, borderRadius: 10, marginBottom: 10 },
  nombre: { fontSize: 16, fontWeight: "700" },
  descripcion: { fontSize: 14, color: "#555" },
  distancia: { fontSize: 14, fontWeight: "700", color: "#174F49", marginLeft: 8 },
  fila: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
});