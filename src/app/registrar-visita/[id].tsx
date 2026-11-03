import { useEffect, useRef, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { obtenerLugarPorId } from '../../servicios/lugares';
import {
  registrarVisitaManual,
  registrarVisitaPorGps,
} from '../../servicios/visitas';
import type { Lugar } from '../../tipos/lugar';

export default function RegistrarVisitaScreen() {
  const { id, origen } = useLocalSearchParams<{ id: string; origen?: string }>();
  const ocupadoRef = useRef(false);

  const [lugar, setLugar] = useState<Lugar | null>(null);
  const [nota, setNota] = useState('');
  const [fotoUri, setFotoUri] = useState<string | null>(null);
  const [usarGps, setUsarGps] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [eligiendoFoto, setEligiendoFoto] = useState(false);
  const [guardada, setGuardada] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let activo = true;

    async function cargarLugar() {
      setCargando(true);
      setError(null);
      setLugar(null);
      setNota('');
      setFotoUri(null);
      setUsarGps(origen === 'gps');
      setGuardada(false);

      try {
        if (!id) {
          throw new Error('Falta el lugar.');
        }

        const respuesta = await obtenerLugarPorId(id);

        if (activo) {
          setLugar(respuesta.datos);
        }
      } catch {
        if (activo) {
          setError('No pudimos cargar el lugar.');
        }
      } finally {
        if (activo) {
          setCargando(false);
        }
      }
    }

    cargarLugar();

    return () => {
      activo = false;
    };
  }, [id, origen]);

  async function elegirFoto(desdeCamara: boolean) {
    if (ocupadoRef.current || guardada) {
      return;
    }

    ocupadoRef.current = true;
    setEligiendoFoto(true);

    try {
      if (desdeCamara) {
        const permiso =
          await ImagePicker.requestCameraPermissionsAsync();

        if (!permiso.granted) {
          Alert.alert(
            'Cámara no habilitada',
            'Podés elegir una foto de la galería o continuar sin foto.'
          );
          return;
        }
      }

      const opciones: ImagePicker.ImagePickerOptions = {
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.75,
      };

      const resultado = desdeCamara
        ? await ImagePicker.launchCameraAsync(opciones)
        : await ImagePicker.launchImageLibraryAsync(opciones);

      if (!resultado.canceled && resultado.assets[0]) {
        setFotoUri(resultado.assets[0].uri);
      }
    } catch {
      Alert.alert(
        'No pudimos abrir la foto',
        'Intentá nuevamente o guardá la visita sin foto.'
      );
    } finally {
      ocupadoRef.current = false;
      setEligiendoFoto(false);
    }
  }

  async function guardarVisita() {
    if (!lugar || ocupadoRef.current || guardada) {
      return;
    }

    ocupadoRef.current = true;
    setGuardando(true);

    try {
      const entrada = {
        lugarId: lugar.id,
        nota,
        fotoUri,
      };

      if (usarGps) {
        await registrarVisitaPorGps(entrada);
      } else {
        await registrarVisitaManual(entrada);
      }

      setGuardada(true);
    } catch (problema) {
      Alert.alert(
        'No pudimos guardar la visita',
        problema instanceof Error
          ? problema.message
          : 'Intentá nuevamente.'
      );
    } finally {
      ocupadoRef.current = false;
      setGuardando(false);
    }
  }

  if (cargando) {
    return (
      <View style={styles.centrado}>
        <ActivityIndicator
          size="large"
          color="#14665C"
          accessibilityLabel="Cargando lugar"
        />
      </View>
    );
  }

  if (error || !lugar) {
    return (
      <View style={styles.centrado}>
        <Text style={styles.descripcion}>
          {error ?? 'Lugar no disponible.'}
        </Text>
      </View>
    );
  }

  if (guardada) {
    return (
      <SafeAreaView edges={['bottom']} style={styles.container}>
        <View style={styles.centrado}>
          <Text style={styles.etiqueta}>UN NUEVO RECUERDO</Text>
          <Text style={styles.titulo}>¡Visita guardada!</Text>

          <Text style={styles.descripcion}>
            Tu visita a {lugar.nombre} quedó registrada
            {usarGps ? ' por cercanía GPS.' : ' manualmente.'}
          </Text>

          <Pressable
            accessibilityRole="button"
            onPress={() => router.replace('/recorrido')}
            style={styles.boton}
          >
            <Text style={styles.textoBoton}>Ver mi recorrido</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const ocupado = guardando || eligiendoFoto;

  return (
    <SafeAreaView edges={['bottom']} style={styles.container}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.contenido}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.etiqueta}>MI RECORRIDO</Text>
          <Text style={styles.titulo}>Guardá este momento.</Text>

          <View style={styles.tarjeta}>
            <Text style={styles.nombreLugar}>{lugar.nombre}</Text>
            <Text style={styles.descripcion}>
              {lugar.direccion}
            </Text>
          </View>

          <View style={styles.opcionGps}>
            <Text style={styles.tituloGps}>
              Verificar cercanía por GPS
            </Text>

            <Switch
              accessibilityLabel="Verificar cercanía por GPS"
              value={usarGps}
              onValueChange={setUsarGps}
              disabled={ocupado}
              trackColor={{
                false: '#849993',
                true: '#14665C',
              }}
            />

            <Text style={styles.ayudaGps}>
              {usarGps
                ? 'Al guardar comprobaremos que estés a menos de 100 metros, considerando la precisión de tu ubicación.'
                : 'Registro manual: no comprueba tu ubicación.'}
            </Text>
          </View>

          <Text style={styles.label}>Una foto · opcional</Text>

          {fotoUri ? (
            <View>
              <Image
                source={{ uri: fotoUri }}
                style={styles.foto}
                resizeMode="cover"
                accessibilityLabel="Foto seleccionada para la visita"
              />

              <Pressable
                accessibilityRole="button"
                disabled={ocupado}
                onPress={() => setFotoUri(null)}
                style={styles.quitarFoto}
              >
                <Text style={styles.textoQuitar}>Quitar foto</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.sinFoto}>
              <Text style={styles.descripcion}>
                Sumá una imagen para recordar tu paseo.
              </Text>
            </View>
          )}

          <View style={styles.accionesFoto}>
            <Pressable
              accessibilityRole="button"
              disabled={ocupado}
              onPress={() => elegirFoto(true)}
              style={[
                styles.botonSecundario,
                ocupado && styles.deshabilitado,
              ]}
            >
              <Text style={styles.textoSecundario}>Sacar foto</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              disabled={ocupado}
              onPress={() => elegirFoto(false)}
              style={[
                styles.botonSecundario,
                ocupado && styles.deshabilitado,
              ]}
            >
              <Text style={styles.textoSecundario}>Elegir foto</Text>
            </Pressable>
          </View>

          <Text style={[styles.label, styles.separacion]}>
            Tu nota · opcional
          </Text>

          <TextInput
            accessibilityLabel="Nota de la visita"
            style={styles.entrada}
            value={nota}
            onChangeText={setNota}
            placeholder="¿Qué te gustó de este lugar?"
            placeholderTextColor="#637477"
            multiline
            maxLength={300}
            textAlignVertical="top"
            editable={!ocupado}
          />

          <Text style={styles.contador}>{nota.length}/300</Text>

          <Pressable
            accessibilityRole="button"
            disabled={ocupado}
            onPress={guardarVisita}
            style={[
              styles.boton,
              ocupado && styles.deshabilitado,
            ]}
          >
            <Text style={styles.textoBoton}>
              {guardando
                ? usarGps
                  ? 'Verificando y guardando…'
                  : 'Guardando…'
                : usarGps
                  ? 'Verificar GPS y guardar'
                  : 'Guardar visita manual'}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F7F2',
  },
  contenido: {
    padding: 24,
    paddingBottom: 40,
  },
  centrado: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F7F7F2',
  },
  etiqueta: {
    fontSize: 13,
    letterSpacing: 2,
    fontWeight: 'bold',
    color: '#14665C',
  },
  titulo: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#183B42',
    marginTop: 12,
  },
  tarjeta: {
    padding: 22,
    borderRadius: 20,
    backgroundColor: '#E7EEE8',
    marginVertical: 26,
  },
  nombreLugar: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#183B42',
  },
  descripcion: {
    fontSize: 17,
    lineHeight: 26,
    color: '#586C70',
    marginTop: 12,
  },
  opcionGps: {
    padding: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#CBD7D0',
    marginBottom: 26,
  },
  tituloGps: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#183B42',
    marginBottom: 8,
  },
  ayudaGps: {
    fontSize: 16,
    lineHeight: 24,
    color: '#586C70',
    marginTop: 8,
  },
  label: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#183B42',
    marginBottom: 12,
  },
  separacion: {
    marginTop: 28,
  },
  foto: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: 18,
    backgroundColor: '#E7EEE8',
  },
  sinFoto: {
    minHeight: 110,
    padding: 20,
    borderRadius: 18,
    backgroundColor: '#E7EEE8',
    justifyContent: 'center',
  },
  accionesFoto: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 12,
  },
  botonSecundario: {
    minHeight: 48,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#849993',
    justifyContent: 'center',
    alignItems: 'center',
  },
  textoSecundario: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#183B42',
  },
  quitarFoto: {
    minHeight: 48,
    alignSelf: 'flex-start',
    justifyContent: 'center',
  },
  textoQuitar: {
    fontSize: 17,
    color: '#A32020',
    fontWeight: 'bold',
  },
  entrada: {
    minHeight: 150,
    borderWidth: 1,
    borderColor: '#849993',
    borderRadius: 16,
    padding: 16,
    backgroundColor: '#FFFFFF',
    color: '#183B42',
    fontSize: 18,
  },
  contador: {
    fontSize: 14,
    color: '#586C70',
    textAlign: 'right',
    marginTop: 8,
  },
  boton: {
    minHeight: 52,
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#174F49',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 26,
  },
  textoBoton: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  deshabilitado: {
    opacity: 0.6,
  },
});