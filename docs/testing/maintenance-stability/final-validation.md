# A3 — Validación final de Maintenance and Stability

Ejecución nueva: 2026-11-12, Windows x64. Estado: **regresión automatizada ejecutada; aceptación Android BlueStacks USER-REPORTED registrada; Android físico DEFERRED; revisión externa y checkpoint final PENDIENTES**. Este informe no cierra el cambio ni autoriza archive/sync/merge.

## 1. Estado real y checkpoints

- Branch: `feat/maintenance-stability`; HEAD/checkpoint manual A2: `197f4a3697bcf971cdbeb3250c7106ac9bc46e7b` (`chore: complete A2 dependency security remediation`).
- Integrated baseline: `f234faaa2955ee2ce5ed2da95bd2a69c026a482f`. ScriptsCheckpoint A1: `a793d459c841814291c1e3c0887c8bf7b77ecc10`. Documentación anterior A2: `1131ddefeac97a7f3fd88735cccf320f2600c5d2`.
- Gate A2 verificado ANTES de A3: 1.1–2.5 checked, árbol limpio,37 nodos incorporados en commit real y revisión/aceptación temporal de matriz G.15. `HEAD...@{upstream}` =0/0. Consulta nueva read-only `git ls-remote --heads origin feat/maintenance-stability` devolvió197f4a3…: push comprobado, sin fetch ni operaciones Git mutables.
- Los párrafos de tasks/design que dicen “2.5 pendiente” son snapshots históricos anteriores; checkbox2.5 y matrizG.15/commit197f son el estado posterior comprobado. No se infiere checkpoint a partir de hashes históricos.
- Árbol inicialmente limpio al comenzar regresión A3. Al iniciar esta reconciliación documental: tasks.md modificado y este informe untracked, ambos trabajo A3 preservado; HEAD sigue en197f4a3 y branch esperada. La decisión del usuario actualiza además proposal.md, design.md y delta maintenance-review-workflow existentes. En esa reconciliación no se modificaron package.json/lockfile, source ni runners. La corrección posterior de ancestry del helper se documenta en §12: modifica el helper, su runner y README; source de aplicación, specs canónicas, datos y checkpoints permanecen intactos.

## 2. Entorno, aislamiento y evidencia

Node22.18.0; npm10.9.3; PowerShell7.6.9; Git2.51.0.windows.1; Windows x64. Stack real: Expo54.0.32, React Native0.81.5, Router6.0.22, Metro0.83.3, React19.1.0, TypeScript5.9.3.

Raíz externa `$R`:

```text
C:\Users\elias\.codex\visualizations\2026\11\11\01a1cd0c-0601-72b0-b90c-2e3de09dc1bb\a3-final-20261112
```

`$P=$R/project`. Copia por allowlist de267 blobs COMMITTED de HEAD, sin .git, secretos, bases personales, backups, tokens ni perfiles. source-manifest.json registra selección. HOME/USERPROFILE/APPDATA/LOCALAPPDATA/TEMP/TMP y cache/config npm apuntan a directorios vacíos propios bajo$R; user/global npmrc vacíos, registry público, CI=1, telemetría Expo desactivada. No se instala en checkout personal. Los fixtures que escriben se ejecutan únicamente aquí.

`run.cjs` registra comando/args/cwd/duración/exit en `<label>.result.json` y stdout/stderr por label. `evidence-index.json` contiene comandos,49 suites, hashes de fixtures externos y bytecode. Sus conteos “command” no son assertion counts: audit exit1 significa hallazgos, no fallo de regresión. No sumar suites/checks/commands como si fueran una única unidad. Las rutas externas son evidencia local, no quedan versionadas: conservarlas para el reviewer y trasladar solo material permitido previa inspección.

## 3. Scripts, lockfile y reproducibilidad

Scripts aprobados: android=expo run:android; ios=expo run:ios; android:start=expo start --android; ios:start=expo start --ios. start=expo start y web=expo start --web conservados. Dependencias de package.json sin cambios. Frente a baseline integrado, package.json solo contiene esos cuatro cambios de scripts; frente a A2, package.json/lockfile idénticos.

`npm ci --no-audit --no-fund --foreground-scripts`, con user/global config vacíos/cache externa/registry público (args exactos npm-ci.result.json), exit0,798 paquetes en18.921s. Sin flags force/legacy-peer-deps/ignore-scripts y sin audit fix/update. La única entrada hasInstallScript del lock corresponde a fsevents opcional Darwin, no instalado en Windows. npm-ls exit0; Arborist loadActual:799 nodos incluida raíz, cero edges obligatorios/peers inválidos y cero incompatibilidades Node engines. Los opcionales no presentes por plataforma no equivalen a instalaciones faltantes.

SHA256:

| Archivo | HEAD = copia aislada después de npm ci | Checkout personal antes/después |
|---|---|---|
| package.json | `d2ec93a1ebef2e9186f7473b26caa161c4c1dca7e97c931c3eefeb0c3ce5d542` | `dc114766fa9db8cadb497bdc4a909ffd74dbc226384b6bcade8100509be46a9f` |
| package-lock.json | `7580f469b8b41e44903a2cfcd9bb13c102c7a724b5b7ef8014d6b6de8e55d237` | `7580f469b8b41e44903a2cfcd9bb13c102c7a724b5b7ef8014d6b6de8e55d237` |

package.json HEAD usa LF y checkout usa CRLF; hashes distintos por EOL, JSON semánticamente idéntico. npm ci conserva los bytes HEAD de ambos archivos en la copia. No atribuir el hash CRLF del checkout al manifiesto LF instalado.

Lockfile contra A1/integrated:810 entradas incluida raíz, **37 existing physical nodes cambiados, cero adiciones/remociones y cero padres fuera del cierre aprobado**; contra A2: cero cambios. Verificación total graph-evidence.json, no solo resumen textual. Los25 L1/L2 permanecen exactos;12 Babel/Browserslist adicionales exactos. baseline-browser-mapping2.11.0 y update-browserslist-db1.2.3 conservados; sin overrides/directas nuevas/migración. Diff acumulado de manifest+lock:205 inserciones/182 borrados (lock381 líneas de diff y package6); no representa381 nodos.

