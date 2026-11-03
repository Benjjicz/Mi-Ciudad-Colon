# Mi Ciudad — copia integrada para probar

Esta copia combina el proyecto de Bruno con el login y Mi recorrido de la rama v6 del compañero. No es una entrega final ni modifica sus carpetas originales. Pruébenla en una carpeta nueva antes de llevar cambios al repositorio del grupo.

## 1. Abrir la copia

Descomprimir el ZIP en una carpeta nueva llamada `mi-ciudad-integrada`, sin pegarlo sobre `mi-ciudad`. Abrir esa carpeta en VS Code. Desde la terminal que contiene su `package.json`:

```powershell
npm ci
```

Se agregó `expo-local-authentication` usando `expo install` para SDK 57. Las dependencias y el lock están incluidos; no hace falta instalar Expo 58 ni copiar `node_modules` de otro proyecto. Esta app se prueba con Expo Go para SDK 57 en Android.

## 2. Iniciar la API

Dejar Docker Desktop abierto. En otra terminal, desde la carpeta de la API del profesor:

```powershell
cd "C:\Users\Bruno\Desktop\api-proyectos-mobile-main\api-proyectos-mobile-main\api-mi-ciudad"
docker compose -f compose.postgres.yaml up
```

Comprobar `/salud` desde la PC y desde el navegador del teléfono. La configuración inicial sigue apuntando a `http://192.168.0.226:3000`.

Para cambiarla, copiar `.env.example` a `.env.local` y cambiar `EXPO_PUBLIC_API_URL`. Esa dirección es pública, no un secreto; no poner tokens ni contraseñas en ella. Si cambia la IP del equipo, actualizarla y reiniciar Metro. El celular no debe usar `localhost`.

Toda la conexión a la API ahora comparte `src/servicios/configuracion-api.ts`. Si el grupo usa un servidor distinto, cada computadora configura su propia `.env.local`.

## 3. Revisar y ejecutar

En la terminal de la copia integrada:

```powershell
npx tsc --noEmit
npm run lint
npx expo start --go --clear
```

No iniciar este comando desde la carpeta general de Desarrollo de Aplicaciones Movil. Dejar abierta la terminal de la API y usar otra terminal para Expo. Cerrar el Metro anterior si usa el mismo puerto.

## 4. Prueba guiada en Android

1. Sin sesión: abrir el mapa, sus filtros y detalles. Siguen siendo públicos.
2. Ir a Mi cuenta e ingresar con una cuenta de demo de la API del profesor: `lucia@mail.com` / `lucia1234`.
3. Abrir Mi recorrido: deberían descargarse las visitas de Lucía.
4. Registrar una visita manual desde el detalle o desde el botón de Mi recorrido. Agregar una nota y probar también con foto.
5. Abrir Mi recorrido y tocar Actualizar y sincronizar. La visita debe figurar sincronizada con la API. También puede comprobarse en Bruno con el token de esa cuenta.
6. Detener la API con Ctrl+C en su terminal. Registrar otra visita: debe quedar local y pendiente. No borrar el almacenamiento del teléfono.
7. Cerrar sesión e ingresar con `nuevo@demo.ar` / `nuevo1234` (esto requiere volver a iniciar la API). No deben aparecer ni subirse las visitas de Lucía.
8. Volver a ingresar como Lucía y abrir Mi recorrido. Su pendiente debe conservarse y poder sincronizarse.
9. Al volver a Mi cuenta con una sesión guardada y biometría configurada, se solicita autenticación local. Si se cancela o no hay biometría configurada, aparece el formulario para ingresar con email y contraseña.
10. Volver a probar mapa, filtros, brújula y enlaces para caminar o ir en auto.

La biometría de esta copia está aplicada al reingreso a la pantalla Mi cuenta; no se implementó un bloqueo global de toda la app. El servidor sigue autenticando cada petición privada con el token. No se debe presentar esta copia como una app completamente bloqueada por biometría.

## Qué se conservó de Bruno

- `src/app/mapa.tsx`, sin cambios de contenido.
- Filtros desplegables, categorías, radios, horario y accesibilidad.
- Brújula, distancias y utilidades de horarios.
- Servicios de catálogo con paginación y caché; se unificó su cliente HTTP.
- Pantallas de captura manual/GPS y QR; ahora el servicio exige sesión para guardar.
- Configuración de Expo SDK 57, identidad del proyecto, íconos y rutas existentes.

