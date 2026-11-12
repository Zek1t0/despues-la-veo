# A1 — scripts y bundles de revisión

Este helper requiere PowerShell 7.2+ (.NET 6+, por las APIs binarias/JSON utilizadas) y Git instalado. No instala paquetes, ejecuta tests, abre DBs ni hace stage/commit/push. Solo escribe un directorio externo NUEVO. Las validaciones son comandos separados.

## Scripts

| Comando npm | Valor | Intención |
| --- | --- | --- |
| start | expo start | Iniciar Metro |
| android | expo run:android | Compilar/instalar y ejecutar Android local |
| ios | expo run:ios | Compilar/instalar y ejecutar iOS local |
| android:start | expo start --android | Iniciar Metro y abrir Android |
| ios:start | expo start --ios | Iniciar Metro y abrir iOS |
| web | expo start --web | Iniciar Web |

Los valores personales android/ios se conservan. run puede generar directorios nativos y requiere tooling local; iOS local requiere macOS/Xcode, no funciona como compilación iOS en Windows. No se incorpora expo-dev-client ni se afirma que run lo instale.

## Crear un bundle A1

Desde la raíz del proyecto, después de revisar las exclusiones personales necesarias, elegir una carpeta nueva fuera del repositorio:

```powershell
Set-Location D:\dev\despues-la-veo
$output = Join-Path $env:TEMP ('dlv-a1-review-' + [guid]::NewGuid().ToString('N'))
.\scripts\New-ReviewBundle.ps1 `
  -Baseline 68cc02ff83a6f5d0172348cdef010da10f2169b1 `
  -OutputDirectory $output `
  -Boundary Section `
  -PackageJsonPolicy ApprovedScripts
Get-Content -LiteralPath (Join-Path $output 'manifest.md')
```

Este baseline es el checkpoint de la propuesta aprobada. ApprovedScripts es opt-in para la incorporación A1; solo acepta las modificaciones de scripts previstas respecto de ese baseline, sin otras diferencias semánticas de package.json. Rechaza comentarios/claves duplicadas y verifica también HEAD/índice antes de exportar; no incluye contenido personal intermedio no aprobado. El usuario debe revisar el diff real antes de su checkpoint MANUAL. La generación del bundle no aprueba el cambio ni completa 1.5.

Protección predeterminada y exclusiones explícitas (literales, archivo o subárbol relativo al repo, usar `/`):

```powershell
$output = Join-Path $env:TEMP ('dlv-partial-' + [guid]::NewGuid().ToString('N'))
.\scripts\New-ReviewBundle.ps1 -Baseline 68cc02f -OutputDirectory $output `
  -ExcludePath @('private-notes/', 'personal-export.json')
```

ProtectPersonal es el default: package.json no se exporta y el bundle se declara PARTIAL/incomplete. No sirve para completar la revisión de scripts. Las exclusiones se registran por regla/motivo, con nombres privados redactados. No se registra contenido ni hashes de secretos.

Después del checkpoint MANUAL A1, se puede usar Incorporated; requiere el commit exacto no-merge cuya diferencia de package.json respecto de su padre sea solo la incorporación de scripts aprobada. Debe ser ancestro de HEAD y descendiente del baseline de revisión. La política permite revisar cambios posteriores de dependencias, no los autoriza:

```powershell
$scriptsCheckpoint = Read-Host 'Hash del commit A1 revisado y creado manualmente'
$output = Join-Path $env:TEMP ('dlv-complete-' + [guid]::NewGuid().ToString('N'))
.\scripts\New-ReviewBundle.ps1 `
  -Baseline f234faaa2955ee2ce5ed2da95bd2a69c026a482f `
  -OutputDirectory $output -Boundary Complete `
  -PackageJsonPolicy Incorporated -ScriptsCheckpoint $scriptsCheckpoint
```

Complete es el límite completo de este change: requiere baseline integrado f234faa, Incorporated válido y ninguna omisión de paths cambiados. Si hay omisiones, falla: usar Section para un bundle parcial y resolver el límite con el reviewer. No excluir package.json/lockfile para aparentar una revisión completa. Actualmente no existe aún un checkpoint A1; no fabricar su hash.

## Contenido y límites

