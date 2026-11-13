## Context

Ver proposal.md para motivación. Baseline integrado f234faaa2955ee2ce5ed2da95bd2a69c026a482f; rama observada feat/maintenance-stability. Solo package.json estaba modificado: android/ios pasaron de expo start --android/--ios a expo run:android/run:ios. Sin staged ni untracked previos. Expo 54.0.32, RN 0.81.5, Router 6.0.22, React 19.1.0; lockfile v3. Windows, PowerShell 7.6.9, Node 22.18.0 y npm 10.9.3 fueron observados en Explore. El inventario inicial 37 es evidencia fechada, no promesa del resultado futuro.

Estado al ampliar la especificación (2026-11-12): HEAD1131ddefeac97a7f3fd88735cccf320f2600c5d2, ScriptsCheckpoint A1 a793d459c841814291c1e3c0887c8bf7b77ecc10. A1 completa; L1+L2 aplicados/validados en25 nodos, sin checkpoint A2; audit23 entradas/15 GHSA/0 críticas. Los criterios §6.1 reabrieron2.2–2.4 sin revocar aprobación/evidencia L1/L2. Estado posterior APPLY: G.13 registra aprobación adicional y G.14 su validación;37 nodos totales, audit21 entradas/12 GHSA/0 críticas,2.2–2.4 completas. HEAD/branch no cambiaron;2.5 y A3 siguen pendientes. El contexto original de Explore y los snapshots previos no describen como actuales los estados de ejecución posteriores.

Se revisaron catálogo canónico, provider-neutral-media-review, library-backup-integrity, second-provider-discovery, configuración OpenSpec y propuesta/diseño/tasks archivados de enable-mangaupdates-cover-images. La revisión sintética de media no es revisión de Git; se introduce una sola capacidad de desarrollo nueva. El workflow anterior exige revisión externa y checkpoints manuales. No hay scripts de test agregados en package.json; existen 52 runners cjs. La regresión histórica pasó 50 suites deterministas, excluyendo live y browser; no es evidencia de nueva ejecución. expanded-media-domain/section-5-verification.cjs escribe TEST-section5-review-v6.json: no ejecutarlo en el checkout personal bajo una promesa de solo lectura.

Estado posterior A3: A2 checkpoint manual `197f4a3697bcf971cdbeb3250c7106ac9bc46e7b`; automatización terminada y decisión manual del usuario 2026-11-12 registrada en §6.2.1 y final-validation.md. Los snapshots anteriores conservan trazabilidad, no describen el estado actual. 3.1–3.3 completas;3.4/3.5 pendientes.

## Goals / Non-Goals

**Goals:** contrato verificable de bundle, distinción explícita de contenido personal/aprobado, remediación acotada con decisión humana y evidencia proporcional. PowerShell/Git/Node existentes; cero dependencias nuevas previstas.

**Non-Goals:** helper que ejecute tests, gestione Git checkpoints, clone perfiles personales o cree CI; rediseñar runners; implementar producto. No instalación o edición de manifest/lockfile durante Propose.

## Decisions

### 1. Archivos y scripts

Futuros archivos: scripts/New-ReviewBundle.ps1; docs/testing/maintenance-stability/Test-ReviewBundle.ps1; docs/testing/maintenance-stability/README.md, remediation-matrix.md y final-validation.md. Logs/bundles/sandboxes se guardan fuera del repo. package.json se toca únicamente en A1 para los scripts aprobados y A2 para el subconjunto autorizado; package-lock.json únicamente según A2. No se prevén cambios en app/, src/, metro.config.js, app.json, tsconfig.json ni capacidades canónicas existentes; una necesidad adicional se presenta y revisa antes de ampliar alcance.

Scripts exactos previstos:

| Nombre | Comando |
| --- | --- |
| start | expo start |
| android | expo run:android |
| ios | expo run:ios |
| android:start | expo start --android |
| ios:start | expo start --ios |
| web | expo start --web |

run compila/instala el build nativo y puede generar android/ios; start abre el destino con Metro sin sustituir la compilación. iOS local requiere macOS/Xcode; Windows no lo acredita. expo-dev-client no está instalado y no se añade implícitamente. Se conserva la preferencia personal en vez de restaurar scripts anteriores o introducir nombres build alternativos.

