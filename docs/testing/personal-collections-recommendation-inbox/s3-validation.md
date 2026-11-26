# S3 — Portabilidad, restauración e integridad

Fecha: 2026-11-20. Change: `add-personal-collections-and-recommendation-inbox`.

## Preflight y estado de entrega

- Rama inicial/final: `feat/personal-collections-recommendation-inbox`.
- HEAD inicial/final: `99144ede296a5694ad6dfdce34e2080d7abdaa5b`, checkpoint S2. S1: `78a955ab14c764dca77d1fb18d17cf116436b7d4`, ancestro de S2.
- Origin confirmó directamente `99144ede296a5694ad6dfdce34e2080d7abdaa5b` para esta rama mediante `git ls-remote`. La consulta inicial en sandbox falló por DNS; la repetición autorizada de solo lectura tuvo éxito. No se hizo fetch ni se alteraron referencias.
- Worktree e índice iniciales limpios. Índice final vacío; cambios S3 sin staging. No había cambios ajenos pendientes de revisión.
- Se leyeron proposal, design, tasks y los tres deltas. Esquema OpenSpec spec-driven; estado inicial ready, 8/15 tareas. No se recrearon artefactos ni se sincronizaron specs.
- 3.1–3.3 completas. 3.4 tiene evidencia automatizada de atomicidad/integridad pero sigue abierta por validación pendiente de runtimes SQLite Android/Web. 3.5 abierta por aceptación manual. 1.5 y 2.5 sin cambios: no se cerraron por administración. Progreso: 11/15.
- Sin staging, commit, push, merge, sync de specs ni archive. No hay nuevas funcionalidades ni rediseño.

## Corrección de producción

Se encontró un defecto mediante SQL real: dos items válidos del archivo con referencias disjuntas pueden resolver al mismo título local multirreferenciado. Antes, sus membresías se escribían por separado: contadores insertado/actualizado para una sola pareja efectiva y ganador por orden del array ante updatedAt igual con addedAt contradictorio.

`organizationBackupImport.ts` ahora agrupa después del remapeo por colección/ID local efectivo. Cada pareja es una sola unidad/savepoint y un solo contador; selecciona la versión entrante de mayor updatedAt. Si las versiones más recientes empatan con addedAt distinto, omite esa unidad y reporta el conflicto sin modificar la local. Después compara con el reloj local: mayor actualiza, igualdad/viejo conservan. Una entrada posterior estrictamente más reciente puede resolver un empate anterior. La prueba cubre referencias TMDB/Kitsu disjuntas que convergen en el mismo ID local, fechas en ambos órdenes y contradicción empatada.

No cambian SQLite v8, backup v9, claves canónicas, relojes personales ni gates. El resto de los cambios son pruebas/evidencia y estado documental.

## Matriz de SQLite

| Escenario | Resultado verificado en node:sqlite TEST |
| --- | --- |
| Instalación nueva v0→v8 | Tablas, índices, CHECKs, FKs y triggers completos |
| v7→v8 mixta | Comparación exacta de todas las filas preexistentes: títulos, proveedores, manual portable, estado/rating/notas/tags/pins, metadata editorial y baselines/selecciones, actividad, preferencias y timestamps personales |
| Fallo afterV8TablesCreated | Rollback completo, user_version=7, ninguna tabla parcial |
| Fallo antes/después de publicar v8 | Rollback completo de datos/DDL/user_version |
| Reapertura repetida v8 | Sin recreación ni duplicados; comparación exacta; cierre/reapertura de archivo cubiertos también por S1/S2 ejecutados en esta sesión |
| Versión futura 99 | Rechazo sin reset ni modificación de filas/version |
| PK/UNIQUE/índices | Pareja de membresía única, referencia Inbox no única, verificación de esquema vigente |
| CHECK/FKs/triggers | Incorporada sin vínculo rechazada; original inmutable; FK activa; cascadas y reapertura de todas las recomendaciones al borrar título |
| Integridad | foreign_key_check vacío e integrity_check=ok para todas las bases de las matrices S3 |

No se ejecutó una migración contra datos personales ni se añadió una versión de esquema.

## Matriz de backups y contratos históricos

