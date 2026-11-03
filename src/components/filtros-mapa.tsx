import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type { Categoria } from '../tipos/categoria';

const RADIOS = [
  { etiqueta: 'Todos', metros: null },
  { etiqueta: '1 km', metros: 1000 },
  { etiqueta: '5 km', metros: 5000 },
  { etiqueta: '10 km', metros: 10000 },
];

interface Props {
  categorias: Categoria[];
  categoriaSeleccionada: string | null;
  radioMetros: number | null;
  tieneUbicacion: boolean;
  soloAbiertos: boolean;
  soloAccesibles: boolean;
  onCategoria: (id: string | null) => void;
  onRadio: (metros: number | null) => void;
  onSoloAbiertos: () => void;
  onSoloAccesibles: () => void;
}

interface BotonFiltroProps {
  texto: string;
  seleccionado: boolean;
  deshabilitado?: boolean;
  etiquetaAccesible?: string;
  onPress: () => void;
}

function BotonFiltro({
  texto,
  seleccionado,
  deshabilitado = false,
  etiquetaAccesible,
  onPress,
}: BotonFiltroProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={etiquetaAccesible ?? texto}
      accessibilityState={{
        selected: seleccionado,
        disabled: deshabilitado,
      }}
      disabled={deshabilitado}
      onPress={onPress}
      style={[
        styles.opcion,
        seleccionado && styles.opcionActiva,
        deshabilitado && styles.deshabilitado,
      ]}
    >
      <Text
        style={[
          styles.textoOpcion,
          seleccionado && styles.textoOpcionActivo,
        ]}
      >
        {texto}
      </Text>
    </Pressable>
  );
}

export default function FiltrosMapa({
  categorias,
  categoriaSeleccionada,
  radioMetros,
  tieneUbicacion,
  soloAbiertos,
  soloAccesibles,
  onCategoria,
  onRadio,
  onSoloAbiertos,
  onSoloAccesibles,
}: Props) {
  const [desplegados, setDesplegados] = useState(false);

  const cantidadActivos =
    Number(categoriaSeleccionada !== null) +
    Number(radioMetros !== null) +
    Number(soloAbiertos) +
    Number(soloAccesibles);

  const nombreCategoria = categorias.find(
    (categoria) => categoria.id === categoriaSeleccionada
  )?.nombre;

  const resumen = [
    categoriaSeleccionada === null
      ? 'Todas las categorías'
      : nombreCategoria ?? 'Categoría seleccionada',
    radioMetros === null
      ? 'Sin límite de distancia'
      : `Hasta ${radioMetros / 1000} km`,
    ...(soloAbiertos ? ['Abiertos ahora'] : []),
    ...(soloAccesibles ? ['Solo accesibles'] : []),
  ].join(' · ');

  function limpiarFiltros() {
    onCategoria(null);
    onRadio(null);

    if (soloAbiertos) {
      onSoloAbiertos();
    }

    if (soloAccesibles) {
      onSoloAccesibles();
    }
  }

  return (
    <View style={styles.contenedor}>
      <View style={styles.cabecera}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            desplegados ? 'Ocultar filtros' : 'Mostrar filtros'
          }
          accessibilityState={{ expanded: desplegados }}
          onPress={() => setDesplegados((valor) => !valor)}
          style={styles.botonDesplegar}
        >
          <Text style={styles.titulo}>
            Filtros
            {cantidadActivos > 0 ? ` (${cantidadActivos})` : ''}
          </Text>

          <Text style={styles.accion}>
            {desplegados ? 'Ocultar ▴' : 'Mostrar ▾'}
          </Text>
        </Pressable>

        {cantidadActivos > 0 && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Quitar todos los filtros"
            onPress={limpiarFiltros}
            style={styles.botonLimpiar}
          >
            <Text style={styles.textoLimpiar}>Limpiar</Text>
          </Pressable>
        )}
      </View>

      <Text style={styles.resumen}>{resumen}</Text>

      {desplegados && (
        <ScrollView
          style={styles.panel}
          contentContainerStyle={styles.contenidoPanel}
          nestedScrollEnabled
        >
          <Text style={styles.etiqueta}>Categoría</Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.opciones}
          >
            <BotonFiltro
              texto="Todas las categorías"
              seleccionado={categoriaSeleccionada === null}
              onPress={() => onCategoria(null)}
            />

            {categorias.map((categoria) => (
              <BotonFiltro
                key={categoria.id}
                texto={categoria.nombre}
                seleccionado={
                  categoriaSeleccionada === categoria.id
                }
                onPress={() => onCategoria(categoria.id)}
              />
            ))}
          </ScrollView>

          <Text style={styles.etiqueta}>
            Distancia desde tu ubicación
          </Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.opciones}
          >
            {RADIOS.map((radio) => (
              <BotonFiltro
                key={radio.etiqueta}
                texto={radio.etiqueta}
                seleccionado={radioMetros === radio.metros}
                deshabilitado={
                  radio.metros !== null && !tieneUbicacion
                }
                etiquetaAccesible={
                  radio.metros === null
                    ? 'Sin límite de distancia'
                    : `Lugares a ${radio.etiqueta} o menos`
                }
                onPress={() => onRadio(radio.metros)}
              />
            ))}
          </ScrollView>

          {!tieneUbicacion && (
            <Text style={styles.ayuda}>
              Consultá Mi ubicación para habilitar los radios.
            </Text>
          )}

          <Text style={styles.etiqueta}>Más opciones</Text>

          <View style={styles.extras}>
            <BotonFiltro
              texto={
                soloAbiertos
                  ? '✓ Abierto ahora'
                  : 'Abierto ahora'
              }
              seleccionado={soloAbiertos}
              onPress={onSoloAbiertos}
            />

            <BotonFiltro
              texto={
                soloAccesibles
                  ? '✓ Solo accesibles'
                  : 'Solo accesibles'
              }
              etiquetaAccesible={
                'Solo lugares accesibles para silla de ruedas'
              }
              seleccionado={soloAccesibles}
              onPress={onSoloAccesibles}
            />
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={() => setDesplegados(false)}
            style={styles.botonVerMapa}
          >
            <Text style={styles.textoVerMapa}>
              Listo, ver mapa
            </Text>
          </Pressable>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: {
    marginTop: 10,
  },
  cabecera: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  botonDesplegar: {
    flex: 1,
    minWidth: 170,
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#EFF6F1',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  titulo: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#183B42',
  },
  accion: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#14665C',
  },
  botonLimpiar: {
    minHeight: 48,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  textoLimpiar: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#14665C',
  },
  resumen: {
    fontSize: 14,
    lineHeight: 20,
    color: '#586C70',
    marginTop: 6,
  },
  panel: {
    maxHeight: 260,
    marginTop: 6,
  },
  contenidoPanel: {
    paddingBottom: 4,
  },
  etiqueta: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#385354',
    marginTop: 10,
    marginBottom: 6,
  },
  opciones: {
    gap: 8,
    paddingVertical: 2,
  },
  opcion: {
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#CBD7D0',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
  },
  opcionActiva: {
    backgroundColor: '#183B42',
    borderColor: '#183B42',
  },
  textoOpcion: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#385354',
  },
  textoOpcionActivo: {
    color: '#FFFFFF',
  },
  deshabilitado: {
    opacity: 0.45,
  },
  ayuda: {
    fontSize: 13,
    lineHeight: 19,
    color: '#586C70',
    marginTop: 6,
  },
  extras: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  botonVerMapa: {
    minHeight: 48,
    backgroundColor: '#174F49',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },
  textoVerMapa: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
});