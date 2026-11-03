import { View, Text, Pressable, StyleSheet } from "react-native";

interface Props {
  mensaje: string;
  onReintentar?: () => void;
}

export function PantallaError({ mensaje, onReintentar }: Props) {
  return (
    <View style={styles.centro}>
      <Text style={styles.mensaje}>{mensaje}</Text>
      {onReintentar && (
        <Pressable style={styles.boton} onPress={onReintentar} accessibilityRole="button">
          <Text style={styles.botonTexto}>Reintentar</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  centro: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 16 },
  mensaje: { fontSize: 16, textAlign: "center", color: "#333" },
  boton: {
    backgroundColor: "#1F8A70",
    minHeight: 48,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  botonTexto: { color: "#fff", fontWeight: "700", fontSize: 16 },
});