## Context

Ver proposal.md para motivación. Baseline inspeccionado: HEAD a5195c51873d117e286e0b442825eb81a046a3c9; rama ya activa feat/anime-catalog-manual-entries; árbol limpio antes del scaffold. No hay otros changes activos. Maintenance & Stability está archivado e integrado y no se reabre.

### Hechos de implementación existentes

- src/core/mediaClassification.ts y SQLite v5 ya representan medium/contentFamily/primaryFormat, anime y movie/tv/ova/ona/special/music. null no es una clasificación negativa. No se crea otra taxonomía.
- src/core/savedTitle.ts y src/core/providerReference.ts separan ID local opaco de cero o varias referencias externas completas. La biblioteca y /title/[id] trabajan localmente.
- src/core/providerSavedTitle.ts refina clasificación monotónicamente en refresh, preserva datos personales y separa initialTags; voteAverage solo puede suministrarlo TMDB.
- src/storage/databaseSchema.ts declara versión 5. Las migraciones existentes conservan IDs, referencias, legacy identities y pins; src/storage/storageMutationQueue.ts serializa mutaciones.
- src/core/libraryBackupV6.ts rechaza exportar local-only sin referencia ni legacyIdentity. src/storage/libraryBackupMerge.ts admite defensivamente v5/v6 con ID libre pero reporta conflicto si está ocupado. Reinterpretar ID como identidad portable cambiaría este contrato.
- Biblioteca tiene filtros solapados (Anime y Películas pueden contener el mismo item), búsqueda por título/tags y vistas existentes. El detalle modifica campos personales, no ofrece todavía edición manual de snapshot.
- Buscar tiene categorías finitas, ProviderSearchCapability y control de respuestas obsoletas, pero algunas ramas aún distinguen TMDB de MangaUpdates de forma binaria. MangaUpdates metadata está habilitado solo en Android; arte productivo sigue omit. Sus gates no se cambian.

### Estado de decisiones

| Clase | Contenido |
|---|---|
| Hecho existente | Identidad universal, clasificación, SQLite5/backup6, merge histórico y restricciones MangaUpdates descritos arriba |
| Dirección solicitada para proponer | Cuatro secciones B1–B4, formulario mínimo, advertencia no bloqueante, Anime como única categoría, Kitsu condicional y exclusiones |
| Recomendación técnica de este diseño | Tabla manual portable 1:1, backup7, alcance de edición local-only, algoritmo de duplicados y defaults operativos iniciales |
| Aprobación pendiente del usuario | Implementar esta propuesta; en particular SQLite5→6/backup6→7, migración/backfill y contratos de edición/import descritos abajo |
| Gate externo pendiente | Elegibilidad Kitsu de metadata/retención/backups; derechos de arte separados; aceptación técnica Android y Web independiente |

Todos los MUST en deltas describen el comportamiento objetivo sujeto a aprobación; existencia de artifacts o validación OpenSpec no significa autorización para APPLY ni clearance externo.

## Goals / Non-Goals

**Goals:** añadir solo la identidad portable que falta; permitir manuales exportables y editables offline; preparar una integración anime delimitada que permanezca inactiva si no pasa sus gates; conservar datos y contratos previos.

**Non-Goals:** no cambiar ID local ni clasificación; no crear registry universal, API de detalle genérica, rating global, backend, SDK ni dependencias. No añadir un catálogo/flujo especializado de libros: el formulario solo reutiliza los medios y formatos existentes, incluida literature si se selecciona. No incluir linking manual o automático en esta entrega.

## Decisions

### D1 — Identidad manual portable aditiva (recomendación pendiente)

Proponer tabla manual_entry_identities con portable_id TEXT PRIMARY KEY NOT NULL y saved_title_id TEXT NOT NULL UNIQUE, FK a saved_titles(id) ON DELETE CASCADE. Token opaco canónico no vacío, generado aleatoriamente independientemente del ID local, no derivado de contenido, provider ni legacy. Exponer manualIdentity opcional como dato separado del snapshot y providerReferences; no fabricar provider=manual. Generación por helper compartido con reintentos acotados (25) ante colisión comprobada, fallo íntegro si se agotan. Verificar disponibilidad real del generador Expo/Android/Web al implementar, sin instalar SDK; no afirmar que Math.random sea criptográficamente seguro. IDs locales históricos siguen siendo strings opacos, no se exige UUID.

