## Context

Ver `proposal.md` para la motivación y `specs/tmdb-user-credential/spec.md` para el contrato. Hoy `src/providers/tmdb/tmdbClient.ts` lee sincrónicamente `process.env.EXPO_PUBLIC_TMDB_TOKEN`, construye el Bearer header y concentra todo `fetch` autenticado; `tmdbApi.ts` expone búsqueda, detalles, créditos y proveedores. Los únicos callers son `app/(tabs)/buscar.tsx` y `app/tmdb/[type]/[id].tsx`. El resto del producto usa SQLite y repositorios locales sin depender del provider.

La feature cruza storage por plataforma, lifecycle compartido, cliente HTTP, navegación y UI sensible. Agrega `expo-secure-store` en native, pero no cambia SQLite ni backups. `app.json` y `package.json` contienen cambios locales protegidos que Apply debe preservar al incorporar la dependencia/configuración necesaria.

## Goals / Non-Goals

**Goals:**

- Introducir una única fuente runtime para la credencial personal con límites explícitos entre UI, servicio, store y cliente HTTP.
- Mantener la app renderizable y localmente utilizable aunque la lectura del store falle o TMDB esté ausente.
- Hacer deterministas validación, reemplazo, eliminación y requests concurrentes.
- Dar a los consumidores estados observables sin exponer el token ni detalles de persistencia.
- Usar el seam TMDB existente en vez de dispersar autenticación o storage por screens.

**Non-Goals:**

- Añadir cuentas, login TMDB de usuario, backend, proxy, Supabase, cloud sync o recuperación remota.
- Modificar `SavedTitle`, SQLite, `app_preferences`, backups, sorting, views, ratings, pins o tags.
- Cifrar `localStorage` con una clave incluida en el mismo cliente.
- Añadir biometría, refresh/rotación automática del token o un fallback `EXPO_PUBLIC_*`.
- Separar la carga atómica actual de detalles, créditos y proveedores; sólo cambia su manejo de errores.
- Crear una infraestructura general de secretos, legal, temas o providers externos múltiples.

## Decisions

### 1. Store puro por plataforma y servicio único de credencial

Crear un contrato `TmdbCredentialStore` con operaciones async equivalentes a `get`, `set` y `delete`, sin validación HTTP, estado React ni conocimiento de TMDB. Resolverlo mediante módulos por plataforma, previsiblemente `tmdbCredentialStore.native.ts` y `tmdbCredentialStore.web.ts`, con tipos compartidos separados para que Metro seleccione el adapter correcto.

Native usará `expo-secure-store` con una clave estable y sin `requireAuthentication`; web usará `window.localStorage` con una clave namespaced. El adapter web capturará excepciones de disponibilidad, acceso, cuota o políticas del navegador y nunca caerá silenciosamente a memoria o SQLite. El token no se escribirá en `app_preferences` ni entrará en los repositorios de biblioteca.

Por encima, un singleton equivalente a `TmdbCredentialService` coordinará inicialización, estado, normalización, validación, mutations y cache. Recibirá un validator inyectado que opera con candidato explícito y un transporte HTTP sin estado global; no importará `tmdbApi` ni `tmdbClient`. Screens y el cliente runtime consumirán el servicio o una fachada/hook, nunca el store.

Alternativas descartadas: SQLite/app preferences, porque son almacenamiento ordinario y acercan el token al backup/dominio; leer SecureStore en cada request, por I/O repetido y carreras; Context conteniendo directamente persistencia, porque acoplaría React con el cliente HTTP.

### 2. Provider de estado no bloqueante para UI y servicio usable fuera de React

El servicio publicará atómicamente un snapshot equivalente a `{ status, tokenAvailable, generation }`, donde `status` distingue `initializing | configured | not-configured | storage-error`. `storage-error` conserva la incertidumbre: no significa ausencia conocida. Un provider/hook React delgado puede suscribirse desde el root y exponer ese snapshot a Buscar y Ajustes, pero debe renderizar sus children inmediatamente: sólo las superficies TMDB esperan la resolución; Biblioteca y rutas locales no quedan detrás de un splash o gate global.

