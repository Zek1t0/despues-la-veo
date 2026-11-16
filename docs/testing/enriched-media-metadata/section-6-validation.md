# S6 — Actualizaciones e historial

Fecha: 2026-11-16, America/Buenos_Aires. Change `add-enriched-media-metadata-and-library-updates`. Implementadas exclusivamente 6.1–6.5. **6.6 pendiente** de revisión externa, aceptación manual y checkpoint Git. S7/S8 no implementadas.

## Checkpoint y alcance

- Rama verificada: `feat/anime-catalog-manual-entries`.
- HEAD: `77e0588f9549d742215ce3a38ed4f03405d4df35`, `feat: add individual and automatic metadata refresh coordination`.
- Staging y worktree iniciales limpios. El commit incluye la corrección final de Retry-After y sus regresiones.
- 5.7 cerrada **administrativamente** por checkpoint y revisión informados por el usuario: aceptación Web limitada, sin reproducción manual de HTTP 429 y sin Android comprobado. No equivale a aceptación visual S6.
- OpenSpec: 36/46 tareas completas; 6.6 pendiente. Sin Git de escritura, archive/sync/merge ni modificaciones del change anterior.
- SQLite v7, backup v8, dependencias, gates, políticas de imágenes y defaults automáticos permanecen vigentes.
- Inventario preciso de nuevos/modificados: `section-6-inventory.json`. Comprobaciones: `section-6-checks.json`.

## 6.1 — Actividad transaccional

`libraryActivityRepo` reutiliza la tabla/índices/FK v7 y el contrato portable de actividad v8. Los componentes no insertan eventos.

| Operación | Camino central | Resultado |
| --- | --- | --- |
| Alta remota | `savedTitlesRepo.saveProviderTitleWithDb` | Un evento personal `added`. La metadata inicial se guarda sin un segundo evento. |
| Alta manual | `manualContentEntries.createManualContentWithDb` | `added` tras guardar identidad/baseline. |
| Edición manual | `editManualContentWithDb` | `manual-edit` solo ante diferencias. Tipos compatibles: título, sinopsis, clasificación. El año conserva la descripción genérica de edición manual: no se inventa una fecha ni se amplía el contrato portable. |
| Estado/tags/notas | `updateSavedTitleMetadataWithDb` y el wrapper público `upsertSavedTitle` | Un evento con los nombres de campos efectivamente cambiados, incluso en una operación combinada. |
| Rating personal | `setPersonalRatingWithDb` | `personalRating`, únicamente si cambia el valor. |
| Pins | `pinTitleWithDb`, `setTitlePinStateWithDb`, `unpinTitleWithDb` | `pin` personal, sin favoritos independientes y sin duplicar no-ops. Unpin público usa transacción. La limpieza derivada de tags no genera otro evento independiente. |
| Metadata remota | Escritor S2 `updateMediaMetadataWithDb` | Conserva su idempotencia; ahora resume solo campos semánticamente modificados. No-op/checkedAt no genera actividad. |

El evento se escribe dentro de la misma transacción de datos. Solo guarda ID local, tipo/origen, reloj, nombres de campos y clave de operación: no valores completos de notas/tags, payloads HTTP o credenciales. Pins sobre títulos remotos siguen siendo acciones personales.

`libraryActivitySignals` marca escrituras dentro de la operación. `storageMutationQueue` publica únicamente después de resolver exitosamente al dueño serializado de la transacción. Un rollback no deja eventos ni publica ese resultado; su marca interna tampoco se filtra a un no-op posterior. Se conserva la invalidación S2 de proyección y se añade una señal acotada de actividad para cambios personales/importación.

Importar continúa usando los caminos de merge, no los de alta interactiva: no sintetiza eventos. Los eventos v8 existentes conservan remap/deduplicación y se notifican después del commit. No se alteran reglas personales de merge ni timestamps históricos. Las mutaciones personales que históricamente avanzaban su reloj en un no-op conservan esa semántica, pero no generan actividad falsa.

## 6.2 — Retención e integridad

- Eventos: 90 días y 2000 filas; ambos límites se aplican en SQL al escribir y al leer páginas. El borde exacto de 90 días permanece; se elimina lo anterior.
- Runs terminados: 30 días y 20, ordenados por finalización (inicio como fallback). Los `running` están protegidos; la escritura protege el run que está finalizando. No se infiere que un `interrupted` esté completo.
- Errores: el manager/repo mantienen máximo 100 detalles y el contador completo. La UI agrega motivos seguros e indica truncamiento, por ejemplo 100 detalles de 150 fallos.
- Página: 40 eventos, límite técnico 100, cursor estricto `(occurredAt,eventId)` descendente. Empates temporales ordenados por ID. Se usan índices v7; no se materializa el historial completo en JavaScript.
- La FK elimina eventos identificables al borrar el título. La lectura usa JOIN con títulos existentes y la navegación revalida existencia. Los resúmenes de runs contienen números/códigos, sin referencias identificables de títulos.
- `metadataRunRepo.lastCompleted()` consulta independientemente la última revisión `completed` retenida. Un intento parcial/cancelado/interrumpido no reemplaza esa fecha.
- El lector valida que procesados sea la suma terminal y que procesados + pendientes = total. Un resumen inconsistente se presenta como error recuperable de lectura.

La fixture S5 de runs ahora inyecta su reloj sintético al repositorio para que la política nueva no elimine sus fechas de 1970. Es una adaptación de prueba, no un cambio de los relojes productivos.

## 6.3–6.5 — Pantalla y coordinación

Cinco tabs: Librería, Buscar, Etiquetas, Actualizaciones, Ajustes. Librería sigue como entrada principal. Se usan Ionicons, etiquetas visibles/accesibles, tokens del tema y safe areas. La altura de la barra se adapta al ancho y escala de fuente, sin reducir ni limitar indiscriminadamente las letras.

