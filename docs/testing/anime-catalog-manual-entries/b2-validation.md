# B2 — creación y edición manual: entrega para revisión externa

Fecha de proyecto: 2026-11-12, America/Buenos_Aires. Rama `feat/anime-catalog-manual-entries`.
Baseline B1 y HEAD conservado: `4e99c6f75966541035a454d786b5e7beedfbe111`.
Árbol inicial limpio. `git ls-remote origin refs/heads/feat/anime-catalog-manual-entries` confirmó ese mismo hash publicado (exit 0 después de repetir con acceso de red; el primer intento restringido falló en DNS).

El usuario confirmó aprobación externa sin bloqueantes de `dlv-b1-review.zip` y `dlv-b1-supplement.zip`, más su checkpoint manual B1. Se registró ese cierre y se marcó 1.6, sin afirmar inspección propia de esos ZIP ni nueva aceptación manual.

Implementadas **2.1–2.4**; progreso **10/22**. **2.5 pendiente** de revisión externa, aceptación manual y checkpoint del usuario. B3/B4 no iniciados. No stage, commit, push, archive, sync ni merge.

## Archivos exactos

Nuevos:

- `app/manual-entry.tsx`
- `src/components/ManualEntryForm.tsx`
- `src/core/manualContentEntry.ts`
- `src/storage/manualContentEntries.ts`
- `docs/testing/anime-catalog-manual-entries/b2-verification.cjs`
- `docs/testing/anime-catalog-manual-entries/b2-ui-verification.cjs`
- `docs/testing/anime-catalog-manual-entries/b2-validation.md`

Modificados:

- `app/(tabs)/libreria.tsx` — entrada «Agregar manualmente», también en biblioteca vacía.
- `app/title/[id].tsx` — acción «Editar título» condicionada por elegibilidad local releída.
- `src/dev/mediaReview/session.ts` — operaciones manuales con las conexiones TEST ya aisladas.
- `src/dev/mediaReview/MediaReview.tsx` — formulario TEST y borrador montado al inspeccionar candidatos, ligado a su DB de origen.
- `docs/testing/provider-abstraction/section-5-detail-verification.cjs` — expectativa del esquema vigente v6.
- `docs/testing/mangaupdates-cover-images/section-4-verification.cjs` — expectativas v6, manteniendo los casos históricos de backup v6.
- `docs/testing/mangaupdates-cover-images/section-5-verification.cjs` — mock de elegibilidad sin DB personal y comprobación de acción editar manual frente a snapshot con proveedor.
- `docs/testing/anime-catalog-manual-entries/b1-validation.md` — cierre administrativo autorizado.
- `openspec/changes/add-anime-catalog-and-manual-entries/tasks.md` — cierre 1.6 y 2.1–2.4; 2.5 permanece sin marcar.

## UI y comportamiento

Un formulario compartido crea/edita título, tipo de contenido, estilo, formato, año y resumen. El medio no tiene selección inicial implícita. Hay etiquetas accesibles, controles de al menos 44 px, scroll, safe area y colores del tema. No hay imagen propia, proveedor ni rating externo. Una selección incompatible anterior permanece visible y requiere revisión explícita; nunca se borra al cambiar medio.

La creación abre `/title/[id]`. La edición se ofrece únicamente sin referencias externas y con identidad manual válida o exactamente una identidad histórica manual válida. La mutación vuelve a verificarlo dentro de la transacción: una ruta directa no habilita editar snapshots con proveedor. Los manuales históricos conservan su identidad exacta, incluido whitespace.

Guardar deshabilita controles y usa un bloqueo síncrono para doble pulsación. Después de un commit conserva el ID confirmado para que un fallo de navegación/reintento no inserte otra fila. Fallos conservan todos los campos. Cancelar pide decidir entre seguir editando y descartar; ninguna opción de cancelación escribe.

Duplicados: consulta local, trim, colapso de whitespace, minúsculas españolas y eliminación de diacríticos NFD; título igual y año igual o desconocido en alguno. Incluye manuales y títulos con proveedor, excluye self. Permite abrir detalle sobre el formulario y volver al borrador montado, o crear/guardar por separado. No se usa esta coincidencia como identidad, no hay merge/link automático ni solicitudes remotas.

Biblioteca y detalle consumen los contratos existentes: búsqueda título/tags, lista/grid, filtros solapados, placeholder, estados, notas, rating, pins y eliminación. No se añadieron filtros de formato ni cambios a providers, schema o versiones de backup.

## Evidencia de integridad

Creación mediante INSERT, con hasta 25 candidatos locales libres y generación portable independiente por el helper B1. Nunca se utiliza upsert para crear. Item e identidad se confirman juntos en la cola/transacción pública existente; los helpers WithDb requieren transacción del caller y no abren otra base.

