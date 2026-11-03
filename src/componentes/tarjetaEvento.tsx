import { View, Text, StyleSheet, Pressable } from "react-native";
import { Evento } from "../tipos";
import { formatearHora } from "../utils/fechas";

interface Props {
    evento: Evento;
    onPress: () => void;
}

function textoPrecio(precio: number | null): string {
    if (precio === null) return "Consultar Precio";
    if (precio === 0) return "Gratis";
    return `$${precio}`;
}

export function TarjetaEvento({evento, onPress}: Props) {
    const afectado = evento.estado === "suspendido" || evento.estado === "cancelado";


    return (
        <Pressable style={styles.tarjeta} onPress={onPress}>
            <View style={styles.fila}>
                <Text style={[styles.titulo, afectado && styles.tituloTachado]}>
                    {evento.titulo}

                </Text>
                {afectado && <Text style={styles.etiqueta}>{evento.estado.toUpperCase()}</Text>}
            </View>
            <Text style={styles.detalle}>
                {formatearHora(evento.inicio)}
                {evento.fin ? `a ${formatearHora(evento.fin)}` : ""} · {textoPrecio(evento.precio)}
            </Text>

        </Pressable>
    );
}
    
const styles = StyleSheet.create({
    tarjeta: { backgroundColor: "#eee", padding: 14, borderRadius: 10, marginBottom: 10 },
    fila: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    titulo: { fontSize: 16, fontWeight: "700", flexShrink: 1 },
    tituloTachado: { textDecorationLine: "line-through", color: "#888" },
    etiqueta: { fontSize: 11, fontWeight: "800", color: "#A33", marginLeft: 8 },
    detalle: { fontSize: 14, color: "#555", marginTop: 4 },
});