# Unión de las tres partes — noviembre 2026

## Qué contiene esta copia

Base: el ZIP actual de Bruno `mi-ciudad-integrada(1).zip`.
Partes incorporadas: pantallas de `mi-ciudad(agenda-lugares).rar` y registro GPS de `proyecto-final-desarrollo-movil-8.zip`.

Es una copia nueva para probar en una carpeta separada. No reemplazar las carpetas originales hasta completar la prueba con el grupo.

## Cambios conservados sin reescribir

Se verificó que estos archivos son idénticos a los del ZIP actual de Bruno:

- `src/app/mapa.tsx`.
- `src/components/filtros-mapa.tsx` y `brujula-lugar.tsx`.
- `src/app/recorrido.tsx`, incluyendo los textos Actualizar / Guardada en tu cuenta.
- `src/app/cuenta.tsx` y `src/servicios/sesion.ts`.
- `src/servicios/db.ts` y `archivos.ts`.
- `src/utilidades/distancias.ts` y `horarios.ts`.
- `package.json`, `package-lock.json`, `app.json` y la configuración de EAS.

La base SQLite y las claves de sesión no cambiaron. No hay una operación de borrado o reinicio de registros al instalar esta copia. No se incluyen datos privados del teléfono en el ZIP.

## Pantallas de agenda y lugares

Se conservaron los diseños de las cuatro pantallas y los componentes enviados por el compañero. Para integrarlos con las rutas existentes se hicieron estas correspondencias:

| Origen del compañero | Destino en la copia integrada |
| --- | --- |
| `app/(tabs)/index.tsx` | `src/app/index.tsx` |
| `app/(tabs)/agenda.tsx` | `src/app/agenda.tsx` |
| `app/lugares/[id].tsx` | `src/app/lugar/[id].tsx` |
| `app/eventos/[id].tsx` | `src/app/evento/[id].tsx` |
| `src/componentes/*` | Mismos nombres y carpeta |

No se copió su navegador completo porque sustituiría los accesos del mapa, cuenta y recorrido. En el encabezado existente se añadieron los accesos Mapa y Favoritos que antes estaban en la portada de Bruno.

Las pantallas del compañero usan funciones llamadas `listarLugares`, `obtenerLugar`, `listarCategorias`, `listarEventosDesde` y `obtenerEvento`. Se añadieron adaptadores con esos nombres, manteniendo también `obtenerLugares`, `obtenerLugarPorId`, etc., que usa el resto de la app. Ambos caminos consultan el mismo catálogo API y caché.

No se conservaron sus servicios de mocks como fuente de las pantallas: agenda, categorías y lugares se consultan en la API del profesor. Los archivos mock originales de la base siguen disponibles como referencia; no se borran.

### Tipos

El compañero tenía entidades duplicadas en `src/tipos/index.ts`, incluyendo `idiomas` en lugar de `idioma` y una categoría sin todos los campos del contrato. El nuevo índice reexporta los tipos existentes de Bruno; solo define el sobre de respuesta adicional que usan las pantallas incorporadas.

### Funciones del detalle que ya existían

La ficha de lugares del compañero no tenía favoritos, audioguía ni enlaces para caminar o ir en auto. Se mantuvo su diseño y se añadieron debajo mediante `src/components/acciones-lugar.tsx`, usando los servicios existentes. La acción Registrar de la barra superior sigue abriendo la misma pantalla de visitas.

### Horarios y fechas

`src/utils/horarios.ts` conserva el formato de la semana del compañero, pero delega Abierto ahora a la misma utilidad que usa el mapa. Evita resultados distintos para turnos de tarde, horarios que cruzan medianoche y teléfonos con otra zona horaria.

`src/utils/fechas.ts` corrige el título de día (fecha, no hora), usa la zona horaria de Argentina y permite que un evento nocturno aparezca en los dos días que toca. La agenda ya no filtra datos inventados: recibe eventos de la API.

### Guardar eventos y recordatorios

La versión de agenda usaba otra clave local para guardados. Se añadió un puente en `src/servicios/eventosGuardados.ts` para que su detalle y la pantalla existente Mis eventos compartan el mismo almacenamiento.

El botón Guardar y avisarme del compañero intenta un recordatorio una hora antes. El servicio existente admite ahora ese intervalo como parámetro, conservando el valor de 15 minutos como opción por defecto para otros consumidores.

Se añadió un bloqueo mientras guarda/quita para evitar pulsaciones repetidas y manejo de errores de lectura/guardado. Un evento ya guardado puede quitarse aunque esté suspendido o cancelado. Si la programación no está disponible, queda guardado sin prometer un aviso.

Los cuatro efectos de carga inicial de las pantallas del compañero se conservaron; tienen una excepción de lint localizada para esa carga, sin reorganizar su estructura para satisfacer una recomendación de rendimiento.

## Mi recorrido v8