Edición mediante UPDATE de únicamente title/medium/content_family/primary_format/year/overview/updated_at. El patch se copia por lista explícita, incluso si el caller agrega propiedades ajenas en runtime. No toca ID, createdAt, identidades, campos personales, pins, géneros, poster ni score previo. updatedAt usa `nextSavedTitleUpdatedAt`, incluso con reloj atrasado.

La suite B2 usa archivos SQLite sintéticos en TEMP y compara tablas completas ante fallos. Comprueba validación, mínima/completa, límites de año, defaults, colisión local/portable, agotamiento, fallo al asociar identidad, fallo de UPDATE y fallo real de COMMIT por FK diferida. No quedan filas/identidades parciales; el error del commit no retorna éxito. Comprueba serialización pública, edición histórica, rechazo de proveedor/local sin identidad, preservación de campos y ambos pins (Biblioteca y etiqueta). Ejecuta metadata/rating/pins reales antes de editar; búsqueda por título/tag y filtros existentes después. Export real v7 → parser → merge en otra DB → comparación completa de items/pins; cierre/reopen v6 sin regeneración; delete con cascadas y foreign_key_check vacío. Fetch bloqueado: cero solicitudes. No se abrió la biblioteca personal.

La suite UI ejecuta el componente real con hook-host y servicios sintéticos: medio obligatorio, inválidos, revisión de clasificaciones, fallo con recuperación, doble submit, reintento tras confirmación, candidatos de ambas procedencias, inspección con borrador conservado, separado, exclusión self, edición, cancelación y elegibilidad rechazada. No es renderer de navegador ni aceptación nativa.

## Comandos y resultados

Todos los siguientes terminaron con **exit 0** en su ejecución final:

| Comando | Resultado |
| --- | --- |
| `node docs/testing/anime-catalog-manual-entries/b2-verification.cjs` | SQLite real B2 y persistencia/backup |
| `node docs/testing/anime-catalog-manual-entries/b2-ui-verification.cjs` | Formulario real, hook-host aislado |
| `node docs/testing/anime-catalog-manual-entries/b1-regressions.cjs` | 17/17 suites B1/universal identity/expanded domain/backup/ratings/Appearance/provider save/review |
| `node docs/testing/provider-abstraction/section-5-detail-verification.cjs` | Detalle TMDB, mapping y save/re-save SQLite |
| `node docs/testing/mangaupdates-cover-images/section-4-verification.cjs` | 18 DBs aisladas, persistencia/imports históricos/rollback |
| `node docs/testing/mangaupdates-cover-images/section-5-verification.cjs` | Composición biblioteca/lista/grid/detalle/tags/proveedores y acción manual |
| `node docs/testing/expanded-media-domain/section-5-ui-verification.cjs` | Review aislado, cero inicialización personal |
| `npx tsc --noEmit` | Sin errores |
| `openspec validate add-anime-catalog-and-manual-entries --strict` | Válido |
| `git diff --check` | Sin errores de whitespace |
| `git diff --quiet -- package.json package-lock.json` | Ambos intactos |
| `git diff --cached --exit-code` | Nada staged |

Export Web: `$env:EXPO_PUBLIC_MEDIA_REVIEW='1'; $env:EXPO_OFFLINE='1'; npx expo export --platform web --output-dir "$env:TEMP/dlv-b2-web-export-01a1d28f"` — exit 0, 928 módulos y bundles/worker SQLite compilados fuera del repo. Export es build de producción: el gate `__DEV__` mantiene la revisión inactiva; esto verifica compilación, no ejecución de review ni SQLite Web. Expo cargó automáticamente `.env.local`; no se leyó su contenido ni se hicieron requests a proveedores.

Fallos iniciales transparentes: una ampliación del test B2 utilizó nombres incorrectos para PinContext y falló; se corrigió a contextType/contextKey y pasó. Las regresiones adicionales de TMDB y MangaUpdates fallaron por `user_version=5` esperado después de B1; se actualizó a 6. La composición de UI MangaUpdates rechazó la nueva importación de elegibilidad por faltar su mock; se agregó el boundary sintético y luego pasó, incluyendo una comprobación positiva/negativa de la acción manual. No se relajaron guards personales ni contratos históricos. Advertencias node:sqlite experimental, NO_COLOR, Browserslist viejo y conversión LF/CRLF no son errores; no se actualizaron dependencias.