### 2. Interfaz pequeña, generación sin tests

PowerShell 7 + Git CLI; usar APIs .NET de procesos/streams para preservar bytes y argumentos, sin herramientas nuevas. Interfaz planificada:

```powershell
# Captura parcial mientras package.json sigue protegido (predeterminado).
pwsh -NoProfile -File .\scripts\New-ReviewBundle.ps1 -Baseline f234faaa2955ee2ce5ed2da95bd2a69c026a482f -OutputDirectory D:\reviews\dlv-a1-draft -Boundary Section -ExcludePath @('private-notes/')

# Revisión explícita de incorporación A1: exige diff exacto de scripts aprobado.
pwsh -NoProfile -File .\scripts\New-ReviewBundle.ps1 -Baseline f234faaa2955ee2ce5ed2da95bd2a69c026a482f -OutputDirectory D:\reviews\dlv-a1-review -Boundary Section -PackageJsonPolicy ApprovedScripts

# Después del commit MANUAL A1, obtener su identificador y usarlo como checkpoint.
$scriptsCheckpoint = Read-Host 'Commit revisado de incorporación de scripts A1'
pwsh -NoProfile -File .\scripts\New-ReviewBundle.ps1 -Baseline f234faaa2955ee2ce5ed2da95bd2a69c026a482f -OutputDirectory D:\reviews\dlv-final -Boundary Complete -PackageJsonPolicy Incorporated -ScriptsCheckpoint $scriptsCheckpoint

# Comandos separados, no lanzados por el helper; ejemplos para APPLY.
pwsh -NoProfile -File .\docs\testing\maintenance-stability\Test-ReviewBundle.ps1
.\node_modules\.bin\tsc.cmd --noEmit
openspec validate improve-dependency-security-and-review-workflow --strict
```

Estos comandos documentan la interfaz futura, no fueron ejecutados ni los archivos creados en Propose. -Baseline siempre obligatorio, tanto para sección (checkpoint anterior escogido por reviewer) como revisión completa (baseline integrado anterior al cambio). Sin opción implícita HEAD~1, sin comandos arbitrarios ni test discovery automático. OutputDirectory debe ser nuevo; no sobreescribir bundles ni limpiar recursivamente rutas de usuario.

### 3. Límite Git y artefactos

Resolver repo raíz y baseline con Git y validar commit explícito (sin ejecutar shell construido desde texto). Capturar branch o detached HEAD, HEAD completo, baseline completo y status --porcelain=v1 -z. Obtener metadata de paths/estados por separado para committed (baseline→HEAD), staged (HEAD→índice), unstaged (índice→working tree) y neto (baseline→working tree); añadir ls-files --others --exclude-standard -z. Leer NUL y argumentos literales, no dividir nombres por whitespace ni usar Git pathspec mágico. El manifiesto sanitizado conserva esas listas separadas, también cuando un archivo figura en varias o sus cambios se cancelan y no aparece en net.patch.

Únicos entregables del helper v1: manifest.md (entorno, hashes permitidos, boundary, status, listas committed/staged/unstaged/netas sanitizadas, exclusiones y advertencias), net.patch (diferencia tracked FINAL completa baseline→working tree dentro del alcance permitido), y untracked/ con bytes originales de nuevos archivos permitidos y hashes en el manifiesto. No generar patches adicionales de capas. net.patch usa --binary --full-index --no-ext-diff --no-textconv --no-renames y paths previamente permitidos; captura stdout binaria directa, sin pipeline de texto que recodifique binarios. No producir primero un patch sin filtrar para luego limpiarlo. El manifiesto declara explícitamente que las listas de capas son inventarios, no contenido histórico exportado: el net patch no reconstruye versiones intermedias ni cuenta la historia completa de los commits.