| Formato | Restauración real y contrato conservado |
| --- | --- |
| v1 | Títulos TMDB/manuales legacy, personales y fechas; sin autoridad sobre pins/rating de versiones posteriores; rating nuevo null y rating local conservado |
| v2 | Contrato v1 + pins; rating de versiones posteriores no tiene autoridad |
| v3 | Rating requerido/restaurado; referencias históricas y pins |
| v4 | Contrato histórico + parser de Appearance; conservación de configuración cuando ausente |
| v5 | Referencias completas y clasificación histórica; manual local-only repetido reporta conflicto si carece de identidad, nunca se fabrica equivalencia ni copia adicional |
| v6 | Clasificación neutral, referencias multifuente, personales/pins y null; no restaura documentos editoriales v8 |
| v7 | Identidad manual portable y legacy, remapeo estable, personales/pins |
| v8 | Documentos por fuente, baseline/selección, relojes de metadata, preferencias y actividad, identidad y personales |
| v9 S1 | Colecciones vacías/pobladas y membresías; recommendations ausente es válido, no borra Inbox local |
| v9 S2/S3 | Colecciones + Inbox de todos los estados, captura original/actual y vínculos portables |

Para cada v1–v8: importación en base vacía, título TMDB y manual; reimportación en base poblada; edición personal local más reciente conservada; colecciones/recomendaciones locales conservadas aunque el archivo histórico incluya campos v9 inválidos. Tests históricos existentes amplían referencias/legacy/local-only, metadata por fuente y pins. Los parsers históricos no se modificaron.

En v9 se verificaron secciones opcionales ausentes, secciones vacías, mezcla de unidades válidas/relaciones irresolubles, JSON globalmente malformado, contenedores incorrectos y versión futura. Rechazo global antes de escribir; errores por registro informados sin eliminar unidades válidas. El parser mantiene duplicados idénticos de organización como una unidad e invalida IDs/parejas contradictorios, sin elegir por orden de entrada.

## Matriz de identidad, conflictos y remapeo

| Caso | Resultado |
| --- | --- |
| Misma identidad portable, ID de archivo diferente | Reusa el ID local efectivo; títulos antes de relaciones |
| ID local ocupado por otra identidad manual | Crea/remapea destino válido; jamás vincula al ocupante casual |
| Obra con referencias múltiples | Resuelve por identidad completa; convergencia de referencias disjuntas deduplica pareja efectiva |
| Identidades que resuelven destinos incompatibles | Item omitido/conflicto; no genera mapa falso; relaciones dependientes omitidas o recomendaciones Pendientes |
| Colección inexistente/existente, nombre/descripcion distintos | Merge por ID; nombre repetido no identifica ni fusiona |
| updatedAt remoto mayor/local mayor/igual | Mayor aplica; local mayor/igual conserva; createdAt local intacto |
| Membresía repetida/remapeada | Una pareja efectiva, addedAt/updatedAt independientes del reloj de colección |
| Membresía previamente eliminada | Puede recuperarse desde backup: merge aditivo sin tombstones |
| Recomendación en los tres estados, persona/comentario editados | Merge por ID y reloj propio; originalCapture intacta |
| OriginalCapture contradictoria | Conflicto reportado antes de comparar frescura; local preservada |
| Dos personas, misma referencia/obra | IDs/contextos separados, vínculos al mismo título permitidos |
| Vínculo irresoluble | Pendiente/null conservando captura, campos actuales y reloj entrante; reparación reportada |
| Un título compartido entre dos colecciones | Recupera ambas membresías sin duplicar título |
| Registros ausentes | Sin efecto destructivo |

Se probó la tabla completa de fechas mayor/igual/menor para colecciones y membresías, y las nueve combinaciones de fecha/estado para recomendaciones. Las pruebas de S2 comparan filas completas al vincular existentes, incluidos metadata, relojes personales, identidades, pins y actividad: no hay refresh incidental.

## Round trip real v9

Base A TEST mixta → snapshot transaccional de exportación → v9 → Base B TEST vacía → nueva exportación y comparación semántica completa. Incluye manual portable, TMDB/Kitsu/MangaUpdates, multirreferencias, rating, estado, notas, etiquetas, pins, metadata sensible, actividad reciente, preferencias, Appearance, colección vacía, título compartido y recomendaciones Pendientes/Incorporadas/Descartadas de distintas personas, con enlace/comentario y edición posterior a la captura original.

