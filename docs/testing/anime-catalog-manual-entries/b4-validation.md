# B4 — integración y regresión para revisión externa

## Resultado vigente de revisión combinada — 2026-11-13

El usuario confirmó aprobación sin bloqueantes de código del bundle
`dlv-b4-kitsu-dev-review-9a186a5050744fdfb04ec3e2989c75f8`: 19 archivos modificados y
4 nuevos sobre `da5520b8465478553587856bdc86a4a013eb666d`. **USER-REPORTED**, sin afirmar
inspección propia de ese bundle. La revisión examinó diff/pruebas nuevas; no ejecutó otra
vez las 56 suites contra el repositorio completo. Las ejecuciones B4 descritas debajo
son evidencia histórica propia, distinta de la revisión externa y de la corrección
posterior de fetch. No se atribuye una reejecución independiente al revisor.

Chrome local: búsqueda real `cowboy bebop` en Buscar → Anime y navegación al detalle
aceptadas por el usuario el 13/11/2026 después de revisar la corrección de fetch. Ver
development-activation-validation.md para el registro consolidado y límites; el fallo
Web anterior se conserva allí como antecedente resuelto para ese recorrido.

La decisión explícita es priorizar funcionalidades completas/gratuitas y experimentar
localmente, aceptando eventuales cambios de proveedor o reimplementaciones. Release
público se difiere sin declarar permisos externos, Android/iOS/producción aceptados ni
ampliar el alcance. No se inicia enriquecimiento de metadata; arte omit y scores intactos.

Estado vigente: **22/24 completas**, 3.6 y 4.5 completas por decisión de alcance y revisión
registradas. 3.5 (M/T de release) y 4.4 (Android y demás condiciones finales no verificadas)
siguen pendientes. Checkpoint Git todavía pendiente de revisión manual; change abierto,
sin archive/sync/merge. El resto del informe conserva el estado histórico de la entrega B4.

## Antecedentes históricos de entrega B4

Actualización posterior, 2026-11-13: el usuario confirmó revisión externa aceptada de esta
entrega B4. Sus cambios y pruebas se preservan. La activación viva local posterior tiene
su evidencia en development-activation-validation.md y requiere revisión combinada nueva;
el estado cerrado de Kitsu descrito abajo corresponde a la entrega B4 anterior.

Fecha: 2026-11-13, America/Buenos_Aires. Change `add-anime-catalog-and-manual-entries`,
schema `spec-driven`. Resultado: regresión automatizada completada; aceptación final
y revisión externa pendientes. Kitsu productivo permanece deshabilitado.

## Git verificado

- Rama: `feat/anime-catalog-manual-entries`.
- HEAD: `da5520b8465478553587856bdc86a4a013eb666d`, `feat: prepare conditional Kitsu anime catalog`.
- Árbol e índice iniciales limpios (`git status --short`, sin salida).
- Tracking local `origin/feat/anime-catalog-manual-entries`: mismo hash.
- `git ls-remote origin refs/heads/feat/anime-catalog-manual-entries`: mismo hash, exit 0.
  Primer intento restringido falló por resolución de red; lectura de red autorizada pasó.
- HEAD conservado, índice vacío. No stage, commit, push, archive, sync ni merge.

B1/B2 aceptados según usuario e informes existentes. Se reconcilió la entrega histórica
B3 con su checkpoint publicado: preparación técnica y revisión externa aceptadas,
Web Kitsu TEST PASS USER-REPORTED. No se afirma inspección propia de la revisión externa
ni nueva ejecución del smoke B3. La aceptación TEST no satisface M ni T Web vivo.

## Archivos de esta entrega

Nuevos:

- `docs/testing/anime-catalog-manual-entries/b4-regressions.cjs`: runner reproducible,
  40 comandos/56 suites, cada suite una vez, timeout por comando y exit agregado.
- `docs/testing/anime-catalog-manual-entries/b4-validation.md`: esta evidencia.

Modificados:

- `docs/testing/anime-catalog-manual-entries/b3-verification.cjs`: amplía el recorrido
  SQLite existente a manual + TMDB movie/TV + MangaUpdates + Kitsu, títulos iguales,
  IDs externos compartidos y grandes exactos; restauración mixta con ID manual ocupado,
  reimportación repetida, edición offline, nuevo export/reimport y borrado aislado.
  Compara el manual restaurado completo, todos los proveedores completos, el ocupante
  intacto y FK vacías; no duplica las pruebas unitarias B1/B2.
- `docs/testing/expanded-media-domain/section-3-ui-verification.cjs`: inyecta elegibilidad
  manual en el host UI histórico y rechaza explícitamente SQLite/DB personal.
- `docs/testing/personal-title-rating/section-1-verification.cjs`: destino de migración
  vigente v6; esquema futuro de prueba v7. Conserva verificación v5 de ratings, rollback
  histórico, pins y preferencias.