## Qué se incorporó y adaptó

- Login real contra `/auth/ingreso`, identidad de usuario y token en SecureStore.
- Reingreso a Mi cuenta con autenticación local; formulario como alternativa.
- SQLite para visitas, tomando como base el trabajo del compañero.
- Subida multipart de fotos y cola de visitas pendientes.
- Mi recorrido, estados de sincronización, botón de actualización y selector de lugar para registrar.
- Cuenta real en los registros: no se usa un usuario fijo de prueba.
- Listas y pendientes filtradas por usuario. El logout no elimina visitas.
- Una sincronización por vez, identificadores idempotentes y reutilización de la foto subida al reintentar.
- Errores de red controlados, tiempo de espera, conservación de datos offline y comprobación de cambios de cuenta durante una operación.
- Dos ajustes mínimos en portada y tema web para pasar las reglas actuales de lint. También se actualizaron textos antiguos del detalle.

La sincronización se intenta al guardar, al ingresar, al abrir Mi recorrido y al tocar Actualizar y sincronizar. No es una tarea permanente en segundo plano ni un sistema de sincronización por push.

## Datos anteriores y límites de alcance

- Las visitas de prueba de Bruno estaban en kv-store sin usuario. No se borran ni se asignan automáticamente a una cuenta.
- Esta integración usa una nueva base `miciudad-integrada.db`. Tampoco importa automáticamente la base SQLite del compañero, que guardaba un usuario fijo de prueba. Los datos que ya estén en la API se recuperan con su cuenta real.
- No se incluyen las bases privadas del teléfono dentro del ZIP.
- Favoritos y eventos guardados continúan con su implementación local anterior; no se integró su sincronización por cuenta. No asumir que ya están separados por usuario.
- La agenda, audioguías y notificaciones se conservaron de Bruno; esta unión no completa ni verifica esos módulos. El problema previo de notificaciones en Expo Go no se da por resuelto.
- No se agregó registro de usuarios nuevos, edición de perfil ni restablecimiento de contraseña. El login usa cuentas existentes de la API.
- El catálogo puede consultarse desde caché sin API; Leaflet y las imágenes del mapa necesitan conexión. No se descargan mapas offline.
- Probar especialmente las funciones nativas en el POCO. No se ejecutó un emulador ni se accedió a su API local desde este entorno.

## Archivos a revisar al llevarlo al repositorio del grupo

Pantallas: `cuenta.tsx`, `recorrido.tsx`, `registrar-visita/index.tsx` y la ruta añadida en `_layout.tsx`.
Servicios: `configuracion-api.ts`, `http.ts`, `api.ts`, `sesion.ts`, `db.ts`, `archivos.ts` y `visitas.ts`.
Tipos: `sesion.ts` y `usuario.ts`.
Dependencias: `package.json` y `package-lock.json`.
Herramientas: `eslint.config.js`, `.env.example`, este documento y `scripts/pruebas-integracion.cjs`.
Ajustes menores: portada en `index.tsx`, tema web, comentario de reintento en eventos guardados y textos del detalle.

Comparar los archivos en Git antes de copiar si el compañero siguió avanzando después de entregar su ZIP. No reemplazar todo el repositorio del grupo sin revisar sus nuevos cambios.

## Validación realizada

- TypeScript: `npx tsc --noEmit`.
- ESLint: `npm run lint`.
- Bundle Android: `npx expo export --platform android` (validación de empaquetado, no instalación nativa).
- Nueve pruebas automatizadas sobre los servicios reales, con SQLite en memoria y dobles de red y módulos nativos. Cubren separación de usuarios, logout, errores y reintentos, duplicados, subida de fotos, paginación, cambios de cuenta durante sincronización y controles GPS.

Para repetir las pruebas de servicios se necesita Node 24 (usan `node:sqlite`):

```powershell
node --test scripts/pruebas-integracion.cjs
```

Estas pruebas no sustituyen la prueba manual del teléfono contra el backend real. Las credenciales de demo son las documentadas por el profesor, no datos personales.