| Path existente | Antes de A2 | Final aprobado e instalado |
|---|---|---|
| `node_modules/@babel/core` | 7.28.6 | 7.29.6 |
| `node_modules/@babel/core/node_modules/@babel/code-frame` | 7.28.6 | 7.29.0 |
| `node_modules/@babel/generator` | 7.28.6 | 7.29.6 |
| `node_modules/@babel/helpers` | 7.28.6 | 7.29.2 |
| `node_modules/@babel/parser` | 7.28.6 | 7.29.3 |
| `node_modules/@babel/traverse` | 7.28.6 | 7.29.0 |
| `node_modules/@babel/traverse/node_modules/@babel/code-frame` | 7.28.6 | 7.29.0 |
| `node_modules/@babel/types` | 7.28.6 | 7.29.0 |
| `node_modules/@expo/xcpretty/node_modules/js-yaml` | 4.1.1 | 4.3.2 |
| `node_modules/@react-native/codegen/node_modules/brace-expansion` | 1.1.12 | 1.1.21 |
| `node_modules/@react-native/dev-middleware/node_modules/ws` | 6.2.3 | 6.2.4 |
| `node_modules/@xmldom/xmldom` | 0.8.11 | 0.8.15 |
| `node_modules/baseline-browser-mapping` | 2.9.19 | 2.11.0 |
| `node_modules/brace-expansion` | 2.0.2 | 2.1.7 |
| `node_modules/browserslist` | 4.28.1 | 4.28.7 |
| `node_modules/caniuse-lite` | 1.0.30001766 | 1.0.30001806 |
| `node_modules/compression` | 1.8.1 | 1.8.2 |
| `node_modules/electron-to-chromium` | 1.5.283 | 1.5.393 |
| `node_modules/expo/node_modules/picomatch` | 3.0.1 | 3.0.2 |
| `node_modules/expo/node_modules/ws` | 8.19.0 | 8.21.0 |
| `node_modules/glob/node_modules/brace-expansion` | 5.0.4 | 5.0.12 |
| `node_modules/js-yaml` | 3.14.2 | 3.15.2 |
| `node_modules/nanoid` | 3.3.11 | 3.3.18 |
| `node_modules/node-forge` | 1.3.3 | 1.4.3 |
| `node_modules/node-releases` | 2.0.27 | 2.0.51 |
| `node_modules/picomatch` | 2.3.1 | 2.3.2 |
| `node_modules/react-native/node_modules/brace-expansion` | 1.1.12 | 1.1.21 |
| `node_modules/react-native/node_modules/ws` | 6.2.3 | 6.2.4 |
| `node_modules/rimraf/node_modules/brace-expansion` | 1.1.12 | 1.1.21 |
| `node_modules/shell-quote` | 1.8.3 | 1.11.0 |
| `node_modules/source-map-js` | 1.2.1 | 1.2.2 |
| `node_modules/tar` | 7.5.12 | 7.5.21 |
| `node_modules/test-exclude/node_modules/brace-expansion` | 1.1.12 | 1.1.21 |
| `node_modules/tinyglobby/node_modules/picomatch` | 4.0.3 | 4.0.4 |
| `node_modules/undici` | 6.24.1 | 6.29.1 |
| `node_modules/ws` | 7.5.10 | 7.5.11 |
| `node_modules/yaml` | 2.8.2 | 2.8.3 |

## 4. Ejecuciones nuevas de regresión

Todos los siguientes comandos se ejecutaron sobre las dependencias de npm ci del lock final. cwd=$P salvo indicación. Ejecutable/args exactos, entorno y stdout/stderr: archivos por label bajo$R. Fixtures externos son sintéticos, quedan hasheados en evidence-index.json y no añaden dependencias al proyecto.

| Label/evidencia .stdout/.stderr/.result.json | Comando (rutas relativas a $P) | Exit | Resultado y unidad |
|---|---|---:|---|
| npm-ci | `npm ci --no-audit --no-fund --foreground-scripts [config/cache/registry externos: args en JSON]` | 0 | 1 instalación limpia passed;798 paquetes; 18.921s |
| typescript | `node node_modules/typescript/bin/tsc --noEmit` | 0 | 1 comando passed;0 failed; 7.734s |
| expo-config | `node node_modules/expo/bin/cli config --type public --json` | 0 | 1 comando passed;0 failed; 0.441s |
| graph | `node ../graph.cjs` | 0 | 1 comando passed;0 failed; 2.097s |
| npm-ls | `npm ls --all --json [config/cache/registry externos: args en JSON]` | 0 | 1 comando passed;0 failed; 2.475s |
| babel-transforms | `node ../babel-transforms.cjs` | 0 | 9 escenarios passed;0 failed; 1.646s |
| tooling-consumers | `node ../l1-consumers.cjs` | 0 | 7 escenarios passed;0 failed; 0.489s |
| runtime-consumers | `node ../l2-consumers.cjs` | 0 | 8 escenarios passed;0 failed; 1.364s |
| synthetic-tls | `node ../tls.cjs` | 0 | 1 escenario TLS passed;0 failed; 0.547s |
| web-export | `node node_modules/expo/bin/cli export --platform web --source-maps --output-dir ../web-dist` | 1 | Falló escritura EPERM; compiló pero NO es export exitoso; 32.214s |
| web-export-retry | `node node_modules/expo/bin/cli export --platform web --source-maps --output-dir ../web-dist-retry` | 0 | 1 export passed en destino nuevo con permisos externos; 7.934s |
| android-hermes-export | `node node_modules/expo/bin/cli export --platform android --source-maps --output-dir ../android-dist` | 0 | 1 comando passed;0 failed; 41.103s |
| browser-targets-css | `node ../browser-targets-css.cjs` | 0 | 3 comparaciones CSS passed; listas exactas; 0.17s |
| browser | `node docs/testing/mangaupdates-cover-images/section-5-browser-a3.cjs` | 0 | 31 checks passed;0 failed; Chrome157.0.8103.78; 53.728s |
| review-helper | `pwsh -NoProfile -File docs/testing/maintenance-stability/Test-ReviewBundle.ps1 -EvidenceDirectory ../helper-fixtures` | 0 | 63 checks passed;0 failed;2 escenarios enlace SKIP por permisos; 206.978s |
| final-audit | `npm audit --json [config/cache/registry externos: args en JSON]` | 1 | Hallazgos21 entradas/12 GHSA; exit1 esperado; 8.804s |
| audit-comparison | `node ../audit-compare.cjs` | 0 | 1 comando passed;0 failed; 9.061s |

Las49 suites siguientes se ejecutaron UNA vez mediante `node $R/suites.cjs`;49 passed,0 failed,0 skipped (unidad suite; sus assertions internas no se inventan). Cada fila equivale a `node <path>`, cwd=$P, exit0 y evidencia suite-NN.stdout/.stderr/.result.json. suite-manifest.json preserva lista exacta.