- `docs/testing/personal-title-rating/section-3-verification.cjs` y
  `section-6-verification.cjs`: tabla aditiva manual en fixtures de runtime; contratos
  de imports históricos y cola de ratings intactos.
- `docs/testing/global-appearance-themes/section-7-verification.cjs`: assertions de
  búsqueda con AbortSignal y preferencias inyectables del contrato B3 vigente.
- `docs/testing/anime-catalog-manual-entries/b3-validation.md` y `b3-eligibility.md`:
  reconciliación de aceptación/checkpoint y límites. Se corrigió un guion histórico
  codificado como byte CP1252 en el informe B3 para dejar Markdown UTF-8 válido.
- `openspec/changes/add-anime-catalog-and-manual-entries/design.md` y `tasks.md`:
  autorización B4 independiente, checkpoint actual y tareas realmente verificadas.

Sin cambios de producto, dependencias, versiones, parsers históricos ni gates.

## Comandos y resultados

Todos desde la raíz del repositorio. Resultado final:

| Comando | Exit / resultado |
| --- | --- |
| `node docs/testing/anime-catalog-manual-entries/b4-regressions.cjs` | 0; 40/40 comandos, 56/56 suites individuales |
| `npx tsc --noEmit` | 0 |
| `openspec validate add-anime-catalog-and-manual-entries --strict` | 0; válido |
| `git diff --check` | 0 |
| `git diff --quiet -- package.json package-lock.json app src` | 0; producto/dependencias intactos |
| `git diff --cached --exit-code` | 0; nada staged |
| Web export, comando inferior | 0; entry JS, CSS, worker SQLite, WASM e index generados en TEMP |

El inventario exacto está en `b4-regressions.cjs`: imprime comando y exit individual.
Incluye el runner B1 (17 suites de identidad, cadena SQLite, backup1–7, rollback real,
materialización, pins/ratings, Appearance poscommit y review aislado), B2 storage/UI,
B3 contratos/storage/UI, provider abstraction 2/3/5, expanded domain 3/UI/4/6/8-UI,
MangaUpdates cover 1–5, TMDB credential 1–5, personal rating 1/badge/3–6 y Appearance
1/3–10/12. No incluye pruebas live de proveedores ni browser automation.

```powershell
$env:EXPO_OFFLINE='1'
$env:EXPO_NO_DOTENV='1'
npx expo export --platform web --output-dir "$env:TEMP/dlv-b4-web-export-01a1d3b5"
```

El export no leyó `.env.local`. No se muestran credenciales ni se usan cuentas personales.
La compilación no acredita runtime Expo SQLite, CORS, layout visual ni aceptación Android.
Las suites usan SQLite Node real con adaptadores async, hosts UI simulados y transportes
falsos. No se solicitaron ni retuvieron datos Kitsu vivos ni imágenes reales.

Primera ejecución: 35/40 comandos pasaron; cinco suites históricas estaban desactualizadas.
Fallos: destino v5 en ratings1, falta de tabla manual v6 en ratings3/6, import de Expo SQLite
sin mock por nueva dependencia de elegibilidad manual en UI expandida3 y assertions
anteriores a AbortSignal/bindings en Appearance7. Se corrigieron fixtures/mocks/expectativas,
sin relajar las comprobaciones de conservación, y se repitió la matriz completa: 40/40.
Avisos node:sqlite experimental, NO_COLOR, Browserslist antiguo y LF/CRLF no son errores.
No se actualizaron dependencias para eliminarlos.

## Matriz de regresión

PASS significa evidencia automatizada con fixtures sintéticos; las filas no acreditan
aceptación física, red real de proveedores o revisión visual nueva.

| Área requerida | Resultado y evidencia |
| --- | --- |
| 1. SQLite v6 | PASS B1 + identity2/3 + rating1: nueva/histórica/mixta, backfill limitado, todas las tablas/relaciones, rollback de fases y COMMIT real, reopen, versión futura, FK/cascade |
| 2. Backup v7 / imports1–6 | PASS B1 + expanded2 + MU4 + rating3: contratos por versión, null/presencia/frescura, resolución, export/import/reimport, reporte parcial y rollback |
| 3. Identidad manual portable | PASS B1 y B3/B4 ampliada: colisiones/remap, reimport determinista, contradicciones y coexistencia de cuatro fuentes/ambos namespaces TMDB |
| 4. Manual create/edit/delete | PASS B2 storage/UI y B3/B4: defaults, validación, doble envío, borrador, edición limitada, identidad/timestamps/personales y cascade |
| 5. Cards/filtros/detalles | PASS expanded3/UI/8-UI, B2 y MU5: lista/grid/tags, filtros solapados, manga/manhwa/manhua/unknown, accesibilidad, placeholder y metadata local |
| 6. Personales/tags/rating/pins | PASS ratings1–6/badge, identity5, B2/B3: preservación y aislamiento, intents, pins contextuales, timestamps |
| 7. TMDB | PASS credential1–5, provider2/3/5, expanded4/8: credencial ausente/error/configurada, search/detail/save/re-save, imágenes simuladas, watch providers y atribución |
| 8. MangaUpdates | PASS expanded6 + cover1–5: metadata Android, Web/iOS cerrados, omit productivo, identidad grande y almacenamiento/imports; sin ampliar plataformas |
| 9. Kitsu TEST/aislamiento | PASS B3 contratos/storage/UI + expanded5/UI: fixtures originales, DB/preferencias/red personal aisladas; Web TEST previamente aceptado por usuario |
| 10. Kitsu productivo | PASS B3 contratos/UI: web/android/ios/unknown cerrados, rutas directas sin fetch ni saved detection/write; arte null y score omitido |
| 11. Offline/errores | PASS B2/B3/expanded6: CRUD local sin fetch, snapshot reopen, 404/429/5xx/network/timeout/payload inválido, Retry-After sin bucles |
| 12. Navegación rápida/stale | PASS B3 UI + expanded4: query/source/category/retry/credencial, abort, unmount, ID detalle y doble save; respuestas obsoletas descartadas |
| 13. Appearance/temas | PASS Appearance1–12 + B2/B3 UI + MU5: tokens y contraste/contracts, presets, preferencias y restauración poscommit; sin nueva inspección visual |