`libraryUpdatesService` expone lecturas locales y el **mismo** `metadataRunManager` de S5. No crea otro coordinador. La cabecera muestra inicio del último intento, última finalización completa conocida, estado, progreso y errores/omisiones. Tiene acción explícita y cancelación; doble toque se controla en UI y en el manager. Al capturar IDs muestra preparación, sin presentar un total ficticio. Sin servicio disponible la acción está deshabilitada y se ofrece relectura ante fallo.

Las suscripciones entregan progreso en memoria. Solo se relee el resumen al montar/finalizar/reintentar; no hay polling en cada render. Navegar no cancela el run global. Al volver, se observa el handle activo o el resumen persistido. Reinicio conserva `interrupted`, sin reanudación. Abrir la pestaña no llama `start()` ni consulta proveedores.

El historial usa FlatList virtualizada, páginas locales, filas de día y filtros **Todos / Metadata / Mi actividad**. Cambiar filtro no modifica datos. Las lecturas se coalescen y se descartan resultados obsoletos; listeners se limpian al desmontar. El foco/retorno a foreground relee localmente para contemplar cambios de zona horaria o datos; no inicia refresh global.

La agrupación usa la fecha local del dispositivo, no UTC. Las filas muestran descripciones breves, sin valores privados. El título se resuelve mediante la proyección/idiomas S4 sobre la ficha vigente; cambiar idioma no modifica identidad, eventos ni documentos y no consulta HTTP. Antes de navegar se comprueba que la ficha exista. La UI conserva estados de vacío/offline, carga, error y reintento; el progreso tiene role/value/live region accesibles.

## Pruebas y evidencia

Reproducción: `node docs/testing/enriched-media-metadata/section-6-regressions.cjs`.

**Resultado: 53/54 suites aprobadas. Las seis suites nuevas S6 pasan. Hay un fallo preexistente del baseline**, descrito abajo. Salidas completas y exit codes: `section-6-results.json`. Primera pasada de regresiones previas: `section-6-prior-results.json`.

| Nueva suite | Evidencia |
| --- | --- |
| `section-6-activity.cjs` | SQLite real: altas/manual, operación personal combinada, rating, pins, origen personal en remoto, no-op/idempotencia, rollback/poscommit, privacidad, metadata real/no-op y cascade. |
| `section-6-retention.cjs` | Reloj y SQLite real: fronteras 90/30 días, 1999/2000/2001 eventos, 19/20/21 runs, activo protegido, cursor con empates sin duplicados, filtros, 150 errores/100 detalles y última completada independiente. |
| `section-6-tabs.cjs` | Componente real con host simulado: orden, iconos, etiquetas, anchos 320/390/800 y escalas 1/1.6/2 sin encoger fuentes. |
| `section-6-run-ui.cjs` | Pantalla/cabecera: no start al montar, doble toque, cancelación, estados, fecha de completada independiente, error/reintento, remount y cleanup, progreso accesible y truncamiento. |
| `section-6-feed.cjs` | FlatList, filtros, páginas/dedup, navegación/borrado, suscripciones y lectura tardía tras unmount, reintento, idiomas sin lectura SQL extra, zona UTC/Argentina y retorno a foreground. |
| `section-6-service.cjs` | SQLite real: 500 no-ops → un resumen y cero eventos; un cambio → un evento; export/parse/import v8 de 500 títulos/reimport sin altas falsas; borrado seguro; manager con 150 fallos/100 detalles; reapertura `interrupted` sin reanudar. |

Las regresiones incluyen contratos, SQLite, backups, fuentes, datos personales, invalidaciones, coordinación S5, HTTP/Retry-After y automática. Ninguna suite S5 falla. Los transportes/capacidades de proveedor se inyectan: **no son HTTP real**. Los hosts de hooks ejecutan componentes reales con React/native simulados: **no son aceptación visual**.

TypeScript, OpenSpec estricto, `git diff --check` y exportación Metro Web se registran en `section-6-checks.json`. Exportación: `$env:EXPO_OFFLINE='1'; npx expo export --platform web --output-dir .expo/s6-web-validation-20261116`. Es compilación estática local, no ejecución/aceptación visual ni despliegue. Advertencias de Browserslist/NO_COLOR no motivaron cambios de dependencias.

## Fallo preexistente y límites reales

La suite `docs/testing/tmdb-user-credential/section-2-verification.cjs` escanea también toda la documentación y rechaza un nombre de variable legacy presente en la salida de Metro guardada en `section-5-checks.json`. Se comprobó que ese texto ya existe en **HEAD S5**, y que tanto la suite como ese artefacto permanecen sin cambios. Es el nombre en un log histórico, no una credencial agregada por S6. No se eliminó evidencia aprobada ni se modificó la suite del change anterior para ocultar el fallo. El runner conserva su exit code 1 y el resultado no se presenta como totalmente verde.

Smoke Web intentado: Metro local puerto 8096, origen separado para no tocar la biblioteca habitual. El in-app browser terminó con timeout de conexión; la comprobación local del entorno devolvió denegación de acceso al socket. El comando Metro se detuvo. No se observó la pantalla de aplicación ni se realizó aceptación visual S6.

Android: sin recorrido real/emulador/dispositivo validado; no se atribuye aceptación Android. Paletas, fuentes y navegación reales quedan para 6.6. La compilación y los componentes simulados no sustituyen ese checkpoint.

**Estado exacto:** 5.7 cerrada administrativamente; 6.1, 6.2, 6.3, 6.4 y 6.5 implementadas con las verificaciones anteriores; 6.6 pendiente. Sin checkpoint Git ni trabajo S7/S8.