| Label | Runner comprometido | Exit |
|---|---|---:|
| suite-01 | `node docs/testing/expanded-media-domain/section-1-verification.cjs` | 0 |
| suite-02 | `node docs/testing/expanded-media-domain/section-2-verification.cjs` | 0 |
| suite-03 | `node docs/testing/expanded-media-domain/section-3-ui-verification.cjs` | 0 |
| suite-04 | `node docs/testing/expanded-media-domain/section-3-verification.cjs` | 0 |
| suite-05 | `node docs/testing/expanded-media-domain/section-4-verification.cjs` | 0 |
| suite-06 | `node docs/testing/expanded-media-domain/section-5-ui-verification.cjs` | 0 |
| suite-07 | `node docs/testing/expanded-media-domain/section-5-verification.cjs` | 0 |
| suite-08 | `node docs/testing/expanded-media-domain/section-6-verification.cjs` | 0 |
| suite-09 | `node docs/testing/expanded-media-domain/section-8-ui-verification.cjs` | 0 |
| suite-10 | `node docs/testing/expanded-media-domain/section-8-verification.cjs` | 0 |
| suite-11 | `node docs/testing/global-appearance-themes/section-1-verification.cjs` | 0 |
| suite-12 | `node docs/testing/global-appearance-themes/section-10-verification.cjs` | 0 |
| suite-13 | `node docs/testing/global-appearance-themes/section-11-verification.cjs` | 0 |
| suite-14 | `node docs/testing/global-appearance-themes/section-12-verification.cjs` | 0 |
| suite-15 | `node docs/testing/global-appearance-themes/section-2-verification.cjs` | 0 |
| suite-16 | `node docs/testing/global-appearance-themes/section-3-verification.cjs` | 0 |
| suite-17 | `node docs/testing/global-appearance-themes/section-4-verification.cjs` | 0 |
| suite-18 | `node docs/testing/global-appearance-themes/section-5-verification.cjs` | 0 |
| suite-19 | `node docs/testing/global-appearance-themes/section-6-verification.cjs` | 0 |
| suite-20 | `node docs/testing/global-appearance-themes/section-7-verification.cjs` | 0 |
| suite-21 | `node docs/testing/global-appearance-themes/section-8-verification.cjs` | 0 |
| suite-22 | `node docs/testing/global-appearance-themes/section-9-verification.cjs` | 0 |
| suite-23 | `node docs/testing/mangaupdates-cover-images/section-1-verification.cjs` | 0 |
| suite-24 | `node docs/testing/mangaupdates-cover-images/section-2-verification.cjs` | 0 |
| suite-25 | `node docs/testing/mangaupdates-cover-images/section-3-verification.cjs` | 0 |
| suite-26 | `node docs/testing/mangaupdates-cover-images/section-4-verification.cjs` | 0 |
| suite-27 | `node docs/testing/mangaupdates-cover-images/section-5-verification.cjs` | 0 |
| suite-28 | `node docs/testing/personal-title-rating/section-1-badge-verification.cjs` | 0 |
| suite-29 | `node docs/testing/personal-title-rating/section-1-verification.cjs` | 0 |
| suite-30 | `node docs/testing/personal-title-rating/section-2-integration-verification.cjs` | 0 |
| suite-31 | `node docs/testing/personal-title-rating/section-2-verification.cjs` | 0 |
| suite-32 | `node docs/testing/personal-title-rating/section-3-verification.cjs` | 0 |
| suite-33 | `node docs/testing/personal-title-rating/section-4-verification.cjs` | 0 |
| suite-34 | `node docs/testing/personal-title-rating/section-5-verification.cjs` | 0 |
| suite-35 | `node docs/testing/personal-title-rating/section-6-verification.cjs` | 0 |
| suite-36 | `node docs/testing/provider-abstraction/section-2-tmdb-mapping-verification.cjs` | 0 |
| suite-37 | `node docs/testing/provider-abstraction/section-3-buscar-verification.cjs` | 0 |
| suite-38 | `node docs/testing/provider-abstraction/section-4-materialization-save-verification.cjs` | 0 |
| suite-39 | `node docs/testing/provider-abstraction/section-5-detail-verification.cjs` | 0 |
| suite-40 | `node docs/testing/tmdb-user-credential/section-1-verification.cjs` | 0 |
| suite-41 | `node docs/testing/tmdb-user-credential/section-2-verification.cjs` | 0 |
| suite-42 | `node docs/testing/tmdb-user-credential/section-3-verification.cjs` | 0 |
| suite-43 | `node docs/testing/tmdb-user-credential/section-4-verification.cjs` | 0 |
| suite-44 | `node docs/testing/tmdb-user-credential/section-5-verification.cjs` | 0 |
| suite-45 | `node docs/testing/universal-media-identity/section-1-verification.cjs` | 0 |
| suite-46 | `node docs/testing/universal-media-identity/section-2-sqlite-v4-verification.cjs` | 0 |
| suite-47 | `node docs/testing/universal-media-identity/section-3-persistence-verification.cjs` | 0 |
| suite-48 | `node docs/testing/universal-media-identity/section-4-backup-v5-verification.cjs` | 0 |
| suite-49 | `node docs/testing/universal-media-identity/section-5-runtime-consumers-verification.cjs` | 0 |

Cobertura comprobada: migración SQLitev5 con rollback, backupsv1–v6 históricos, round-tripv6, merge/duplicados/identidades/provider refs/pins y conservación ante errores de referencia/savepoint/pin/commit/Appearance (expanded-media-domain/section-2); DBs reales sintéticas con editor/snapshots y restorev6 (section-5); runtime gates/taxonomía/search/discovery, TMDB mapping/detail/save, credencial sin secretos reales y fallos de estado/rating. Suites identity/backupv5 conservan regresión histórica; no cambian schema5 ni format6. Node sqlite experimental warnings no implican aceptación de SQLite Android.

Consumidores: shell-quote con comentario/newline rechazado; tar Unicode; compression/Undici HTTP+headers y TLS con CA sintética sin desactivar verificación; cuatro branches ws con echo loopback. XML y ambos consumidores plist; YAML3/4/yaml2; Forge mediante consumidores Expo certificate/sign/CSR (claves sintéticas solo memoria); todos los majors brace/picomatch; source-map-js. nanoid secure/nonsecure:1000 IDs únicos y tamaños0/-1/1025, IDs de StackRouter, query decoding y memory history Router con window simulado. Esto es regresión acotada y no prueba Android/Hermes real en dispositivo.

Babel: preset Expo real TSX/JSX/Flow para web y android/hermes; source-map de identificador a fuente, composición inline/externa permitida y rechazo de lectura de mapa sintético fuera del paquete.9 escenarios passed. Android export produjo bytecode Hermes magic c61fbc03c103191f/version96; SHA256 `25dc637922b1b997cd9c02230ff12ac973660f1eb38879eac6b0539a24212fa8`, source map incluido. No es un APK.