Identidad nueva para cada creación manual y para local-only defensivos existentes sin legacyIdentity. Manuales históricos mantienen legacyIdentity como identidad portable suficiente; no se reemplaza ni normaliza. Los ítems con referencias externas no reciben identidad manual por backfill. No se añade un flag mutable de origen: edición de snapshot disponible solo si providerReferences está vacío y existe identidad manual o histórica válida. Si algún futuro linking agrega referencias, requiere otro diseño de propiedad de metadata.

Alternativas rechazadas: reutilizar ID local como identidad global (rompe colisiones/import histórico), fabricar legacyIdentity (miente sobre origen), inventar ProviderReference manual (contradice identidad universal), regenerar identidad en cada export (duplica al reimportar). No se cambia la autoridad local de MediaItem.

Creación manual usa INSERT protegido y genera ID libre; no usar el upsert genérico como comprobación de unicidad. Inserción de item+identidad en una sola transacción pública serializada. Edición relee item y elegibilidad dentro de la transacción, usa un patch limitado y avanza updatedAt con el helper vigente. Borrado usa cascadas existentes y nueva FK. Evitar transacciones anidadas o reinicialización dentro de helpers WithDb.

### D2 — Backup7 e import compatible (recomendación pendiente)

Nuevo src/core/libraryBackupV7.ts, derivado del contrato v6 y no de la reinterpretación de v6: version=7, items con manualIdentity opcional string canónico, referencias/legacy separadas, pins por itemId y Appearance vigente. Un local-only exportable necesita identidad manual o histórica. Mantener validadores v1–v6 intactos en significado y sumar dispatch v7.

Resolución v7: reunir propietarios de todas las identidades suministradas; si apuntan a más de un item, conflicto. Si hay un propietario, conservar su ID local y rechazar medium distinto o identidad manual distinta ya asociada; adjuntar identidades compatibles según reglas actuales antes del control de frescura, sin quitar referencias ausentes. Actualizar contenido solo por updatedAt elegible y presencia explícita; null sigue restaurable como en v6. Si no hay propietario y el ID entrante está ocupado, generar ID libre solo con identidad portable suficiente. Resolver pins mediante mapa itemId→ID final y reglas contextuales/aditivas existentes.

Validar unicidad de manualIdentity entre items del archivo antes de writes, con reporte de todos los items afectados como inválidos (sin elegir ganador por orden), siguiendo la política actual para identidades repetidas. Conflictos de propietarios ya persistidos se reportan como conflictos. Savepoint por item; fallo de asociación revierte item completo; outer transaction/cola e informe parcial vigentes. Appearance se activa después del commit, no se mezcla con fallo de item.

Compatibilidad precisa: v1–v4 resuelven identidades históricas, v5/v6 por referencias/legacy como hoy. Un local-only v5/v6 sin identidad e ID libre puede insertarse y recibe identidad nueva en DB en esa misma mutación, para su siguiente export v7. Reimportar el archivo viejo con ID ocupado sigue siendo conflicto; no prometer deduplicación retroactiva donde el archivo carece de identidad. Dos instalaciones que importaron separadamente ese archivo sin identidad no pueden demostrar igualdad: se requiere decisión futura, nunca merge por título. Un manual legacy reimportado conserva su resolución histórica incluso tras ediciones locales.

### D3 — Un formulario manual breve (dirección solicitada, detalle recomendado)

Ruta propuesta app/manual-entry.tsx con modo crear o editar por id; Biblioteca muestra «Agregar manualmente» incluso vacía/sin red. Navegación post-save a /title/[id]. No agregar entrada Buscar en esta entrega inicial: es opcional y puede reutilizarse más adelante sin otro change para detalles menores.

