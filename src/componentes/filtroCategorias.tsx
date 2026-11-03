import { ScrollView, Pressable, Text, StyleSheet } from "react-native";
import { Categoria } from "../tipos";

interface Props {
  categorias: Categoria[];
  seleccionada: string | null;
  onSeleccionar: (id: string | null) => void;
}

export function FiltroCategorias({ categorias, seleccionada, onSeleccionar }: Props) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroll}>
      <Pressable
        style={[styles.chip, seleccionada === null && styles.chipActivo]}
        onPress={() => onSeleccionar(null)}
      >
        <Text style={[styles.texto, seleccionada === null && styles.textoActivo]}>Todas</Text>
      </Pressable>

      {categorias.map((cat) => {
        const activa = seleccionada === cat.id;
        return (
          <Pressable
            key={cat.id}
            style={[styles.chip, activa && styles.chipActivo]}
            onPress={() => onSeleccionar(cat.id)}
          >
            <Text style={[styles.texto, activa && styles.textoActivo]}>{cat.nombre}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 0, marginBottom: 12 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 48,
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#CBD7D0",
    marginRight: 8,
  },
  chipActivo: { backgroundColor: "#174F49", borderColor: "#174F49" },
  texto: { fontSize: 16, fontWeight: "700", color: "#174F49" },
  textoActivo: { color: "#fff" },
});