Helper:63 checks passed;20 invocaciones en repos externos desechables. Incluye baseline/layers/cancelaciones/untracked/rename/delete/binarios reconstruidos/Unicode/secretos históricos, copia de sensible TRACKED SIN cambios, policiespackage, snapshot concurrente e invariantes HEAD/index/bytes. Dos creaciones de enlaces filesystem input/output omitidas por AccessDenied; índice symlink sí comprobado. No se debilitaron protecciones. Identity filtering no detecta necesariamente copias modificadas ni secretos originalmente ignored/untracked; exclusiones declaradas y revisión humana del bundle siguen necesarias. La ruta Complete positiva no se fabrica en fixtures: requiere baseline real f234faa y checkpoint de incorporación; generación real queda para revisión humana (§13). No se ejecutó helper contra el checkout personal.

Excluidos deliberadamente: runner live de MangaUpdates (no necesario: contratos deterministas), utility controlled-sqlite-failure.cjs (importada por suites, no runner), ejecución separada del browser original reemplazada únicamente en copia externa por driver A3. Ningún runner del repositorio fue editado para pasar tests.

## 5. Web/Browserslist y navegador real

Chrome headless157.0.8103.78, CDP real, profile NUEVO propio fuera del checkout, dos Metros localhost propios (producción/review).31 checks: tab/grid/detail, Router push real a Acerca de, back/forward, SQLite Web WASM/worker/OPFS y nota/estado del editor conservados después de Page.reload. Producción antes/después vacía y review con20 fixtures separadas; cero excepciones browser, cero errores console inesperados, cero requests/intentos de activación MangaUpdates. Procesos propios cerrados; network/console/result JSON bajo browser-evidence.

Driver externo section-5-browser-a3.cjs conserva assertions del runner versionado y extensiones A2 de historial/reload; adapta transporte al endpoint del Chrome iniciado por Start-Process -WindowStyle Hidden con --user-data-dir nuevo, sin perfil del usuario. Espera hidratación del mismo control único antes del click. No modifica código ni runner real. Chrome no acredita Safari/Firefox/Edge/iOS/Android ni smoke humano. Provider requests live no ejecutados.

Web export inicial exit1 por EPERM al crear _expo/static; retry aislado en web-dist-retry exit0 con permisos adecuados, mismos source/lock. No se alteró implementación para resolverlo.

Targets defaults actuales coinciden EXACTAMENTE con G.12.3:34 históricos →31 actuales;24 retirados,21 añadidos,10 sin cambio. La lista anterior viene de evidencia aprobada, no de instalar nuevamente una dependencia vieja en A3. Se recalculó lista actual y tres transformaciones LightningCSS con arrays anteriores/actuales: global.css, layout y modern syntax sin diferencias de salida; source maps presentes. findConfig devuelve nada y package.json no declara browser policy/query aparte. No convertir retirada de versión de defaults en pérdida funcional probada.

| Lista | Valores |
|---|---|
| Histórica aprobada | and_chr 144; and_ff 147; and_qq 14.9; and_uc 15.5; android 144; chrome 144; chrome 143; chrome 142; chrome 141; chrome 139; chrome 126; chrome 125; chrome 112; chrome 109; edge 144; edge 143; edge 142; firefox 147; firefox 146; firefox 145; firefox 140; ios_saf 26.2; ios_saf 26.1; ios_saf 18.5-18.7; kaios 3.0-3.1; kaios 2.5; op_mini all; op_mob 80; opera 125; opera 124; safari 26.2; safari 26.1; samsung 29; samsung 28 |
| Actual recalculada | and_chr 150; and_ff 152; and_qq 14.9; and_uc 15.5; android 150; chrome 150; chrome 149; chrome 148; chrome 118; chrome 109; edge 150; edge 149; edge 148; firefox 152; firefox 151; firefox 140; ios_saf 26.5; ios_saf 26.4; ios_saf 26.3; ios_saf 18.5-18.7; kaios 3.0-3.1; kaios 2.5; op_mini all; op_mob 80; opera 131; opera 127; safari 26.5; safari 26.4; safari 26.3; samsung 30; samsung 29 |
| Retiradas defaults | and_chr 144; and_ff 147; android 144; chrome 144; chrome 143; chrome 142; chrome 141; chrome 139; chrome 126; chrome 125; chrome 112; edge 144; edge 143; edge 142; firefox 147; firefox 146; firefox 145; ios_saf 26.2; ios_saf 26.1; opera 125; opera 124; safari 26.2; safari 26.1; samsung 28 |
| Añadidas defaults | and_chr 150; and_ff 152; android 150; chrome 150; chrome 149; chrome 148; chrome 118; edge 150; edge 149; edge 148; firefox 152; firefox 151; ios_saf 26.5; ios_saf 26.4; ios_saf 26.3; opera 131; opera 127; safari 26.5; safari 26.4; safari 26.3; samsung 30 |
| Sin cambio | and_qq 14.9; and_uc 15.5; chrome 109; firefox 140; ios_saf 18.5-18.7; kaios 3.0-3.1; kaios 2.5; op_mini all; op_mob 80; samsung 29 |

## 6. Android build y límites físicos

**APK/Gradle: PASS, exit0,339.394s (5m39s);183 actionable tasks ejecutadas.**

Copia nativa externa corta: C:/Users/elias/AppData/Local/Temp/dlv-a3-native-20261112, mismos source públicos/lock/node_modules instalados. Java Microsoft OpenJDK17.0.20, SDK existente Android36, build-tools36.0.0, NDK27.1.12297006, CMake3.22.1; Gradle wrapper8.14.3. HOME/perfiles/GRADLE_USER_HOME/ANDROID_USER_HOME propios; SDK download desactivado; sin instalar herramientas ni tocar perfiles/caches personales.

Prebuild: `node node_modules/expo/bin/cli prebuild --platform android --no-install --skip-dependency-update <lista completa de dependencies de package.json>`, exit0 (19.421s), manifiesto/lock idénticos. Lista exacta de flags en native-prebuild.result.json. Generación únicamente externa, no se trae android/ a repo.

Build: `android/gradlew.bat :app:assembleDebug --no-daemon --console=plain -Pandroid.builder.sdkDownload=false -PreactNativeArchitectures=arm64-v8a`. stdout/stderr/result en native-gradle.*; no expo run:android, adb install ni consulta de dispositivos. APK generado: `C:/Users/elias/AppData/Local/Temp/dlv-a3-native-20261112/android/app/build/outputs/apk/debug/app-debug.apk`,46,658,452 bytes; SHA256 `40045c3262a5fe8a880b2f35305c8c189590def3a8b21ccc16a0a4041a63234f`. `aapt2 dump badging` exit0: com.zekito.despueslaveo1.0.0, minSDK24/target36, debuggable, arm64-v8a, MainActivity. APK debug requiere Metro para JS; no es release offline ni distribución aprobada. Prebuild/build no cambiaron manifiesto ni lock. No se presume dispositivo conectado y no se ejecutó adb.