Título trim obligatorio, medio sin selección implícita, familia/formato opcionales restringidos al medio actual. Año vacío→null; recomendar entero 1..9999, sin inferirlo del título. Resumen vacío→null; no interpretar HTML/Markdown ni descargar enlaces. Sin campos para portada, provider IDs o puntuación externa. Defaults planned, tags=[], notes=null, personalRating=null, metadata restante ausente/null según storage actual. Personalización posterior en detalle existente.

En edición se permiten correcciones explícitas de clasificación, incluida sustitución de un formato conocido; esto no es refresh remoto. Cambiar medio exige selección compatible o confirmación explícita de limpiar familia/formato, no pérdida silenciosa. Preservar resto de campos, createdAt y ambas identidades aplicables. No permitir snapshot-edit de provider-backed ni convertirlo en manual por borrar referencias. Fallos conservan borrador; doble envío deshabilitado y protegido por la identidad de la operación, cancelación no escribe.

Cambiar medio localmente no relaja el contrato import: si el mismo token ya existe en otra biblioteca con otro medium, su restauración reporta conflicto de medio como hoy. No convertir silenciosamente el destino; informar el motivo.

Advertencia local recomendada: comparar títulos trim, whitespace colapsado, minúsculas es y normalización de diacríticos; año igual o desconocido en alguno. Excluir self en edición. Mostrar candidatos de cualquier fuente, abrir detalle local y permitir volver con borrador conservado o «Crear por separado». No búsqueda remota, fuzzy matching, deduplicación ni linking. Diferencias de puntuación fina no son contratos de identidad.

### D4 — Kitsu como candidato, evidencia y gates

Consulta realizada durante PROPOSE, fecha de proyecto 2026-11-12:

| Fuente / prueba | Resultado y límite |
|---|---|
| [Documentación oficial del proyecto](https://github.com/hummingbird-me/api-docs) y [API Blueprint oficial](https://raw.githubusercontent.com/hummingbird-me/api-docs/master/apiary.apib) | Base documentada https://kitsu.io/api/edge; search textual, detail, mappings, lectura pública mayormente sin auth y exclusión NSFW sin auth. Documento legacy en conversión: no acredita comportamiento vivo ni licencia de datos. |
| [Modelo oficial Anime](https://raw.githubusercontent.com/hummingbird-me/kitsu-server/master/app/models/anime.rb) | Enum TV/special/OVA/ONA/movie/music observado; encaja con formatos actuales. No acredita precisión del catálogo. |
| [Términos](https://kitsu.io/terms) | El lector Web solo obtuvo shell que exige JavaScript; no se verificaron cláusulas materiales de uso/retención/backups/arte. No se infiere permiso. |
| GET https://kitsu.io/api/edge/anime?filter%5Btext%5D=cowboy%20bebop&page%5Blimit%5D=1 y GET /anime/1 | Sandbox inicial: DNS falló. Repetición con red: primer search timeout15s; verificación final de search y detail HTTP200 JSON:API sin credenciales, Origin http://localhost:8081 y Access-Control-Allow-Origin: *. Search devolvió un resultado, ID string 1, Cowboy Bebop, subtype TV; detail confirmó esos campos. Respuesta byte[] decodificada UTF-8 antes de validar. Detail incluyó metadata de poster (no se solicitó imagen); X-RateLimit-Limit ausente. No es validación de cuotas, navegador CORS, Android o derechos. |
| Quotas y plataformas | No se verificó cuota numérica oficial vigente, Android físico, browser fetch, preflight ni redirects reales. No se afirma unlimited ni aceptación nativa/Web. |

**Gate metadata M:** antes de cualquier activación productiva, registrar fuente oficial/fecha/cláusulas o autorización suficiente para el uso concreto personal/local-first: tracker independiente, búsqueda/detalle iniciados por usuario, snapshot seleccionado pequeño, retención, cache y backup/export/import, atribución y distribución prevista. Debe especificar límites y usos no permitidos. No exige email individual si términos oficiales bastan. Si retención/backups materialmente inciertos o incompatibles, mantener todo Kitsu productivo inactivo; el usuario no puede sustituir derechos externos con aprobación propia. Sin OAuth ni credenciales personales en este paquete.

**Gate técnico T por plataforma:** después de M, probar host/base actuales, IDs/search/detail/payload real, errores y redirects; Android mediante runtime nativo y aceptación registrada, Web mediante navegador real con el origen/headers exactos de producción, incluidos preflight si corresponde. Probar también que rutas directas rechazan antes de HTTP cuando no habilitadas. Desktop HTTP no sustituye T. Android y Web son objetivos separados; iOS no se activa en esta entrega. Sin proxy/CORS público ni backend para sortear restricciones.

**Gate arte A independiente:** por defecto omit, posterUrl=null tanto en search/detail como materialización. Antes de mostrar arte real se necesita evidencia suficiente para display/hotlink, cache nativa/Web, redirects finales, retención/exportación de URL, atribución y derechos pertinentes; no basta que la API devuelva una URL. Si A sigue pendiente, implementar/activar metadata solo con placeholder cuando M/T lo permitan. No descargar/redistribuir binarios ni hacer pruebas de arte real antes de A. No usar credenciales/URLs privadas. No se incluye tarea de activación de arte: requerir decisión posterior explícita y evidencia A.

Trabajo con fixtures sintéticos propios y transporte inyectado sin red puede prepararse tras autorización APPLY aunque M esté pendiente, siempre sin toggle productivo ni afirmar activación terminada. Si M no se resuelve, B3 no se marca completado como catálogo activo; registrar bloqueo y volver a decisión del usuario sobre diferir activación/ajustar alcance antes del cierre. No sustituir proveedor ni crear otro OpenSpec automáticamente.

### D5 — Integración técnica anime acotada

Proponer cliente/adaptador específico bajo src/providers/kitsu/; búsqueda GET /anime?filter[text]=... y detalle GET /anime/{id}; mappings documentados para inspección pero no se solicitan/adjuntan automáticamente. ProviderReference kitsu/anime/decimal-string. Rechazar IDs cero/negativos/no canónicos y mismatch de DTO; no parseInt para identidad opaca. Usar tipos propios y validación runtime, no DTOs en pantallas.

Reutilizar ProviderSearchCapability, ProviderSearchResult, ProviderMediaDetails, ProviderMaterializationInput y saveProviderTitle. Sin registry ni capability universal de detalle. Ruta app/kitsu/anime/[id].tsx con gate antes de fetch; detalle local ofrece procedencia y navegación remota solo cuando la plataforma está habilitada.

Mapping explícito ya especificado; unknown→null; title canónico válido, año de startDate inequívoco o null, descripción como texto seguro, géneros narrativos mediante allowlist revisada (no importar indiscriminadamente categories/temas). initialTags=[]; voteAverage ausente incluso cuando Kitsu expone score. Sin clasificaciones TMDB nuevas ni backfill de anime por heurística. Re-save usa referencia completa, preserva datos personales y refinamiento monotónico vigente.

Extender categorías/tipos/destinos finitos y presentar errores por source explícita: no usar «no es TMDB entonces es MangaUpdates». Una categoría Anime para todos los formatos; sin filtros OVA/ONA/especial. Reutilizar debounce 350ms y scope/sequence; timeout/abort, navegación y reintento invalidan respuestas viejas. Adaptar mensajes provider-specific, sin cambiar credenciales TMDB.

Valores operativos recomendados, no cuotas atribuidas al proveedor: un request en vuelo por cliente, inicio espaciado al menos 1s, timeout 15s, cache solo memoria 5min/50 entradas si M lo permite, sin polling/prefetch de catálogo. Sin reintento automático inicial; Retry-After válido bloquea solicitudes durante la espera, valor excesivo o inválido produce espera/mensaje seguro y reintento manual sin bucles (no truncar espera oficial y reintentar antes). Revisar estos valores contra límites oficiales observados antes de activar. No persistir respuestas search; persistir solo snapshot elegido autorizado. Distinguir 404, 429, offline, timeout, 5xx y payload inválido; jamás usar caché/credenciales para eludir gate.

### D6 — Archivos y fronteras previstas

| Área | Archivos existentes / nuevos previstos |
|---|---|
| Identidad manual | src/core/savedTitle.ts; nuevo src/core/manualEntryIdentity.ts; src/storage/savedTitleStorage.ts; nuevo src/storage/manualEntryIdentities.ts |
| SQLite/bootstrap | src/storage/databaseSchema.ts, src/storage/db.ts, src/storage/savedTitleIntegrity.ts |
| Backup/import | nuevo src/core/libraryBackupV7.ts; src/core/libraryBackup.ts; src/storage/libraryBackupExport.ts; src/storage/libraryBackupMerge.ts; app/(tabs)/ajustes.tsx |
| Manual | nuevo src/core/manualContentEntry.ts; src/storage/savedTitlesRepo.ts; nuevo app/manual-entry.tsx; app/(tabs)/libreria.tsx; app/title/[id].tsx |
| Anime | nuevos src/providers/kitsu/{client,transport,validation,mapping,identity,errors,availability,attribution}.ts y app/kitsu/anime/[id].tsx |
| Composición | src/components/search/{searchCategories,useCategorySearch}.ts; app/(tabs)/buscar.tsx; app/_layout.tsx si requiere registro; src/components/ProductionRootLayout.tsx según composición vigente |
| Regresión/review | docs/testing/anime-catalog-manual-entries/* nuevos; fixtures/MediaReview bajo src/dev/mediaReview solo por composición sintética; reutilizar suites existentes |

Cards, libraryView, etiquetas, appearance y TMDB deberían consumir contratos existentes sin cambios funcionales; editar solo si integración demuestra necesidad concreta. Mantener clasificación y parsers históricos como autoridad; no modificar package.json/package-lock.json. Archivo nuevo concreto puede consolidarse al implementar sin cambiar fronteras ni contratos. No escribir pruebas en datos personales.

## Risks / Trade-offs

- [ID local confundido con identidad portable] → tabla 1:1 y resolución de todas las identidades antes de writes/frescura; casos de colisión y remapeo con pins.
- [backfill aleatorio en instalaciones separadas] → no prometer equivalencia retroactiva sin identidad compartida; archivos v7 sí reimportan por token persistido.
- [migración cambia datos personales] → comparar todas las columnas/relaciones, inyectar fallos antes/después de cada fase y comprobar reapertura; no avanzar timestamps por backfill.
- [arte o metadata sin derechos verificados] → gates M/A separados, producto cerrado por defecto; fixtures y pruebas no son permisos.
- [API/documentación legacy difiere de runtime] → verificar payload/host/quotas reales y T por plataforma antes de activación; sin dependencia adicional.
- [scope crece con libros o linking] → selector existente no habilita catálogo nuevo, y mappings externos nunca se adjuntan.
- [UI cambia mientras hay escritura pendiente] → relectura transaccional, intents/estado existente, doble envío protegido y borrador conservado al inspeccionar duplicados.

## Migration Plan

Plan candidato sujeto a aprobación explícita antes de B1; esta fase no migra nada.

1. Antes de ejecutar sobre datos del usuario, conservar copia consistente y verificable de la base v5 con la app cerrada (incluyendo tratamiento correcto de WAL/sidecars) y un backup v6 cuando sea exportable. Un local-only defensivo puede impedir export v6: el JSON no sustituye esa copia de DB. Preparar/ensayar recuperación en fixture aislado.
2. Conservar cadena de migraciones históricas hasta v5. Instalación vacía crea v6; una anterior llega por sus migraciones vigentes y luego ejecuta v5→v6.
3. En una sola transacción crear tabla de identidad manual, sus restricciones/FK e índice UNIQUE; asignar token a local-only sin referencias/legacy, sin actualizar filas saved_titles ni timestamps. El generador evita colisiones de token; la FK exige item existente.
4. Comparar items/snapshots/relaciones/preferencias contra baseline, verificar FK/cascadas/unique, correspondencia de backfill y ausencia de identidades fabricadas. Publicar user_version=6 solo dentro de la transacción una vez verificado todo.
5. Inyectar fallos de creación/asignación/verificación/publicación/commit. Fallo devuelve v5 completo y sin tabla parcial. Reapertura exitosa no regenera tokens.
6. Export por defecto v7 únicamente con el runtime aprobado; importar 1–7 y aplicar reglas por versión. Backup6 anterior sigue importable; no prometer exporter antiguo para estados nuevos.
7. Reversión después de commit: no bajar PRAGMA ni eliminar tabla para fingir v5. Restaurar copia consistente previa con aplicación anterior o usar versión compatible que preserve v6. Datos nuevos posteriores a la copia requieren recuperación mediante runtime compatible; app vieja no lee backup7. Documentar esta pérdida potencial antes del checkpoint, no ejecutar recuperación destructiva automáticamente.

## Validation and section boundaries

Cuatro secciones B1 identidad/backup, B2 manual UI, B3 catálogo condicional, B4 integración/regresión. Cada sección incluye tests pertinentes, TypeScript, revisión del diff real y un checkpoint manual antes de pasar a la siguiente; no commits automáticos ni gates duplicados por detalle menor. B4 reúne regresión final; revisión externa posterior y archive/review/checkpoint/integración siguen siendo etapas separadas solicitadas por el usuario.

| Matriz | Casos de aceptación |
|---|---|
| SQLite | nueva/histórica/v5→v6, snapshot completo, legacy exacta, local-only backfill, colisión generador, rollback por fase/commit, reopen, esquema futuro, FK/cascadas |
| Backup | imports1–6 con resultados históricos, export/import7, reimport tras remap, tokens inválidos/duplicados/contradictorios, frescura/presencia/null, pins contextual/aditivo, Appearance poscommit |
| Manual | offline create mínimo/completo, validación título/medio/año, compatibilidad familia/formato, doble submit, cancelar/fallo, editar preservando identidad/createdAt/personales, duplicados inspeccionar/volver/separar, delete |
| Identidad | tmdb/movie/N distinto de tmdb/tv/N; manual, Kitsu y MangaUpdates sin colisión por título/ID externo igual; cero/varias referencias; ningún auto-link |
| UI | cards/lista/grid, tags/collages, filtros solapados, búsqueda título/tags, placeholder, navegación remota/local y back, pantallas estrechas/accesibilidad |
| Anime | seis subtipos y unknown, score omitido, IDs mismatched/grandes, payload incompleto, resumen seguro, re-save/personales, 404/429/timeout/5xx/offline, stale query/source/category/retry |
| Plataformas | Web manual y SQLite/backup runtime; Android manual runtime; Kitsu M y T independientes para Android/Web; CORS navegador real; disabled gate sin fetch; iOS Kitsu no habilitado |
| Regresión | TMDB credenciales/search/detail/images/watch providers/save/attribution; MangaUpdates Android metadata/omit/gates Web-iOS; Appearance/ratings/pins y review isolation |

No atribuir una suite Node o export Web a aceptación Android/CORS. Registrar comandos/exits, dispositivos y limitaciones reales. Esta propuesta no repite regresión de Maintenance ni instala dependencias.

## Pending approvals and external gates

- Usuario: aprobar o revisar antes de APPLY el contrato SQLite6/backup7, backfill limitado y recuperación; la aprobación de PROPOSE no los ejecuta.
- Usuario: revisar recomendaciones de edición local-only, año 1..9999 y duplicados exactos normalizados; son diseño propuesto, no decisiones ya aprobadas en Explore.
- Externo: M/A y validación T de cada plataforma; no hay autorización afirmada. Si M sigue pendiente, no declarar B3 activo/completo ni cerrar por silencio: decidir explícitamente alcance de activación diferida antes de cierre.

No hay preguntas abiertas sobre detalles menores que requieran otro change. Ajustes de layout/rutas/helpers conservando estos contratos se resuelven en su sección. Cualquier cambio material de contratos vuelve a revisión de esta propuesta.