- `manifest.md`: branch/HEAD/baseline, entorno, Git status sanitizado, inventarios committed (baseline→HEAD), staged (HEAD→índice), unstaged (índice→working tree) y neto; cancelaciones, exclusiones, hashes permitidos y estado del bundle.
- `net.patch`: único patch del resultado tracked FINAL baseline→working tree, Git `--binary --full-index --no-textconv --no-ext-diff --no-renames`. Los renames permitidos se representan D+A. No es historia de commits ni contiene versiones intermedias de cada capa.
- `untracked/`: bytes originales de nuevos archivos permitidos no ignorados, preservando espacios/Unicode y binarios. Nunca usa `git add -N`.

El contenido se filtra antes de exportar. Se protegen env, claves/credenciales/tokens, SQLite/DBs/sidecars, backups/dumps y generados. La protección se propaga a ambos extremos de renames detectados en todas las capas. Las fuentes de identidad protegida se obtienen independientemente de los archivos cambiados: metadata tracked de baseline, HEAD e índice, aplicando la misma política sensible/exclusiones y considerando sus bytes históricos y los actuales cuando existen. Así, un secreto tracked SIN CAMBIOS también impide exportar una copia exacta con nombre inocuo. Fuentes, bytes y hashes protegidos permanecen en memoria: no se exportan árboles completos ni se añaden fuentes sin cambios a inventarios/manifiesto. No se puede exportar el historial intermedio usando esta primera versión.

No es un scanner general de secretos: copias modificadas y copias de fuentes secretas ignoradas o untracked pueden escapar a la comparación por identidad. Es necesario declarar exclusiones con -ExcludePath y realizar inspección manual del bundle antes de compartirlo; no se promete descubrir esos casos automáticamente.

Paths con traversal, controles, backslashes, colon/ADS y componentes ambiguos son rechazados. Se rechazan enlaces/reparse points de entrada/salida y candidatos históricos symlink/submodule; índices sparse/assume-unchanged/unmerged no son soportados. No se siguen enlaces ni se sobrescriben bundles existentes. Git se invoca sin shell, con optional locks deshabilitados y diff.autoRefreshIndex=false, sin fsmonitor/external diff/textconv y con filtros clean/process/smudge registrados desactivados solo para el proceso hijo; no se modifica configuración Git. Por eso el patch refleja contenido Git sin ejecutar filtros personalizados ni refrescar el índice.

Fingerprints de HEAD, índice, status y bytes/metadata de candidatos detectan cambios concurrentes; no es un snapshot transaccional ni protección contra un atacante que intercambie y restaure archivos entre checks. Ante fallo posterior a crear salida, el manifiesto se marca INVALID/incomplete y se conservan evidencias; no usar ese bundle y repetir en una carpeta nueva. No borrar carpetas del usuario automáticamente.

## Validaciones separadas

Ejecutar desde la raíz (los repos del test se crean únicamente en el directorio externo elegido; sus commits/staging son preparación de fixtures, nunca acciones sobre este proyecto):

```powershell
$evidence = Join-Path $env:TEMP ('dlv-review-tests-' + [guid]::NewGuid().ToString('N'))
pwsh -NoProfile -File .\docs\testing\maintenance-stability\Test-ReviewBundle.ps1 -EvidenceDirectory $evidence
.\node_modules\.bin\tsc.cmd --noEmit
openspec validate improve-dependency-security-and-review-workflow --strict
```

No hace falta npm install/ci ni Pester. El runner conserva logs por invocación y result.json o failure.txt fuera del repo. Cubren entradas inválidas, capas/cancelación, contenido nuevo, reconstrucción binaria/neto, borrado/rename, Unicode/espacios, secretos y exclusiones, políticas package, ausencia de mutaciones, links y concurrencia. Una suite Node/Web o estos tests no acreditan Android físico; no se ejecutan builds nativos para validar nombres de scripts.

## Resultados observados de A1

Prerequisito: propuesta refinada comprometida en HEAD `68cc02ff83a6f5d0172348cdef010da10f2169b1`, rama `feat/maintenance-stability`, artefactos sin diff, exactamente tres secciones y quince tareas inicialmente pendientes. Solo package.json tenía el diff personal android/ios → run. Se conservó ese diff y se agregaron únicamente las dos variantes :start; dependencias y demás campos sin cambios.

