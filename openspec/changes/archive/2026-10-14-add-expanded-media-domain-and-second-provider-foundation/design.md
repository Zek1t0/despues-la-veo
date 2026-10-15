## Context

Ver `proposal.md` para motivación y alcance. La fuente normativa son las specs canónicas del repositorio; esta propuesta contiene deltas, no modifica las specs principales ni implementa código.

Evidencia histórica al proponer la evolución (las restricciones v4/type de esta tabla describen el punto de partida, no el runtime actual):

| Archivo/capa | Restricción actual | Consecuencia |
| --- | --- | --- |
| `src/core/savedTitle.ts` | TitleType movie/TV; legacy types derivados de SavedTitle actual | Separar tipos históricos del dominio actual antes de retirar type |
| `src/providers/providerContracts.ts` | snapshot.type; voteAverage obligatorio | Clasificación nueva; suministro opcional y propiedad TMDB |
| `src/core/providerSavedTitle.ts` | copia siempre voteAverage; preserva campos personales | Conservar algoritmo y ajustar únicamente propiedad/presencia y clasificación |
| `src/storage/savedTitlesRepo.ts` | saveProviderTitleWithDb + cola + transacción | Reutilizar este recorrido, incluidos fixtures aislados |
| `src/storage/databaseSchema.ts` | v4 type TEXT sin CHECK de taxonomía; verificación de columnas y foreign keys | v5 por tres campos independientes, no por añadir un provider |
| `src/core/libraryBackupV5.ts` | normalizeBackupSavedTitle v1; tipo movie/TV; export local-only exige identidad portable | Validador v6 independiente y conversión posterior a validación v1–v5 |
| `src/storage/libraryBackupMerge.ts` | equality de type; presencia de campos; savepoints y mapa de pins | Sustituir compatibilidad taxonómica sin alterar resolución/frescura |
| `src/core/tmdbSavedTitle.ts`, `savedTitleProviderReferences.ts` | type local = namespace TMDB | Namespace permanece movie/TV; compatibilidad se mapea explícitamente |
| `app/(tabs)/buscar.tsx` | credential gating global TMDB, query/generation, cast namespace, rutas interpoladas | Fuente/categoría en identidad y destinos explícitos reconocidos |
| `libraryView.ts`, Biblioteca, Etiquetas, TitleGridCard, detalle local | filtro type exclusivo; labels de Viendo; bloque TMDB | Predicados de familia/formato/medio, labels según medio y rating aplicable |
| snapshots de pantallas, pins, ratings | ID local y WithDb | Preservar ownership y composición transaccional |
| `app/_layout.tsx`, `AppThemeProvider`, `appearancePreferencesRepo.ts` | bootstrap de tema lee preferencias mediante initDb y puede migrar DB personal antes de abrir una ruta | El modo de revisión debe seleccionarse antes del bootstrap normal, no solamente dentro de la ruta dev |

Las specs provider-abstraction congelaron selector y schema v4/backup v5 para aquella entrega; aquí esos límites cambian deliberadamente mediante deltas completos. Universal-media-identity ya separa namespace y clasificación: no hay motivo para cambiar sus invariantes. La spec backup v5 y su exporter rechazan exportar local-only sin identidad portable; se conserva esa restricción, no se inventa equivalencia por ID para permitir fixtures sin referencias.

Estado al actualizar el 2026-10-11: Secciones 1–2 y 3.1–3.3 completadas; clasificación expandida, snapshots opcionales, refresh monotónico, SQLite v5 y backup v6 ya existen. El remoto TMDB ya guarda por el pipeline genérico; 3.4 permanece sin marcar por su revisión móvil separada pendiente. Buscar aún usa capability/credenciales/errores TMDB y no tiene selección por categorías/fuentes. Secciones 4–5 y el adaptador MangaUpdates todavía requieren implementación; esta actualización no cambia ese estado.

## Goals / Non-Goals

**Goals:** conservar dominio/persistencia correctos y revisión aislada; mantener TMDB; demostrar Manga/Manhwa/Manhua con MangaUpdates bajo elegibilidad revisada y transporte usable por plataforma. La disponibilidad de la fuente remota puede diferir de la capacidad neutral del dominio.

**Non-Goals:** ver exclusiones de proposal. Ningún proveedor anime/libros ni Novel de MangaUpdates, sin clasificar a partir de categorías/país/título/conteos, sin generalizar servicios de credencial, errores, imágenes o atribución. Sin proxy/backend, dependencias nuevas, cambios de package.json ni operaciones Git de implementación. Esta actualización solo modifica artefactos; no ejecuta APPLY.

## Decisions

### 1. Tres dimensiones locales y una matriz pequeña

Usar `MediaMedium`, `MediaContentFamily`, `MediaPrimaryFormat` y `MediaClassification` en `src/core/mediaClassification.ts` (nuevo). SavedTitle y ProviderLocalSnapshot incluyen `medium`, `contentFamily`, `primaryFormat`; no conservan type como fuente paralela.

- medium obligatorio: audiovisual | comic | literature.
- contentFamily nullable: anime | manga | manhwa | manhua | null.
- primaryFormat nullable: movie | tv | ova | ona | special | music | webtoon | one-shot | novel | light-novel | null.
- Compatibilidad: anime solo audiovisual; manga/manhwa/manhua solo comic; audiovisual admite movie/tv/ova/ona/special/music; comic admite webtoon/one-shot; literature admite novel/light-novel y familia null. Todo medio admite formato null; todo medio admite familia null.