Intento de smoke Web: servidor Expo TEST en 8142 inició correctamente; el navegador IAB de la herramienta no pudo conectar ni a localhost ni a 127.0.0.1 (ERR_CONNECTION_TIMED_OUT). No se obtuvo aceptación visual ni evidencia SQLite Expo Web. El servidor propio se detuvo con Ctrl+C (exit 1 por interrupción intencional). BlueStacks/Android físico no se ejecutaron.

## Checklist manual pendiente — Web y BlueStacks

Ejecutar cada plataforma por separado con perfil/instalación **descartable**, sin biblioteca ni credenciales personales. Registrar fecha, plataforma/runtime/build, tamaño, origen Web y evidencia; no marcar 2.5 por estos tests automatizados.

- [ ] En development con `EXPO_PUBLIC_MEDIA_REVIEW=1`, verificar banner TEST y nombres media-review-primary.db / media-review-restore.db antes de operar. Usar Agregar manual TEST, Editar manual TEST y Volver al borrador TEST para el formulario compartido aislado.
- [ ] En otro perfil/instalación descartable, modo normal: Biblioteca vacía → Agregar manualmente → título+medio → detalle local. Verificar planned, placeholder y acción Editar título. No usar el perfil personal para validar las rutas productivas.
- [ ] Crear completo: audiovisual/Anime/Película, año, resumen. Probar manga/manhwa/manhua y clasificaciones sin especificar. Probar título vacío/espacios, medio ausente, año 0/10000/fracción y combinaciones incompatibles. Cambiar medio y revisar selecciones retenidas.
- [ ] Sin red y sin credenciales: crear y abrir/editar detalle; doble pulsación confirma una sola fila. Cancelar → seguir conserva borrador; descartar no crea fila. Inspeccionar candidato y volver conserva título/año/resumen/selecciones.
- [ ] Crear coincidencia normalizada con año igual/ausente; revisar manual y proveedor sintético del corpus; crear por separado sin alterar el anterior. Editar no se advierte a sí mismo; año distinto no advierte. No hay tráfico remoto de duplicados.
- [ ] Detalle: tags/notas/status/rating y pins de Biblioteca/etiqueta; editar snapshot mantiene todo y avanza fecha. No ofrecer editor para proveedor. Biblioteca: lista/grid, búsqueda título/tag, Anime+Películas, placeholder y filtros existentes.
- [ ] Cerrar/reabrir runtime y confirmar persistencia e identidad. Exportar TEST v7/restaurar segunda DB y revisar datos/pins. Eliminar manual y comprobar desaparición y cascadas; usar solo datos descartables.
- [ ] Web estrecha y BlueStacks: scroll con teclado, botones visibles, foco por Tab, lector de pantalla/labels, contraste claro/oscuro y errores legibles. Registrar separadamente cualquier plataforma/caso sin validar. El modo «Simular sin red» afecta solo fuente sintética: verificar desconexión real por separado.

Límites: borradores viven en memoria de la pantalla, no sobreviven recarga/proceso terminado. No se afirma aceptación del usuario, Web runtime, Expo SQLite nativo ni dispositivo físico. Los gates Kitsu/MangaUpdates y el generador B1 no criptográfico permanecen como estaban. Cambiar medio manual conserva el contrato import v7: otro destino con mismo token y medio distinto sigue reportando conflicto.

## Bundle único B2

Incluye también las dos correcciones administrativas B1. Baseline es el checkpoint B1, no el padre. Helper y checkpoint de scripts verificados por `git show` y ancestry; no hay bundle publicado ni staging automático. Desde la raíz, PowerShell 7.2+:

```powershell
$b2ReviewDirectory = Join-Path $env:TEMP ('dlv-b2-review-' + [guid]::NewGuid().ToString('N'))
pwsh -NoProfile -File .\scripts\New-ReviewBundle.ps1 -Baseline 4e99c6f75966541035a454d786b5e7beedfbe111 -OutputDirectory $b2ReviewDirectory -Boundary Section -PackageJsonPolicy Incorporated -ScriptsCheckpoint a793d459c841814291c1e3c0887c8bf7b77ecc10
Get-Content -LiteralPath (Join-Path $b2ReviewDirectory 'manifest.md')
```

STOP para revisión externa B2. El usuario realiza aceptación y checkpoint manual; 2.5 continúa pendiente y B3/B4 no se inician.

## Cierre B2 confirmado por el usuario

USER-REPORTED: revisión externa aprobada y aceptación manual completada en Web y BlueStacks (emulador Android). El usuario realizó el checkpoint manual; HEAD y remoto verificados en e75d813dd3e9508bb417e1b756e52fc22d5d3d08, árbol limpio antes de B3. 2.5 ya estaba marcada en ese checkpoint. No se inventa versión de navegador/build/emulador ni se hereda esta aceptación a B3 o a release físico.