Renames permitidos se representan intencionadamente como borrado+adición completos, documentados en el manifiesto; conserva el cambio real aun en staged/unstaged separados. Antes de exportar, consultar también metadata name-status con detección de renames en cada capa para propagar exclusión a AMBOS extremos cuando alguno sea protegido; esa consulta no se guarda sin sanitizar. Para movimientos exactos hacia untracked, comparar en memoria identidad de blob contra borrados protegidos y excluir el destino coincidente sin exportar hashes privados. La detección de similitud no garantiza descubrir copias/reescrituras de secretos con nombres arbitrarios: requieren exclusión explícita; si se detecta ambigüedad sensible detener la captura. No basta desactivar rename detection en patches para proteger un secreto movido a nombre inocuo. La lista de afectados informa A/M/D y esa representación. Binarios deben poder inspeccionarse/reconstruirse en fixture aislada desde patch/snapshot; no basta --stat. Archivos untracked se copian solo tras la política; nunca git add -N. No exportar el repo entero ni usar git archive sin filtros. Los mismos filtros se aplican a cada capa histórica, incluyendo archivos borrados y versiones del índice.

Validar salida resuelta externa, rechazo de destino/ancestros reparse-point o symlink ambiguos y de enlaces de entrada; no seguirlos para copiar contenido. Capturar fingerprints de HEAD, índice lógico y bytes de candidatos permitidos antes/después; si cambian concurrentemente, marcar bundle inválido y devolver exit distinto de cero sin afirmar snapshot atómico. Deshabilitar optional locks de Git para lecturas, no refrescar índice mediante comandos mutables. El helper no invoca scripts de repo, hooks externos, tests, instalaciones ni cambios Git.

### 4. Protección personal antes de exportar

Denegar por defecto archivos .env y variantes (incluidos tracked), credentials/tokens/claves/certificados privados, .aws/.ssh, DBs SQLite y sidecars, backups locales/dumps, node_modules, .expo, dist/web-build, android/ios generados, perfiles/logs privados y rutas personales declaradas. Excluir por nombres/rutas y añadir -ExcludePath literal repo-relative para archivo o subárbol, sin comodines implícitos. Una exclusión inválida/que escape raíz falla. No excluir todos los JSON: package-lock y fixtures de prueba revisables no son backups personales por extensión. Los secretos con nombres arbitrarios requieren declaración del usuario; no prometer detección universal de secretos. No copiar contenidos privados ni hashes de secretos al manifiesto; registrar regla/motivo y ruta relativa cuando no sea sensible, o etiqueta redactada. Status exportado también se sanitiza. Las reglas predeterminadas sensibles no tienen bypass genérico.

package.json tiene tres estados: ProtectPersonal (default: excluido, bundle parcial), ApprovedScripts (opt-in A1: solo permite el diff exacto de los cuatro comandos android/ios y :start respecto del baseline integrado, sin cambios de dependencias/otros campos), Incorporated (exige ScriptsCheckpoint commit existente ancestro de HEAD con la incorporación aprobada verificada; package.json se incluye normalmente, incluyendo dependencias A2). Antes de A1 registrar el diff y hash personal sin exportarlo por defecto; si aparece otra modificación personal detener la inclusión, no adivinar propiedad. A1 no se completa con el bundle ProtectPersonal: debe existir revisión real ApprovedScripts antes del commit manual.

Boundary Complete exige baseline del cambio integrado, Incorporated y checkpoint válido; no admite excluir package.json/package-lock ni archivos cambiados de implementación/specs/tests/docs del alcance aprobado. Excepciones sensibles se declaran como omisiones, requieren revisión del límite por el reviewer y hacen el bundle parcial; no usar la palabra completo. Sin lista mágica que atribuya todos los cambios del usuario al mantenimiento: el reviewer contrasta inventario y exclusiones explícitamente. Evita tanto blanket exclusion permanente como inclusión prematura de cambios personales.

### 5. Tests del helper en fixtures desechables

Runner PowerShell sin Pester nuevo. Crea repos Git exclusivamente en carpeta externa temporal propia para construir commits/índice de prueba; estas mutaciones preparan fixtures y nunca son operaciones del helper sobre el repo real. Cubrir baseline inexistente/no commit, salida interna/enlace, committed+staged+unstaged sobre mismo archivo, untracked, cancelación neta, borrados/renames, binarios, espacios/Unicode, env/DB/backup tracked y untracked, secreto borrado/renombrado, exclusión explícita, salida existente, symlink/reparse cuando plataforma permita y captura concurrente fallida. Comprobar solo los tres entregables: net.patch reconstruye el resultado tracked permitido final desde baseline, untracked/ conserva bytes y nombres, y manifest.md distingue las tres listas de capas y cancelaciones sin prometer historial de contenido ni exigir reconstruir capas intermedias. Comparar bytes del working tree, índice y HEAD antes/después en éxito/error y buscar marcadores secretos conocidos en TODOS los outputs.