Se incorporó el menú de Nueva visita con tres opciones:

- Escanear QR.
- Estoy acá (Usar GPS).
- Buscar en la lista (Manual).

El botón GPS detecta el lugar activo más cercano dentro de 100 metros usando el catálogo completo de la API o su caché. Se movió el cálculo al servicio `detectarLugarCercano` para reutilizar las distancias existentes y no mantener dos algoritmos distintos.

Se conserva el spinner y la selección de lugar de v8. Al navegar al formulario se pasa `origen=gps`; el formulario existente ahora respeta ese parámetro y vuelve a verificar cercanía al guardar, con precisión y antigüedad de la lectura. No alcanza con haber estado cerca al abrir el menú.

También se incorporó `registrarVisitaUbicacionActual`, adaptada a la cuenta real y al guardado local existente.

### Qué no se sustituyó con v8

La migración de fetch a Axios del compañero es un cambio de transporte, no una función nueva. Se mantuvo el cliente HTTP común que ya estaba probado para no introducir dos configuraciones de API ni reemplazar la separación de visitas por usuario. No se agregó Axios como dependencia.

No se copió el cierre de sesión que borra visitas ni el usuario fijo de prueba de esa rama. Se conserva el login y la sincronización de la copia integrada, que separan usuarios y retienen pendientes. Esto debe revisarse con el compañero al llevarlo a Git.

## Cómo probar sin reemplazar la app anterior

1. Extraer este ZIP en una carpeta nueva. Abrir en VS Code la carpeta que contiene `package.json`; si hay una carpeta dentro de otra, entrar a la interior.
2. Ejecutar `npm ci` en esa carpeta.
3. Abrir Docker Desktop. En otra terminal, desde `api-mi-ciudad`, ejecutar `docker compose -f compose.postgres.yaml up`.
4. Comprobar `http://192.168.0.226:3000/salud` desde el celular. Si cambió la IP, configurar `EXPO_PUBLIC_API_URL` en `.env.local` como muestra `.env.example` y reiniciar Metro. La dirección común sigue definida en `src/servicios/configuracion-api.ts`.
5. Detener el Metro anterior y ejecutar `npx expo start --go --clear` desde la copia nueva. Se mantiene Expo SDK 57 y Expo Go compatible con SDK 57.
6. Probar lugares/búsqueda/categorías; abrir un detalle y sus fotos; probar mapa, filtros, brújula y Cómo llegar.
7. Probar agenda, detalle de evento y acceso al lugar. Guardar un evento y comprobar que aparece en Mis eventos; quitarlo y verificar que desaparece.
8. Ingresar con la cuenta demo, registrar visita manual con foto y abrir Mi recorrido. Probar el menú GPS. Fuera de Colón, el mensaje de que no hay un lugar a menos de 100 m puede ser correcto.
9. Probar API detenida después de haber cargado los catálogos, y volver a iniciarla para reintentar. No se necesita borrar volúmenes de Docker ni limpiar el almacenamiento del teléfono.
10. Probar cambio de cuenta para comprobar que las visitas no se mezclan.

## Validación local

- `npx tsc --noEmit`: sin errores.
- `npm run lint`: sin errores ni advertencias del código.
- Exportación del bundle Android: correcta. Es empaquetado, no prueba en un Android real.
- `node --test scripts/pruebas-integracion.cjs`: 17 pruebas aprobadas con Node 24, usando SQLite real en memoria y dobles de red y módulos nativos. Incluyen aislamiento de usuarios, cola offline, fotos, reintentos, GPS, paginación, API/caché, fechas, horarios y recordatorios compartidos.

No se pudo acceder al teléfono ni al servidor local de Bruno desde este entorno. La cámara, sensores, biometría y notificaciones necesitan una prueba real en el dispositivo.

## Pendientes que esta unión no da por terminados

- Favoritos y eventos guardados continúan siendo locales. No se implementó su sincronización por cuenta con `/yo/favoritos` o `/yo/eventos-guardados`.
- No se incorporaron push del servidor. El problema previo del módulo de notificaciones en Expo Go no se considera resuelto: el flujo debe seguir guardando sin recordatorio si no está disponible.
- El listado Mis eventos sigue consultando la agenda vigente; un historial completo de guardados pasados necesitaría consultarlos por sus identificadores o desde la API privada.
- Los guardados de agenda de la base de Bruno se conservan. No se importan automáticamente registros que solo existan en el teléfono del compañero ni en su clave local distinta.
- Se conservan las audioguías de la integración anterior; no se completó reproducción en segundo plano ni se revisó su estado funcional.
- No se agregó registro de cuentas nuevas ni edición de perfil.
- El mapa necesita conexión para descargar Leaflet y las imágenes de OpenStreetMap; no se hizo un mapa offline.
- Esta copia no sustituye el contraste final con la consigna ni el trabajo restante del grupo.