No agregar serial, doujin, OEL, TV-short u origen occidental como formato. Manga genérico → comic/manga/null; manhwa no implica webtoon; novela/light novel requieren evidencia explícita. TV corto puede mapear a tv porque sigue siendo TV; rasgos adicionales permanecen específicos. Tokens nuevos desconocidos de DTO remoto se mapean a null solo si el medio está probado; clasificación local/backup inválida se rechaza, no se repara silenciosamente. Si el medio no se conoce, no hay guardado: no se agrega un medium unknown.

La migración movie → audiovisual/null/movie y tv → audiovisual/null/tv es determinista y no usa heurísticas. La clasificación del snapshot entrante debe ser internamente válida. En provider refresh, medium diferente se rechaza antes de escribir; family/format se resuelven por las reglas monotónicas de la decisión 2. Una discrepancia entre valores no-null válidos no es motivo para reemplazar clasificación local ni abortar el resto del refresh. Una referencia TMDB reconocida exige identidad TMDB válida y medio audiovisual, nunca igualdad permanente namespace/primaryFormat.

Alternativas descartadas: ampliar TitleType con anime/manga mezcla dimensiones; guardar clasificación en tags la vuelve personal y mutable; derivarla de referencias excluye local-only; conservar type duplica autoridad.

### 2. Mantener contratos estrechos y propiedad del campo legacy

ProviderSearchResult permanece con reference y campos visibles; kindLabel no es un token del dominio. ProviderSearchCapability conserva search(query), sin registry, descriptor, paginación universal ni DetailCapability. ProviderMediaDetails no incluye initialTags. DTO y mappers específicos mantienen fechas completas, subtipos, relaciones, contadores y ratings nativos fuera del snapshot.

ProviderLocalSnapshot conserva title, year, posterUrl, overview, genres y añade clasificación. `voteAverage?: number | null` es una excepción legacy de propiedad TMDB, con presencia comprobada mediante own-property, no undefined como payload válido:

| Input materialización | Nuevo item | Item existente |
| --- | --- | --- |
| voteAverage ausente | null | conserva valor actual |
| TMDB suministra número finito | número | actualiza número |
| TMDB suministra null explícito | null | borra su valor anterior |
| no-TMDB suministra voteAverage, incluso null | rechazo previo a escritura | rechazo; conserva todos los datos |

El guardado valida la propiedad con input.reference.provider; no se deduce procedencia por presencia de referencias ni se convierte a escala universal. TMDB sigue suministrando el campo explícitamente. Test de un item ya multirreferenciado puede ejercitar un refresh no-TMDB sobre voteAverage TMDB existente sin crear linking UI. Backups tienen su propio contrato de presencia de campos: restauración no es refresh remoto y continúa admitiendo null explícito elegible.

Generic materialization conserva ID, createdAt, status, tags, notes, personalRating y reloj nextSavedTitleUpdatedAt. References y pins se preservan en repositorio, no se reinterpretan en mapper. initialTags vacío para el segundo proveedor; TMDB conserva genres como tags de creación.

Reglas normativas de clasificación para provider-driven materialization, aplicadas por separado a contentFamily y primaryFormat:

| Estado | Resultado |
| --- | --- |
| Nuevo item | medium requerido; persistir family/format mapeados, incluidos null |
| Refresh con medium distinto | rechazar antes de cualquier escritura |
| Existente null + entrante no-null válido | refinar al valor entrante |
| Existente no-null + entrante null | conservar valor existente |
| Existente no-null + entrante igual | conservar valor existente |
| Existente no-null + entrante diferente no-null válido | conservar valor existente; continuar resto del refresh válido |

Esto aplica a todas las fuentes, incluso TMDB y a items multirreferenciados: no downgrade, reemplazo automático, prioridad ni fusión. Null significa conocimiento no aportado por el proveedor. Validar snapshot y clasificación resultante contra la matriz local; identidad/medio incompatible siguen siendo errores, no una discrepancia tolerada de formato. Pruebas: audiovisual/anime/movie + TMDB audiovisual/null/movie conserva anime; comic/manga/null + comic/manga/one-shot refina one-shot; comic/manhwa/webtoon + comic/manhwa/null conserva webtoon; valores conocidos diferentes conservan ambos valores locales mientras title/genres y reloj elegibles sí se refrescan. Backup no utiliza este algoritmo: v6 representa estado local y puede borrar/reemplazar family/format con valores explícitos elegibles por frescura.

Year significa año útil de estreno/inicio y queda nullable; no inventar año de término. Overview entra como texto: retirar HTML sin ejecutar contenido, resolver entidades y conservar párrafos; Markdown se normaliza a texto sin fetch de enlaces/imágenes ni transformación heurística agresiva. Cada mapper declara el markup de su fuente y prueba casos maliciosos/longitud; no añadir parser/dependencia automáticamente. Genres usa nombres reconocidos por mapping revisado; temas/demografías/spoilers ambiguos quedan fuera.

### 3. SQLite v5 sin type activo

`saved_titles` reemplaza type por `medium TEXT NOT NULL`, `content_family TEXT NULL`, `primary_format TEXT NULL`; conserva las restantes columnas con tipos/nullability/constraints actuales. Añadir CHECK del vocabulario y matriz compatible, manteniendo personal_rating 10..100 y las foreign keys. Validar en fronteras runtime y esquema. No nuevos índices de clasificación: actualmente el filtrado es en memoria.

