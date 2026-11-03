import { useCallback, useRef, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
  Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  cerrarSesionAPI, iniciarSesionAPI, obtenerSesionAPI,
  reingresoBiometrico, validarSesionAPI,
} from '../servicios/sesion';
import { ErrorApi } from '../servicios/http';
import { intentarSincronizar } from '../servicios/visitas';
import type { Sesion } from '../tipos/sesion';

export default function PantallaCuenta() {
  const [sesion, setSesion] = useState<Sesion | null>(null);
  const [cargando, setCargando] = useState(true);
  const [procesando, setProcesando] = useState(false);
  const [email, setEmail] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [aviso, setAviso] = useState<string | null>(null);
  const ocupada = useRef(false);
  const activa = useRef(false);

  useFocusEffect(useCallback(() => {
    let vigente = true;
    activa.current = true;
    setCargando(true);
    setSesion(null);
    setAviso(null);
    async function verificar() {
      try {
        const guardada = await obtenerSesionAPI();
        if (!vigente || !guardada) return;
        if (!(await reingresoBiometrico()) || !vigente) {
          if (vigente) setAviso('Ingresá con email y contraseña para continuar.');
          return;
        }
        try {
          await validarSesionAPI(guardada);
        } catch (error) {
          if (error instanceof ErrorApi && error.status === 401) {
            await cerrarSesionAPI();
            if (vigente) setAviso('Tu sesión venció. Ingresá nuevamente; tus visitas locales se conservan.');
            return;
          }
          // El token no se declara válido por una falla: se permite consultar
          // su copia local e indicamos que falta validación con el servidor.
          if (vigente) setAviso('No pudimos validar la sesión con la API. Podés consultar tus visitas locales.');
        }
        if (vigente) setSesion(guardada);
      } catch (error) {
        if (vigente) setAviso(error instanceof Error ? error.message : 'No pudimos leer la sesión.');
      } finally {
        if (vigente) setCargando(false);
      }
    }
    void verificar();
    return () => { vigente = false; activa.current = false; };
  }, []));

  async function ingresar() {
    if (ocupada.current) return;
    if (!email.trim() || !contrasena) {
      Alert.alert('Datos incompletos', 'Ingresá email y contraseña.');
      return;
    }
    ocupada.current = true;
    setProcesando(true);
    setAviso(null);
    try {
      await iniciarSesionAPI(email, contrasena);
      const actual = await obtenerSesionAPI();
      if (!activa.current) return;
      setSesion(actual);
      setContrasena('');
      try {
        await intentarSincronizar();
      } catch (error) {
        if (activa.current) setAviso(
          error instanceof Error ? error.message : 'La sincronización quedó pendiente.'
        );
      }
    } catch (error) {
      if (activa.current) Alert.alert(
        'No pudimos ingresar', error instanceof Error ? error.message : 'Probá nuevamente.'
      );
    } finally {
      ocupada.current = false;
      if (activa.current) setProcesando(false);
    }
  }

  function salir() {
    Alert.alert('Cerrar sesión', 'Tus visitas pendientes quedan guardadas para esta cuenta en el teléfono.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Salir', onPress: () => {
        void cerrarSesionAPI().then(() => {
          if (activa.current) {
            setSesion(null); setAviso(null); setEmail(''); setContrasena('');
          }
        }).catch(() => Alert.alert('No pudimos cerrar sesión', 'Intentá nuevamente.'));
      } },
    ]);
  }

  if (cargando) return <View style={styles.centrado}><ActivityIndicator size="large" color="#14665C" /></View>;

  return (
    <SafeAreaView edges={['bottom']} style={styles.container}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.contenido} keyboardShouldPersistTaps="handled">
          <Text style={styles.titulo}>{sesion ? `¡Hola, ${sesion.usuario.nombre}!` : 'Tu cuenta, tus recuerdos.'}</Text>
          <Text style={styles.descripcion}>
            {sesion ? sesion.usuario.email : 'Ingresá para guardar y sincronizar tus visitas. El mapa se puede explorar sin cuenta.'}
          </Text>
          {aviso && <Text style={styles.aviso}>{aviso}</Text>}
          {sesion ? (
            <>
              <Pressable accessibilityRole="button" disabled={procesando} style={styles.boton} onPress={() => router.push('/recorrido')}>
                <Text style={styles.textoBoton}>Ver Mi recorrido</Text>
              </Pressable>
              <Pressable accessibilityRole="button" disabled={procesando} style={styles.secundario} onPress={salir}>
                <Text style={styles.textoSecundario}>Cerrar sesión</Text>
              </Pressable>
              <Text style={styles.descripcion}>Los registros de cada cuenta se mantienen separados. Cerrar sesión no elimina visitas pendientes.</Text>
            </>
          ) : (
            <>
              <Text style={styles.label}>Email</Text>
              <TextInput accessibilityLabel="Email" value={email} onChangeText={setEmail} style={styles.entrada}
                autoCapitalize="none" keyboardType="email-address" autoComplete="email" editable={!procesando} />
              <Text style={styles.label}>Contraseña</Text>
              <TextInput accessibilityLabel="Contraseña" value={contrasena} onChangeText={setContrasena} style={styles.entrada}
                secureTextEntry autoCapitalize="none" autoComplete="current-password" editable={!procesando} />
              <Pressable accessibilityRole="button" disabled={procesando} onPress={ingresar} style={[styles.boton, procesando && styles.deshabilitado]}>
                <Text style={styles.textoBoton}>{procesando ? 'Ingresando…' : 'Ingresar'}</Text>
              </Pressable>
              <Text style={styles.descripcion}>Usá una cuenta existente de la API. El registro de cuentas nuevas todavía no está implementado en esta integración.</Text>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F7F2' },
  centrado: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  contenido: { padding: 24, paddingBottom: 40 },
  titulo: { fontSize: 30, fontWeight: 'bold', color: '#183B42' },
  descripcion: { fontSize: 17, lineHeight: 25, color: '#586C70', marginTop: 14 },
  aviso: { fontSize: 16, lineHeight: 24, color: '#8A431B', marginTop: 14 },
  label: { fontSize: 17, color: '#183B42', fontWeight: 'bold', marginTop: 24, marginBottom: 8 },
  entrada: { minHeight: 50, borderWidth: 1, borderColor: '#849993', borderRadius: 12, padding: 14, fontSize: 18, backgroundColor: '#FFF', color: '#183B42' },
  boton: { minHeight: 50, borderRadius: 14, padding: 16, backgroundColor: '#174F49', alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  textoBoton: { fontSize: 18, fontWeight: 'bold', color: '#FFF' },
  secundario: { minHeight: 48, padding: 14, marginTop: 12, alignItems: 'center' },
  textoSecundario: { fontSize: 17, color: '#174F49', fontWeight: 'bold' },
  deshabilitado: { opacity: 0.5 },
});