`tmdbClient` consultará directamente la fachada del servicio para obtener el token efectivo. Esto evita que código no React dependa de hooks y conserva el seam único.

Alternativas descartadas: cargar la credencial dentro de cada screen, que duplica I/O y estado; bloquear todo el árbol hasta inicializar, que rompe local-first.

### 3. Inicialización lazy, snapshot coherente, generation y mutations serializadas

La primera lectura crea una única `initializationPromise`; todos los consumidores concurrentes reutilizan esa promesa. Una vez resuelta con token o ausencia, el resultado queda hidratado en memoria mientras la app está activa. Si la lectura rechaza, el service publica atómicamente `storage-error`, expone `credential-storage-error` y libera/reemplaza la referencia a la promise fallida: el error no queda sticky como inicialización reutilizable.

El service expone una operación equivalente a `retryInitialization`/`reinitialize`, válida desde `storage-error`. La primera llamada de cada intento crea una nueva promise de lectura y publica `initializing` o una snapshot coherente equivalente; llamadas concurrentes reutilizan esa única nueva promise. Mientras está pendiente, la resolución runtime espera y no permite requests TMDB, pero el provider sigue renderizando rutas locales. Si devuelve token publica `configured`; si devuelve `null`, `not-configured`; si rechaza, vuelve a `storage-error`, libera nuevamente la promise fallida y permite otro retry posterior.

La hidratación inicial o repetida no es una mutation de credencial: nunca incrementa generation, incluso cuando recupera un token ya persistido. Search reacciona una sola vez al cambio coherente de status/token availability hacia `configured`, sin exigir ni inventar una generation nueva.

Cada request obtiene una string snapshot antes de construir el header. Un reemplazo validado sólo afecta requests posteriores; no hay abort global de requests ya enviados. `generation` cambia únicamente al publicar un cambio efectivo de la credencial usable para requests futuros: save inicial exitoso, replacement validado+persistido exitosamente o delete exitoso. Status, `tokenAvailable` y generation se publican juntos, nunca como transiciones parciales que React pueda interpretar como dos cambios.

Validación fallida, 401, network/retry, write fallido y delete fallido con rollback no incrementan generation. Las mutations de persistencia se serializan para impedir que save/change/remove se reordenen:

- Guardar/cambiar: normalizar → validar candidato explícito → escribir store → publicar en una sola operación cache/status/generation. Si el write falla, la cache y generation anteriores permanecen y se comunica `credential-storage-error` para esa mutation.
- Eliminar: activar un gate interno representado por la misma promise/resultado de la mutation; toda resolución runtime nueva espera ese gate, mientras la snapshot pública anterior permanece coherente → borrar store. El delete no espera a esos requests, por lo que no existe dependencia inversa ni deadlock.
- Si delete tiene éxito, publicar atómicamente `not-configured` y una única generation nueva; liberar el gate; cada request esperado vuelve a resolver y recibe `credential-not-configured`, con zero fetch y sin usar el token eliminado.
- Si delete falla, comunicar `credential-storage-error` a quien inició la mutation, retirar el gate sin cambiar snapshot/cache/generation; cada request esperado vuelve a resolver la credencial anterior y puede continuar normalmente con ella.
- Requests que ya habían tomado snapshot y salido antes de confirmar delete pueden terminar normalmente. React consumers no reciben ausencia ni generation intermedia durante la mutation.
- Fallos de inicialización/lectura publican `storage-error` y se propagan como `credential-storage-error`; no limpian store/cache conocido ni se convierten a `not-configured`.

Alternativas descartadas: cancelar todos los requests al mutar, por complejidad sin beneficio contractual; actualizar cache antes del write al guardar, porque podría publicar una credencial no persistida.

### 4. Transporte HTTP explícito sin credencial global

Extraer una primitive equivalente a `tmdbRequestWithToken(token, path, options)` que concentre base URL, query params, `Authorization`, `fetch`, `AbortSignal`, clasificación HTTP/transporte y parsing seguro. Esta capa recibe una credencial no vacía ya resuelta y no importa ni conoce `TmdbCredentialService`, stores, SecureStore, localStorage, React, `tmdbApi` ni screens.

El flujo queda acíclico:

