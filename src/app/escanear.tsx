import { useCallback, useRef, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import {
  CameraView,
  useCameraPermissions,
} from 'expo-camera';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  buscarLugarPorQr,
  registrarVisitaPorQr,
} from '../servicios/visitas';
import type { Lugar } from '../tipos/lugar';

export default function EscanearScreen() {
  const [permiso, pedirPermiso] = useCameraPermissions();
  const bloqueado = useRef(false);

  const [enFoco, setEnFoco] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [guardada, setGuardada] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lugar, setLugar] = useState<Lugar | null>(null);
  const [codigo, setCodigo] = useState('');
  const [nota, setNota] = useState('');

  useFocusEffect(
    useCallback(() => {
      setEnFoco(true);

      return () => {
        setEnFoco(false);
      };
    }, [])
  );

  async function habilitarCamara() {
    try {
      if (permiso?.canAskAgain === false) {
        await Linking.openSettings();
      } else {
        await pedirPermiso();
      }
    } catch {
      Alert.alert(
        'No pudimos abrir los permisos',
        'Revisá el permiso de cámara desde los ajustes de Expo Go.'
      );
    }
  }

  async function escanear(data: string) {
    if (bloqueado.current) {
      return;
    }

    bloqueado.current = true;
    setProcesando(true);
    setError(null);

    try {
      const encontrado = await buscarLugarPorQr(data);

      setLugar(encontrado);
      setCodigo(data.trim());
    } catch {
      setError(
        'No reconocimos este QR como un lugar disponible de Mi Ciudad. Podés probar con otro.'
      );
    } finally {
      setProcesando(false);
    }
  }

  function volverAEscanear() {
    setLugar(null);
    setCodigo('');
    setNota('');
    setError(null);
    setGuardada(false);
    bloqueado.current = false;
  }

  const guardandoRef = useRef(false);

  async function guardar() {
    if (!lugar || guardandoRef.current || guardada) {
      return;
    }

    guardandoRef.current = true;
    setGuardando(true);

    try {
      await registrarVisitaPorQr(codigo, nota);
      setGuardada(true);
    } catch {
      Alert.alert(
        'No pudimos registrar la visita',
        'Intentá nuevamente en unos momentos.'
      );
    } finally {
      guardandoRef.current = false;
      setGuardando(false);
    }
  }

  if (!permiso) {
    return (
      <View style={styles.centrado}>
        <ActivityIndicator
          size="large"
          color="#14665C"
          accessibilityLabel="Consultando permiso de cámara"
        />
      </View>
    );
  }

  if (!permiso.granted) {
    return (
      <View style={styles.centrado}>
        <Text style={styles.titulo}>Escaneá un lugar</Text>
        <Text style={styles.descripcion}>
          Necesitamos acceso a la cámara para leer el QR del cartel.
          Podés seguir usando el catálogo y el mapa sin habilitarla.
        </Text>

        <Pressable
          accessibilityRole="button"
          onPress={habilitarCamara}
          style={styles.boton}
        >
          <Text style={styles.textoBoton}>
            {permiso.canAskAgain
              ? 'Permitir cámara'
              : 'Abrir ajustes'}
          </Text>
        </Pressable>
      </View>
    );
  }

  if (guardada) {
    return (
      <View style={styles.centrado}>
        <Text style={styles.etiqueta}>MI RECORRIDO</Text>
        <Text style={styles.titulo}>¡Visita registrada!</Text>
        <Text style={styles.descripcion}>
          Guardamos tu visita a {lugar?.nombre} mediante QR.
        </Text>

        <Pressable
          accessibilityRole="button"
          onPress={() => router.replace('/recorrido')}
          style={styles.boton}
        >
          <Text style={styles.textoBoton}>Ver mi recorrido</Text>
        </Pressable>
      </View>
    );
  }

  if (lugar) {
    return (
      <SafeAreaView edges={['bottom']} style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.contenido}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.etiqueta}>LUGAR RECONOCIDO</Text>
          <Text style={styles.titulo}>{lugar.nombre}</Text>
          <Text style={styles.descripcion}>
            {lugar.descripcionCorta}
          </Text>

          <Text style={styles.label}>Tu nota · opcional</Text>
          <TextInput
            accessibilityLabel="Nota de la visita por QR"
            value={nota}
            onChangeText={setNota}
            maxLength={300}
            multiline
            editable={!guardando}
            placeholder="¿Qué querés recordar?"
            placeholderTextColor="#637477"
            style={styles.entrada}
          />

          <Pressable
            accessibilityRole="button"
            disabled={guardando}
            onPress={guardar}
            style={[
              styles.boton,
              guardando && styles.deshabilitado,
            ]}
          >
            <Text style={styles.textoBoton}>
              {guardando ? 'Guardando…' : 'Registrar visita por QR'}
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            disabled={guardando}
            onPress={() =>
              router.replace({
                pathname: '/lugar/[id]',
                params: { id: lugar.id },
              })
            }
            style={styles.secundario}
          >
            <Text style={styles.textoSecundario}>Ver detalle</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            disabled={guardando}
            onPress={volverAEscanear}
            style={styles.secundario}
          >
            <Text style={styles.textoSecundario}>
              Escanear otro código
            </Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (procesando || error) {
    return (
      <View style={styles.centrado}>
        {procesando ? (
          <>
            <ActivityIndicator size="large" color="#14665C" />
            <Text style={styles.descripcion}>Buscando el lugar…</Text>
          </>
        ) : (
          <>
            <Text style={styles.titulo}>Código no reconocido</Text>
            <Text style={styles.descripcion}>{error}</Text>

            <Pressable
              accessibilityRole="button"
              onPress={volverAEscanear}
              style={styles.boton}
            >
              <Text style={styles.textoBoton}>Volver a intentar</Text>
            </Pressable>
          </>
        )}
      </View>
    );
  }

  return (
    <SafeAreaView edges={['bottom']} style={styles.container}>
      <View style={styles.contenido}>
        <Text style={styles.titulo}>Escaneá el QR</Text>
        <Text style={styles.descripcion}>
          Apuntá al código del cartel de Mi Ciudad.
        </Text>
      </View>

      {enFoco && (
        <CameraView
          style={styles.camara}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={({ data }) => {
            void escanear(data);
          }}
          onMountError={() => {
            bloqueado.current = true;
            setError('No pudimos iniciar la cámara.');
          }}
        />
      )}

      <Text style={styles.indicacion}>
        La visita solo se guarda cuando tocás “Registrar visita por QR”.
      </Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F7F2',
  },
  centrado: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F7F7F2',
  },
  contenido: {
    padding: 24,
  },
  etiqueta: {
    fontSize: 13,
    fontWeight: 'bold',
    letterSpacing: 2,
    color: '#14665C',
  },
  titulo: {
    fontSize: 30,
    fontWeight: 'bold',
    color: '#183B42',
    marginTop: 10,
  },
  descripcion: {
    fontSize: 17,
    lineHeight: 26,
    color: '#586C70',
    marginTop: 12,
  },
  camara: {
    flex: 1,
    marginHorizontal: 20,
    minHeight: 200,
  },
  indicacion: {
    fontSize: 16,
    color: '#586C70',
    padding: 20,
    textAlign: 'center',
  },
  label: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#183B42',
    marginTop: 26,
    marginBottom: 12,
  },
  entrada: {
    minHeight: 130,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#849993',
    backgroundColor: '#FFFFFF',
    color: '#183B42',
    fontSize: 18,
    textAlignVertical: 'top',
  },
  boton: {
    minHeight: 52,
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#174F49',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 22,
  },
  textoBoton: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  secundario: {
    minHeight: 48,
    padding: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  textoSecundario: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#14665C',
  },
  deshabilitado: {
    opacity: 0.6,
  },
});