Se repitió la importación tres veces: sin títulos, membresías, recomendaciones ni eventos duplicados; mismos datos portables/personales. Se repitió con IDs del archivo cambiados y con colisión de ID manual. La equivalencia semántica remapea las referencias de items/pins/miembros/recomendaciones/actividad por identidad portable y ordena arrays; no exige igualdad de exportedAt ni de IDs locales legítimamente remapeados. Los documentos editoriales completos sí se comparan. La revisión interna de escritura de metadata no pertenece al formato portable; no se confunde con fechas personales.

El filtro sensible no reduce el export: título, miembros, recomendaciones y metadata se conservan. La regresión de render aplica la preferencia a Biblioteca/Tags/Buscar/Colecciones/Inbox después de leer/restaurar los mismos contratos de datos.

## Fallos inyectados y atomicidad

| Punto de fallo | Resultado |
| --- | --- |
| Crear colección / insertar miembro | Rollback de operación pública; snapshot previo exacto; cero invalidaciones |
| Vincular recomendación existente | Sin transición ni alteración del título |
| Crear título e incorporar recomendación | Fallo de vínculo revierte título, referencia, metadata, actividad y transición |
| Eliminar título después de cascadas/trigger | Error AFTER DELETE revierte título, membresías y reapertura de recomendaciones juntos |
| Commit de colección/Inbox/incorporación | Snapshot exacto, sin publicación |
| Commit de importación completa | Sin títulos/relaciones parciales ni publicación de preferencias/organización/Biblioteca/actividad |
| Restaurar título | Savepoint omite item fallido; no entra al mapa; recomendaciones dependientes recuperadas Pendientes |
| Restaurar colección | Unidad revertida; miembros dependientes omitidos; otras colecciones válidas |
| Restaurar membresía | Unidad revertida; otras parejas válidas; contador real |
| Restaurar recomendación | Unidad revertida; otros contextos válidos, incluso compartiendo título |
| Tres imports/mutaciones/incorporaciones concurrentes | Cola pública serializa; máximo una transacción activa; sin anidamiento ni duplicación |

Los observadores de Biblioteca, organización, preferencias y actividad registran si se publica dentro de transacción: no hay publicaciones prematuras ni después de fallos. Se distingue rollback de operación completa de savepoints por registro. Esta evidencia ejecuta SQLite real Node; no acredita el runtime expo-sqlite Android/Web.

## Regresiones y validaciones de esta sesión

17/17 suites focalizadas pasan. Logs y resultados por comando en `s3-results.json`; fallos previos y baseline de producción S2 en `s3-inherited-results.json`. Runner reproducible: `node docs/testing/personal-collections-recommendation-inbox/s3-regressions.cjs`.

- S3 portability/conflicts/failures/settings: matrices nuevas y handlers reales de Ajustes con SQLite TEST. Export completo; cancelar confirmación sin writes; import/reimport real; contadores/informe, malformado y recuperación Pendiente. DOM, descarga y selección de archivo simuladas: no es aceptación manual Web.
- S1/S2 verification + UI: migraciones, Colecciones, Inbox, captura, resolución, vinculación/incorporación y rollback; layout de componentes a 320–400/escritorio, fuente ampliada y paletas; visibilidad sensible, navegación y menú/foco/Escape.
- Universal-media-identity backup v5: identidad, remapeo y compatibilidad histórica.
- Metadata backups: v8, v7, relojes por fuente, conflictos, preferencias, savepoints y commit.
- Expanded domain: proveedores/gates vigentes, guardado genérico, personales, null, rating y contrato v6.
- Activity + feed + tabs: actividad real SQLite, feed/Actualizaciones, cinco pestañas y accesibilidad de componentes.
- Sensitive UI: Biblioteca Detalle/Mosaico, Etiquetas, Buscar, preferencias y contenido oculto sin arte/HTTP.
- Buscar histórico actualizado y picker: identidad completa, rutas y «¿Qué veo hoy?».

Se ejecutaron de nuevo las regresiones previas; no se asumió que seguían pasando. Se evitó el runner histórico de todas las secciones, que repetiría suites no relacionadas. Después de corregir expectativas se repitieron solo las afectadas; después de ampliar fixtures v7 se repitieron las cuatro matrices S3. Los resultados previos fallidos se conservan en la evidencia.

### Expectativas heredadas corregidas con evidencia

