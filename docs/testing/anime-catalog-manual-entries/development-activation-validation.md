# Kitsu vivo local — entrega combinada B4 + activación de desarrollo

## Consolidación vigente — 2026-11-13

**Web de desarrollo aceptado, revisión externa combinada aprobada y alcance de release
explícitamente diferido. OpenSpec: 22/24 tareas completas.** Esta sección actualiza las
declaraciones históricas de fallo/aceptación/revisión pendiente que se conservan abajo.

- **USER-REPORTED, 13/11/2026:** después de implementar y revisar la corrección
  `(input, init) => globalThis.fetch(input, init)`, buscar `cowboy bebop` desde
  Buscar → Anime funciona correctamente en Chrome, incluida la navegación al detalle
  solicitada. El fallo Web anterior queda registrado como antecedente resuelto en ese
  recorrido. No se repitió aquí el smoke ni se inventan versión de Chrome, origen/build,
  headers, guardado vivo u otros recorridos no informados.
- **Revisión externa combinada USER-REPORTED:** bundle
  `dlv-b4-kitsu-dev-review-9a186a5050744fdfb04ec3e2989c75f8`, sobre baseline/checkpoint
  `da5520b8465478553587856bdc86a4a013eb666d`, aprobado sin bloqueantes de código.
  Contenía 19 archivos modificados y 4 nuevos. Ese conteo corresponde al bundle revisado,
  no al diff documental incremental de esta actualización. El revisor examinó el diff y
  las pruebas nuevas; **no volvió a ejecutar las 56 suites contra el repositorio completo**.
  Sus resultados previos conservan su procedencia y fecha; esta aceptación no los convierte
  en una ejecución independiente del revisor ni en nuevas pruebas de runtime.
- **Decisión de producto:** priorizar funcionalidades completas y gratuitas; aceptar que
  cambios de disponibilidad o condiciones de proveedores puedan exigir sustituciones o
  reimplementaciones futuras. Separar experimentación local de requisitos de distribución
  pública. Esto no concede derechos externos ni autoriza nuevos proveedores, cambios de
  contratos, enriquecimiento de metadata o trabajo técnico adicional en esta actualización.
- **3.6 completa:** suites/revisión y checkpoint técnico B3 ya documentados, más decisión
  explícita de uso local y diferimiento de release. No se declara 3.5 satisfecha ni un
  nuevo checkpoint Git realizado. **4.5 completa:** entrega y resultado de revisión externa
  combinada registrados. El siguiente checkpoint Git requiere revisión manual separada.
- **Pendientes:** 3.5 por M/T de release (incluidas condiciones de uso/retención/backups,
  atribución/cuotas y aceptación por plataforma del release previsto); 4.4 por Android
  y demás condiciones finales no verificadas. La aceptación de Chrome local no acredita
  release Web, Android, iOS o producción. BlueStacks conserva investigación de lanzamiento
  pendiente sin causa determinada; Android físico sigue diferido al hito acordado.

Producción/iOS permanecen cerrados, arte omitido y puntuaciones sin cambios. Change abierto;
no archive/sync/integración. No se inicia enriquecimiento de metadata. Esta actualización
es únicamente documental y se detiene antes del checkpoint Git para revisión manual.

## Evidencia histórica de implementación y validación

Fecha: 2026-11-13, America/Buenos_Aires. Change `add-anime-catalog-and-manual-entries`.
Rama `feat/anime-catalog-manual-entries`, HEAD conservado
`da5520b8465478553587856bdc86a4a013eb666d`.

## Autorización y preservación B4

El usuario autorizó explícitamente usar datos Kitsu reales en desarrollo local Web/Android,
sin exigir MediaReview. Es autorización técnica del proyecto, no licencia otorgada por
Kitsu ni permiso de distribución pública. El change permanece abierto.

Worktree inicial: los 10 archivos modificados y 2 nuevos de B4 coinciden con su informe.
B4 implementado y revisado externamente según usuario (USER-REPORTED); no se solicitó
limpieza/commit ni se atribuye inspección propia del informe externo. Se preservaron todos
sus cambios. Los hashes SHA256 de las **60 suites .cjs preexistentes** son idénticos antes
y después de esta ejecución, incluido el runner B4 no commiteado. No se modificaron ni
debilitaron pruebas históricas; se agregó una suite independiente.

## Archivos de esta ejecución

Producto (7):

- `src/providers/kitsu/availability.ts`: disponibilidad local separada de release.
- `src/providers/kitsu/identity.ts`: endpoint vivo oficial io explícito.
- `src/providers/kitsu/client.ts`: base io seleccionable explícitamente para transporte
  real, manteniendo validación de origin, redirects, cola, timeout y cancelación.