Warnings de tooling: SDK XMLv4 leído por parser que entiendev3; APIs Kotlin/Java/Gradle deprecadas (Gradle9 no validado); NODE_ENV no definido en assembleDebug, Expo usa búsqueda .env.local/.env SOLO en copia sin esos archivos. Build terminó exitoso, no se instaló/actualizó SDK para ocultar warnings.

Manifest principal y merged MainActivity solo declaran intent-filter MAIN/LAUNCHER; no VIEW/BROWSABLE/custom scheme registrado. `<queries>`https es visibilidad de intents salientes y NO registro de deep link entrante. No afirmar que se puede abrir cualquier scheme. Checklist debe registrar deep-link externo NOT APPLICABLE para este APK actual y verificar rutas/parámetros dentro de navegación/Web; si un build de aceptación distinto registra scheme, probarlo sin cambiar configuración en A3. Ausencia actual no demuestra decoder universalmente inalcanzable.

**Aceptación Android de este hito: SATISFECHA bajo excepción explícita del usuario 2026-11-12;3.2 checked.** El usuario reporta9/9 checks manuales en BlueStacks 5 Android emulator, con este APK debug previamente instalado por él y conectado a Metro aislado. Es evidencia USER-REPORTED, no ejecución automatizada ni verificación independiente del agente. Build Gradle, export Android/Hermes y regresión conservan su evidencia ejecutada original.

**Android físico: DEFERRED** por decisión explícita hasta completar las funcionalidades restantes. La regla original lo exigía por impacto runtime de nanoid y Babel/Metro; el usuario la sustituye SOLO como gate de este hito, basándose en build/automatización más aceptación BlueStacks. No acredita teléfono físico ni release readiness. Sigue siendo seguimiento obligatorio antes de afirmar aceptación real-device/release, y no habilita omitir pruebas físicas de futuras features. iOS/macOS/Xcode: NOT EXECUTED; smoke Web humano: NOT EXECUTED.31 checks Chrome automatizados siguen siendo evidencia válida automatizada, no humana. No se inventan dispositivo, Android/API de BlueStacks, screenshots, logs ni subcasos no reportados.

## 7. Audit actual, comparación histórica y aceptación limitada

Audit nuevo registry público contra lock exacto final: exit1 por hallazgos, sin error de red. Tabla por entradas afectadas, NO exploits independientes:

| Snapshot | Critical | High | Moderate | Low | Total | GHSA distintos |
|---|---:|---:|---:|---:|---:|---:|
| original (histórico) | 2 | 17 | 16 | 2 | 37 | 100 |
| l1l2 (histórico) | 0 | 7 | 14 | 2 | 23 | 15 |
| babel (histórico) | 0 | 7 | 14 | 1 | 22 | 14 |
| expanded (histórico) | 0 | 6 | 14 | 1 | 21 | 12 |
| a3 (NUEVA ejecución) | 0 | 6 | 14 | 1 | 21 | 12 |

Contra expandedA2: **cero GHSA nuevos, cero removidos y cero cambios de título/severidad/rango/CVSS/CWE**. Se contrastaron12 advisories oficiales GitHub API y metadata npm de13 paquetes/padres actuales; official-advisories.json/residual-metadata.json registran URLs/updated_at/patches/constraints. Comparación completa en audit-comparison.json.

Contra original,88/100 GHSA dejan de aplicar; contraL1/L2 se resuelven GHSA-4x5r-pxfx-6jf8 (Babel), GHSA-c83g-rgw3-j3cx y GHSA-73wf-gq98-2v4g (Browserslist). Esto no son88 exploits demostrados. Todos los advisories eliminados se enumeran en matrizG.11/G.14 y audit-comparison.json (100 objetos originales); no se recicla forecast como resultado real.

La aceptación del usuario G.15 es TEMPORAL/CONDICIONAL de los12 siguientes y permite avanzar A3; no constituye proyecto libre de vulnerabilidades ni aceptación automática de riesgos nuevos/materialmente distintos. Esta ejecución no amplía ni inventa aceptación. Sin nuevos/cambios no se reabre el mismo gate; si aparecen posteriormente, detener esa vía y pedir decisión específica.