Entorno: Windows, PowerShell 7.6.9, Git 2.51.0.windows.1, Node 22.18.0, npm 10.9.3. Registro inicial anterior a la corrección de identidad de fuentes sin cambios (ver resultado vigente al final):

`C:\Users\elias\.codex\visualizations\2026\11\11\01a1cd0c-0601-72b0-b90c-2e3de09dc1bb\a1-tests-09`

| Comando efectivamente ejecutado desde la raíz | Resultado |
| --- | --- |
| `pwsh -NoProfile -File docs/testing/maintenance-stability/Test-ReviewBundle.ps1 -EvidenceDirectory C:/Users/elias/.codex/visualizations/2026/11/11/01a1cd0c-0601-72b0-b90c-2e3de09dc1bb/a1-tests-09` | Exit 0; 54 assertions aprobadas, 19 invocaciones del helper; 2 escenarios filesystem omitidos por permisos |
| `npx --no-install tsc --noEmit` | Exit 0, sin diagnósticos |
| `openspec validate improve-dependency-security-and-review-workflow --strict` | Exit 0; cambio válido |
| `git diff --check` | Exit 0; sin errores de whitespace; Git avisa normalización LF→CRLF de tasks.md al tocarlo en el futuro |
| Parser PowerShell sobre ambos .ps1 | Cero errores de sintaxis |

result.json enumera las 54 assertions; los 19 logs conservan stdout/stderr por invocación. Casos aprobados: baseline inexistente/no commit, salida interna/existente, traversal en exclusión, inventarios simultáneos y cancelación, tres únicos entregables, bytes binarios nuevos y reconstrucción del patch en segundo repo sintético, rename/borrado, Unicode/espacios, secretos tracked/untracked/históricos y ambos extremos del rename, movimiento secreto hacia untracked, exclusión explícita, ProtectPersonal parcial, ApprovedScripts válido y rechazos por estado incompleto/dependencias extra/claves duplicadas, diagnóstico sin valores privados, Incorporated válido con cambio posterior de dependencias y checkpoints inválidos/ausentes, rechazo de Complete protegido/baseline incorrecto, enlace de índice rechazado sin cambiar índice, filtros Git desactivados y modificación concurrente rechazada. En invocaciones no concurrentes se compararon HEAD, SHA256 del índice/config y bytes de working files antes/después. El test concurrente modifica deliberadamente solo una fixture y comprueba rechazo/no nuevos commits; no se afirma igualdad de sus working bytes.

Limitaciones reales: crear junctions de entrada y salida dio Acceso denegado; ambos escenarios figuran en skipped, NO como aprobados. El caso positivo Complete necesita el baseline real f234faa y un futuro checkpoint A1 revisado, por lo que no se fabricó en fixtures ni se ejecutó sobre el proyecto. Se probó Incorporated positivo como Section y los rechazos de Complete indicados. La concurrencia fue rechazada antes de exportar; no se afirma snapshot atómico ni prueba de todos los posibles interleavings. Windows es la plataforma probada; no se acredita Android físico ni iOS.

Las pasadas preliminares a1-tests-01 a a1-tests-08 no son evidencia de suite aprobada: detectaron selección ambigua de Git, ajuste de fixture personal, transporte local clone bloqueado (sustituido por copia de metadata sintética), permisos de junction y refresco del índice/racy-clean metadata. Se corrigieron los problemas y a1-tests-09 pasó completa. Importante: GIT_OPTIONAL_LOCKS=0 solo no impedía el refresco de índice por diff; la fixture confirmó la corrección con diff.autoRefreshIndex=false y numstat para descartar falsos cambios netos, sin tocar configuración real.

SHA256 inicial de package.json personal: `262E90681FAFF16686F79D3F14CE6A6CAE158442D432038F31616B4E2E990C78`; tras las dos adiciones aprobadas: `DC114766FA9DB8CADB497BDC4A909FFD74DBC226384B6BCADE8100509BE46A9F`. package-lock.json conserva exactamente `7EB6A96DF94D78B76C89A3E0B305AD95E1316DD91D7BB0B7B18DC4B13F3EED05`. No se ejecutó el helper sobre el proyecto real ni se accedió a DBs, backups, perfiles o credenciales personales. No se instaló/actualizó ninguna dependencia ni se ejecutó audit fix, builds nativos o arte MangaUpdates.