Reutilizar la reconstrucción transaccional de v4 como patrón. Desde v4: validar source type movie/TV, copiar las tablas dependientes a targets compatibles, conservar la totalidad de media_provider_references, legacy_saved_title_identities y title_pins, verificar conteos, comparación de valores no taxonómicos, claves/ownership/FK y publish PRAGMA user_version=5 solo al final. El orden de renames/recreación debe evitar que foreign keys sigan apuntando a tablas temporales; no desactivar FK dentro de la transacción como supuesto de solución. Prueba SQLite real con FK ON obligatoria.

Instalación nueva crea v5. Bases anteriores conservan el recorrido histórico hasta v4 y luego v4→v5 en la composición transaccional actual, sin transacciones anidadas. Reapertura v5 verifica esquema/datos, no remigra. Versión futura rechazada; legacy type inválido aborta sin reset ni corrección inventada. Timestamps se copian exactos, no se materializa cada fila con Date.now.

Archivos: databaseSchema.ts, db.ts, savedTitleStorage.ts, savedTitleIntegrity.ts, savedTitlesRepo.ts; snapshots de pantallas y titlePinsRepo/titlePinsBackup se revisan por compatibilidad pero no cambian sus claves ni ownership.

### 4. Backup v6 y conversión histórica explícita

Nuevo `src/core/libraryBackupV6.ts`: raíz version=6, exportedAt, items, pins y Appearance como hoy; cada item lleva ID, clasificación completa (medium requerido; family/format requeridos pero nullable), referencias, datos personales y snapshot. No type. Otros campos conservan las reglas de presencia actuales; personalRating requerido. Unknown tokens o combinaciones inválidas invalidan el item completo. Referencias genéricas mantienen tokens/ID opaco y duplicate checks; TMDB exige identidad movie/TV válida y medium audiovisual, sin exigir familia null ni igualdad namespace/primaryFormat. audiovisual/anime/ova con tmdb/movie válido es restaurable, como también audiovisual/null/null: el namespace identifica el recurso externo, no el formato local.

Separar contratos históricos congelados de SavedTitle actual (`src/core/historicalSavedTitle.ts` y `src/core/libraryBackupDomainConversion.ts`, nuevos). v1–v5 validan exactamente sus formas originales. Después, convertir clasificación y campos de presencia al input común de merge; mantener legacyIdentity y mapas de relaciones. En un import histórico sobre un item moderno, familia no clasificada es metadata no suministrada, no una orden de borrar su familia; movie/TV suministra su formato histórico y medio. En una inserción histórica la familia es null. v6 null explícito en familia/formato es valor suministrado y se aplica solo si compatible con referencias y frescura.

v6 reutiliza resolución por referencias completas, compatibilidad manual legacy exacta, savepoints por item y pins, referencias aditivas incluso para item anterior y frescura por updatedAt. Si medium difiere o una referencia TMDB es inválida/incompatible con medium audiovisual, conflicto sin mover relaciones. Una diferencia primaryFormat/namespace TMDB no es conflicto. Restauración v6 posterior aplica family/format explícitos, incluidos reemplazos no-null y null que borra valores conocidos si la clasificación local sigue siendo válida; no reutiliza el algoritmo monotónico de provider refresh. Ausencias de otros campos conservan valores modernos y null explícito los borra cuando permitido. Familia histórica no suministrada sigue ausente en actualización, null solo como default de inserción. Una referencia desconocida no se interpreta como clasificación de un proveedor no instalado.

Local-only con legacyIdentity exporta como hoy. Local-only sin referencia ni legacyIdentity sigue rechazado por exporter; import defensivo con ID libre permitido, ID ocupado conflicto, sin equivalencia por ID/title. No nueva identidad portable artificial. Fixtures exportables usan referencias sintéticas exclusivamente en bases aisladas; fixtures locales sin referencia prueban lectura/presentación y rechazo de export esperado en una prueba separada.

Archivos: libraryBackup.ts, libraryBackupV1–V5.ts (solo separación de tipos, no ampliar validadores), libraryBackupV6.ts, libraryBackupDomainConversion.ts, libraryBackupMerge.ts, libraryBackupExport.ts, titlePinsBackup.ts y `app/(tabs)/ajustes.tsx`. Mantener Appearance confiable, invalidación parcial y aplicación después del commit bajo contrato actual.

### 5. Consumidores locales y TMDB

Modificar presentationLabels.ts para clasificación → label contextual y status + medium. planned/done/dropped conservan labels; watching → Viendo audiovisual, Leyendo comic/literature; filtros globales En curso. Unknown format usa familia o medio; family null nunca se presenta como occidental/live action. Filtros finitos: todos, películas (audiovisual/movie), series (audiovisual/tv), anime, manga, manhwa, manhua, cómics, literatura. Un item puede satisfacer varios predicados, aunque el usuario elija un filtro a la vez. No persistir nuevas preferencias de filtros en esta entrega.

Mantener orden determinista (updated/title/year/TMDB/personal), pins antes de unpinned dentro del resultado filtrado, collages y vistas actuales. Year en cómic/literatura se presenta como inicio/publicación; clasificación y estado accesibles se anuncian una vez. Rating personal sigue igual; bloque TMDB solo cuando voteAverage existe o una referencia TMDB inequívoca justifica mostrar ausencia. No etiquetar un rating de la nueva fuente como TMDB.