| GHSA oficial | Paquete | Severidad npm | Rango vulnerable | Primer parche oficial |
|---|---|---|---|---|
| [GHSA-3g3m-2fjr-6pw4](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4) | glob | moderate | `>=9.0.0 <=14.0.1` | 14.0.2 |
| [GHSA-5p2g-fcmc-qvqq](https://github.com/advisories/GHSA-5p2g-fcmc-qvqq) | image-size | high | `>=1.2.0 <=2.0.2` | 2.0.3 |
| [GHSA-6g55-p6wh-862q](https://github.com/advisories/GHSA-6g55-p6wh-862q) | postcss | high | `<=8.5.11` | 8.5.12 |
| [GHSA-fxqj-rqcc-2cmp](https://github.com/advisories/GHSA-fxqj-rqcc-2cmp) | postcss | moderate | `<=8.5.22` | 8.5.23 |
| [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249) | minimatch | moderate | `>=7.0.0 <11.0.1` | 11.0.1 |
| [GHSA-gcqx-w48m-w2h4](https://github.com/advisories/GHSA-gcqx-w48m-w2h4) | deepmerge | low | `>=4.2.0 <=4.3.1` | NINGUNO |
| [GHSA-qr28-fpjm-wq7f](https://github.com/advisories/GHSA-qr28-fpjm-wq7f) | decode-uri-component | high | `<=0.5.0` | 0.5.1 |
| [GHSA-qx2v-qp2m-jg93](https://github.com/advisories/GHSA-qx2v-qp2m-jg93) | postcss | moderate | `<8.5.10` | 8.5.10 |
| [GHSA-r28c-9q8g-f849](https://github.com/advisories/GHSA-r28c-9q8g-f849) | postcss | high | `<=8.5.17` | 8.5.18 |
| [GHSA-vcc3-ghjq-m6fr](https://github.com/advisories/GHSA-vcc3-ghjq-m6fr) | decode-uri-component | moderate | `<=0.4.2` | 0.5.0 |
| [GHSA-w3rx-r6r6-pgpr](https://github.com/advisories/GHSA-w3rx-r6r6-pgpr) | image-size | high | `>=0.6.3 <=2.0.2` | 2.0.3 |
| [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq) | uuid | moderate | `<11.1.1` | 12.0.1; 13.0.1; 11.1.1 |

21 entradas =7 paquetes con advisories propios +14 propagaciones. Expo y Router son directas agregadas, las7 hojas son transitivas. Todas las hojas tienen dev=false en lock; eso NO convierte build tooling en runtime.

| Entrada audit | Severidad agregada | Directa | Via (GHSA o propagación) |
|---|---|---|---|
| @expo/cli | moderate | no | @expo/config, @expo/config-plugins, @expo/metro-config, @expo/prebuild-config, glob, minimatch |
| @expo/config | moderate | no | @expo/config-plugins, deepmerge, glob |
| @expo/config-plugins | moderate | no | glob, xcode |
| @expo/fingerprint | moderate | no | glob, minimatch |
| @expo/metro-config | moderate | no | @expo/config, glob, minimatch, postcss |
| @expo/prebuild-config | moderate | no | @expo/config, @expo/config-plugins |
| @react-navigation/core | high | no | query-string |
| decode-uri-component | high | no | GHSA-vcc3-ghjq-m6fr, GHSA-qr28-fpjm-wq7f |
| deepmerge | low | no | GHSA-gcqx-w48m-w2h4 |
| expo | moderate | sí | @expo/cli, @expo/config, @expo/config-plugins, @expo/fingerprint, @expo/metro-config, expo-asset, expo-constants |
| expo-asset | moderate | no | expo-constants |
| expo-constants | moderate | no | @expo/config |
| expo-linking | moderate | no | expo-constants |
| expo-router | high | sí | expo-constants, expo-linking, query-string |
| glob | moderate | no | GHSA-3g3m-2fjr-6pw4, minimatch |
| image-size | high | no | GHSA-5p2g-fcmc-qvqq, GHSA-w3rx-r6r6-pgpr |
| minimatch | moderate | no | GHSA-g3hv-75wg-m249 |
| postcss | high | no | GHSA-qx2v-qp2m-jg93, GHSA-6g55-p6wh-862q, GHSA-fxqj-rqcc-2cmp, GHSA-r28c-9q8g-f849 |
| query-string | high | no | decode-uri-component |
| uuid | moderate | no | GHSA-w5hq-g745-h8pq |
| xcode | moderate | no | uuid |

## 8. Paths, exposición, fixes y mitigaciones residuales

Paths reales y rangos de TODOS los padres inmediatos: graph-evidence.json/residualPaths. Resumen:

| Dependencia instalada y ruta desde raíz | Exposición/impacto | Fix y bloqueo compatible / alternativa |
|---|---|---|
| expo-router6.0.22 / @react-navigation/core → query-string7.1.3 → decode-uri-component0.2.2 | Potencial DoS al decodificar URLs/query no confiables. No explotar con payloads grandes. | Ambos GHSA requieren0.5.1; query-string7 exige^0.2.2. Router6.0.24 aún query-string^7.1.3. Override no aprobado;0.5.1 ESM vs consumidor CJS cambia contrato. |
| expo → @expo/config12.0.13 → deepmerge4.3.1 (^4.3.1) | Poisoning de objetos mergeados de configuración, no entrada app adversaria demostrada. | Oficial sin parche; latest4.3.1. Config confiable reduce exposición, no corrige advisory. |
| expo/config/plugins/fingerprint/metro-config/CLI → glob13.0.0 (^13.0.0) | Traversal tras cancelación en tooling; no uso runtime demostrado. | Parche14.0.2 fuera^13;13.0.7 sigue afectado. Major/override diferidos. |
| expo/Metro → image-size1.2.1 (^1.0.2) | DoS parsers de assets ICNS/JXL/HEIF durante build; no procesamiento remoto de artwork demostrado. | Ambos parches2.0.3 fuera^1.0.2. Latest2.1.0 no autorizado; wrapper Metro permanece0.83.3. |
| glob13 → minimatch10.2.4 (^10.1.1); Expo fingerprint/metro-config/CLI → minimatch9.0.9 (^9.0.0) | Amplificación de patrones en tooling. | Fix11.0.1 fuera9/10;10.2.6 también afectado. No sustituir majors forzados. |
| expo → @expo/metro-config54.0.14 → postcss8.4.49 (~8.4.32) | CSS/sourceMappingURL no confiables: lectura de archivos/XSS según advisory/consumidor. | Fix completo8.5.23 (latest8.5.32) fuera~8.4.32; config54.0.17 aún exige mismo rango. Control de CSS/mapas confiables no es parche. |
| expo → @expo/config-plugins54.0.4 → xcode3.0.1 → uuid7.0.3 (^7.0.3) | APIs buffers v3/v5/v6 en config iOS; camino adversario no demostrado, no ID runtime nanoid. | Fix11.1.1 fuera^7.0.3. Parent config-plugins54.0.6/xcode4 elimina uuid pero cambia plist/json-file y exige evaluación nativa/macOS; explícitamente diferido. |

Decoder: evidencia A2 limitada conserva observación del fork Router getStateFromPath → parseQueryParams → URL.searchParams y seis inputs cortos con cero llamadas instrumentadas al decoder; **no es una nueva prueba A3 de inalcanzabilidad**. Upstream React Navigation todavía query-string.parse. A3 verifica query decoding/Router y navegador con entradas sintéticas normales, sin explotar DoS. No hay customscheme/intentfilters declarados en app.json, pero Expo puede generar schemes; verificar deep links reales del build/dispositivo. Host/scheme allowlist y límites de entrada son opciones de mitigación que requerirían diseño/aprobación; no se implementaron.

No hay arreglo completo probado dentro de los rangos actuales de estas hojas. Semver/metadata no demuestra compatibilidad runtime. Config-plugins/xcode/plist/json-file nativos, decoder override, sustituciones forzadas glob/minimatch/PostCSS/image-size/deepmerge y Expo/RN/Router mayores permanecen FUERA del scope autorizado. No se aplicó ningún update en A3.

## 9. Fallos, limitaciones y blockers

- Export Web inicial EPERM: corregido repitiendo en nuevo destino externo con permisos; no regresión funcional reproducida.
- Helper: dos escenarios filesystem-links SKIP por permisos, no “passed”; otras protecciones y symlink de índice sí ejecutadas.
- APK/Gradle arm64 debug pasó (§6); release/otras ABI y ejecución física no efectuadas.
- No regresión bloqueante confirmada en los checks automatizados terminados y ninguna regresión nueva reportada por el usuario en sus nueve checks BlueStacks. No se infiere compatibilidad universal/física; un fallo material posterior exige investigación/revalidación.
- Android físico DEFERRED; Web manual e iOS NOT EXECUTED. El usuario reporta instalación previa del APK y conexión a Metro en BlueStacks; el agente no instaló ni accedió a un dispositivo. Provider tests automatizados siguen siendo deterministas; el alcance manual TMDB/provider es solo el reportado por el usuario, sin inventar requests/logs/credenciales. MangaUpdates artwork sin activar/solicitar.

## 10. Decisión y evidencia manual del usuario (2026-11-12)

Plataforma: **BlueStacks 5 Android emulator**. Resultado **9/9 PASS, USER-REPORTED** en el mensaje de aceptación del usuario, usando APK A3 SHA256 `40045c3262a5fe8a880b2f35305c8c189590def3a8b21ccc16a0a4041a63234f`, previamente instalado por él y conectado a la instancia Metro aislada. Fecha de aceptación:2026-11-12. No se aportan ni inventan screenshots/logs individuales, modelo de teléfono o versión Android/API; este registro conserva el alcance exacto reportado y no afirma ejecución independiente del agente.

| # | Check reportado por el usuario | Resultado y procedencia |
|---:|---|---|
| 1 | Application startup. | PASS — USER-REPORTED |
| 2 | Tabs, stack navigation y Back. | PASS — USER-REPORTED |
| 3 | Guardar múltiples entradas de media y comportamiento de IDs. | PASS — USER-REPORTED |
| 4 | Editar y borrar entradas. | PASS — USER-REPORTED |
| 5 | Persistencia SQLite después de cerrar/reabrir. | PASS — USER-REPORTED |
| 6 | Backup v6 export/import. | PASS — USER-REPORTED |
| 7 | Compatibilidad de backups históricos. | PASS — USER-REPORTED |
| 8 | Flujos existentes TMDB/providers. | PASS — USER-REPORTED |
| 9 | Manejo de errores y recuperación. | PASS — USER-REPORTED |

El usuario no reporta regresiones nuevas. Los subcasos más detallados del checklist preparatorio previo (p.ej. cada variante de parámetros/Unicode, ratings/tags o fallo inyectado) no se convierten automáticamente en checks manuales pasados: solo estos nueve ámbitos fueron confirmados. Se conserva la evidencia automatizada original, incluida la que cubre fixtures/fallos, con su procedencia propia.

**Decisión de aceptación:** Decisión explícita del usuario del 2026-11-12: para ESTE hito de mantenimiento, build Gradle APK y export Android/Hermes exitosos, regresión automatizada satisfactoria y aceptación manual BlueStacks 5 reportada por el usuario (9/9) satisfacen A3.2, con prueba en teléfono Android físico DEFERRED hasta completar las funcionalidades restantes. La excepción sustituye el gate físico de este hito, no acredita compatibilidad física ni readiness de release y no se extiende a otras features. La validación física sigue siendo seguimiento obligatorio antes de afirmar aceptación real-device/release. Build Gradle, export Hermes y checks automatizados satisfactorios más9/9 BlueStacks y deferral explícito permiten marcar3.2 bajo design §6.2.1/delta; no constituyen cierre antes de revisión3.4 y checkpoint3.5.

| Validación fuera de los nueve checks | Estado y límite |
|---|---|
| Teléfono Android físico | **DEFERRED** hasta completar funcionalidades; seguimiento obligatorio antes de afirmar real-device/release. Modelo/fecha futuros no informados. |
| iOS | **NOT EXECUTED**; no aceptación iOS inferida. |
| Deep links externos entrantes | **NOT APPLICABLE** para este APK: manifest MainActivity sin filtro VIEW/BROWSABLE/scheme entrante (§6). No es test pasado ni prueba de decoder universalmente inalcanzable. |
| Smoke Web manual | **NOT EXECUTED**; no evidencia humana independiente.31 checks Chrome automatizados conservan valor y límites (§5), sin atribuir otros motores ni soporte universal. |

La excepción resuelve el gate Android de este hito y deja sus límites trazados; Web manual no se registra como pasado ni se inventa como ejecución adicional. Se mantienen verificaciones automatizadas Web y soporte defaults aprobado G.12.3. Cualquier fallo material, requisito de soporte nuevo o advisory nuevo/materialmente cambiado requiere investigación y decisión aplicable, no aceptación automática. Revisión externa y checkpoint final permanecen pendientes; no se ejecutan aquí.

## 11. Protecciones personales y archivos

Primera ejecución A3: solo este informe nuevo y tasks.md. Reconciliación de aceptación 2026-11-12: también proposal.md, design.md y specs/maintenance-review-workflow/spec.md del cambio existente; cinco documentos en esa etapa. La corrección posterior modifica scripts/New-ReviewBundle.ps1, docs/testing/maintenance-stability/Test-ReviewBundle.ps1 y README.md, además de actualizar este informe existente. Source de aplicación/manifest/lock/schema/format permanecen; hashes§3. No staging/commit/push/fetch/reset/stash/rebase/clean/archive/sync/merge. HEAD e índice real intactos. Solo fixtures desechables del helper crean sus propios repos e índices.

No se copiaron ni leyeron DBs/backups secretos, credenciales/tokens/perfiles personales. Copia allowlist de blobs deHEAD públicos; fixtures sintéticos; cache y perfiles nuevos externos. Java/SDK/Chrome existentes se usan como tooling, sin leer contenido de perfiles ni conectar dispositivos. Logs/bundles fuera del repo. Antes de compartir evidencia inspeccionar que solo contiene datos sintéticos/paths de tooling; no adjuntar carpetas enteras de caches/perfiles/node_modules.

## 12. Validación OpenSpec y tareas

`openspec validate improve-dependency-security-and-review-workflow --strict`: exit0,2.474s, “Change ... is valid”; evidencia openspec.stdout/.stderr/.result.json. Validación final posterior: openspec-final.result.json/stdout, exit0. Whitespace: `git -c core.autocrlf=false diff --check` exit0. Informe nuevo: `git -c core.autocrlf=false diff --no-index --check -- /dev/null docs/testing/maintenance-stability/final-validation.md` exit1 por diferencia de archivo nuevo (semántica --no-index), stdout/stderr vacíos y cero diagnósticos de whitespace; no atribuirle exit0. Scan adicional de ambos archivos para whitespace final, conflicto y newline exit0,2 archivos clean. Evidencia whitespace.result.json/whitespace.cjs. core.autocrlf se sobreescribe SOLO por invocación, sin configurar Git ni modificar índice.

Reconciliación documental de aceptación (2026-11-12): `openspec validate improve-dependency-security-and-review-workflow --strict` exit0 y `git diff --check` exit0; comprobación de consistencia de cinco archivos y conteo13/15, sin cambios inesperados. Informe untracked verificado por scan de whitespace/conflictos/newline; no se omite por no estar en el índice. Los hashes de package.json/lockfile §3 permanecen idénticos. No se reejecutan regresión ni audit por este cambio documental; sus resultados anteriores conservan fecha y procedencia.

Trazabilidad: inicio A3=10/15; tras automatización=12/15 (3.1/3.3 completas,3.2 física pendiente bajo regla original). Tras decisión del usuario y contrato revisado2026-11-12: **13/15**,3.1/3.2/3.3 checked;3.2 por excepción BlueStacks, NO por test físico.3.4 revisión y3.5 checkpoint permanecen unchecked. Android físico DEFERRED para aceptación real-device/release futura. A1/A2, audit21 entradas/12 GHSA/0 críticas y aceptación residual temporal/condicional se conservan; sin nuevas aprobaciones de dependencias. Esta actualización solo valida documentos: no se repite regresión ni audit ni se presenta evidencia anterior como ejecución nueva.

### Corrección posterior del helper — baseline A3 y checkpoint A1

El usuario reportó fallo de su Section A3 durante Incorporated checkpoint validation. Causa confirmada en código y Git: exigía baseline→ScriptsCheckpoint (A3→A1 exit1), cuando A1→A3 exit0. Se corrige Section para aceptar cualquiera de esas direcciones sobre la misma cadena, exigiendo ambos refs ancestros de HEAD y rechazando siblings divergentes aun reunidos por merge. Checkpoint no-merge con incorporación exacta y efectiva, scripts aprobados conservados en HEAD/índice/working tree y Complete con hash integrado fijo/cero exclusiones permanecen obligatorios. No cambian filtros personales, identidad protegida, binarios ni snapshots.

Resultado nuevo2026-11-12: exit0, **112 checks passed,0 failed;2 escenarios SKIP** por permisos al crear enlaces filesystem input/output. **41 invocaciones** del helper en fixtures externos. El symlink del índice, binarios reconstruidos, Unicode, capas/cancelaciones, secretos (incluida fuente tracked sin cambios), políticas package, divergencias y snapshot concurrente pasaron. PowerShell7.6.9/Git2.51.0.windows.1; parser de ambos scripts sin errores, OpenSpec strict y git diff --check exit0. TypeScript externo sobre la copia A3 con lock aprobado, sin instalaciones, exit0. Ninguna suite de aplicación costosa se repitió ni se modificaron dependencias.

Evidencia: `C:/Users/elias/.codex/visualizations/2026/11/11/01a1cd0c-0601-72b0-b90c-2e3de09dc1bb/review-ancestry-20261112-01` (result.json y41 logs). Comando real desde raíz:

```powershell
pwsh -NoProfile -File docs/testing/maintenance-stability/Test-ReviewBundle.ps1 -EvidenceDirectory C:/Users/elias/.codex/visualizations/2026/11/11/01a1cd0c-0601-72b0-b90c-2e3de09dc1bb/review-ancestry-20261112-01
```

No se generaron bundles del proyecto real. Complete positivo usa exclusivamente el literal sintético de la copia externa documentada; no se afirma un Complete/A3 real exitoso. Se preservan riesgos de copias modificadas/secretos ignored-untracked, exclusiones declaradas e inspección manual.3.4/3.5 permanecen unchecked; sin staging/commit/push/archive/merge.

El diff de esta corrección debe entrar en AMBAS coberturas de revisión3.4; este reporte no resuelve ni marca revisiones o checkpoint. Los resultados originales de automatización/audit y aceptación BlueStacks se conservan con su procedencia.

## 13. Revisión externa final y archivo separado

**Aceptación Android de este hito satisfecha por excepción documentada; listo para presentar a revisión externa, NO para cierre/checkpoint/archive sin3.4/3.5.** Android físico queda DEFERRED para aceptación real-device/release futura y no se convierte en prueba pasada. Se conservan límites iOS/Web manual. La siguiente etapa es UN evento externo con DOS boundaries reales; no usar A3-only como sustituto de feature completo. Desde checkout real, directorios externos NUEVOS, helper probado:

```powershell
Set-Location -LiteralPath 'D:\dev\despues-la-veo'
$helper = 'D:\dev\despues-la-veo\scripts\New-ReviewBundle.ps1'
$a3Output = Join-Path $env:TEMP ('dlv-A3-review-' + [guid]::NewGuid().ToString('N'))
& $helper -Baseline '197f4a3697bcf971cdbeb3250c7106ac9bc46e7b' -OutputDirectory $a3Output -Boundary Section -PackageJsonPolicy Incorporated -ScriptsCheckpoint 'a793d459c841814291c1e3c0887c8bf7b77ecc10'
$completeOutput = Join-Path $env:TEMP ('dlv-complete-review-' + [guid]::NewGuid().ToString('N'))
& $helper -Baseline 'f234faaa2955ee2ce5ed2da95bd2a69c026a482f' -OutputDirectory $completeOutput -Boundary Complete -PackageJsonPolicy Incorporated -ScriptsCheckpoint 'a793d459c841814291c1e3c0887c8bf7b77ecc10'
```

Agregar -ExcludePath solo para rutas personales explícitas, nunca excluir silenciosamente manifest/lock/cambios aprobados. Revisar manifest sanitizado (capas/exclusiones/partial), net.patch binario del resultado tracked FINAL y untracked/ real permitido. Debe incluir completo: A1package/scripts, lock37nodos y todos los nuevos archivos permitidos; net.patch no es historia de capas. Inspección manual antes de enviar; helper no ejecuta tests ni Git mutaciones. No se generaron estos bundles contra datos personales durante A3.

3.4 registra revisión/aprobación de AMBAS coberturas, findings y baselines.3.5 corrige/revalida lo pertinente, actualiza bundles afectados y vuelve al mismo ciclo externo hasta aprobación explícita; UN único checkpoint final commit/push MANUAL del usuario, no checkpoint A3 intermedio. Solo después, solicitar archive/sync como acción SEPARADA, revisar externamente su diff real y checkpoint manual archive; integración a main únicamente por acción posterior explícita. Nada de esto ejecutado aquí.

## 14. Revisión externa final A3

Fecha: 2026-11-12.

Revisión externa conjunta A3 Section y Complete: APPROVED.

Baselines:
- A3: 197f4a3697bcf971cdbeb3250c7106ac9bc46e7b
- Complete: f234faaa2955ee2ce5ed2da95bd2a69c026a482f

Se revisaron los diffs reales del helper, sus pruebas,
scripts, 37 nodos actualizados, OpenSpec y documentación.

No se identificaron bloqueantes en los artefactos revisados.

La aceptación funcional BlueStacks 5 es USER-REPORTED.
Android físico permanece DEFERRED; iOS y Web manual
permanecen NOT EXECUTED.

Se conserva la aceptación temporal condicionada
de los 12 GHSA residuales.

A3.4 aprobada. A3.5 se completa mediante el
checkpoint final commit/push manual del usuario.