```text
TmdbCredentialService ──▶ validator inyectado ──▶ explicit-token transport

tmdbClient runtime ──▶ TmdbCredentialService ──▶ snapshot
          └────────────────────────────────────▶ explicit-token transport
```

El validator dedicado llama `GET /authentication` usando el candidato como argumento explícito del transporte. El cliente runtime primero obtiene una snapshot del service y después invoca el mismo transporte. `tmdbApi` continúa consumiendo el cliente runtime para endpoints normales, pero el service nunca importa `tmdbApi` ni `tmdbClient`; la composición raíz inyecta el validator al crear el service.

Alternativas descartadas: un `tmdbFetch` que resuelva override o credencial global internamente, porque reintroduce el ciclo y hace ambiguo qué fuente gana; duplicar fetch/clasificación para validación, porque divergiría del runtime.

### 5. Normalización acotada y override de validación exclusivo

Una función pura normalizará el candidato con `trim`; si después comienza con un único prefijo `Bearer` seguido de whitespace, retirará sólo ese prefijo y volverá a recortar. Un valor vacío será inválido localmente. No se cambiará casing, puntuación ni contenido restante.

La semántica de override es absoluta: al validar un candidato, ese valor es la única credencial del request. El validator no consulta ni inicializa el store, no obtiene fallback global, no modifica cache/status/generation y no persiste. Un candidato vacío se rechaza antes de llamar al transporte. Sólo después de `200` el service intenta persistir; hasta completar ese write, la credencial configurada anterior permanece efectiva.

Un `401` rechaza el candidato. Fallos de red, timeout representado dentro de network, `429` y `5xx` preservan candidato en el estado local del formulario, permiten reintento y mantienen la credencial anterior. No se crea `configured-unverified`.

Alternativas descartadas: guardar y luego probar, porque puede desplazar una credencial válida; usar un endpoint de datos arbitrario, porque `/authentication` expresa exactamente validación de credencial.

### 6. `tmdbClient` runtime resuelve snapshot y errores tipados

Eliminar `getToken()` basado en entorno sólo cuando la composición runtime real exista. `tmdbClient` pedirá al service una snapshot efectiva; si está configured, pasará esa string al transporte explícito. Si la lectura falló, producirá `credential-storage-error`; si la ausencia fue confirmada, `credential-not-configured`. El cliente no acepta override, no importa SecureStore, APIs web, React ni screens y no construye Authorization por una segunda vía.

Definir una unión/clase segura equivalente a:

- `credential-not-configured`
- `credential-storage-error`
- `credential-invalid`
- `network` con causa interna opcional de timeout
- `aborted`
- `rate-limited`
- `http` con status y código remoto seguro opcional
- `invalid-response`

Mapeo: ausencia confirmada antes de fetch → not configured; fallo al inicializar/leer/persistir/eliminar cuando debe informarse → storage error; `401` → invalid; `429` → rate limited; AbortError → aborted; rechazo de transporte/timeout → network; otros status → http; JSON ilegible o shape mínimo imposible → invalid response. Network y `5xx` nunca borran la credencial.

El transporte puede leer cuerpos para extraer un código/mensaje permitido, pero no propagará el body crudo. Ningún error/log recibe Authorization, el token, fingerprint/prefijo/sufijo/substrings deliberados ni otra representación intencional derivada. Como el token sólo viaja en el header interno, tampoco se agrega a URLs o query params. Los harnesses con token canario prueban ausencia íntegra y de todas las representaciones que la feature implementa, sin afirmar que pueden excluir coincidencias accidentales arbitrarias.

Alternativas descartadas: strings de error y `instanceof Error` genérico, porque impiden UX específica; pasar mensajes crudos de TMDB, por seguridad y estabilidad.

### 7. Buscar usa el estado de credencial como gate del efecto existente

`app/(tabs)/buscar.tsx` conservará debounce, query y preferencias. El efecto esperará durante `initializing` y sólo llamará `searchMulti` en `configured`. En `not-configured` conservará `q/debounced`, invalidará resultados y mostrará `TMDB no está configurado` con `Obtener token` y `Configurar`. En `storage-error` hará cero requests y mostrará un mensaje específico de acceso a configuración con `Reintentar` y/o `Configurar`, sin afirmar ausencia.