1. `section-6-tabs.cjs`: esperaba texto visible «Actualizaciones». La ruta, título y label accesible siguen «Actualizaciones», pero el rediseño aprobado anterior (`be71199`) muestra «Actividad». Solo se corrige el texto visible esperado; se conservan ruta/orden/accesibilidad/icono/escala.
2. `expanded-media-domain/section-8-verification.cjs`: comparaba sidecars metadataState/localAliases al restaurar v6, pese a que su parser no les da autoridad (documentos editoriales desde v8). Ahora exige igualdad completa de los campos del contrato v6, incluidos todos los personales, clasificación, referencias y pins, y prueba explícitamente que el payload parseado no contiene el sidecar. También esperaba user_version=6 después de inicializar con el migrador actual: ahora exige DATABASE_SCHEMA_VERSION y foreign_key_check limpio. No se cambiaron parsers ni gates para satisfacer el test.

Ambos fallaban usando producción de HEAD S2 antes de la corrección; el probe en memoria reemplazó únicamente el importador modificado por su versión `git show HEAD:...`, sin checkout ni writes de producción. La revisión de los parsers históricos y del layout identifica por qué las expectativas son obsoletas.

### Comprobaciones finales

| Comando/control | Resultado |
| --- | --- |
| `npx tsc --noEmit` | PASS |
| `EXPO_NO_DOTENV=1 EXPO_OFFLINE=1 npx expo export --platform web --output-dir s3-web-review` (variables PowerShell; <VARIABLE_TMDB_LEGACY> quitada del proceso hijo) | PASS: 1022 módulos, bundle Web completo. Artefactos trasladados a `dist/s3-reviewed-build`, ignorado por Git |
| `npx openspec validate add-personal-collections-and-recommendation-inbox --strict` | PASS |
| `git diff --check`, incluyendo cada nuevo con `git diff --no-index --check NUL archivo` | PASS; sin staging, normalizando únicamente finales de línea de archivos S3 cuando fue necesario |
| package.json/lockfiles/dependencias/providers/gates/schema | Sin cambios |

Avisos del build: Browserslist antiguo y NO_COLOR/FORCE_COLOR; sin actualizar dependencias. Build sin dotenv ni credenciales personales. No se exportó el sentinel secreto introducido en app_preferences TEST, ni contenido binario, filas SQL internas o preferencias excluidas. No se consultaron proveedores productivos ni enlaces de captura; pruebas offline bloquean fetch.

## Aceptación real, informada y excepciones

**Automatizado:** 17 suites, SQLite Node real y harness de componentes/hooks; build Web. **Informado por el usuario:** presentación general S1/S2 aprobada y checkpoint S2 publicado; no equivale a aceptar todos los recorridos de plataforma. **Manual ejecutado aquí:** no hubo recorrido visual funcional completo.

Se intentó un origen TEST nuevo `http://127.0.0.1:43193`, separado de los orígenes de Biblioteca existentes, con COOP/COEP, build sin dotenv y servidor limitado al bundle. El navegador integrado falló con `net::ERR_CONNECTION_TIMED_OUT`. La alternativa nativa sobre la ventana Brave falló dos veces con `computer-use request timed out: get_window_state`, después de volver a inventariar ventanas. No se enviaron acciones de entrada ni se usó la biblioteca personal. El servidor se detuvo y el bundle quedó bajo dist ignorado.

No se ejecutaron Android físico, emulador, TalkBack ni SQLite Web/Android de extremo a extremo; no se declara aceptación visual ni restauración manual real. La falta de esas comprobaciones mantiene abiertas 1.5, 2.5, el extremo de plataforma de 3.4 y 3.5. No hay un defecto técnico conocido pendiente tras las matrices Node; falta evidencia de plataforma, no se reemplaza por una casilla marcada.

## Recorrido único mínimo pendiente Android/Web

Usar una instalación/origen TEST nuevo y dos destinos A/B separados. Nunca importar/restaurar sobre la biblioteca personal. Puede usarse el generador `representative()`/`exported()` de s3-fixtures para producir un v9 sintético; no contiene credenciales ni datos personales reales.