Cubrir los tres estados package.json: default excluido y parcial; ApprovedScripts exacto permitido pero diff extra rechazado; Incorporated con checkpoint inválido rechazado y checkpoint válido incluyendo cambios A2; Complete con exclusiones de cambios aprobados rechazado/parcial. Guardar resultados/exit fuera del repo y registrar escenarios no ejecutables por permisos, sin declararlos aprobados. No usar datos reales.

### 6. Gate de seguridad A2

Antes de editar dependencias, refrescar npm audit --json y consultar advisories completos y metadata publicada, con fecha. El reporte 37 inicia investigación, no autoriza versiones de Explore. Distinguir entradas agregadas de advisories únicos, prod/dev de lockfile frente a uso runtime/tooling. Para cada candidato usar esta matriz en remediation-matrix.md:

| Campo obligatorio | Contenido requerido |
| --- | --- |
| Identidad y evidencia | Paquete directo/transitivo, instalada/locked, ruta completa, advisory URL/ID/severidad/rango/fecha |
| Target concreto | Versión exacta propuesta y versiones patched para TODO el set aplicable; no latest genérico |
| Riesgo | Superficie runtime/build/dev, condición vulnerable, evidencia de uso y límites de explotabilidad |
| Compatibilidad | Rango de cada padre, APIs, Expo54/RN0.81/Router6/Metro, engines/peers, alternativa sin override |
| Cambio | Manifest/lockfile esperados, versiones/nodos duplicados afectados, alcance transitivo |
| Verificación | Tests exactos por cambio; build/startup, navegación, nativo si corresponde |
| Decisión | Aprobar/rechazar/diferir por paquete y usuario; residual tras aplicar y motivo de diferimiento |

En el inventario original shell-quote era1.8.3 vía react-native→react-devtools-core; L1 ya incorporó1.11.0 con evidencia en la matriz. Reconsultar el set COMPLETO aplicable, tanto al instalado como a cada candidato, incluyendo advisories posteriores a GHSA-w7jw-789q-3m8p y GHSA-395f-4hp3-45gv; no asumir que1.9.0 basta. Si no hay evidencia completa registrar incertidumbre. Consultas primarias: https://github.com/ljharb/shell-quote/security/advisories y https://github.com/advisories?query=ecosystem%3Anpm+shell-quote. Búsquedas no exhaustivas no son certificación.

