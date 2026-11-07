import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

import AvisosProximidad from '../components/avisos-proximidad';
import BrujulaLugar from '../components/brujula-lugar';
import FiltrosMapa from '../components/filtros-mapa';
import { obtenerCategorias } from '../servicios/categorias';
import { obtenerLugares } from '../servicios/lugares';
import type { Categoria } from '../tipos/categoria';
import type { Lugar } from '../tipos/lugar';
import {
  calcularDistanciaMetros,
  mostrarDistancia,
} from '../utilidades/distancias';
import {
  mostrarEstadoHorario,
  obtenerEstadoHorario,
} from '../utilidades/horarios';

export default function MapaScreen() {
  const webview = useRef<WebView>(null);
  const buscandoRef = useRef(false);
  const montadoRef = useRef(true);

  const [lugares, setLugares] = useState<Lugar[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [categoriaSeleccionada, setCategoriaSeleccionada] =
    useState<string | null>(null);
  const [radioMetros, setRadioMetros] = useState<number | null>(null);
  const [soloAbiertos, setSoloAbiertos] = useState(false);
  const [soloAccesibles, setSoloAccesibles] = useState(false);
  const [ahora, setAhora] = useState(() => new Date());
  const [ubicacion, setUbicacion] =
    useState<Location.LocationObject | null>(null);
  const [lugarBrujula, setLugarBrujula] = useState<Lugar | null>(null);
  const [panelMapa, setPanelMapa] = useState<'filtros' | 'avisos' | null>(null);
  const filtrosAbiertos = panelMapa === 'filtros';
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mapaListo, setMapaListo] = useState(false);
  const [avisoMapa, setAvisoMapa] = useState<string | null>(null);
  const [buscandoUbicacion, setBuscandoUbicacion] = useState(false);

  useEffect(() => {
    montadoRef.current = true;

    return () => {
      montadoRef.current = false;
    };
  }, []);

  useEffect(() => {
    const temporizador = setInterval(() => {
      setAhora(new Date());
    }, 30000);

    const suscripcion = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') {
        setAhora(new Date());
      }
    });

    return () => {
      clearInterval(temporizador);
      suscripcion.remove();
    };
  }, []);

  useEffect(() => {
    let activo = true;

    async function cargarDatos() {
      try {
        const [respuestaLugares, respuestaCategorias] =
          await Promise.all([
            obtenerLugares(),
            obtenerCategorias(),
          ]);

        if (activo) {
          setLugares(
            respuestaLugares.datos.filter((lugar) => lugar.activo)
          );
          setCategorias(respuestaCategorias.datos);
        }
      } catch {
        if (activo) {
          setError('No pudimos cargar los datos del mapa.');
        }
      } finally {
        if (activo) {
          setCargando(false);
        }
      }
    }

    void cargarDatos();

    return () => {
      activo = false;
    };
  }, []);

  const filas = useMemo(
    () => lugares.map((lugar) => ({
      lugar,
      estadoHorario: obtenerEstadoHorario(lugar.horarios, ahora),
      distancia: ubicacion
        ? calcularDistanciaMetros(
            {
              latitud: ubicacion.coords.latitude,
              longitud: ubicacion.coords.longitude,
            },
            lugar.coordenadas
          )
        : null,
    })),
    [lugares, ubicacion, ahora]
  );

  const lugaresVisibles = useMemo(() => {
    const resultado = filas.filter(
      ({ lugar, distancia, estadoHorario }) => {
        const coincideCategoria =
          categoriaSeleccionada === null ||
          lugar.categoriaId === categoriaSeleccionada;

        const coincideRadio =
          radioMetros === null ||
          (distancia !== null && distancia <= radioMetros);

        const coincideHorario =
          !soloAbiertos || estadoHorario === 'abierto';

        const coincideAccesibilidad =
          !soloAccesibles || lugar.accesible;

        return (
          coincideCategoria &&
          coincideRadio &&
          coincideHorario &&
          coincideAccesibilidad
        );
      }
    );

    if (ubicacion) {
      resultado.sort(
        (a, b) => (a.distancia ?? 0) - (b.distancia ?? 0)
      );
    }

    return resultado;
  }, [
    filas,
    categoriaSeleccionada,
    radioMetros,
    soloAbiertos,
    soloAccesibles,
    ubicacion,
  ]);

  const html = useMemo(() => {
    const datos = JSON.stringify(
      lugares.map((lugar) => ({
        id: lugar.id,
        nombre: lugar.nombre,
        latitud: lugar.coordenadas.latitud,
        longitud: lugar.coordenadas.longitud,
      }))
    ).replace(/</g, '\\u003c');

    return `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport"
          content="width=device-width, initial-scale=1.0" />
        <link rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <style>
          html, body, #mapa {
            height:100%; width:100%; margin:0; padding:0;
          }
          body { font-family:sans-serif; }
          .nombre {
            font-size:18px; font-weight:bold; margin-bottom:8px;
          }
          .dato {
            font-size:15px; color:#385354; margin-bottom:10px;
          }
          .acciones {
            display:flex; flex-wrap:wrap; gap:8px;
          }
          button {
            min-height:48px; padding:12px 16px;
            border:0; border-radius:8px;
            background:#174F49; color:white; font-size:16px;
          }
          .secundario {
            background:#EFF6F1; color:#174F49;
          }
        </style>
      </head>
      <body>
        <div id="mapa"></div>
        <script>
          function avisar(tipo, datos) {
            window.ReactNativeWebView.postMessage(
              JSON.stringify({ tipo:tipo, ...datos })
            );
          }

          window.onerror = function () {
            avisar('error', {
              mensaje:'No pudimos iniciar el mapa.'
            });
          };
        </script>
        <script
          src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
          onerror="avisar('error', {
            mensaje:'No pudimos descargar el mapa. Revisá tu conexión.'
          })"
        ></script>
        <script>
          const lugares = ${datos};
          const mapa = L.map('mapa').setView([-32.218,-58.142],14);
          const marcadores = [];

          let idsVisibles = new Set(lugares.map(l => l.id));
          let posicionUsuario = null;
          let puntoUsuario = null;
          let circuloPrecision = null;
          let circuloBusqueda = null;

          L.tileLayer(
            'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
            {
              maxZoom:19,
              attribution:
                '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            }
          ).addTo(mapa).on('tileerror', function () {
            avisar('aviso', {
              mensaje:'Algunas imágenes del mapa no se pudieron cargar.'
            });
          });

          lugares.forEach(function (lugar) {
            const coordenadas = [lugar.latitud,lugar.longitud];
            const contenido = document.createElement('div');

            const nombre = document.createElement('div');
            nombre.className = 'nombre';
            nombre.textContent = lugar.nombre;

            const distancia = document.createElement('div');
            distancia.className = 'dato';
            distancia.textContent =
              'Consultá tu ubicación para ver la distancia.';

            const horario = document.createElement('div');
            horario.className = 'dato';

            const accesibilidad = document.createElement('div');
            accesibilidad.className = 'dato';

            const acciones = document.createElement('div');
            acciones.className = 'acciones';

            const detalle = document.createElement('button');
            detalle.textContent = 'Ver detalle';
            detalle.addEventListener('click', function () {
              avisar('detalle', { id:lugar.id });
            });

            const direccion = document.createElement('button');
            direccion.className = 'secundario';
            direccion.textContent = 'Ver dirección';
            direccion.addEventListener('click', function () {
              avisar('brujula', { id:lugar.id });
            });

            acciones.append(detalle,direccion);
            contenido.append(
              nombre,distancia,horario,accesibilidad,acciones
            );

            marcadores.push({
              id:lugar.id,
              coordenadas:coordenadas,
              distancia:distancia,
              horario:horario,
              accesibilidad:accesibilidad,
              marcador:L.marker(coordenadas)
                .addTo(mapa).bindPopup(contenido)
            });
          });

          window.verLugares = function () {
            if (circuloBusqueda) {
              mapa.fitBounds(circuloBusqueda.getBounds(), {
                padding:[20,20], maxZoom:15
              });
              return;
            }

            const puntos = marcadores
              .filter(e => idsVisibles.has(e.id))
              .map(e => e.coordenadas);

            if (puntos.length > 0) {
              mapa.fitBounds(puntos, {
                padding:[35,35], maxZoom:15
              });
            } else if (posicionUsuario) {
              mapa.setView(posicionUsuario,15);
            } else {
              mapa.setView([-32.218,-58.142],14);
            }
          };

          window.actualizarDatos = function (datos) {
            const porId = new Map(datos.map(d => [d.id,d]));

            marcadores.forEach(function (elemento) {
              const dato = porId.get(elemento.id);
              if (!dato) return;

              elemento.horario.textContent = dato.horario;
              elemento.distancia.textContent = dato.distancia;
              elemento.accesibilidad.textContent =
                dato.accesibilidad;
            });
          };

          window.actualizarUbicacion = function (
            posicion,precision
          ) {
            posicionUsuario = posicion;

            if (puntoUsuario) {
              puntoUsuario.setLatLng(posicion);
            } else {
              puntoUsuario = L.circleMarker(posicion, {
                radius:9, color:'#FFFFFF', weight:3,
                fillColor:'#1769D2', fillOpacity:1
              }).addTo(mapa).bindPopup('Tu ubicación al consultar');
            }

            if (circuloPrecision) {
              mapa.removeLayer(circuloPrecision);
              circuloPrecision = null;
            }

            if (typeof precision === 'number' && precision > 0) {
              circuloPrecision = L.circle(posicion, {
                radius:precision, color:'#1769D2',
                weight:1, fillOpacity:0.1, interactive:false
              }).addTo(mapa);
            }
          };

          window.aplicarFiltros = function (ids,radio,posicion) {
            idsVisibles = new Set(ids);
            mapa.closePopup();

            marcadores.forEach(function (elemento) {
              if (idsVisibles.has(elemento.id)) {
                if (!mapa.hasLayer(elemento.marcador)) {
                  elemento.marcador.addTo(mapa);
                }
              } else {
                mapa.removeLayer(elemento.marcador);
              }
            });

            if (circuloBusqueda) {
              mapa.removeLayer(circuloBusqueda);
              circuloBusqueda = null;
            }

            if (radio !== null && posicion !== null) {
              circuloBusqueda = L.circle(posicion, {
                radius:radio, color:'#14665C', weight:2,
                dashArray:'6, 6', fillOpacity:0.05,
                interactive:false
              }).addTo(mapa);
            }

            window.verLugares();
          };

          window.centrarUsuario = function () {
            if (posicionUsuario) {
              mapa.setView(posicionUsuario,15);
            }
          };

          window.verLugares();

          setTimeout(function () {
            mapa.invalidateSize();
            avisar('listo',{});
          },200);
        </script>
      </body>
      </html>
    `;
  }, [lugares]);

  const fuenteMapa = useMemo(() => ({ html }), [html]);

  const idsVisibles = useMemo(
    () => JSON.stringify(
      lugaresVisibles.map(({ lugar }) => lugar.id)
    ).replace(/</g, '\\u003c'),
    [lugaresVisibles]
  );

  useEffect(() => {
    if (!mapaListo) return;

    const datos = JSON.stringify(
      filas.map((fila) => ({
        id: fila.lugar.id,
        horario: mostrarEstadoHorario(fila.estadoHorario),
        distancia: fila.distancia === null
          ? 'Consultá tu ubicación para ver la distancia.'
          : `${mostrarDistancia(fila.distancia)} en línea recta`,
        accesibilidad: fila.lugar.accesible
          ? 'Accesible para silla de ruedas'
          : 'No figura como accesible en el catálogo',
      }))
    ).replace(/</g, '\\u003c');

    webview.current?.injectJavaScript(`
      if (window.actualizarDatos) {
        window.actualizarDatos(${datos});
      }
      true;
    `);
  }, [filas, mapaListo]);

  useEffect(() => {
    if (!ubicacion || !mapaListo) return;

    const argumentos = JSON.stringify([
      [ubicacion.coords.latitude, ubicacion.coords.longitude],
      ubicacion.coords.accuracy,
    ]);

    webview.current?.injectJavaScript(`
      if (window.actualizarUbicacion) {
        window.actualizarUbicacion(...${argumentos});
      }
      true;
    `);
  }, [ubicacion, mapaListo]);

  useEffect(() => {
    if (!mapaListo) return;

    const posicion = JSON.stringify(
      ubicacion
        ? [ubicacion.coords.latitude, ubicacion.coords.longitude]
        : null
    );

    webview.current?.injectJavaScript(`
      if (window.aplicarFiltros) {
        window.aplicarFiltros(
          ${idsVisibles}, ${JSON.stringify(radioMetros)}, ${posicion}
        );
      }
      true;
    `);
  }, [idsVisibles, radioMetros, ubicacion, mapaListo]);

  async function mostrarMiUbicacion() {
    if (buscandoRef.current) return;

    buscandoRef.current = true;
    setBuscandoUbicacion(true);

    try {
      const permiso =
        await Location.requestForegroundPermissionsAsync();

      if (!montadoRef.current) return;

      if (!permiso.granted) {
        Alert.alert(
          'Ubicación no habilitada',
          'Podés explorar el mapa sin ubicación. Para calcular distancias, habilitá el permiso desde los ajustes de Expo Go.'
        );
        return;
      }

      const serviciosActivos =
        await Location.hasServicesEnabledAsync();

      if (!montadoRef.current) return;

      if (!serviciosActivos) {
        Alert.alert(
          'Activá la ubicación',
          'La ubicación del teléfono está apagada.'
        );
        return;
      }

      const posicion = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      if (!montadoRef.current) return;

      const { latitude, longitude } = posicion.coords;

      if (
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude)
      ) {
        throw new Error('Ubicación no válida.');
      }

      setUbicacion(posicion);
    } catch {
      if (montadoRef.current) {
        Alert.alert(
          'No pudimos obtener tu ubicación',
          'Probá nuevamente. El listado sigue disponible.'
        );
      }
    } finally {
      buscandoRef.current = false;

      if (montadoRef.current) {
        setBuscandoUbicacion(false);
      }
    }
  }

  function mostrarLugares() {
    webview.current?.injectJavaScript(`
      if (window.verLugares) window.verLugares();
      true;
    `);
  }

  function centrarMiUbicacion() {
    webview.current?.injectJavaScript(`
      if (window.centrarUsuario) window.centrarUsuario();
      true;
    `);
  }

  function abrirDetalle(id: string) {
    router.push({
      pathname: '/lugar/[id]',
      params: { id },
    });
  }

  function abrirBrujula(lugar: Lugar) {
    if (!ubicacion) {
      Alert.alert(
        'Consultá tu ubicación',
        'Tocá Mi ubicación antes de usar la flecha hacia un lugar.'
      );
      return;
    }

    setLugarBrujula(lugar);
  }

  function recibirMensaje(texto: string) {
    try {
      const mensaje: unknown = JSON.parse(texto);

      if (
        typeof mensaje !== 'object' ||
        mensaje === null ||
        !('tipo' in mensaje)
      ) return;

      if (mensaje.tipo === 'listo') {
        setMapaListo(true);
        return;
      }

      if (
        mensaje.tipo === 'aviso' &&
        'mensaje' in mensaje &&
        typeof mensaje.mensaje === 'string'
      ) {
        setAvisoMapa(mensaje.mensaje);
        return;
      }

      if (mensaje.tipo === 'error') {
        setMapaListo(false);
        setError(
          'mensaje' in mensaje &&
          typeof mensaje.mensaje === 'string'
            ? mensaje.mensaje
            : 'No pudimos cargar el mapa.'
        );
        return;
      }

      if (
        (mensaje.tipo === 'detalle' || mensaje.tipo === 'brujula') &&
        'id' in mensaje &&
        typeof mensaje.id === 'string'
      ) {
        const id = mensaje.id;
        const fila = lugaresVisibles.find(
          ({ lugar }) => lugar.id === id
        );

        if (!fila) return;

        if (mensaje.tipo === 'detalle') {
          abrirDetalle(id);
        } else {
          abrirBrujula(fila.lugar);
        }
      }
    } catch {
      // Ignoramos mensajes con formato inesperado.
    }
  }

  if (cargando) {
    return (
      <View style={styles.centrado}>
        <ActivityIndicator
          size="large"
          color="#14665C"
          accessibilityLabel="Cargando lugares y categorías"
        />
      </View>
    );
  }

  const cantidadFiltros = Number(categoriaSeleccionada !== null) +
    Number(radioMetros !== null) + Number(soloAbiertos) + Number(soloAccesibles);
  const mapaDisponible = mapaListo && error === null;

  return (
    <SafeAreaView edges={['bottom']} style={styles.container}>
      <View style={styles.encabezado}>
        <View style={styles.acciones}>
          <Pressable
            accessibilityRole="button"
            disabled={buscandoUbicacion}
            onPress={mostrarMiUbicacion}
            style={[
              styles.boton, styles.botonBarra,
              buscandoUbicacion && styles.deshabilitado,
            ]}
          >
            <Text style={styles.textoBoton}>
              {buscandoUbicacion
                ? 'Buscando…'
                : ubicacion
                  ? 'Actualizar'
                  : 'Mi ubicación'}
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            disabled={!mapaDisponible}
            onPress={mostrarLugares}
            style={[
              styles.boton, styles.botonBarra,
              !mapaDisponible && styles.deshabilitado,
            ]}
          >
            <Text style={styles.textoBoton}>Ver lugares</Text>
          </Pressable>

          {ubicacion && (
            <Pressable
              accessibilityRole="button"
              disabled={!mapaDisponible}
              onPress={centrarMiUbicacion}
              style={[
                styles.boton, styles.botonBarra,
                !mapaDisponible && styles.deshabilitado,
              ]}
            >
              <Text style={styles.textoBoton}>Centrarme</Text>
            </Pressable>
          )}
        </View>

        <AvisosProximidad lugares={lugares} abierto={panelMapa === 'avisos'} onAlternar={() => setPanelMapa(panelMapa === 'avisos' ? null : 'avisos')} botonFiltro={
          <Pressable accessibilityRole="button" accessibilityState={{ expanded: filtrosAbiertos }} onPress={() => setPanelMapa(filtrosAbiertos ? null : 'filtros')} style={[styles.boton, styles.botonBarra]}>
            <Text style={styles.textoBoton}>
              Filtros{cantidadFiltros > 0 ? ` (${cantidadFiltros})` : ''}
            </Text>
          </Pressable>

        } />

        {filtrosAbiertos && (
          <ScrollView style={styles.panelEnLinea} nestedScrollEnabled>
            <FiltrosMapa
              categorias={categorias}
              categoriaSeleccionada={categoriaSeleccionada}
              radioMetros={radioMetros}
              tieneUbicacion={ubicacion !== null}
              soloAbiertos={soloAbiertos}
              soloAccesibles={soloAccesibles}
              onCategoria={setCategoriaSeleccionada}
              onRadio={setRadioMetros}
              onSoloAbiertos={() => {
                setAhora(new Date());
                setSoloAbiertos((valor) => !valor);
              }}
              onSoloAccesibles={() =>
                setSoloAccesibles((valor) => !valor)
              }
            />

            <Text style={styles.aviso}>
              {ubicacion
                ? 'Distancias en línea recta desde la última ubicación consultada.'
                : 'Tocá Mi ubicación para habilitar distancias y dirección.'}
              {' '}Horarios según la hora de Colón.
            </Text>
            <Pressable accessibilityRole="button" style={styles.boton} onPress={() => setPanelMapa(null)}>
              <Text style={styles.textoBoton}>Ver resultados ({lugaresVisibles.length})</Text>
            </Pressable>
          </ScrollView>
        )}


        {avisoMapa && (
          <Text style={styles.advertencia}>{avisoMapa}</Text>
        )}
      </View>

      {error ? (
        <View style={styles.centrado}>
          <Text style={styles.advertencia}>{error}</Text>
          <Text style={styles.aviso}>
            Para reintentar, volvé atrás y entrá nuevamente.
          </Text>
        </View>
      ) : (
        <WebView
          ref={webview}
          style={styles.mapa}
          originWhitelist={['*']}
          source={fuenteMapa}
          javaScriptEnabled
          applicationNameForUserAgent="MiCiudadTP/1.0"
          onLoadStart={() => setMapaListo(false)}
          onMessage={(evento) =>
            recibirMensaje(evento.nativeEvent.data)
          }
          onError={() => {
            setMapaListo(false);
            setError('No pudimos abrir el mapa.');
          }}
        />
      )}

      <View style={styles.listaContenedor}>
        <Text style={styles.tituloLista}>
          {radioMetros !== null
            ? 'Qué tengo cerca'
            : ubicacion
              ? 'Lugares por distancia'
              : 'Lugares para explorar'}
        </Text>

        <Text style={styles.contador}>
          {lugaresVisibles.length}{' '}
          {lugaresVisibles.length === 1 ? 'lugar' : 'lugares'}
          {radioMetros === null
            ? ' en esta selección'
            : ` a ${mostrarDistancia(radioMetros)} o menos`}
          {soloAbiertos ? ' · Abiertos ahora' : ''}
          {soloAccesibles ? ' · Accesibles' : ''}
        </Text>

        <ScrollView style={styles.lista}>
          {lugaresVisibles.length === 0 && (
            <Text style={styles.aviso}>
              No hay lugares con estos filtros. Probá cambiar la
              categoría, ampliar el radio o desactivar los filtros
              de horario y accesibilidad.
            </Text>
          )}

          {lugaresVisibles.map(
            ({ lugar, distancia, estadoHorario }) => (
              <View key={lugar.id} style={styles.fila}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Ver detalle de ${lugar.nombre}`}
                  onPress={() => abrirDetalle(lugar.id)}
                  style={styles.contenidoFila}
                >
                  <View style={styles.textosFila}>
                    <Text style={styles.nombre}>{lugar.nombre}</Text>

                    <Text style={styles.descripcion}>
                      {lugar.descripcionCorta}
                    </Text>

                    <Text style={[
                      styles.horario,
                      estadoHorario === 'abierto' &&
                        styles.destacado,
                    ]}>
                      {mostrarEstadoHorario(estadoHorario)}
                    </Text>

                    {lugar.accesible && (
                      <Text style={styles.accesibilidad}>
                        Accesible para silla de ruedas
                      </Text>
                    )}
                  </View>

                  <Text style={styles.distancia}>
                    {distancia === null
                      ? 'Ver →'
                      : mostrarDistancia(distancia)}
                  </Text>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Ver dirección hacia ${lugar.nombre}`}
                  onPress={() => abrirBrujula(lugar)}
                  style={styles.botonSecundario}
                >
                  <Text style={styles.textoSecundario}>
                    Ver dirección
                  </Text>
                </Pressable>
              </View>
            )
          )}
        </ScrollView>
      </View>

      <Modal
        visible={lugarBrujula !== null}
        animationType="slide"
        onRequestClose={() => setLugarBrujula(null)}
      >
        <SafeAreaView style={styles.modal}>
          <View style={styles.cabeceraModal}>
            <Text style={styles.tituloModal}>Brújula</Text>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cerrar brújula y volver al mapa"
              onPress={() => setLugarBrujula(null)}
              style={styles.boton}
            >
              <Text style={styles.textoBoton}>Cerrar</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.contenidoModal}>
            {lugarBrujula && ubicacion && (
              <BrujulaLugar
                key={lugarBrujula.id}
                lugar={lugarBrujula}
                ubicacion={ubicacion}
              />
            )}

            <Pressable
              accessibilityRole="button"
              disabled={buscandoUbicacion}
              onPress={mostrarMiUbicacion}
              style={[
                styles.boton,
                styles.actualizarModal,
                buscandoUbicacion && styles.deshabilitado,
              ]}
            >
              <Text style={styles.textoBoton}>
                {buscandoUbicacion
                  ? 'Buscando…'
                  : 'Actualizar mi ubicación'}
              </Text>
            </Pressable>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F7F2' },
  centrado: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  encabezado: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
  },
  botonBarra: { flex: 1, minWidth: 0, paddingHorizontal: 4 },
  panelEnLinea: { maxHeight: 180, marginTop: 8 },
  acciones: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  boton: {
    minHeight: 48,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#174F49',
    justifyContent: 'center',
    alignItems: 'center',
  },
  textoBoton: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  deshabilitado: { opacity: 0.45 },
  aviso: {
    fontSize: 14,
    lineHeight: 20,
    color: '#586C70',
    marginTop: 8,
  },
  advertencia: {
    fontSize: 16,
    color: '#8A431B',
    marginTop: 8,
  },
  mapa: { flex: 1, backgroundColor: '#E6EDF3' },
  listaContenedor: {
    flex: 1,
    minHeight: 0,
    paddingHorizontal: 18,
    paddingTop: 10,
    backgroundColor: '#FFFFFF',
  },
  lista: { flex: 1 },
  tituloLista: {
    fontSize: 21,
    fontWeight: 'bold',
    color: '#183B42',
  },
  contador: {
    fontSize: 14,
    color: '#586C70',
    marginTop: 5,
    marginBottom: 8,
  },
  fila: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E1E6DE',
  },
  contenidoFila: {
    minHeight: 64,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 12,
  },
  textosFila: { flex: 1, minWidth: 150 },
  nombre: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#183B42',
  },
  descripcion: {
    fontSize: 15,
    color: '#586C70',
    marginTop: 5,
  },
  horario: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#586C70',
    marginTop: 6,
  },
  destacado: { color: '#14665C' },
  accesibilidad: {
    fontSize: 14,
    color: '#14665C',
    marginTop: 5,
  },
  distancia: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#14665C',
  },
  botonSecundario: {
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#EFF6F1',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 10,
  },
  textoSecundario: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#174F49',
  },
  modal: { flex: 1, backgroundColor: '#F7F7F2' },
  cabeceraModal: {
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
  },
  tituloModal: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#183B42',
  },
  contenidoModal: { padding: 18 },
  actualizarModal: { marginTop: 16 },
});