## Conservación, recuperación y datos

Ninguna suite nueva abre biblioteca personal. Archivos SQLite/WAL y exports sintéticos
se crean en TEMP; UI usa hosts con repositorios inyectados. Se reutiliza el ensayo B1
de copia v5 consistente (checkpoint WAL/cierre/copia/reapertura/comparación completa),
ejecutado de nuevo por el runner. Fallos de migración no publican versión ni asociaciones
parciales. Después de COMMIT v6 no se realiza downgrade: recuperar copia previa con
runtime anterior o continuar con runtime compatible; la copia previa no contiene writes
posteriores. No se ensayó recuperación en datos del usuario ni se promete pérdida cero
al restaurar una copia anterior.

## Pendientes exactos y decisión de alcance recomendada

- **3.5:** M pendiente: evidencia oficial suficiente de uso por tracker independiente,
  snapshots locales, retención, cache/export/import/backups y atribución; cuotas vigentes
  sin establecer. Después de M, T Web/Android vivos independientes con origen/headers,
  endpoints/payload/redirects y errores reales. Ninguna plataforma Kitsu activa.
- **3.6:** revisión externa/checkpoint de preparación técnica ya aceptados; falta decisión
  explícita sobre alcance diferido antes de cerrar como catálogo activo.
- **A:** arte omit y sin activación prevista; requeriría evaluación separada de derechos,
  display/hotlink/cache/URLs/atribución. Scores Kitsu ausentes.
- **4.4:** TypeScript/validación/export/diff completos; aceptación manual final Android/Web,
  smoke productivo/review con runtime/origen/dispositivo documentados y checkpoint final
  aún pendientes. No se exige repetir el mismo B3 BlueStacks diferido. Su fallo de inicio
  es una investigación ambiental pendiente, causa no determinada. Android físico diferido
  al hito final acordado. B2 Web/BlueStacks y B3 Web TEST no se extrapolan a este hito.
- **4.5:** entrega preparada aquí; falta registrar resultado de revisión externa integral.

OpenSpec: **18/22 completas**, 4.1–4.3 verificadas esta sesión. 3.5, 3.6, 4.4 y 4.5
permanecen sin marcar. No se cambian sus criterios para forzar el cierre.

Recomendación para aprobación del usuario después de revisión: aceptar esta entrega como
regresión técnica de manuales/identidad/backup y preparación Kitsu cerrada; mantener el
change abierto hasta resolver M/T y la aceptación final. Si se necesita entregar B1/B2
antes, aprobar explícitamente una revisión de alcance y specs que difiera la activación,
con obligaciones pendientes visibles, antes de proponer cualquier cierre. No declarar
el catálogo activo, crear otro change automáticamente ni archivar/integrar el change
completo bajo los criterios actuales.

## Bundle mínimo para revisión B4

Baseline B3 remoto verificado. ScriptsCheckpoint comprobado con git show y ancestry,
exit 0. PowerShell 7.2+, desde la raíz; el helper incluye archivos nuevos sin staging:

```powershell
pwsh -NoProfile -File .\scripts\New-ReviewBundle.ps1 -Baseline da5520b8465478553587856bdc86a4a013eb666d -OutputDirectory (Join-Path $env:TEMP ('dlv-b4-review-' + [guid]::NewGuid().ToString('N'))) -Boundary Section -PackageJsonPolicy Incorporated -ScriptsCheckpoint a793d459c841814291c1e3c0887c8bf7b77ecc10
```

Este bundle incremental se revisa sobre el checkpoint B3 aceptado. No es una entrega
de integración completa ni un archive. Comando preparado, sin staging o publicación.
**STOP para revisión externa.**