1. Crear o importar en A títulos TEST manual/proveedor, con rating/notas/tags/pins y al menos un sensible. Crear colección vacía y dos colecciones compartiendo título. Desde ficha y colección, agregar/retirar miembros y confirmar borrado de colección conservando Biblioteca.
2. Capturar offline por nombre/URL/referencia, editar y consultar original; dos personas recomiendan una obra. Descartar/reabrir. Buscar «Spiderman» sobre títulos TEST «Spider-Man»: confirmar manualmente homónimo y verificar que ocultos no aparecen. Cero solicitudes al pegar/capturar/abrir.
3. Vincular existente conservando todos sus personales; incorporar manual y remoto elegible, regresar a recomendación y repetir sin duplicar. Probar gate cerrado/sin credencial y fallo de red conservando Pendiente/borrador. Nunca abrir URL automáticamente.
4. Exportar v9 desde Ajustes en A; cancelar una importación en B (sin cambios); luego importar y comparar títulos/personales/identidades/colecciones/membresías/Inbox. Reimportar dos veces. Probar v9 S1 sin Inbox conservando datos locales y archivo malformado sin escrituras.
5. Editar localmente comentario/colección y volver a importar backup anterior/igual: conservar local. Borrar título compartido: todas sus recomendaciones Pendientes con contexto y membresías eliminadas; colecciones vacías conservadas. Reiniciar offline. Un backup previo puede recuperar bajas, por diseño aditivo sin tombstones.
6. Web: escritorio y 320–400 px, claro/oscuro, fuente 200%, teclado/Tab/foco/menú/Escape/retorno, textos largos y sin portadas. Android: formularios con teclado/safe areas, navegación/retorno, reinicio offline, TalkBack y restauración TEST real. Comprobar regresiones Biblioteca Mosaico/Detalle, Etiquetas, Buscar, Actualizaciones, Ajustes, cinco pestañas y picker.

Registrar dispositivo/navegador/build, qué se ejecutó, resultado/errores y aceptación del usuario por cada paso antes de cerrar tareas de plataforma. No introducir cambios visuales por esa aceptación salvo defecto funcional demostrado.

## Riesgos y límites residuales

- Merge aditivo sin tombstones: datos/membresías eliminados pueden reaparecer desde una copia anterior; ausencia no borra. La confirmación de Ajustes ya lo explica.
- Relojes entre dispositivos: updatedAt estrictamente mayor, igualdad local; no causalidad distribuida.
- Conflicto originalCapture o membresía empatada tras remap: registro local preservado/unidad omitida y reportada; requiere revisión de usuario, no fusión automática.
- Manual local-only v5/v6 sin identidad: reimportación defensiva puede reportar conflicto; no duplica ni inventa correspondencia.
- SQLite Node y mocks DOM no sustituyen los runtimes expo-sqlite, permisos/diálogos, descarga/subida del navegador ni accesibilidad física. Gates remotos continúan vigentes.

## Inventario completo del diff S3

Comparado con checkpoint S2 `99144ed`, incluidos todos los nuevos. No incluye artifacts ignorados del build ni archivos TEST temporales fuera del repositorio.

5 modificados + 9 nuevos = 14 archivos.

| Estado | Archivo |
| --- | --- |
| Modificado | `docs/testing/enriched-media-metadata/section-6-tabs.cjs` |
| Modificado | `docs/testing/expanded-media-domain/section-8-verification.cjs` |
| Nuevo | `docs/testing/personal-collections-recommendation-inbox/s3-conflicts.cjs` |
| Nuevo | `docs/testing/personal-collections-recommendation-inbox/s3-failures.cjs` |
| Nuevo | `docs/testing/personal-collections-recommendation-inbox/s3-fixtures.cjs` |
| Nuevo | `docs/testing/personal-collections-recommendation-inbox/s3-inherited-results.json` |
| Nuevo | `docs/testing/personal-collections-recommendation-inbox/s3-portability.cjs` |
| Nuevo | `docs/testing/personal-collections-recommendation-inbox/s3-regressions.cjs` |
| Nuevo | `docs/testing/personal-collections-recommendation-inbox/s3-results.json` |
| Nuevo | `docs/testing/personal-collections-recommendation-inbox/s3-settings.cjs` |
| Nuevo | `docs/testing/personal-collections-recommendation-inbox/s3-validation.md` |
| Modificado | `openspec/changes/add-personal-collections-and-recommendation-inbox/design.md` |
| Modificado | `openspec/changes/add-personal-collections-and-recommendation-inbox/tasks.md` |
| Modificado | `src/storage/organizationBackupImport.ts` |