Revalidar ausencia de fix compatible de deepmerge (https://github.com/advisories/GHSA-gcqx-w48m-w2h4), no inferir parche de fixAvailable del padre. Priorizar hojas que satisfagan rangos; considerar padres compatibles; escaladas como decoder ^0.2.2→0.5.x, image-size ^1→2, PostCSS ~8.4→8.5, glob13→14, minimatch9/10→11 y uuid7→11 NO están autorizadas. Expo58/Router58 propuestos por npm no son mantenimiento compatible aprobado.

No override por defecto. Una excepción debe indicar paquete/versión/ruta, razón, alternativas, API/semver y plan de verificación, y obtener aprobación específica antes de tocar archivos. Gate: presentar matriz completa al usuario, esperar aprobación identificable del subconjunto; aplicar solo ese subconjunto. Si la resolución introduce nuevos cambios fuera de aprobación, parar y renovar matriz/aprobación. No npm audit fix (incluido --force) automático ni actualizaciones masivas.

### 6.1 Extensión A2: dos candidatos y gate adicional independiente

Fuente: informe Explore externo `C:/Users/elias/.codex/visualizations/2026/11/11/01a1cd0c-0601-72b0-b90c-2e3de09dc1bb/a2-extra-explore-20261112/report.md`, closures.json y browser-targets.json; resumen durable y evidencia de constraints/advisories en remediation-matrix.md G.12. En ese snapshot ninguna versión adicional estaba aplicada ni autorizada; aprobación/ejecución posteriores se registran en G.13/G.14. La tabla conserva los valores de entrada y targets exactos del gate. No se crea sección A4 ni tareas extra.

| Grupo | Path existente exacto | Actual locked | Candidato |
| --- | --- | --- | --- |
| Babel | node_modules/@babel/core | 7.28.6 | 7.29.6 |
| Babel | node_modules/@babel/generator | 7.28.6 | 7.29.6 |
| Babel | node_modules/@babel/parser | 7.28.6 | 7.29.3 |
| Babel | node_modules/@babel/helpers | 7.28.6 | 7.29.2 |
| Babel | node_modules/@babel/types | 7.28.6 | 7.29.0 |
| Babel | node_modules/@babel/traverse | 7.28.6 | 7.29.0 |
| Babel | node_modules/@babel/core/node_modules/@babel/code-frame | 7.28.6 | 7.29.0 |
| Babel | node_modules/@babel/traverse/node_modules/@babel/code-frame | 7.28.6 | 7.29.0 |
| Browserslist | node_modules/browserslist | 4.28.1 | 4.28.7 |
| Browserslist | node_modules/caniuse-lite | 1.0.30001766 | 1.0.30001806 |
| Browserslist | node_modules/electron-to-chromium | 1.5.283 | 1.5.393 |
| Browserslist | node_modules/node-releases | 2.0.27 | 2.0.51 |

Mantener baseline-browser-mapping2.11.0 y update-browserslist-db1.2.3; no otras copias de code-frame ni helpers adicionales. Los demás hijos ya satisfacen los manifests propuestos. No nodos añadidos/borrados/movidos, nuevas directas ni cambios de package.json; mantener los25 L1+L2 y padres de los doce nodos, excepto los cambios internos explícitamente enumerados del propio grupo. Expo54/RN0.81/Router6 y familias Metro permanecen byte/versión idénticas. No se aprueban upgrades de padres externos al cierre ni overrides.

**Gate 2.2 ampliado:** presentar aprobar/rechazar/diferir para Babel y para Browserslist de forma independiente, con los paths/versiones de la tabla y compatibilidad Web resultante. La aprobación L1/L2 no se solicita otra vez ni se extiende por inferencia. Aprobar uno no permite mutar el otro. Para Browserslist, anexar listas completas antes/después y targets efectivos CSS, incluyendo cada versión retirada; aceptar expresamente el soporte resultante. Si el nuevo cálculo difiere del mostrado para aprobación, detenerse y renovar esa decisión antes de trasladar el lockfile al checkout. Esta actualización documental NO completa el gate ni acepta residuales. Si un grupo se rechaza/difiere, registrar decisión y su residual; no obligar a implementarlo para cerrar A2.

Tras autorización específica, un grupo por vez: partir del lock L1/L2 actual en copia limpia externa sin secretos/datos/perfiles personales. Verificar versiones exactas/rutas, metadata publicada, URLs/integrity auténticas y tarballs, todos los padres/peers/engines e inventario completo. No audit fix, --force, padres/overrides/directas ni versiones nuevas para forzar resolución. Una preparación controlada del lockfile solo externa debe preservar metadata y demostrar npm ci limpio; no falsificar integrity ni copiar un candidato no validado al repo. Detenerse ante cualquier ampliación no autorizada. Instalar exclusivamente externamente y registrar flags, lifecycle, exits y hashes antes/después. Solo trasladar lockfile tras checks del subconjunto realmente aprobado.

**Babel, 2.3/2.4:** npm ci aislado reproducible y diff de ocho rutas; TypeScript, Expo public config, TSX/JSX/Flow (incluidos presets Expo/RN y transformaciones pertinentes), source maps inline/externos y fixtures sintéticas de lectura permitida/rechazada fuera del fixture; Metro/Web export con assets/worker/WASM; suites relevantes de navegación/providers/SQLite/backup. Evaluar compatibilidad Android/Hermes con el entorno disponible y registrar exactamente build/bundle/bytecode ejecutados y checks no disponibles. La regla original exigía aceptación física material en A3, especialmente por nanoid; para este hito aplica únicamente la excepción explícita §6.2.1. Node/Web/export por sí solos no satisfacen aceptación manual ni equivalen a un APK instalado o teléfono físico. No completar un requisito automatizado bloqueante faltante como aprobado.

**Browserslist, 2.3/2.4:** npm ci aislado reproducible, diff de cuatro rutas, comparación reproducible de queries reales/defaults y targets CSS antes/después. Explore observó Edge mínimo142→148, Safari26.1→26.3 y Samsung28→29; guardar todas las adiciones/retiros, no solo ejemplos. Cambio de datos puede alterar CSS/prefijos/transforms; aceptación de targets no sustituye export y smoke funcional Web/CSS. Verificar Buscar/Biblioteca/detalle/back/recarga, assets/WASM y navegación/SQLite Web según impacto con fixtures externas; documentar navegadores/versiones realmente probados. No ampliar soporte ni declararlo eliminado sin decisión explícita. Si no hay entorno para un check requerido, queda pendiente.

Validación proporcional: compartir evidencia pertinente entre grupos cuando siga vigente, sin repetir suites caras por cambios solo documentales. Después del último grupo aprobado verificar combinación final y audit por advisory; tests L1/L2 y loadVirtual/audits de Explore no acreditan npm ci/runtime de los candidatos. Mantener V0/T1/T2/T3/T4 de la matriz. 2.4 incluye compatibilidad del nuevo resultado y riesgos/limitaciones; no asumir cierre por cero errores semver.

**Residuales y diferidos:** continúan fuera config-plugins54.0.6/xcode4, plist/json-file nativos relacionados y retirada uuid; su análisis es separado, no aprobación. También decoder directo, sustituciones forzadas de glob/minimatch/PostCSS/image-size/deepmerge y migraciones mayores. Router6.0.22 configura su fork getStateFromPath con URL.searchParams; seis inputs sintéticos cortos dieron cero llamadas instrumentadas al decoder. Upstream React Navigation mantiene query-string.parse: la observación reduce exposición demostrada, no prueba inalcanzabilidad universal ni aceptación del residual. No se añade mitigación de app en este cambio de especificación.

Snapshot previo a APPLY adicional: audit23 entradas/15 GHSA/0 críticas. El candidato Explore no instalado Babel+Browserslist dio21 entradas/12 GHSA, sin nuevos; no acredita implementación ni garantiza el resultado futuro. La aprobación posterior se registra en matriz G.13 y los resultados reales en G.14. Quedan decoder, deepmerge, glob, minimatch, PostCSS, image-size y uuid más propagaciones; solicitar aceptación explícita de residuales reales en2.5.

### 6.2 Límite de aceptación A2/A3 confirmado por el usuario

A2 verifica compatibilidad de dependencias/build con pruebas automatizadas y aisladas disponibles, incluyendo navegador real automatizado cuando sea posible. A3 registra aceptación manual final separada de la validación física. La regla física original se conserva como seguimiento, con la excepción del usuario §6.2.1 para este hito; un test físico no ejecutado se declara DEFERRED, nunca pasado ni soporte universal. La aceptación condicional de defaults G.12.3 autoriza solo esas diferencias si los checks disponibles no muestran regresiones o pérdida inesperada de soporte requerido. Si falta un requisito automatizado bloqueante, cambia el grafo/soporte fuera de autorización o aparece regresión material, detenerse: registrarlo no equivale a resolverlo. Documentar navegadores/versiones realmente ejecutados; no atribuir Safari/Firefox/Android/iOS a Chrome headless ni una suite de stubs a navegador real. En el snapshot A2 de esta aclaración, aceptación manual A3 y residual/revisión/checkpoint2.5 estaban pendientes; el checkpoint A2 posterior y la decisión A3 §6.2.1 registran su evolución sin atribuir pruebas no realizadas.

### 6.2.1 Excepción de aceptación Android para este hito (2026-11-12)

Decisión explícita del usuario del 2026-11-12: para ESTE hito de mantenimiento, build Gradle APK y export Android/Hermes exitosos, regresión automatizada satisfactoria y aceptación manual BlueStacks 5 reportada por el usuario (9/9) satisfacen A3.2, con prueba en teléfono Android físico DEFERRED hasta completar las funcionalidades restantes. La excepción sustituye el gate físico de este hito, no acredita compatibilidad física ni readiness de release y no se extiende a otras features. La validación física sigue siendo seguimiento obligatorio antes de afirmar aceptación real-device/release.

Rationale: el usuario informa nueve checks funcionales pasados en BlueStacks 5 Android emulator usando el APK debug A3 (SHA256 `40045c3262a5fe8a880b2f35305c8c189590def3a8b21ccc16a0a4041a63234f`) que había instalado y conectado a Metro aislado. Build Gradle, export Hermes y regresión automatizada ya aportan evidencia independiente conservada; la evidencia BlueStacks es USER-REPORTED, no ejecución automatizada ni confirmación independiente del agente. Se acepta el hito de mantenimiento con esos límites para continuar el review, no se declara cerrado el cambio antes de 3.4/3.5.

Los nueve ámbitos reportados son startup; tabs/stack/Back; guardar múltiples entradas/IDs; editar/borrar; persistencia SQLite al cerrar/reabrir; backupv6 export/import; compatibilidad histórica; TMDB/providers; errores/recuperación. No se atribuyen subcasos adicionales, screenshots/logs, modelo de teléfono o Android/API no informados. No hay regresiones nuevas reportadas por el usuario. El informe final conserva resultados automatizados originales y aceptación residual temporal/condicional21 entradas/12 GHSA/0 críticas.

Android físico DEFERRED; iOS NOT EXECUTED; smoke Web humano NOT EXECUTED (31 checks Chrome automatizados no son humanos). Deep links entrantes externos NOT APPLICABLE: MainActivity no registra VIEW/BROWSABLE/scheme; no inventar un test de lanzamiento externo. La falta de teléfono deja de bloquear A3.2 SOLO bajo esta decisión; los límites restantes se informan sin marcarlos pasados. Revisión externa con dos boundaries y checkpoint manual permanecen obligatorios.

### 7. Validación proporcional, independiente de exportación

A1: tests del helper, revisión exacta de scripts sin arrancar builds solo para comprobar nombres, TypeScript y OpenSpec. A2: por pequeño grupo aprobado verificar diff/peers/engines/audit/TypeScript y tests afectados. Al final instalar con npm ci en copia temporal externa limpia y permitida del código revisado (sin secretos/.git/datos reales) para demostrar manifest+lockfile reproducibles; registrar Node/npm/plataforma, flags, scripts de instalación, código y hashes antes/después. Nunca npm ci sobre el checkout personal en Propose. No presentar compilación Windows como validación iOS.

A3 consolida evidencia y ejecuta la validación y regresión final ANTES del único evento externo conjunto y del único checkpoint final; repetir tras correcciones materiales o bloqueantes, no repetir suites caras por un ajuste documental. Comandos futuros: tsc --noEmit con binario instalado, expo config --type public, expo start --web para startup/smoke o expo export --platform web para cambio de bundler según pertinencia (artefactos/caches en sandbox), tests de navegación/Router, SQLite/backup histórico, provider abstraction, gates expanded-media, credentials, review isolation y fallbacks afectados. Elegir comandos cjs existentes y registrar lista/exit; no declarar 50 nuevas pasadas por herencia. El runner que escribe fixture se ejecuta en copia aislada, no en datos personales. Tests browser/live no automáticos; justificar pertinencia y límites. No activar ni solicitar arte real MangaUpdates.

Regla original preservada: cambios solo de hojas CLI no obligan a aceptación física completa; cambios de runtime/native/Expo/Router con impacto Android material requieren build instalado y aceptación física pertinente. El usuario reemplaza ese gate SOLO para este hito mediante §6.2.1: build/automatización más nueve checks BlueStacks reportados y deferral físico trazable permiten completar A3.2. No simular un teléfono probado; antes de afirmar real-device/release, sigue siendo obligatoria la validación física diferida. La excepción no autoriza omitirla en futuras features. Nativo iOS no comprobado se declara. Final npm audit y comparación advisory por advisory: resuelto/pendiente/nuevo, sin manipular counts ni usar omit=dev como prueba de seguridad runtime.

### 8. Secuencia humana y definición de cierre

Exactamente A1→A2→A3, una tarea a la vez. A1 y A2: APPLY→validación pertinente→revisión EXTERNA del diff REAL (incluidos nuevos untracked)→corrección/revalidación de bloqueantes→commit/push MANUAL del usuario→continuación explícita. A3 conserva ambas coberturas de revisión dentro de UN evento externo conjunto y UN checkpoint final, como se detalla abajo. La aprobación del proposal no salta el gate de versiones A2. Registrar referencias de checkpoints; nunca fabricarlas ni automatizarlas.

A3: validación y regresión final consolidadas→UN evento de revisión externa que examina (a) el diff REAL A3 desde el checkpoint A2 y (b) el diff REAL COMPLETO desde f234faaa2955ee2ce5ed2da95bd2a69c026a482f, con scripts, lockfile, nuevos archivos y artefactos→correcciones de bloqueantes y revalidación pertinente→aprobación externa de ambas coberturas y residuales aceptados por el usuario→UN checkpoint final MANUAL commit/push→archive OpenSpec solicitado por separado→revisión externa del diff real del archive/sync→checkpoint manual archive→integración a main por acción explícita posterior. Usar dos bundles con baselines distintos y directorios externos separados dentro del mismo evento; conservar ambos baselines y el resultado de revisión. Las correcciones se vuelven a presentar al reviewer en ese mismo ciclo hasta aprobación, sin un checkpoint A3 intermedio ni una segunda revisión final rutinaria. Si una corrección altera contenido, actualizar los bundles afectados y su evidencia antes de aprobar. No archivar en APPLY ni afirmar que status de artefactos done significa implementación completada.

El reporte final incluye resueltos/residuales y aceptación, versiones/rutas, diferencias package/lockfile, entorno/evidencia de compatibilidad, comandos/exit/fallos/límites, archivos afectados/exclusiones, baseline externo completo y checkpoints, y aptitud para archive independiente. Cerrar con residuales requiere explicación y aceptación, no cero automático; bloqueantes de integridad/exposición del bundle y regresiones no pueden diferirse como advisory externo.

## Risks / Trade-offs

- Filtración de secretos históricos o renames → filtrar todas las capas antes de materializar, no seguir enlaces, marcadores sensibles en tests; secretos de nombre desconocido necesitan exclusión explícita.
- Bundle que oculta cambios aprobados → estados package.json y rechazo de Complete parcial; manifiesto contrastado por reviewer.
- Updates compatibles en semver que rompen tooling → pequeños grupos aprobados, lock diff, reproducibilidad y tests pertinentes; ninguna promesa de compatibilidad por número de versión.
- Advisories nuevos o sin parche → matriz refrescada, incertidumbre y residuales aceptados; shell-quote sin target asumido y deepmerge sin parche inventado.
- Snapshot concurrente → fingerprints/rechazo; no bloqueo ni stash del usuario.
- Renames como D+A → menos comodidad visual, pero evidencia completa y filtros más simples.
- Tests existentes con efectos → ejecución separada en sandbox; no construir orquestador como parte del helper.

## Migration Plan

Sin migración de datos: SQLite 5→5 y backup 6→6 con imports históricos conservados. Incorporación de scripts solo tras edición autorizada A1 y revisión/manual checkpoint. A2 solo tras gate, luego verificación reproducible aislada. Reversión futura es un cambio revisado de manifest/lockfile al último checkpoint aceptado y retirada opcional del helper, sin reset/rebase ni borrar datos o modificaciones personales. Separar archive/sync de implementación y revisar ambos diffs.

## Open Questions

- Gates históricos A2: aprobación adicional registrada G.13/evidencia G.14 y aceptación residual TEMPORAL/CONDICIONAL G.15 con checkpoint A2 real197f4a3. Se preservan sus límites; no hay nuevas versiones/overrides aprobados. El review final3.4 y checkpoint3.5 siguen pendientes, sin aceptación automática de riesgos nuevos.
- Directorio externo elegido por el usuario y exclusiones personales adicionales: argumentos explícitos por captura, sin cambiar el contrato.
- Seguimiento físico Android: el usuario lo difiere hasta completar las funcionalidades restantes (§6.2.1); fecha/dispositivo no informados. Debe ejecutarse antes de afirmar compatibilidad real-device o readiness de release; esta excepción no cubre futuras features.