Evidencia de orden: `libraryView.ts` usa voteAverage para `rating-desc`; Biblioteca ya presenta Puntuación TMDB, aunque la spec canónica dice Mayor puntuación. Mantener key/preferencia `rating-desc` y label Puntuación TMDB, con valores finitos descendentes y ausentes al final; empates por título e ID según implementación, respetando prioridad contextual de pins. Mantener órdenes personal-rating separados. No-TMDB nuevo sin rating legacy queda null; un multirreferenciado puede conservar su valor histórico TMDB. No sustituir por personalRating ni preferred external rating. Search preferred score, opción futura de cards y detalle con todos los ratings fuente/escala permanecen diferidos.

`tmdbSavedTitle.ts` y mappers siguen tipando namespace con TmdbResourceNamespace movie/TV y producen snapshot audiovisual, formato movie/TV y familia null. Es una propuesta de clasificación inicial/refinamiento, no una invariante permanente del item. savedTitleProviderReferences.ts valida referencia canónica TMDB y medium audiovisual, conserva exactamente una referencia reconocida para el link y usa su namespace externo para la ruta; no filtra ni rechaza por primaryFormat distinto o null. `/tmdb/[type]/[id]` conserva DTOs, créditos, disponibilidad regional, errores y credenciales; el guardado usa refresh monotónico para preservar anime/OVA ya conocidos. `/title/[id]` nunca necesita red para mostrar metadata local.

Archivos UI: Biblioteca, Etiquetas, detalle local, TitleGridCard.tsx, TagCollage.tsx, presentationLabels.ts, libraryView.ts; viewPreferences.ts conserva opciones/keys de orden y apariencia. TitleGridCard recibe un label visible en vez de exigir tipo estructural: superficies locales lo derivan de clasificación y Buscar usa kindLabel normalizado sin interpretar namespace. PosterPlaceholder existente basta; no garantía de portada offline ni allowlist nueva.

### 6. Categorías finitas y disponibilidad por plataforma

Buscar obtiene categoría/source explícita de una unión finita y capabilities ligadas a categoría, no de registry. Películas → TMDB movie; Series → TMDB tv; Manga → MangaUpdates Manga; Manhwa → MangaUpdates Manhwa; Manhua → MangaUpdates Manhua. Las categorías son la arquitectura de navegación; el proveedor es fuente/atribución secundaria. Preservar comportamiento TMDB al preparar Sección 4, sin requests nuevos productivos ni fixtures fuera del harness. Anime no es categoría remota de este milestone.

Solo exponer categorías con elegibilidad documentada, adaptador disponible y transporte real validado en la plataforma activa. MangaUpdates permanece invisible en Web mientras CORS bloquee requests directos, sin controles deshabilitados ni errores que pidan token TMDB. Web conserva TMDB, Biblioteca/detalle locales y review sintético dev; poder representar/importar cómics en Web no demuestra discovery MangaUpdates Web. Android/iOS se habilitan individualmente tras validación real de la plataforma; declarar exactamente entorno validado y pendientes, sin atribuir iOS a Windows. Si en el futuro el proveedor permite el origen Web o un change separado aprueba transporte legítimo, podrá habilitarse sin cambiar identidad/taxonomía; no anticipar proxy/backend ni spoof de headers.

Identidad de solicitud: secuencia + query + category/source + generación de configuración solo si aplica + retry. Cambiar fuente invalida loading/error/resultados anteriores incluso con igual query. TMDB mantiene debounce 350 ms, retry y estados de credencial; fuente sin credencial no consulta ese gate. Errores/configuración siguen específicos por fuente. Destino se resuelve por casos reconocidos y referencia validada, no por interpolación de provider arbitrario. Sin búsqueda concurrente, ranking mixto o deduplicación.

Ruta MangaUpdates concreta: `/mangaupdates/series/[id]`; TMDB conserva `/tmdb/[type]/[id]`. Resolver destinos por casos reconocidos y referencia canónica, no por provider arbitrario ni generic catch-all. Si varias referencias proveen links, mostrar links explícitos reconocidos sin prioridad inventada; no ofrecer navegación remota MangaUpdates no usable en la plataforma, pero conservar provenance local. No framework genérico de attribution.

### 7. Consumidor inmediato: revisión sintética aislada

Crear fixtures originales bajo `docs/testing/expanded-media-domain/fixtures/` y harness/manual README bajo `docs/testing/expanded-media-domain/`. No copiar catálogos. Referencias test-only usan token `fixture-review` para satisfacer el contrato real, nunca `mock` ni un candidato real; números/strings son sintéticos y pueden coincidir entre namespaces para probar identidad completa. No añadir adaptador de producción de ese token.

Modo de revisión seleccionado al lanzar desarrollo con `EXPO_PUBLIC_MEDIA_REVIEW=1` y `__DEV__`, antes de montar el árbol normal de `app/_layout.tsx`. El root de revisión usa contexto de tema con preferencias de prueba y resolver existente sin lectura/escritura de preferencias personales; no monta TmdbCredentialProvider ni tabs productivas. Este desvío es exclusivamente dev, no un selector runtime de bases para producción ni generalización de credenciales. Una flag sola en release nunca activa el modo. La ruta `/dev/media-review` (`app/dev/media-review.tsx`, futura) contiene la revisión y exige ese modo; navegar a ella desde la app normal no abre review storage. Abrir otras rutas dentro del modo de revisión no permite saltar a consumers con initDb personal. Archivos adicionales afectados por esta evidencia: app/_layout.tsx y el punto mínimo de provisión de tema de prueba necesario para los componentes compartidos.