El efecto observará la identidad coherente de la snapshot y la query, sin imponer un mecanismo React concreto. Una query puede ejecutar o reejecutar exactamente una vez cuando: (A) el estado pasa de cualquier condición no usable (`initializing`, `storage-error` o `not-configured`) a `configured`, aunque hydration/retry no incremente generation; o (B) el estado ya era `configured` y generation incrementa por un replacement validado y persistido que cambia la credencial efectiva. Startup hydration y retry→configured consumen su transición usable una sola vez; un save desde not-configured hace lo mismo aunque también incremente generation, sin doble disparo.

No disparan búsqueda adicional: validación fallida, candidato 401, network/timeout, retry fallido, retry que confirma `null`, write fallido, delete fallido, snapshots repetidas ni renders/suscripciones que no aportan una nueva transición usable o generation. Delete exitoso cambia `configured → not-configured`, invalida resultados y nunca inicia una búsqueda. `aborted` se ignora; invalid credential conduce a cambiar token; storage/network/rate/http recuperable ofrece reintento explícito.

Alternativas descartadas: dejar que cada keystroke falle en el cliente, porque genera intentos inútiles; borrar la query al configurar, porque pierde intención.

### 8. Ajustes resume; una screen propia gestiona el secreto

`app/(tabs)/ajustes.tsx` incorporará una sección TMDB pequeña con estado y navegación, sin mezclar el formulario con backup. Una ruta nueva equivalente a `app/settings/tmdb.tsx` contendrá explicación, input con `secureTextEntry`/equivalente web, show/hide accesible, link oficial, validación, retry, change y eliminación confirmada. El token guardado nunca se precarga ni se revela: cambiar comienza con input vacío.

La screen distingue `storage-error` de `not-configured` en lectura y mutations, conserva cualquier estado conocido cuando corresponde y ofrece retry sin borrar silenciosamente. La advertencia web explicará persistencia, borrado por datos del navegador y acceso potencial de JavaScript same-origin sin afirmar seguridad equivalente. Los links usarán `Linking` o navegación web compatible y fallarán de forma amistosa.

Alternativas descartadas: modal, porque el flujo tiene demasiados estados, teclado y copy; formulario inline en Ajustes, porque acopla credencial con backup y vuelve extensa la tab.

### 9. Detalle remoto conserva `Promise.all` y traduce categorías

`app/tmdb/[type]/[id].tsx` mantendrá el `Promise.all` actual para detalles, créditos y proveedores. El catch diferenciará ausencia/invalidez para ofrecer configurar/cambiar y traducirá fallos remotos a mensajes seguros con retry cuando corresponda. No se intentará presentar detalles parciales ni guardar metadata si la carga atómica falló.

Alternativa descartada en esta change: `Promise.allSettled`, append-to-response o subestados por recurso; cambian la estrategia de producto y ampliarían scope.

### 10. Credits separados y asset oficial controlado

Ajustes enlazará a una ruta equivalente a `app/settings/about.tsx`. La screen contendrá el notice exacto, enlace a TMDB, descripción de servicio externo y un logo descargado desde la fuente oficial durante Apply. El asset se incorporará sólo después de verificar que sea un logo aprobado, conservar proporción/color permitido y documentar su origen; no se generará ni redibujará.

Credits no importará el servicio de credencial ni mostrará su estado. No se crea una infraestructura legal general.

### 11. Dependencia y archivos protegidos se tratan como checkpoint separado

Antes de instalar, Apply debe capturar `git status`, diff y hashes de `app.json` y `package.json`, identificar el lockfile real y detenerse para revisión. Sólo después, instalará `expo-secure-store` con `npx expo install` usando el SDK real. Luego inspeccionará exactamente qué cambió y aplicará manualmente cualquier plugin/config mínimo preservando byte/semánticamente los cambios del usuario no relacionados.

Si la herramienta intenta reescribir o reemplazar cambios protegidos de forma que no pueda aislarse, Apply se detiene: no revierte, formatea ni fuerza el archivo. La dependencia/config se valida antes de continuar con adapters.