- `src/providers/kitsu/product.ts`: wrapper real io, gates y referencias de fuente.
- `src/providers/kitsu/AnimeDetail.tsx`: enlace de fuente io.
- `src/components/search/searchCategories.ts`: Anime disponible en Buscar normal dev.
- `app/kitsu/anime/[id].tsx`: detalle/saved detection/save con el mismo gate dev.

Nueva prueba: `docs/testing/anime-catalog-manual-entries/development-activation-verification.cjs`.
Nuevo informe: este archivo. Documentación actualizada: `b3-eligibility.md`,
`b3-validation.md`, `b4-validation.md` y OpenSpec `proposal.md`, `design.md`, `tasks.md`,
`specs/anime-catalog/spec.md`. El resto de cambios B4 del diff combinado ya existían.
Sin dependencias, scripts npm, esquema SQLite ni formatos backup nuevos.

## Comportamiento exacto

| Runtime | Anime / búsqueda / detalle / guardado remoto |
| --- | --- |
| __DEV__ true + Web/Android | Habilitados en Buscar normal, sin MediaReview |
| __DEV__ false o ausente | Cerrados antes de fetch/saved detection/save de ruta remota |
| iOS o plataforma desconocida | Cerrados incluso en desarrollo |
| MediaReview TEST | Transporte sintético determinista, nunca delega a fetch |

`productionEnabled` continúa false; M/T siguen pending y artwork omit. No existe flag
EXPO_PUBLIC para habilitar release. `productionSearchCategories` es el nombre histórico
de la composición normal; ahora consulta `enabled` para Kitsu, sin cambiar otros providers.
__DEV__ se sustituye por Expo en el bundle; `expo export` genera release y mantiene el gate
cerrado. No distribuir el build development como si fuera un release aprobado.

Todo HTTP real se construye en `https://kitsu.io/api/edge`. GET JSON:API sin Authorization,
credentials omit, redirect:error, sin proxy ni fallback a app/io alternativo. La base app
original del cliente **inyectable** se conserva para los contratos sintéticos B3 existentes;
el único wrapper real pasa io explícitamente. No se relajó validación de origin: la suite
nueva rechaza una respuesta app cuando se pidió io. No se usa kitsu.cloud.

El usuario busca y selecciona individualmente; no hay descarga masiva, paginación
automática, scraping, polling ni cache de catálogo. Solo se guarda el snapshot normalizado
existente (título, año, resumen seguro, clasificación y géneros permitidos), referencia
kitsu/anime/string y campos locales de biblioteca. Resultado de búsqueda completo no se
persiste. posterUrl null, voteAverage ausente desde Kitsu, initialTags vacío. No se solicita
ni muestra arte, score global, mappings ni OAuth. Se mantienen seis subtipos + unknown,
save/re-save por referencia completa y refinamiento/preservación de personales.

La lectura de `/title/[id]` continúa siendo local/offline, también si el catálogo falla
o el build no habilita HTTP. Guardado/export/import usan SQLite6/backup7 existentes;
las dudas de retención/export/backups siguen siendo una decisión de release pendiente.

## API real y navegador

Prueba diagnóstica explícita separada de suites automatizadas, con `createKitsuClient`,
base io, sparse fields exactos del cliente (canonicalTitle,titles,subtype,startDate,
synopsis,categories; include=categories; fields[categories]=title), sin guardar payloads,
fixtures, backups ni imágenes:

| Operación | Resultado |
| --- | --- |
| GET /anime, query cowboy bebop, limit20/offset0 | HTTP200, JSON:API, sin redirect, parser válido, 5 resultados |
| GET /anime/1 | HTTP200, JSON:API, sin redirect, parser válido |
| Ambos con Origin http://localhost:8158 | Access-Control-Allow-Origin: * |