Harness bajo `src/dev/mediaReview/` (futuro) carga JSON fixtures y llama directamente a contratos/capabilities sintéticos, mapper de boundary y `saveProviderTitleWithDb` con cola/transacción y DB aislada. La acción se rotula "Guardar en biblioteca de prueba". Debe demostrar el mismo saveProviderTitle flow por fachada normal con dependencia DB inyectada mínima, sin sustituir materialización ni duplicar reglas; el default productivo sigue usando initDb. No monkeypatch global ni credencial real.

Cada sesión abre archivo SQLite nuevo con nombre explícito de revisión y un segundo archivo vacío para restauración, jamás el DB personal. Extraer únicamente componentes/presenters necesarios de Biblioteca y detalle para recibir un repositorio de sesión; el harness renderiza esos mismos consumidores con ID local y mismo comportamiento que `/title/[id]`, sin navegar fuera del contenedor hacia rutas que abrirían initDb por defecto. DB session y repo se pasan explícitamente a todos los reads/writes, rating/pins/notes/import/export incluidos. Las pruebas de integración invocan funciones WithDb reales. Una prueba release/opt-out comprueba que no se abre ninguna DB de revisión ni hay catálogo fixture disponible.

Revisión manual: lanzar un proceso dev separado con flag opt-in antes de iniciar Expo (por ejemplo EXPO_PUBLIC_MEDIA_REVIEW=1 en el entorno del proceso), sin editar scripts; abrir contenedor, verificar banner de aislamiento/nombre de DB; elegir categoría; abrir fixture; guardar; editar status/tags/notas/rating y pin; refrescar; abrir biblioteca/detalle por ID; filtrar; simular ausencia de red/portada; exportar v6 exclusivamente desde sesión; restaurar en segunda DB; comprobar clasificación y pins; cerrar proceso y retirar flag antes de volver al entorno normal, sin importar el archivo sintético en biblioteca personal. Reset solo DBs de sesión explícitamente identificadas. Export sintético se marca en nombre/README como TEST, sigue payload v6 real y no añade campos universales de mock. No abrir ni escribir DB real en toda la sesión, incluido bootstrap de tema.

Casos: anime TV/movie/OVA/ONA/special; manga general/one-shot; manhwa con webtoon explícito; manhua; western comic comic/null/null; light novel literature/null/light-novel; familia/formato nullable; missing poster/year/overview; empty genres; descripción larga y markup; invalid combos; voteAverage ausente/null; refresh sobre estado personal y referencias múltiples. Añadir ordinary novel y music para cobertura de vocabulario. Fixtures no completan gates ni tareas de provider real.

Añadir los cuatro casos de refresh monotónico de decisión 2 y un item audiovisual/anime/ova con referencia tmdb/movie sintética canónica más fixture-review, sin linking ni requests TMDB: validar link por namespace, refresh conservando ova y round-trip v6 sin exigir formato movie. Probar también que v6 posterior con family/format null borra clasificación conocida, contrastando mismo null de refresh que la conserva.

Alcance exacto de aislamiento: el harness nunca abre/escribe/importa a DB personal, y restaura sus archivos TEST únicamente mediante el flujo de revisión en la segunda DB aislada. `fixture-review` solo existe en datos de sesiones y sus archivos TEST; no hay adaptador productivo, registry, fuente runtime, sentinel en schema ni rechazo especial por token en importer de producción. No se promete impedir que un desarrollador seleccione manualmente fuera del harness un archivo TEST estructuralmente válido: el importer genérico acepta referencias desconocidas conforme a contrato. El aislamiento es garantía del recorrido controlado, no una política nueva de importación universal.

### 8. Elegibilidad MangaUpdates y fase real mínima

MangaUpdates es la fuente elegida de este change para Manga/Manhwa/Manhua, con resultado de exploración CONDITIONAL GO. Anime se retira del compromiso de entrega y de las dependencias de cierre; no añadir MAL, AniList, Kitsu u otra fuente. Secciones 1–5 siguen revisables sin nueva red productiva; la investigación oficial ya realizada no equivale a implementación ni a completar 6.1/6.2.

#### 8.1 Evidencia primaria y política de elegibilidad

La elegibilidad puede sustentarse en A) términos/políticas oficiales publicados suficientemente compatibles con el uso documentado, o B) autorización explícita del proveedor. No exigir permiso humano/email individual en todos los casos. Revisar API, tracker independiente, retención/snapshots, export/import/backups, imágenes/atribución, uso previsto/comercial, upstream pertinente, auth, IDs, límites y plataformas. Silencio/falta de respuesta nunca autoriza; ausencia de prohibición no equivale a clearance completo. Licencia de wrappers/código, BYO-auth, fixtures o uso por otros trackers tampoco completan el gate. Contactar proveedores requiere autorización específica; este change no autoriza mensajes.

Evidencia obtenida en la exploración del 2026-10-11, no nueva prueba ejecutada al actualizar:

| Evidencia oficial / observación | Resultado y límite |
| --- | --- |
| [API oficial](https://api.mangaupdates.com/) y [OpenAPI](https://api.mangaupdates.com/openapi.yaml) | Metadata pública; POST `/v1/series/search` y GET `/v1/series/{id}` probados con 200 sin credenciales y sin Origin externo |
| [AUP oficial](https://api.mangaupdates.com/#section/Acceptable-Use-Policy) | Exige crédito MangaUpdates, espaciado razonable y caché; prohíbe uso fraudulento/ilegal/spam/daño a la DB; puede cambiar; no cuota numérica/TTL verificados |
| Seguridad documentada | Introducción indica operaciones públicas; YAML declara bearerAuth global. Validar operaciones concretas sin imponer login/secret innecesarios |
| CORS | Search con localhost Origin: 403; OPTIONS preflight: 403; GET con Origin externo: 403; Origin `https://www.mangaupdates.com`: 200 y ACAO para ese origen. Transporte Web directo no viable actualmente |
| Runtime nativo | La exploración probó HTTP desde este entorno Windows, no la app Android/iOS. Ninguna plataforma nativa MangaUpdates se declara validada por esa evidencia |
| Portadas | API devuelve URLs HTTPS `cdn.mangaupdates.com`; un HEAD obtuvo 400. Renderizado nativo, redirects y derechos de display/hotlink pendientes; URL pública no acredita copyright |
| Retención/backups/comercial | AUP inspeccionada no trata expresamente retención indefinida, export/backups o uso comercial. No afirmar autorización expresa de DespuésLaVeo ni que todos los derechos están resueltos |

Política de ingeniería para este milestone personal, open-source y no comercial: implementación del adaptador/dominio puede avanzar basada en términos oficiales suficientemente compatibles, con evaluación y restricciones documentadas. Uso acotado a search/detail iniciados por el usuario, snapshots pequeños de cada obra seleccionada y sus backups locales, sin bulk mirroring ni scraping fuera de API; atribución, caché/espaciado, rating omitido y ninguna descarga permanente de portadas. Las incertidumbres expresas anteriores no se ocultan ni se convierten en certeza legal; una restricción material incompatible exige detener el uso afectado/revisar antes de activar. Portadas no permitidas o inciertas usan posterUrl null y placeholder, sin bloquear todo el adaptador. Revisar términos y derechos otra vez antes de distribución materialmente más amplia/comercial; esa release no es entregable de este milestone.

Esta decisión documenta una base de elegibilidad de desarrollo, no habilita por sí sola categorías: 6.1 verifica evidencia/condiciones, 6.2 coherencia y 8.3 runtime real antes de considerar completo el vertical. CORS bloquea exposición Web, no implementación neutral/nativa. Completar fixtures o reescribir tareas no completa gates ni pruebas.

#### 8.2 Operaciones, identidad y contrato

POST `/v1/series/search`: JSON `search`, `stype: title`, `type: [Manga|Manhwa|Manhua]` según categoría, `page: 1`, `perpage` válido. Respuesta `total_hits/page/per_page/results[].record`, con `hit_title` alternativo; conservar ranking de una fuente, validar tipo/ID de cada registro y usar título canónico, no hit_title como identidad. Una capability ligada al filtro puede conservar search(query). Paginación queda específica: primera página, sin cursor/hasMore universal ni N requests de detalle para pintar resultados. La exploración vio perpage 5 respetado y perpage 3 filtrado devuelto como 25; no asumir tamaño ni completar páginas automáticamente.

GET `/v1/series/{id}` retorna registro: validar DTO y coincidencia de series_id con referencia/ruta. Helper canónico `provider: mangaupdates`, `resourceNamespace: series`, `externalId: series_id decimal como string`. Validar entero positivo sin coerción insegura ni rangos de 32 bits; rechazar valores numéricos ya inseguros en vez de perder precisión. No reemplazar por slug/web token/ID legacy. `series` identifica recurso externo, nunca medio/formato local. ID SavedTitle sigue local, opaco e independiente.

DTO/transporte/mappers y errores bajo `src/providers/mangaupdates/`; pantalla `app/mangaupdates/series/[id].tsx`; selección de categoría/destino en `app/(tabs)/buscar.tsx`, fuente local en `app/title/[id].tsx` y atribución en `app/settings/about.tsx`. Reutilizar ProviderSearchResult, ProviderSearchCapability, ProviderMediaDetails, ProviderLocalSnapshot, materializeProviderSavedTitle y saveProviderTitle sin registry/capability de detalle general. Sin nuevas dependencias previstas ni modificación de package.json.

#### 8.3 Mapping conservador y snapshot

| type MangaUpdates habilitado | medium | contentFamily | primaryFormat |
| --- | --- | --- | --- |
| Manga | comic | manga | null |
| Manhwa | comic | manhwa | null |
| Manhua | comic | manhua | null |

Novel es estructuralmente compatible con literature/null/novel, pero no habilitado en este change. Excluir Novel, Doujinshi, OEL, Artbook, Drama CD, Filipino, Indonesian, Thai, Vietnamese, Malaysian, Nordic, French, Spanish, German, Russian y tipos desconocidos/no soportados tanto en discovery como guardado; no ampliar vocabulario. No inferir webtoon/one-shot/light-novel por categorías, país, título, descripción o conocimiento cultural. `Webtoon/Webcomic`, `Based on a Webcomic/Webtoon`, `Adapted to Webtoon` y filtros oneshots no refinan primaryFormat en esta entrega. Las fixtures con formatos conocidos prueban el dominio, no esa precisión de producción.

| Campo | Mapping MangaUpdates |
| --- | --- |
| title | título canónico no vacío; dato inválido impide guardar |
| year | solo año inequívoco válido convertido a número; otro valor → null |
| posterUrl | image.url.original absoluta HTTPS permitida; inválida/no permitida → null; thumb puede servir resultados |
| overview | description normalizada a texto seguro/legible, sin ejecutar markup ni recuperar enlaces; vacío → null |
| genres | solo valores narrativos aprobados explícitamente; excluir demografía (p.ej. Seinen/Shounen), avisos/temas ambiguos y categories; ausentes → [] |
| medium/contentFamily/primaryFormat | tabla anterior; clasificación local monotónica autoritativa |
| initialTags (política de creación, fuera del snapshot) | [] siempre; no reemplaza tags personales al refrescar |
| voteAverage | propiedad totalmente ausente: no número, null ni undefined propio; bayesian_rating/rating_votes no se mapean |

Casos observados: Berserk `51239621230` Manga/1989 → comic/manga/null; Solo Leveling `15180124327` Manhwa/2018 → comic/manhwa/null, aun con categoría votada Webtoon/Webcomic; One Punch-Man `30535847369` Manga/2012 → comic/manga/null, aunque Based on a Webcomic/Webtoon. Solo Leveling (Novel) `13184758110` Novel/2016 se excluye; no fusionar por nombre ni relaciones. [Berserk](https://api.mangaupdates.com/v1/series/51239621230), [Solo Leveling](https://api.mangaupdates.com/v1/series/15180124327), [One Punch-Man](https://api.mangaupdates.com/v1/series/30535847369).

No persistir autores/artistas/publicación/capítulos/relaciones ni ratings nuevos. El genérico crea voteAverage null si ausente y conserva valor histórico TMDB en refresh no-TMDB; rechaza own-properties no-TMDB antes de escritura. Conservar identidad completa, monotonicidad, resto de metadata válida, campos personales, referencias/pins, reloj y separación genres/initialTags, sin matching/fusión/deduplicación.

#### 8.4 Transporte responsable, provenance y validación

Search/detail solo por intención de usuario (debounce/retry de esa acción incluidos); sin refresh de fondo ni descarga de catálogo. Caché acotada de metadata/búsquedas y espaciado razonable compartidos por requests MangaUpdates; definir política concreta verificable en 6.3 sin inventar cuota oficial. Respetar 429/Retry-After cuando disponible con backoff limitado, sin retry storm. Errores específicos network/timeout/aborted/HTTP/rate-limit/not-found/invalid-response/acceso rechazado; no masquerade de credential TMDB. No secret, cuenta/OAuth ni User-Agent obligatorio inventado; validar cambios reales del contrato.

Remote detail: `Datos: MangaUpdates`, con enlace al registro oficial validado cuando corresponda. Local detail: provenance reconocible por ProviderReference donde se muestran fuentes, sin red necesaria ni marca integrada en identidad. About: bloque MangaUpdates/enlace. Solo referencias remotas HTTPS permitidas, sin descarga permanente ni binarios en backup; imagen ausente/restringida/fallida → placeholder. Metadata API permission y derechos de arte son asuntos separados.

Vertical mínimo: categoría → search normalizado → detalle MangaUpdates → snapshot/input initialTags [] → saveProviderTitle → Biblioteca/detalle por ID → re-save/refresh → offline → backup v6/import. No migración adicional ni v7. Referencias desconocidas se preservan aunque el adaptador no esté disponible; import no interpreta series como taxonomía. Android/iOS: probar cada plataforma habilitada en runtime real (search, detail, cover/fallback, save, local detail, refresh, offline/persistencia, backup, attribution y errores); documentar dispositivo/OS/runtime y pendientes. Windows no verifica iOS. 3.4 sigue siendo comprobación móvil independiente. Web: validar TMDB normal, ausencia MangaUpdates/red prohibida y harness neutral, no proclamar provider Web.

#### 8.5 Aceptación y roadmap

Concreción de foundation Sección 6 (2026-10-13): `src/providers/mangaupdates/` ofrece cliente/validadores/mappers y primitivas de atribución/provenance, sin consumidor productivo conectado. La UI remota, las fuentes locales/About y la activación de categorías/plataformas se consumen en Sección 8; 6.4 prepara valores reutilizables, no exige insertar UI ahora. Producción permanece apagada en Web/Android/iOS. El cliente rechaza Web antes de red/caché y conserva llamadas directas explícitas de diagnóstico sin claims nativos.

Políticas de ingeniería, no límites oficiales: cola serial compartida por cliente, inicio de requests separado al menos 1200 ms, máximo 16 operaciones pendientes, caché LRU en memoria de 32 entradas validadas (search 60 s/detail 300 s), sin persistencia. Duplicados sin signal comparten vuelo; solicitudes con signal tienen lifecycle independiente y revalidan caché al llegar a la cola. Timeout de request 12 s. Solo un retry automático HTTP 429: Retry-After válido hasta 30 s o fallback 3 s; espera mayor/429 repetido se devuelve con cooldown, sin polling ni retry de rechazo local. No retries automáticos de otros errores, ni bodies remotos en mensajes.

Allowlist exacta de `genres[].genre`: Action, Adventure, Comedy, Drama, Fantasy, Horror, Mystery, Romance, Sci-fi, Slice of Life, Sports, Supernatural, Psychological, Historical, Tragedy. Matching por trim/case, alias Science Fiction → Sci-fi, duplicados eliminados solo dentro de géneros; categorías/demografías/otros valores se omiten. Año solo string de cuatro dígitos inequívoco. Cover policy por defecto omit; opt-in explícito futuro reference-https valida host cdn.mangaupdates.com/HTTPS sin atribuir permiso de artwork. DTOs retienen solo campos consumidos y outputs no poseen voteAverage; initialTags vacío. Identidad decimal string y HTTP público probados mediante pocas operaciones, sin guardar records reales de catálogo. Ver [evidencia y límites](../../../docs/testing/expanded-media-domain/mangaupdates-evidence.md).

Cierre: dominio local expandido, SQLite v5/backup v6/import histórico, categorías finitas, fixture vertical aislado, TMDB preservado y Manga/Manhwa/Manhua reales en al menos una plataforma nativa elegible validada; cada plataforma habilitada exige su propia validación, con disponibilidad/plataformas y evaluación de desarrollo documentadas. Ausencia de anime y bloqueo MangaUpdates Web no impiden el cierre bajo este alcance. Validar el vertical en instalación/build de prueba controlada antes de exponerlo en producción; ninguna plataforma nativa puede declararse habilitada sin su prueba real. No cerrar mediante fixtures o navegador estrecho ni afirmar aprobación expresa de la app, registry, ratings universales, libros o manual local.

Roadmap no bloqueante, sin tareas aquí: proveedor anime dedicado; Open Library/literatura (incluido Novel MangaUpdates opcional); creación manual local; ExternalRating; precisión webtoon/one-shot; autores/publicación; extensión/protocolo comunitario; capítulos/lectura/progreso; revisión de política/derechos previa a release más amplia/comercial.

## Risks / Trade-offs

- [Foreign keys reconstruidas hacia tablas temporales] → test SQLite real FK ON, integridad antes del publish y rollback inyectado por fase.
- [Históricos acoplados a SavedTitle] → DTOs históricos congelados, validación original y conversión explícita; corpus v1–v5 positivo/negativo.
- [Snapshot no-TMDB borra rating TMDB] → own-property + ownership check, pruebas create/refresh/null/undefined y backup separado.
- [Fixture contamina biblioteca] → DB física aislada, repositorio explícito, release gate y prueba que initDb productivo no se invoca.
- [Pérdida de familia por import histórico] → convertir familia no suministrada en updates, no null explícito; insert histórico null.
- [Confundir implementación con elegibilidad/runtime] → 6.1/6.2 y 8.3 siguen pendientes hasta sus comprobaciones; términos compatibles habilitan desarrollo conservador, no todas las plataformas ni certeza legal.
- [CORS bloquea Web] → ocultar MangaUpdates, preservar TMDB/local y usar review neutral; no proxy ni spoof. No exigir Web MangaUpdates para cerrar este alcance.
- [Condiciones/portadas cambian] → revisar fuentes primarias y restricciones materiales; posterUrl null cuando necesario; nueva revisión antes de release más amplia/comercial.
- [URLs no garantizan offline] → snapshot textual usable + placeholder; no descarga permanente de imágenes automática.
- [Vocablo local insuficiente para DTO futuro] → null honesto o no habilitar recurso sin medio probado; enriquecer el vocabulario solo mediante revisión.

## Migration Plan

1. Antes de APPLY revisar artefactos; una sección por vez. Preparar copia de DB v4 de prueba y backup v5 previo a rollout, nunca migrar datos del usuario durante PROPOSE.
2. Sección 1 integra dominio/contratos y convierte consumidores internos mínimos para mantener compilación; adaptaciones UI visibles completas son sección 3. No publicar build con modelo incompatible y storage antiguo.
3. Sección 2 migra v5, storage, backup v6 y tests históricos. Una release no habilita nuevos guardados antes de pasar round-trip y FK/rollback.
4. Secciones 3–5 completan browsing, arquitectura de categorías futuras invisibles en producción y consumidor dev aislado. Ejecutar regresión 9.1 ahora; segundo proveedor sigue apagado.
5. Verificar evidencia/condiciones de desarrollo 6.1 y coherencia 6.2; implementar adaptador 6.3–6.4 y vertical 8, validar cada plataforma nativa habilitada y mantener MangaUpdates oculto en Web; ejecutar 9.2. Sección 7 solo registra alcance anime retirado, sin dependencia de entrega. No avanzar checkboxes por esta actualización.
6. Rollback por fallo: transacción vuelve a origen sin publish. Rollback después de commit: conservar DB v5/backup v6, restaurar copia v4 pre-rollout para app anterior; nunca reinterpretar comic/literature como movie/TV ni prometer downgrade lossless. Datos posteriores necesitan versión compatible para restauración.

## Open Questions

Permanecen documentados: límites/TTL oficiales y headers no verificados; retención/backups/comercial no tratados expresamente; condiciones de display/hotlink y runtime de portadas. No bloquean automáticamente desarrollo conservador; restricciones materiales incompatibles sí bloquean el uso afectado y portadas pueden omitirse. 6.3 debe concretar valores narrativos permitidos y política conservadora de caché/espaciado sin atribuirlos al proveedor. 8.3 debe registrar plataformas nativas realmente verificadas; iOS permanece pendiente si no existe entorno, sin simular aprobación. Ninguna pregunta pendiente autoriza proxy, scope adicional o exposición Web bloqueada.

## Android physical-device validation

A physical Android validation for Section 3.4 passed. The exact device model and date were not recorded reliably for that validation.

- Runtime: `expo run:android`
- Result: PASS

Manual review confirmed:

- application launch/build
- Biblioteca views and filters
- local detail/navigation
- persistence
- offline/local-first behavior
- mobile layout/usability
- basic accessibility behavior
- no observed crashes or regressions

iOS was not validated because the development environment is Windows.
This does not claim iOS runtime validation.