Alternativas descartadas: editar versiones a mano sin resolver compatibilidad; instalar junto con otras dependencias; revertir los cambios protegidos.

### 12. Archivos y capas previstos

- Modificar `src/providers/tmdb/tmdbClient.ts`, `tmdbApi.ts` y posiblemente `tmdbTypes.ts` sólo para contratos remotos.
- Crear errores, servicio y normalización bajo `src/providers/tmdb/` o un subdirectorio cohesivo.
- Crear contrato/adapters de credencial bajo `src/storage/`, sin tocar `db.ts`, `databaseSchema.ts` ni repositorios de biblioteca.
- Modificar `app/_layout.tsx` sólo para provider/rutas si Expo Router lo requiere, sin bloquear children.
- Modificar Buscar, Ajustes y detalle remoto; crear screens de configuración y créditos.
- Agregar el logo oficial bajo `assets/` con procedencia/uso verificados.
- Modificar únicamente durante el checkpoint autorizado `package.json`, lockfile y, si el plugin realmente lo requiere, `app.json`.
- Agregar harnesses focalizados en `docs/testing/tmdb-user-credential/`.

## Risks / Trade-offs

- [Un XSS o JavaScript same-origin puede leer `localStorage`] → advertencia explícita, CSP/higiene web fuera de esta feature y ninguna promesa de equivalencia con SecureStore.
- [SecureStore tiene lifecycle distinto entre Android e iOS, incluida posible persistencia de Keychain tras reinstalar] → documentarlo y validarlo manualmente, sin tratar la credencial como dato irremplazable.
- [Una mutation de storage falla a mitad del flujo] → cola serial, cache anterior preservada en save y restauración en delete fallido.
- [Un fallo de lectura se confunde con ausencia] → `credential-storage-error` separado y snapshot que conserva la incertidumbre sin publicar `not-configured`.
- [Un request anterior termina después de cambiar credencial] → aceptar su snapshot por contrato y hacer que sólo futuros requests vean generation nueva.
- [Un `401` temporalmente mal clasificado por TMDB invalida la UX] → no borrar automáticamente el token; marcarlo inválido para consumers y requerir cambio/revalidación explícita.
- [El provider de credencial bloquea rutas locales] → render no bloqueante y gates sólo en superficies TMDB.
- [El token aparece en logs o bodies crudos] → errores sanitizados, header nunca interpolado en mensajes y harnesses negativos sobre logging.
- [El token entra al backup o SQLite por reutilizar preferencias] → adapter separado y regresiones estructurales que prohíben imports desde backup/database.
- [La instalación pisa cambios locales de configuración] → checkpoint obligatorio y stop antes de cualquier instalación no aislable.
- [El logo/copy incumple attribution] → usar asset oficial aprobado, notice exacto y verificación manual previa a cierre.
- [La carga atómica del detalle sigue siendo frágil] → riesgo aceptado y explícitamente fuera de alcance; sólo se mejora clasificación/mensaje.

## Migration Plan

1. Introducir tipos, normalización, errores, service/store contracts inyectables, semántica de concurrencia, transporte HTTP explícito y validator con doubles; mantener el wiring runtime vigente y compilable durante este checkpoint preparatorio.
2. Registrar y preservar cambios locales protegidos; detenerse para aprobar la estrategia; instalar/configurar `expo-secure-store`; implementar adapters native/web y composición singleton/provider reales.
3. Con la composición de producción disponible, conectar `tmdbClient` runtime al service, eliminar definitivamente `EXPO_PUBLIC_TMDB_TOKEN` y comprobar que no existe fallback ni almacenamiento temporal.
4. Integrar Ajustes y la screen de configuración con storage-error diferenciado; detenerse para review.
5. Integrar Search y detalle remoto manteniendo la carga atómica; detenerse para review.
6. Integrar Credits y asset oficial; detenerse para review.
7. Validar native/web, seguridad, regresión local, diff completo y specs antes de archive.

Rollback: retirar integración/UI/adapters y la dependencia/configuración de SecureStore sin tocar SQLite ni datos de biblioteca. Las credenciales que ya queden en SecureStore/localStorage pueden eliminarse mediante una limpieza explícita del adapter antes de retirar la feature; no se restaura el fallback de entorno.