Tareas 1.1–1.4 completadas; 1.5 queda pendiente de revisión EXTERNA del diff REAL y commit/push MANUAL del usuario. A2/A3 no iniciadas. Ningún stage/commit/push del repo real fue realizado; los únicos commits de tests pertenecen a fixtures externas desechables.

## Corrección bloqueante A1 — identidad de fuentes tracked sin cambios

La revisión externa detectó que privateHashes solo consideraba rutas denegadas entre los candidatos cambiados. Una fuente sensible tracked sin cambios no alimentaba ese conjunto y una copia exacta untracked con nombre inocuo podía exportarse. Se corrigió separando fuentes de identidad de candidatos exportables y reutilizando una única función de política de protección. Se consulta metadata de baseline/HEAD/índice, se leen solo las versiones protegidas pertinentes y sus bytes actuales cuando existen, y se conservan bytes/hashes únicamente en memoria. Las fuentes sin cambios también participan en los fingerprints de concurrencia, sin aparecer como cambios ni omisiones en el manifiesto. Una versión protegida existente ilegible causa fallo; no se omite silenciosamente. No se exporta un árbol Git ni se incorpora un scanner de secretos.

La regresión agrega una fuente .env tracked con marcador propio distinto al de todos los secretos cambiados, la deja intacta tras su commit y copia sus bytes a un archivo untracked de nombre ordinario. Comprueba que la fuente no tiene diff, la copia queda excluida y un archivo untracked independiente conserva exactamente sus bytes exportados. Verifica ausencia del marcador, SHA256 y blob ID protegido en todos los archivos del bundle y en el log de esa invocación; HEAD, índice/config y bytes originales se comparan antes/después. El runner tampoco escribe snapshots con hashes en sus diagnósticos de fallo: mantiene esas comparaciones en memoria.

Evidencia completa vigente: `C:\Users\elias\.codex\visualizations\2026\11\11\01a1cd0c-0601-72b0-b90c-2e3de09dc1bb\a1-unchanged-source-02` (result.json y logs). Comando ejecutado desde la raíz:

```powershell
pwsh -NoProfile -File docs/testing/maintenance-stability/Test-ReviewBundle.ps1 -EvidenceDirectory C:/Users/elias/.codex/visualizations/2026/11/11/01a1cd0c-0601-72b0-b90c-2e3de09dc1bb/a1-unchanged-source-02
```

Resultado: exit 0, **63 assertions aprobadas, 20 invocaciones del helper, cero fallos**. Dos pruebas filesystem junction/symlink omitidas por Acceso denegado, sin declararlas aprobadas. El enlace de índice, reconstrucción binaria, capas/cancelación, políticas package, filtros, exclusiones y concurrencia pasaron. La primera pasada a1-unchanged-source-01 también pasó con 63 assertions; la 02 verifica la versión final del runner que evita hashes en diagnósticos y comprueba también su ausencia en logs.

Validaciones repetidas: `npx --no-install tsc --noEmit` exit 0; `openspec validate improve-dependency-security-and-review-workflow --strict` exit 0; parser PowerShell sobre ambos .ps1 sin errores; `git diff --check` exit 0 y comprobación de whitespace de los tres archivos editados sin errores. Solo se editaron New-ReviewBundle.ps1, Test-ReviewBundle.ps1 y este README durante la corrección. package.json y package-lock.json conservaron los hashes anteriores; tasks.md no se editó, 1.1–1.4 siguen checked y 1.5 pendiente. Sin A2, staging, commits ni ejecución del helper sobre el proyecto real.

Límites vigentes: identidad exacta de versiones protegidas tracked en los estados seleccionados, no búsqueda de secretos en todo el historial. **Copias modificadas y copias de fuentes secretas ignoradas/untracked pueden escapar**: requieren exclusiones declaradas y revisión manual del bundle. Siguen vigentes las limitaciones de junctions, Complete positivo aún sin checkpoint A1 y snapshot no transaccional documentadas arriba.
