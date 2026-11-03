// Pruebas del código real de servicios con SQLite real en memoria.
// Los módulos nativos y las respuestas de red se sustituyen por dobles de prueba.
// Ejecutar con Node 24: node --test scripts/pruebas-integracion.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const crypto = require('node:crypto');

function entorno({ catalogoReal = false } = {}) {
  const seguro = new Map();
  const almacen = new Map();
  let catalogo = [{ id: 'lug-004', activo: true, nombre: 'Lugar de prueba', categoriaId: 'cat-museos', codigoQr: 'COLON:lug-004', coordenadas: { latitud: -32.2, longitud: -58.1 } }];
  let eventos = [];
  let falloNotificaciones = false;
  const avisos = new Map();
  const sqlite = new DatabaseSync(':memory:');
  const solicitudes = [];
  const visitasServidor = new Map();
  const archivos = new Set();
  let online = false;
  let fallarPost = false;
  let fallarDespuesDeCrear = false;
  let subidas = 0;
  let alPedir = null;
  let gps = { coords: { latitude: -32.2, longitude: -58.1, accuracy: 5 }, timestamp: Date.now() };
  const usuario = id => ({ id, nombre: id, email: `${id}@demo.ar`, avatarUrl: null, creadoEn: new Date().toISOString(), preferencias: {} });
  const json = (datos, status = 200) => new Response(JSON.stringify(datos), { status, headers: { 'Content-Type': 'application/json' } });
  const fetchDoble = async (url, opciones = {}) => {
    const direccion = new URL(url);
    const cabeceras = new Headers(opciones.headers);
    const token = cabeceras.get('Authorization')?.replace('Bearer ', '');
    solicitudes.push({ ruta: direccion.pathname, metodo: opciones.method ?? 'GET', token });
    if (alPedir) { const accion = alPedir; alPedir = null; await accion(); }
    if (!online && direccion.pathname !== '/auth/ingreso') throw new Error('API desconectada');
    if (direccion.pathname === '/auth/ingreso') {
      const cuerpo = JSON.parse(opciones.body);
      if (cuerpo.contrasena === 'mala') return json({ error: { mensaje: 'Credenciales inválidas', codigo: 'CREDENCIALES_INVALIDAS' } }, 401);
      return json({ datos: { token: cuerpo.email, usuario: usuario(cuerpo.email) }, meta: null });
    }
    if (direccion.pathname === '/lugares' || direccion.pathname === '/categorias' || direccion.pathname === '/eventos') {
      const todas = direccion.pathname === '/lugares' ? catalogo : direccion.pathname === '/categorias' ? [{ id: 'cat-museos', nombre: 'Museos API', orden: 1 }] : eventos;
      const pagina = Number(direccion.searchParams.get('pagina') ?? 1);
      const porPagina = Number(direccion.searchParams.get('porPagina') ?? 20);
      return json({ datos: todas.slice((pagina - 1) * porPagina, pagina * porPagina), meta: { total: todas.length, pagina, porPagina } });
    }
    if (direccion.pathname.startsWith('/eventos/')) {
      const evento = eventos.find(e => e.id === direccion.pathname.split('/').pop());
      return evento ? json({ datos: evento, meta: null }) : json({ error: { codigo: 'EVENTO_NO_ENCONTRADO', mensaje: 'No existe ese evento.' } }, 404);
    }
    if (direccion.pathname === '/yo') return json({ datos: usuario(token), meta: null });
    if (direccion.pathname === '/yo/visitas' && opciones.method === 'POST') {
      if (fallarPost) return json({ error: { mensaje: 'Falla simulada' } }, 500);
      const entrada = JSON.parse(opciones.body);
      const clave = `${token}:${entrada.id}`;
      const remota = visitasServidor.get(clave) ?? { ...entrada, usuarioId: token, sincronizada: true };
      visitasServidor.set(clave, remota);
      if (fallarDespuesDeCrear) { fallarDespuesDeCrear = false; throw new Error('Respuesta perdida'); }
      return json({ datos: remota, meta: null }, 201);
    }
    if (direccion.pathname === '/yo/visitas') {
      const todas = [...visitasServidor.values()].filter(v => v.usuarioId === token);
      const pagina = Number(direccion.searchParams.get('pagina') ?? 1);
      const porPagina = Number(direccion.searchParams.get('porPagina') ?? 20);
      return json({ datos: todas.slice((pagina - 1) * porPagina, pagina * porPagina), meta: { total: todas.length, pagina, porPagina } });
    }
    throw new Error(`Ruta inesperada: ${direccion.pathname}`);
  };
  const db = {
    execSync: texto => sqlite.exec(texto),
    getAllSync: (sql, params = []) => sqlite.prepare(sql).all(...params),
    runSync: (sql, params = []) => sqlite.prepare(sql).run(...params),
    withTransactionSync: tarea => {
      sqlite.exec('BEGIN');
      try { tarea(); sqlite.exec('COMMIT'); } catch (error) { sqlite.exec('ROLLBACK'); throw error; }
    },
  };
  class Archivo {
    constructor(...partes) { this.uri = partes.map(p => p.uri ?? p).join('/'); this.extension = '.jpg'; }
    get exists() { return archivos.has(this.uri); }
    copy(destino) { archivos.add(destino.uri); }
    delete() { archivos.delete(this.uri); }
  }
  class Directorio { constructor(...partes) { this.uri = partes.join('/'); } create() {} }
  const nativos = {
    'expo-crypto': { randomUUID: crypto.randomUUID },
    'expo-secure-store': {
      getItemAsync: async clave => seguro.get(clave) ?? null,
      setItemAsync: async (clave, valor) => seguro.set(clave, valor),
      deleteItemAsync: async clave => seguro.delete(clave),
    },
    'expo-local-authentication': { hasHardwareAsync: async () => false, isEnrolledAsync: async () => false },
    'expo-sqlite': { openDatabaseSync: () => db },
    'expo-sqlite/kv-store': {
      __esModule: true,
      default: {
        getItem: async clave => almacen.get(clave) ?? null,
        setItem: async (clave, valor) => almacen.set(clave, valor),
        removeItem: async clave => almacen.delete(clave),
      },
    },
    'react-native': { Platform: { OS: 'android' } },
    'expo-notifications': {
      setNotificationHandler: () => { if (falloNotificaciones) throw new Error('Módulo no disponible'); },
      setNotificationChannelAsync: async () => {}, AndroidImportance: { HIGH: 4 },
      IosAuthorizationStatus: { PROVISIONAL: 3 },
      getPermissionsAsync: async () => ({ granted: true }),
      scheduleNotificationAsync: async aviso => { const id = String(avisos.size + 1); avisos.set(id, aviso); return id; },
      cancelScheduledNotificationAsync: async id => avisos.delete(id),
      SchedulableTriggerInputTypes: { DATE: 'date' },
    },
    'expo-network': { getNetworkStateAsync: async () => ({ isConnected: online, isInternetReachable: null }) },
    'expo-location': {
      requestForegroundPermissionsAsync: async () => ({ granted: true }),
      hasServicesEnabledAsync: async () => true,
      getCurrentPositionAsync: async () => gps,
      Accuracy: { High: 4 },
    },
    'expo-file-system': { File: Archivo, Directory: Directorio, Paths: { document: 'file:///datos' } },
    'expo-file-system/legacy': {
      FileSystemUploadType: { MULTIPART: 1 },
      createUploadTask: () => ({
        uploadAsync: async () => { subidas++; return { status: 201, body: JSON.stringify({ datos: { url: `http://api/archivos/${subidas}.jpg` } }) }; },
        cancelAsync: async () => {},
      }),
    },
  };
  const cache = new Map();
  const raiz = path.resolve(__dirname, '..');
  function cargar(nombre, desde = path.join(raiz, 'src')) {
    if (nativos[nombre]) return nativos[nombre];
    const archivo = path.resolve(desde, nombre) + '.ts';
    if (!catalogoReal && archivo.endsWith('/servicios/lugares.ts')) return {
      obtenerLugares: async () => ({ datos: catalogo, meta: { total: catalogo.length, pagina: 1, porPagina: 100 } }),
      obtenerLugarPorId: async id => ({ datos: { id, activo: true, codigoQr: `COLON:${id}`, coordenadas: { latitud: -32.2, longitud: -58.1 } } }),
    };
    if (cache.has(archivo)) return cache.get(archivo).exports;
    const modulo = { exports: {} }; cache.set(archivo, modulo);
    const codigo = ts.transpileModule(readFileSync(archivo, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const funcion = vm.runInNewContext(`(function(require,module,exports){${codigo}\n})`, {
      console, process, setTimeout, clearTimeout, AbortController, Headers, URL, fetch: fetchDoble,
    }, { filename: archivo });
    funcion(n => cargar(n, path.dirname(archivo)), modulo, modulo.exports);
    return modulo.exports;
  }
  return {
    sesion: cargar('./servicios/sesion'), visitas: cargar('./servicios/visitas'),
    solicitudes, visitasServidor, cargar, avisos,
    setCatalogo: valor => { catalogo = valor; },
    setEventos: valor => { eventos = valor; },
    fallarAvisos: () => { falloNotificaciones = true; },
    conectar: () => { online = true; }, desconectar: () => { online = false; },
    fallarPost: valor => { fallarPost = valor; },
    perderRespuesta: () => { fallarDespuesDeCrear = true; },
    alPedir: accion => { alPedir = accion; },
    setGps: valor => { gps = valor; },
    subidas: () => subidas,
  };
}
const entrada = { lugarId: 'lug-004', nota: 'Una visita' };

async function guardarOffline(e, datos = entrada) {
  const visita = await e.visitas.registrarVisitaManual(datos);
  // Esperar la tarea en segundo plano iniciada por el guardado.
  await e.visitas.intentarSincronizar().catch(() => {});
  return visita;
}

test('sin cuenta no se pueden registrar visitas', async () => {
  const e = entorno();
  await assert.rejects(e.visitas.registrarVisitaManual(entrada), /Ingresá/);
  assert.equal((await e.visitas.obtenerVisitasLocales()).length, 0);
});

test('cerrar sesión conserva pendientes y otra cuenta no puede verlas ni subirlas', async () => {
  const e = entorno();
  await e.sesion.iniciarSesionAPI('lucia', 'bien');
  await guardarOffline(e);
  await e.sesion.cerrarSesionAPI();
  assert.equal((await e.visitas.obtenerVisitasLocales()).length, 0);
  await e.sesion.iniciarSesionAPI('nuevo', 'bien');
  assert.equal((await e.visitas.obtenerVisitasLocales()).length, 0);
  e.conectar();
  await e.visitas.intentarSincronizar();
  assert.equal(e.solicitudes.filter(s => s.metodo === 'POST' && s.ruta === '/yo/visitas').length, 0);
  await e.sesion.cerrarSesionAPI();
  await e.sesion.iniciarSesionAPI('lucia', 'bien');
  assert.equal((await e.visitas.obtenerVisitasLocales()).length, 1);
  await e.visitas.intentarSincronizar();
  assert.equal((await e.visitas.obtenerVisitasLocales())[0].sincronizada, true);
});

test('fallo de subida conserva la visita, reintento reutiliza foto y no duplica', async () => {
  const e = entorno();
  await e.sesion.iniciarSesionAPI('lucia', 'bien');
  const local = await guardarOffline(e, { ...entrada, fotoUri: 'file:///temporal/foto.jpg' });
  e.conectar(); e.fallarPost(true);
  await assert.rejects(e.visitas.intentarSincronizar(), /pendientes/);
  assert.equal((await e.visitas.obtenerVisitasLocales())[0].sincronizada, false);
  assert.equal(e.subidas(), 1);
  e.fallarPost(false);
  await e.visitas.intentarSincronizar();
  await e.visitas.intentarSincronizar();
  const visitas = await e.visitas.obtenerVisitasLocales();
  assert.equal(visitas.length, 1); assert.equal(visitas[0].id, local.id);
  assert.equal(visitas[0].sincronizada, true); assert.equal(e.subidas(), 1);
});

test('respuesta perdida después de guardar en servidor se recupera sin duplicados', async () => {
  const e = entorno();
  await e.sesion.iniciarSesionAPI('lucia', 'bien');
  await guardarOffline(e);
  e.conectar(); e.perderRespuesta();
  await assert.rejects(e.visitas.intentarSincronizar(), /pendientes/);
  await e.visitas.intentarSincronizar();
  assert.equal(e.visitasServidor.size, 1);
  assert.equal((await e.visitas.obtenerVisitasLocales()).length, 1);
  assert.equal((await e.visitas.obtenerVisitasLocales())[0].sincronizada, true);
});

test('sincronizaciones simultáneas comparten una operación y una subida', async () => {
  const e = entorno();
  await e.sesion.iniciarSesionAPI('lucia', 'bien');
  await guardarOffline(e, { ...entrada, fotoUri: 'file:///tmp/foto.jpg' });
  e.conectar();
  await Promise.all([e.visitas.intentarSincronizar(), e.visitas.intentarSincronizar()]);
  assert.equal(e.subidas(), 1);
  assert.equal(e.visitasServidor.size, 1);
});

test('descarga de recorrido procesa más de una página', async () => {
  const e = entorno();
  await e.sesion.iniciarSesionAPI('lucia', 'bien');
  for (let i = 0; i < 125; i++) e.visitasServidor.set(`lucia:${i}`, {
    id: `vis-demo-${i}`, usuarioId: 'lucia', lugarId: 'lug-004',
    fechaHora: new Date().toISOString(), origen: 'manual', fotoUri: null, nota: null, sincronizada: true,
  });
  e.conectar(); await e.visitas.intentarSincronizar();
  assert.equal((await e.visitas.obtenerVisitasLocales()).length, 125);
});

test('cambiar de cuenta durante la descarga no importa visitas de la anterior', async () => {
  const e = entorno();
  await e.sesion.iniciarSesionAPI('lucia', 'bien'); e.conectar();
  e.alPedir(async () => { await e.sesion.cerrarSesionAPI(); await e.sesion.iniciarSesionAPI('nuevo', 'bien'); });
  await e.visitas.intentarSincronizar();
  assert.equal((await e.visitas.obtenerVisitasLocales()).length, 0);
});

test('GPS rechaza ubicaciones viejas y precisión insuficiente', async () => {
  const e = entorno();
  await e.sesion.iniciarSesionAPI('lucia', 'bien');
  e.setGps({ coords: { latitude: -32.2, longitude: -58.1, accuracy: 5 }, timestamp: Date.now() - 120000 });
  await assert.rejects(e.visitas.registrarVisitaPorGps(entrada), /reciente/);
  e.setGps({ coords: { latitude: -32.2, longitude: -58.1, accuracy: 150 }, timestamp: Date.now() });
  await assert.rejects(e.visitas.registrarVisitaPorGps(entrada), /precisión/);
});

test('credenciales incorrectas no crean sesión; sin biometría se pide login', async () => {
  const e = entorno();
  await assert.rejects(e.sesion.iniciarSesionAPI('lucia', 'mala'), /Credenciales/);
  assert.equal(await e.sesion.obtenerSesionAPI(), null);
  await e.sesion.iniciarSesionAPI('lucia', 'bien');
  assert.equal(await e.sesion.reingresoBiometrico(), false);
});


test('GPS automático elige el lugar activo más cercano de todo el catálogo', async () => {
  const e = entorno();
  await e.sesion.iniciarSesionAPI('lucia', 'bien');
  e.setCatalogo([
    { id: 'lug-baja', activo: false, coordenadas: { latitud: -32.2, longitud: -58.1 } },
    ...Array.from({ length: 110 }, (_, i) => ({ id: `lug-lejos-${i}`, activo: true, coordenadas: { latitud: -34, longitud: -58 } })),
    { id: 'lug-cerca', activo: true, coordenadas: { latitud: -32.2001, longitud: -58.1 } },
  ]);
  const detectado = await e.visitas.detectarLugarCercano();
  assert.equal(detectado.id, 'lug-cerca');
  await e.visitas.registrarVisitaUbicacionActual('Encontrado por GPS');
  await e.visitas.intentarSincronizar().catch(() => {});
  const locales = await e.visitas.obtenerVisitasLocales();
  assert.equal(locales[0].lugarId, 'lug-cerca');
  assert.equal(locales[0].origen, 'gps');
});

test('GPS automático no registra si está lejos o la precisión no alcanza', async () => {
  const e = entorno();
  await e.sesion.iniciarSesionAPI('lucia', 'bien');
  e.setGps({ coords: { latitude: -34, longitude: -58, accuracy: 5 }, timestamp: Date.now() });
  await assert.rejects(e.visitas.detectarLugarCercano(), /100 metros/);
  e.setGps({ coords: { latitude: -32.2, longitude: -58.1, accuracy: 180 }, timestamp: Date.now() });
  await assert.rejects(e.visitas.registrarVisitaUbicacionActual('Prueba'), /precisión/);
  assert.equal((await e.visitas.obtenerVisitasLocales()).length, 0);
});

test('pantallas de lugares y mapa consumen el mismo catálogo API paginado y su caché', async () => {
  const e = entorno({ catalogoReal: true });
  e.conectar();
  const lugares = e.cargar('./servicios/lugares');
  const categorias = e.cargar('./servicios/categorias');
  e.setCatalogo(Array.from({ length: 125 }, (_, i) => ({ id: `lug-api-${i}`, activo: true, coordenadas: { latitud: -32.2, longitud: -58.1 } })));
  assert.equal((await lugares.listarLugares()).datos.length, 125);
  assert.equal((await categorias.listarCategorias()).datos[0].nombre, 'Museos API');
  e.desconectar();
  assert.equal((await lugares.obtenerLugares()).datos.length, 125);
  assert.equal((await lugares.obtenerLugar('lug-api-124')).datos.id, 'lug-api-124');
});

test('agenda consulta API y conserva detalle en caché; el sobre de error no se pierde', async () => {
  const e = entorno({ catalogoReal: true }); e.conectar();
  const eventos = e.cargar('./servicios/eventos');
  const evento = { id: 'evt-api', titulo: 'Evento de la API', inicio: '2026-11-01T21:00:00-03:00', fin: null, estado: 'programado' };
  e.setEventos([evento]);
  assert.equal((await eventos.listarEventosDesde(new Date())).datos[0].id, evento.id);
  assert.equal((await eventos.obtenerEvento(evento.id)).datos.titulo, evento.titulo);
  assert.equal((await eventos.obtenerEvento('evt-no-existe')).error.codigo, 'EVENTO_NO_ENCONTRADO');
  e.desconectar();
  assert.equal((await eventos.obtenerEvento(evento.id)).datos.id, evento.id);
});

test('agenda agrupa también el día siguiente de un evento nocturno y usa la fecha de Argentina', () => {
  const e = entorno();
  const fechas = e.cargar('./utils/fechas');
  const grupos = fechas.agruparPorDia([
    { id: 'evt-noche', inicio: '2026-11-01T21:00:00-03:00', fin: '2026-11-02T02:00:00-03:00' },
  ], new Date('2026-11-01T00:00:00-03:00'));
  assert.equal(grupos.length, 2);
  assert.equal(grupos[0].clave, '2026-11-01'); assert.equal(grupos[1].clave, '2026-11-02');
  assert.equal(fechas.claveDia('2026-11-02T01:00:00Z'), '2026-11-01');
});

test('detalle y mapa comparten horario, incluyendo medianoche y múltiples turnos', () => {
  const e = entorno();
  const detalle = e.cargar('./utils/horarios');
  const mapa = e.cargar('./utilidades/horarios');
  const horarios = [{ dia: 0, abre: '09:00', cierra: '12:00' }, { dia: 0, abre: '20:30', cierra: '01:00' }];
  const fecha = new Date('2026-11-02T00:30:00-03:00');
  assert.equal(detalle.calcularEstadoApertura(horarios, fecha).abierto, true);
  assert.equal(mapa.obtenerEstadoHorario(horarios, fecha), 'abierto');
});

test('detalle nuevo y Mis eventos comparten guardado y un recordatorio de una hora', async () => {
  const e = entorno();
  const nuevo = e.cargar('./servicios/eventosGuardados');
  const anterior = e.cargar('./servicios/eventos-guardados');
  const evento = { id: 'evt-avisos', titulo: 'Peña', estado: 'programado', inicio: new Date(Date.now() + 7200000).toISOString() };
  assert.equal(await nuevo.guardarEvento(evento), 'con-aviso');
  assert.equal(await nuevo.estaGuardado(evento.id), true);
  assert.notEqual((await anterior.obtenerEventoGuardado(evento.id)).notificacionId, null);
  const aviso = [...e.avisos.values()][0];
  assert.equal(aviso.trigger.date.getTime(), Date.parse(evento.inicio) - 3600000);
  await nuevo.quitarEvento(evento.id);
  assert.equal(await anterior.obtenerEventoGuardado(evento.id), null);
  assert.equal(e.avisos.size, 0);
});

test('si falta el módulo de avisos, el evento sigue guardado sin prometer notificación', async () => {
  const e = entorno(); e.fallarAvisos();
  const nuevo = e.cargar('./servicios/eventosGuardados');
  const evento = { id: 'evt-sin-aviso', titulo: 'Peña', estado: 'programado', inicio: new Date(Date.now() + 7200000).toISOString() };
  assert.equal(await nuevo.guardarEvento(evento), 'no-disponible');
  assert.equal(await nuevo.estaGuardado(evento.id), true);
});