HTTP de escritorio no sustituye browser CORS. Documentación oficial consultada de nuevo:
[Kitsu JSON:API](https://hummingbird-me.github.io/api-docs/) publica la base io, sparse
fieldsets y GET públicos mayormente sin auth. No prueba derechos de retención/backups.

Web real: `npm run web -- --port 8158 --localhost`, EXPO_OFFLINE y MEDIA_REVIEW removidos,
EXPO_NO_DOTENV=1. Metro fuera del aislamiento de red arrancó; IAB abrió
`http://127.0.0.1:8158`, biblioteca vacía, Buscar normal y categoría Anime visibles.
Query cowboy bebop y reintento mostraron **«No pudimos consultar Kitsu / No se pudo conectar
con Kitsu. Revisá tu conexión.»**, correspondiente al error network del cliente (fetch
rechazado). Abrir el endpoint detail exacto directamente en otra pestaña sí mostró JSON.
La consola capturada no aportó un error CORS, DNS o TLS específico: **no se determina causa
raíz ni se afirma aceptación Web viva**. No se usó otro host/proxy/fake data para resolverlo.
La UI muestra el error y permite reintentar; no se ejecutó save vivo desde ese navegador.

Primer servidor dentro del aislamiento, puerto8157: IAB ERR_CONNECTION_TIMED_OUT; se
repitió fuera del aislamiento en8158 y la app sí cargó. Ambos servidores propios detenidos
con Ctrl+C al terminar (exit1 intencional). La prueba usa un origen nuevo con biblioteca
vacía; no se inspeccionaron credenciales ni datos personales. No se repitieron manuales B2.

## Validación automatizada

| Comando | Exit / resultado |
| --- | --- |
| `node docs/testing/anime-catalog-manual-entries/development-activation-verification.cjs` | 0; nueva suite determinista |
| `node docs/testing/anime-catalog-manual-entries/b3-contracts.cjs` | 0; sin editarla |
| `node docs/testing/anime-catalog-manual-entries/b4-regressions.cjs` | 0; 40/40 comandos, 56/56 suites incluyendo B1/B2/B3 |
| `npx tsc --noEmit` | 0 |
| `openspec validate add-anime-catalog-and-manual-entries --strict` | 0 |
| `npx expo export --platform web --output-dir "$env:TEMP/dlv-kitsu-development-web-01a1d3b5"` | 0; bundle release/worker/WASM en TEMP |
| `git diff --check` | 0 |
| `git diff --quiet -- package.json package-lock.json` | 0 |
| `git diff --cached --exit-code` | 0 |

La nueva suite ejecuta wrappers normales search/detail, resolución/destino Anime y los
servicios reales de la ruta con repositorio sintético; valida URL io, headers, ausencia
de arte/score/auth, conexión a save/local navigation y cero solicitudes implícitas. Recorre
__DEV__ ausente/false/true × Web/Android/iOS/unknown y verifica cierre antes de HTTP/DB.
Prueba también TEST bajo __DEV__ true sin delegación a fetch. Las suites B4 conservan la
evidencia SQLite real de save/re-save, personales, remap, import/export7 y reopen offline.
No se realiza HTTP real durante ninguna suite automatizada.

Dos ejecuciones iniciales de la suite nueva fallaron por mocks UI incompletos (vector-icons
y StyleSheet); se completaron únicamente los mocks nuevos y la ejecución final pasó.
No se tocaron suites históricas para acomodar la activación.

Avisos existentes: node:sqlite experimental, NO_COLOR/Browserslist y Expo recomienda
patches de expo/file-system/router; no se instalaron dependencias ni updates.

## Android y arranque simple

ADB disponible en `C:\Users\elias\AppData\Local\Android\Sdk\platform-tools\adb.exe`;
`adb devices -l` fuera del aislamiento: exit0, lista vacía. Intento restringido previo no
pudo iniciar daemon; no se interpreta como fallo BlueStacks/app. No se localizó puerto
BlueStacks verificable en la ruta de configuración consultada. No se inició la app ni
se repitió la aceptación TEST B3 diferida. Problema previo de lanzamiento sigue sin causa
determinada; no hay aceptación Android viva. Android físico sigue diferido al hito acordado.

PowerShell, raíz del repo. Limpiar flags heredados antes de cualquiera de los arranques:

```powershell
Remove-Item Env:EXPO_OFFLINE -ErrorAction SilentlyContinue
Remove-Item Env:EXPO_PUBLIC_MEDIA_REVIEW -ErrorAction SilentlyContinue
$env:EXPO_NO_DOTENV='1'
```

Web normal (comando arrancado y app visible en esta ejecución):

```powershell
npm run web -- --localhost --port 8158
```

Abrir http://localhost:8158 y elegir Buscar → Anime. No activar TEST ni EXPO_OFFLINE.
Para BlueStacks: abrirlo, habilitar Android Debug Bridge en sus ajustes y usar el puerto
mostrado allí. **5555 es ejemplo habitual, no un puerto verificado en esta máquina.**

```powershell
$adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
$blueStacksSerial = '127.0.0.1:5555' # Sustituir por host:puerto de los ajustes de BlueStacks
& $adb connect $blueStacksSerial
& $adb devices -l
& $adb -s $blueStacksSerial reverse tcp:8081 tcp:8081
npm run android:start -- --localhost --port 8081
```

`android:start` verificado en package.json como `expo start --android`; no se afirma
que esa ejecución nativa haya funcionado aquí. Requiere runtime Expo compatible ya
instalado. Si hace falta construir el runtime existente, alternativa separada sin
dependencias nuevas: `npm run android -- --device --port 8081`, que llama expo run:android.
No se ejecutó ese build. `adb reverse` enlaza Metro; no garantiza salida HTTPS del emulador.

## Estado y revisión

**19/23 tareas completas.** Nueva3.7 completa: implementación local y verificaciones
técnicas documentadas. 3.5 no completada: M de release + T Web/Android pendientes.
3.6 tiene decisión local explícita, pero cierre/revisión/checkpoint combinado pendientes.
4.4 mantiene pendientes aceptación final Web/Android y checkpoint; tests/export pasan.
4.5: revisión externa del B4 anterior aceptada según usuario, nueva revisión combinada
pendiente. No se fuerza cierre por HTTP200 ni por fixtures. Arte A permanece omit.

Riesgos restantes: fetch Web entre orígenes falló en IAB sin causa confirmada; Android
no conectado/validado; términos de uso/retención/backups, atribución y cuotas de release
sin verificar. La disponibilidad HTTP puede cambiar. Release permanece bloqueado y el
change abierto. No solicitar repetir manuales aceptados ni atribuir causa a BlueStacks.

Bundle combinado mínimo sobre B3 aceptado (incluye B4 no commiteado + activación actual),
PowerShell7.2+, desde raíz:

```powershell
pwsh -NoProfile -File .\scripts\New-ReviewBundle.ps1 -Baseline da5520b8465478553587856bdc86a4a013eb666d -OutputDirectory (Join-Path $env:TEMP ('dlv-b4-kitsu-dev-review-' + [guid]::NewGuid().ToString('N'))) -Boundary Section -PackageJsonPolicy Incorporated -ScriptsCheckpoint a793d459c841814291c1e3c0887c8bf7b77ecc10
```

Incluye nuevos archivos sin staging. Comando preparado; no se publicó bundle, no staging,
commit, push, archive, sync o merge. **STOP para revisión externa.**

## Corrección mínima de transporte posterior a Explore — 2026-11-13

Autorización específica del usuario: wrapper dinámico y regresión del receptor; no ejecutar
validación manual Web hasta revisar el diff. Rama/HEAD siguen siendo los registrados arriba;
se preservó el worktree previo de B4/activación. Archivos de esta corrección únicamente:
`src/providers/kitsu/product.ts`, `development-activation-verification.cjs`, este informe
y `openspec/changes/add-anime-catalog-and-manual-entries/tasks.md`.

`product.ts` inyecta `(input, init) => globalThis.fetch(input, init)`. El wrapper ignora el
receptor que le pasa el cliente, invoca fetch con el global correcto y resuelve su valor
en cada solicitud. El singleton del cliente, client.ts, cola/spacing, timeout, cancelación,
Retry-After, errores y gates no fueron modificados en esta corrección.

La suite de activación ahora usa una función normal sintética que exige this===globalThis
y reemplaza fetch después de la primera búsqueda; el detalle debe pasar por ese reemplazo
usando el mismo cliente. La suite falló antes de corregir producto (exit1, error convertido
a network por el cliente) y pasó después (exit0). No usa fetch nativo ni hace HTTP real.

Comandos ejecutados después de corregir, todos exit0:

- `node docs/testing/anime-catalog-manual-entries/development-activation-verification.cjs`
- `node docs/testing/anime-catalog-manual-entries/b3-contracts.cjs` (search/mapping,
  timeout, cancelación, concurrencia/spacing, errores HTTP/red y Retry-After)
- `node docs/testing/anime-catalog-manual-entries/b3-ui-verification.cjs` (search/retry,
  navegación/respuestas obsoletas y detalle)
- `node docs/testing/anime-catalog-manual-entries/b3-verification.cjs` (save/re-save,
  personales, SQLite6/backup7 y aislamiento)
- `npx tsc --noEmit`
- `openspec validate add-anime-catalog-and-manual-entries --strict`
- `git diff --check`

No se repitió el runner B4 completo ni export Web en esta corrección de una línea; sus
resultados anteriores pertenecen a la entrega previa. No se declara todavía corregido
el incidente en Chrome: falta validación manual Web posterior a revisión del diff.
OpenSpec actual: **20/24 completas**, nueva3.8 completada; 3.5, 3.6, 4.4 y 4.5 siguen
pendientes. Producción/iOS cerrados, arte omit y puntuaciones sin cambios; sin dependencias,
staging, commits, push, archive o merge. Change abierto para revisión.
