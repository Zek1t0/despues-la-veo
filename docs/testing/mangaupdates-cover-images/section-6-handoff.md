# Sección 6 — evidencia, límites y handoff Android

Fecha de evaluación: **2026-11-09 (America/Buenos_Aires)**. Cambio actual: `enable-mangaupdates-cover-images`. Alcance: entregables documentales 6.1 y 6.2 exclusivamente. La posible activación independiente se denomina `activate-mangaupdates-cover-images-android`; no se crea ni implementa aquí.

## Hechos verificados

### Baseline y contrato

El checkpoint obligatorio de Sección 5 está en HEAD: `ef0e58a4003d07482f2a19b8c76d8ef62d12fdb1` (`test: validate MangaUpdates cover UI and isolated web review`). `git show --stat HEAD` incluye los dos runners de Sección 5, su informe y tasks.md; `git show HEAD:openspec/changes/enable-mangaupdates-cover-images/tasks.md` confirma 5.1/5.2 marcadas. Al inicio solo `package.json` tenía modificaciones personales; los artefactos y reportes de Secciones 1–5 no tenían diff respecto de HEAD.

Se leyeron [propuesta](../../../openspec/changes/enable-mangaupdates-cover-images/proposal.md), [diseño](../../../openspec/changes/enable-mangaupdates-cover-images/design.md), [delta spec](../../../openspec/changes/enable-mangaupdates-cover-images/specs/second-provider-discovery/spec.md) y [tareas](../../../openspec/changes/enable-mangaupdates-cover-images/tasks.md). Exigen preparación inactiva, compatibilidad local y cierre independiente de permisos futuros. La atribución, una URL pública o un GET exitoso no satisfacen el gate de derechos.

### Registro interno de fuentes y evidencia

Las rutas son relativas a este informe. Los tests citados describen cobertura existente, no nuevas ejecuciones de suites en Sección 6.

| ID | Fuente real, función o prueba | Conclusión y límite |
| --- | --- | --- |
| I1 | [mapping.ts](../../../src/providers/mangaupdates/mapping.ts): `mangaUpdatesPoster`, `mapMangaUpdatesDetails`, `mapMangaUpdatesSearchResult`, `mangaUpdatesMaterializationInput`; [test 1](section-1-verification.cjs), [informe 1](section-1-validation.md) | Original inicialmente válido → thumbnail inicialmente válido del mismo registro → null. No hay sondeo ni segundo candidato tras fallo del renderer. HTTPS absoluto, hostname inicial exacto `cdn.mangaupdates.com`, sin credenciales, controles, whitespace, backslashes, puertos inesperados o formas ambiguas; permite puerto canónico 443. Test: 4 URLs aceptadas y 76 rechazadas, sin fetch. No valida destino final. |
| I2 | [adapter.ts](../../../src/providers/mangaupdates/adapter.ts): `createMangaUpdatesSearchCapability`; [mangaUpdatesSearch.ts](../../../src/components/search/mangaUpdatesSearch.ts): `productSearch`; [detalle remoto](../../../app/mangaupdates/series/[id].tsx): `MangaUpdatesDetailScreen`; [test 2](section-2-verification.cjs), [informe 2](section-2-validation.md) | Defaults omit; búsqueda productiva pasa omit explícito y las dos llamadas de materialización remota también. El input normalizado presentado es el que usa save. Capacidad `reference-https` existe en mapper/adapter, ejercitada explícitamente en tests; no hay activación productiva, toggle ni bypass. |
| I3 | [DetailPoster](../../../src/components/browsing/DetailPoster.tsx), [TitleGridCard](../../../src/components/browsing/TitleGridCard.tsx), [TagCollage](../../../src/components/browsing/TagCollage.tsx): `CollageCell`; [detalle local](../../../app/title/[id].tsx): `LocalPoster`; [Buscar](../../../app/(tabs)/buscar.tsx), [Biblioteca](../../../app/(tabs)/libreria.tsx), detalle remoto; [test 3](section-3-verification.cjs), [informe 3](section-3-validation.md) | Image con URI y onError vuelve a PosterPlaceholder; ausencia también usa placeholder. Se conservan navegación, dimensiones y decoración accesible. El fallo visual no escribe posterUrl ni activa descargas alternativas. |
| I4 | [usePosterImageError.ts](../../../src/components/browsing/usePosterImageError.ts): `usePosterImageError`; tests 2/3 y [test 5](section-5-verification.cjs) | Token memoizado por identidad/URL; reset al cambiar cualquiera y updater que ignora callbacks de generaciones anteriores, incluido A→B→A. Collage conserva keys por ID/URL. Cobertura por hook-host/composición, sin acreditar reciclado nativo real. |
| I5 | [providerSavedTitle.ts](../../../src/core/providerSavedTitle.ts): `materializeProviderSavedTitle`; [savedTitlesRepo.ts](../../../src/storage/savedTitlesRepo.ts): `saveProviderTitle`, `saveProviderTitleWithDb`; [savedTitleStorage.ts](../../../src/storage/savedTitleStorage.ts): `rowToSavedTitle`; [databaseSchema.ts](../../../src/storage/databaseSchema.ts): `ensureLibrarySchema`, `verifyV5Schema`; [test 4](section-4-verification.cjs), [informe 4](section-4-validation.md) | SQLite v5, poster_url TEXT nullable, lookup por referencia completa y refresh de URL/null. Tests con 18 DBs SQLite reales aisladas, no driver Android físico. IDs grandes, clasificación, datos personales, pins, creación-only initialTags y ausencia de voteAverage MangaUpdates conservados según contratos. |
| I6 | [libraryBackupExport.ts](../../../src/storage/libraryBackupExport.ts): `getLibraryBackupExportDataWithDb`; [libraryBackupV6.ts](../../../src/core/libraryBackupV6.ts): `createLibraryBackupV6`, `parseLibraryBackupV6`; [libraryBackup.ts](../../../src/core/libraryBackup.ts): `parseLibraryBackup`; [libraryBackupMerge.ts](../../../src/storage/libraryBackupMerge.ts): `updateFrom`, `mergeLibraryBackupWithDb`; test/informe 4 | Backup v6 y parse/import v1–v6 conservan el contrato genérico string/null/ausente. No se añade allowlist del proveedor a imports. Round-trip, merge y rollback con SQL real; no prueba selector de archivos ni transporte nativo. |
| I7 | [availability.ts](../../../src/providers/mangaupdates/availability.ts): `mangaUpdatesAvailability`; [product.ts](../../../src/providers/mangaupdates/product.ts): `loadMangaUpdatesProductDetail`, `localMangaUpdatesSources`; [client.ts](../../../src/providers/mangaupdates/client.ts): `eligibleTransport`, `attempt`; [gates test](../expanded-media-domain/section-8-verification.cjs), [UI gates](../expanded-media-domain/section-8-ui-verification.cjs), test 2 | Android metadata habilitada (`MANGAUPDATES_ANDROID_VALIDATED=true`); Web/iOS productivos bloqueados antes de cliente/cache. El cliente además prohíbe Web incluso con override diagnóstico. iOS diagnóstico del cliente no equivale a disponibilidad productiva. Ningún gate purga datos locales. |
| I8 | [informe 5](section-5-validation.md), [runner de composición](section-5-verification.cjs), [runner Chrome/CDP](section-5-browser-verification.cjs) | Evidencia vigente del smoke está al principio del informe 5; apartados posteriores son históricos y sus pendientes quedaron sustituidos. Véase alcance concreto abajo. |
| I9 | [attribution.ts](../../../src/providers/mangaupdates/attribution.ts): `MANGAUPDATES_ATTRIBUTION`, `mangaUpdatesProvenance`; detalle remoto/local; [About](../../../app/settings/about.tsx) | Atribución de datos y enlaces existentes no constituyen licencia del arte ni prueba de cumplir una futura atribución específica de imágenes. |
| I10 | [evidencia previa](../expanded-media-domain/mangaupdates-evidence.md), [validación de foundation](../expanded-media-domain/section-6-validation.md), diseño actual §Context | Registro histórico de política/API y exploración; no licencia de imágenes revalidada en esta sección. Sus estados de activación son históricos: I7 refleja el código actual. |

### Navegador, revisión y límites de pruebas

I8 registra Chrome 156.0.8078.80 / Windows / CDP 1.3 / Node v22.18.0, corrida 6 exit 0 con 26 checks, dos Metro y tres contextos desechables (producción antes/review/producción después). El informe enlaza result/network/console, snapshots y capturas fuera del repo; esta sección leyó ese resumen y el runner, sin repetir navegador ni afirmar una nueva inspección de cada artefacto externo.

Se observaron 38 requests: 30 respuestas HTTP 200 y una carga data: con estado 200 y siete fallos Image `ERR_UNSAFE_PORT` del recurso roto localhost:1 existente en review; cero requests MangaUpdates API/CDN en ese recorrido. No hubo redirects observados. La ruta remota Web quedó bloqueada; review permitió guardar/editar/navegar en sus dos DBs aisladas; producción volvió a biblioteca vacía y DB propia. No había credencial TMDB: se verificó el estado de configuración, no búsqueda remota TMDB exitosa con token. Los errores de puerto ocurrieron antes de HTTP: no son siete respuestas 404, ni una prueba de timeout/offline real.

El codec aislado `HTMLImageElement.decode()` decodificó SVG propio 40×60 y rechazó PNG corrupto; eso no prueba carga exitosa de una imagen dentro de la app. Eventos HTTP/red/decode/offline, URL/identidad, navegación y save de componentes están cubiertos por composición Node con hooks/Image simulados. CDP Fetch estuvo habilitado en las páginas, sin intentos MangaUpdates que bloquear; los workers solo tuvieron Network porque ese target no soportaba Fetch.enable. No se extrapola intercepción universal, cero GET histórico, cache offline ni aceptación Android/iOS. La evidencia manual anterior de 13 WebP/Slow 4G no identifica por sí sola proveedor ni derechos. Referencia: I8, tablas de observado y límites de Network.

## Derechos y condiciones: registro externo fechado

Clasificación empleada en todo el informe:

- **A — permiso documentado explícito:** texto primario verificable que autorice el uso concreto, con alcance y condiciones.
- **B — restricción documentada explícita:** obligación/prohibición identificable; indicar si solo consta en un registro histórico.
- **C — comportamiento técnico observado:** respuesta/carga/gate, sin consecuencia de licencia.
- **D — desconocido / no verificado:** falta texto autoritativo accesible o evidencia del entorno pertinente.
- **E — supuesto a validar:** hipótesis futura que no puede usarse como permiso ni criterio satisfecho.

Acceso de esta evaluación: **2026-11-09**, solo búsqueda y lectura de documentación textual mediante herramienta web. No se hizo GET, HEAD, sondeo ni renderizado de artwork/CDN, ni contacto, formularios o solicitud de aprobación. Errores de la herramienta no prueban caída, ausencia de términos ni rechazo del proveedor.

| ID / URL exacta | Autoridad y título | Resultado, paráfrasis breve y alcance |
| --- | --- | --- |
| E1 — https://api.mangaupdates.com/ | MangaUpdates; documentación oficial de API (título según I10; contenido no recuperado ahora) | Open devolvió `Internal Error` no reintentable. I10 registra acceso público search/detail y condiciones históricas; **D** para vigencia/texto actual. No establece licencia del arte ni autorización de esta app. |
| E2 — https://api.mangaupdates.com/openapi.yaml | MangaUpdates; contrato OpenAPI (identificación de I10) | Open devolvió `Internal Error` no reintentable. I10 registra campos de metadata e image.url.original/thumb; **C histórico** de estructura/disponibilidad. Un campo URL no establece derechos de display/hotlink/cache. No se pudo verificar licencia contractual actual. |
| E3 — https://api.mangaupdates.com/#section/Acceptable-Use-Policy | MangaUpdates; Acceptable Use Policy (referencia histórica I10) | Open normalizó al documento raíz y falló con `Internal Error`. I10 resume crédito, caching y espaciar requests; prohíbe fraude/ilegalidad/spam/daño a la base: **B histórico**, no cita primaria fresca. No se verificó alcance a imágenes, TTL, cuotas ni retención/exportación indefinida. |
| E4 — https://www.mangaupdates.com/ | MangaUpdates; sitio oficial (título no recuperado) | Open devolvió `Internal Error`; **D** para términos de copyright, titularidad, hotlink y CDN. No se deduce permiso de inaccesibilidad. |
| E5 — https://reactnative.dev/docs/0.81/image | React Native; Image, versión 0.81 | Lectura exitosa. Documenta imágenes remotas, eventos de carga/error y APIs de cache; soporte Android de formatos requiere atender configuración nativa. **C documental**, no resultado del dispositivo ni licencia MangaUpdates; no establece allowlist de redirects de esta app. |
| E6 — https://reactnative.dev/docs/0.81/images | React Native; Images, versión 0.81 | Lectura exitosa. Distingue recursos y carga/decodificación de imágenes; configuración de cache expuesta para iOS no es garantía Android. **C documental**, no política de retención del proveedor ni medición de cache del build actual. |

Las búsquedas `site.mangaupdates.com API terms copyright images attribution caching`, `site.api.mangaupdates.com API cache attribution`, `site:api.mangaupdates.com "Acceptable Use"` y `site:mangaupdates.com "copyright" "images"` no aportaron texto oficial recuperable suficiente. Se descartaron wrappers, otros catálogos y prácticas de otras apps como fundamento de permiso. No se afirma haber agotado toda fuente posible; revalidación primaria permanece OPEN.

### Resultado por cuestión de derechos

| Cuestión | Clasificación y conclusión al cierre de Sección 6 |
| --- | --- |
| Uso de metadata API | **C histórico:** acceso y contrato registrados en I10. **B histórico:** crédito/espaciado/cache y prohibiciones allí resumidas. **D:** términos actuales completos y alcance de retención. La decisión previa de elegibilidad personal/open-source/no comercial es una decisión de ingeniería condicionada, no autorización explícita de arte. |
| Titularidad del cover / cadena de derechos | **D:** no se verificó quién puede licenciar cada obra ni que MangaUpdates pueda otorgar estos usos. No se asigna propiedad por hospedar una imagen. |
| Display/hotlink desde este cliente Android | **A:** ningún permiso explícito suficiente verificado. **D:** condiciones aplicables. **E:** asumir que servir la URL implica autorizar display sería un supuesto pendiente e inadmisible para activar. |
| Acceso CDN / redirects | **C histórico:** el diseño registra muestras GET 200 sin redirect del 2026-11-08 y HEAD 400; no se repitieron. **D:** condiciones CDN, destinos permitidos y estabilidad. Esas muestras no son licencia ni garantía futura. |
| Atribución | **B histórico:** crédito de datos según I10; I9 lo implementa. **D:** crédito de portada, autor/editor, enlaces y ubicación exigidos. **E:** atribuir datos sería insuficiente si se requiere otra atribución de arte. |
| Retención/export/redistribución de URLs | **C:** capacidad técnica I5/I6. **D:** permiso, plazos, alcance personal/exportado y uso más amplio/comercial; exportar una referencia no equivale a exportar bytes, pero requiere evaluación propia. |
| Descarga/cache/redistribución de binarios | **A:** ningún permiso explícito verificado. **D:** condiciones sobre cache transitoria nativa, almacenamiento persistente, caducidad y eliminación. La recomendación histórica de cache API no se extiende automáticamente a arte. |
| ¿Acceso API implica derechos de portada? | No se encontró documento que establezca esa implicación (**D**); no puede usarse como **A**. HTTPS válida, API pública, GET200, navegador u open-source no sustituyen una base jurídica/contractual suficiente. |

No se declara una prohibición general de portadas sin texto primario que la sustente. Tampoco se transforma falta de restricción recuperable en permiso. Para futura activación, derechos ausentes, ambiguos o incompatibles bloquean el avance.

## Renderer y red: riesgos y limitaciones

I1 valida una **cadena inicial** antes de entregarla a Image. I3 entrega `source={{uri: posterUrl}}` a React Native Image; no instala una política de redirects ni cache. El código instalado en `node_modules/react-native/Libraries/Image/Image.android.js` delega funciones a `NativeImageLoaderAndroid` y usa el componente nativo. Esto respalda separar la capa Image del cliente API JavaScript; no se auditó toda la cadena de transporte del build Android.

I7 `client.ts/attempt` usa `fetch` con `redirect: "error"` y comprobación del origen de respuesta para **metadata API**. Esas defensas no se aplican automáticamente a las imágenes nativas. Sustituir/interceptar JavaScript fetch en tests no demuestra interceptar todas las peticiones de Image. Browser CDP observa Chrome y RN Web, no el transporte Android. No se inventan límites de saltos, downgrade HTTPS, reenvío de headers, política TLS, DNS, cache ni comportamiento de errores de Android.

La imagen puede fallar en transporte, respuesta HTTP o decodificación; el fallback I3/I4 trata onError como fallo visual, sin diagnosticar ni reparar la causa. Seleccionar original→thumbnail sucede en mapping, no es failover de red. Cambiar identidad/URL permite otro intento; no hay un servicio de retry automático de imágenes implementado por este cambio.

**Requiere instrumentación Android posterior:** cadena completa y destino final de redirects; si es posible restringirlos a destinos permitidos; diferencias por build/OS; TLS/red/proxy del sistema; formatos y decode; errores y cancelación al reciclar/navegar; cache real en memoria/disco, TTL, expulsión y efectos de headers; requests repetidos, lifecycle y recuperación de red. Una carga exitosa no prueba ninguna condición jurídica. E5/E6 no resuelven esas preguntas para este APK.

## Retención y backups

I5 guarda **metadata** `posterUrl` (string o null), no el archivo de imagen. `saveProviderTitleWithDb` resuelve por referencia completa y materializa; `materializeProviderSavedTitle` copia el snapshot.posterUrl incluso null. Re-save conserva ID/createdAt/status/tags/notas/personalRating; clasificación sigue su contrato y pins su limpieza existente. `initialTags=[]` solo inicializa al crear. Omit productivo implica null también al actualizar: puede limpiar una URL antigua de ese título; no hay backfill, barrido ni preservación monotónica de covers. Un onError no llama a save y no limpia SQLite (I3/I4, test 4).

I6 exporta el string/null del registro en JSON v6. Import v6 valida el tipo de posterUrl, no la allowlist MangaUpdates. En actualización elegible, ausencia preserva local y null explícito limpia; metadata antigua/igual se salta según merge. Los parsers históricos v1–v6 mantienen sus reglas: no convierten formatos v1–v5 en catálogos MangaUpdates. Sección 4 verifica compatibilidad sin requests.

URLs históricas, importadas por el usuario o guardadas localmente pueden permanecer en SQLite y backups y ser utilizadas por los renderers genéricos, incluso Web/iOS; no pasan retroactivamente por I1. Eso no es nueva activación productiva del proveedor. No se promete que todo string importado sea una URL HTTPS válida, una imagen segura o autorizada; `TagCollage` filtra http(s), mientras otras superficies delegan la URI al renderer. No se añade una nueva restricción al contrato histórico.

El cambio **no introduce downloader, prefetch propio, cache personalizada ni exportación de binarios**. Esto no equivale a garantizar cero bytes en caches internas del renderer/OS: I3 y E5 permiten imágenes remotas y no miden almacenamiento nativo. Un campo genérico string tampoco constituye un filtro universal contra strings data/base64 aportados por terceros: los casos propios de I6 verifican URLs/null sin añadir regla restrictiva al formato. No se incorporan imágenes al backup por descarga automática.

Offline, metadata y campos personales locales siguen disponibles; una portada solo puede mostrarse si el entorno tiene datos accesibles, sin promesa de cache ni disponibilidad offline (I8). Guardar la URL no guarda sus bytes. Backups no garantizan recuperar la imagen si el servidor cambia, desaparece o restringe acceso. Exportar el string puede trasladar la referencia a otro entorno, cuyos accesos y derechos deben evaluarse por separado; tampoco equivale a permiso de redistribuir arte.

## Preguntas abiertas

| ID | Incertidumbre separada de los hechos | Evidencia necesaria en un futuro cambio |
| --- | --- | --- |
| O1 | Licencia/autoridad para mostrar cada clase de portada en esta app Android | Términos oficiales vigentes o autorización suficiente, alcance del titular y compatibilidad con distribución prevista. E1–E4 no pudieron revalidarse. |
| O2 | Hotlink, condiciones CDN y atribución específica | Texto primario fechado, dominios permitidos, crédito exacto/enlaces/ubicación y restricciones de cliente. |
| O3 | Retener/exportar URLs y metadata por tiempo indefinido | Condiciones de snapshot local, backups personales, traslado/importación y distribución más amplia/comercial; distinguir URL de bytes. |
| O4 | Cache binaria nativa permitida y comportamiento real | Condiciones jurídicas y mediciones del build Android: memoria/disco, caducidad, eliminación, reinstalación/upgrade y offline. No asumir que cache de DTO autoriza cache de imágenes. |
| O5 | Redirects y enforcement de destinos | Instrumentación nativa que registre cadena/destino y demuestre si puede restringirse bajo las condiciones aprobadas. Las muestras históricas sin redirects no bastan. |
| O6 | Aceptación física, errores, rendimiento y consumo | Matriz de hardware/build/red, resultados reproducibles y límites de producto según los gates siguientes. |

Riesgos: activar antes de O1/O2 puede incumplir condiciones desconocidas; aceptar solo el hostname inicial deja O5 sin resolver; retención/cache/export tienen ciclos distintos (O3/O4); remotos cambiantes, decode y reciclado pueden causar fallos o tráfico repetido (O6). Son riesgos para una activación futura, no defectos ocultados por la documentación ni licencias inferidas.

## Gates ordenados para futura activación

Este es un handoff, no una propuesta aprobada ni autorización para ejecutar requests reales ahora. El orden evita realizar pruebas con arte antes de disponer de una base suficiente para ese uso de prueba.

1. **A — Permisos del proveedor y titulares.** Revalidar fuentes oficiales y registrar URL, autoridad, título, fecha, texto pertinente y alcance de display Android, hotlink/CDN, atribución y distribución prevista. Verificar que la autoridad cubre arte, no solo metadata. Si el fundamento falta, es ambiguo o incompatible, mantener activación bloqueada y omit. No exigir contacto como única vía: documentación suficiente puede servir; silencio nunca sirve.
2. **B — Red y redirects.** Con pruebas autorizadas en Android controlado, registrar versiones/build/dispositivo, cadenas/destinos y condiciones CDN. Usar primero recursos propios para fallos/redirects; arte real solo bajo el alcance aprobado. Determinar si Image nativo puede restringir destinos a los permitidos y demostrarlo; si no satisface las restricciones, bloquear activación. No prescribir ni implementar proxy, downloader o intercepción de red sin aprobación del usuario de esa arquitectura.
3. **C — Persistencia/cache.** Resolver O3/O4 por separado para metadata, URL retenida, export/import de URL, bytes en memoria/disco y redistribución binaria. Documentar qué se permite, plazos, borrado y expectativas offline; medir el renderer real. Identificar cambios arquitectónicos necesarios y presentarlos para aprobación, sin implementarlos en este milestone. No introducir purga/migración/supresión de backup por inferencia.
4. **D — Aceptación en hardware Android real.** Ejecutar y conservar evidencia de la matriz inferior; Node, Chrome o simulación de Platform no la sustituyen. Identificar dispositivo/OS, versión RN/Expo y build debug/release relevante, condiciones de red, resultado esperado/observado, logs sanitizados y fallos pendientes.
5. **E — Decisión explícita de producto.** Presentar resultados A–D y riesgos residuales en una nueva propuesta aprobada `activate-mangaupdates-cover-images-android`, creada solo cuando el usuario decida avanzar. Distinguir autorización de pruebas controladas de autorización productiva. Requerir decisión del usuario para activar y scope aprobado de plataforma; no cambiar silenciosamente los defaults ni los omit explícitos de I2. Mantener Web/iOS cerrados salvo otra autorización específica.
6. **F — Cierre independiente.** No trasladar estos gates a tareas incompletables del cambio actual; conservar el informe y condiciones como handoff. Archivar preparación no abre ni satisface la futura activación.

### Matriz de aceptación Android requerida (gate D)

| Caso | Qué debe comprobar y conservar la futura evidencia |
| --- | --- |
| Carga/decodificación | Formatos/tamaños autorizados en imágenes reales; placeholders, crop/dimensiones y fallos de decode. No asumir soporte por éxito SVG de Chrome. |
| Ausente/inválida | Original/thumbnail/null y rechazo inicial; imagen corrupta, URI inválida y metadata incompleta sin pérdida de texto. |
| HTTP/red | 404/403/5xx, timeout, interrupción, cancelación y recuperación; fallback sin cascada no autorizada ni escrituras causadas por error. |
| Redirects | Registrar cada salto/destino y comportamiento frente a destino no permitido, loop y downgrade según restricciones aplicables. Probar enforcement posible, no solo caso exitoso. |
| URL/identidad/reciclado | Misma identidad con nueva URL, distinta identidad con misma URL, A→B→A, scroll rápido, reorder y callbacks tardíos. Recuperación con nueva imagen y aislamiento entre celdas. |
| Navegación/guardado | Buscar Detalle/Mosaico, remoto, biblioteca, local, collages; guardar/re-save sin duplicados ni corrupción de notas/rating/pins y sin perder navegación por fallo visual. |
| Atribución | Crédito/enlaces de datos y arte según A, visibles/legibles en superficies requeridas; accesibilidad sin duplicados. |
| Lifecycle/red restaurada | Background/foreground, cierre/reapertura, cambios de ruta durante carga, pérdida y regreso de red; no prometer retry si la UI no lo ofrece. |
| Cache/offline | Arranque frío/caliente, cache vacía/llena/expulsada, red ausente/restaurada, retención/borrado permitido. Metadata editable con placeholder si no hay bytes. |
| Rendimiento/datos | Scroll y memoria, decode, requests repetidos, bytes/latencia en redes representativas; definir límites de aceptación y registrar consumo, sin inventar umbrales actuales. |

## Checklist de handoff

Estos casilleros son **gates futuros**, no tareas pendientes de Sección 6 ni evidencia de autorización actual.

- [ ] Registrar aprobación y alcance de la futura iniciativa independiente antes de crear su cambio.
- [ ] Resolver O1/O2 con documentación primaria suficiente; registrar condiciones incompatibles como bloqueo.
- [ ] Resolver O5 con instrumentación Android y evaluación de restricción efectiva de destinos.
- [ ] Resolver O3/O4; acordar retención/export/cache/atribución y cualquier propuesta arquitectónica necesaria.
- [ ] Completar gate D en hardware real, con fallos y limitaciones visibles.
- [ ] Obtener aprobación explícita de propuesta y decisión productiva después de resolver bloqueos; revisar cada punto de composición I2 y regresiones de I1–I8.

## Independencia de cierre y consistencia

El cambio actual queda técnicamente preparado, probado dentro de límites documentados e **inactivo para nuevas portadas MangaUpdates productivas**. I1–I8 respaldan esa preparación; no se afirma ausencia universal de cargas de URLs históricas. Propuesta, diseño (decisiones 1, 2, 5 y 6) y delta spec separan expresamente derechos/redirects/aceptación real del criterio de cierre técnico.

Por ello O1–O6 bloquean una futura activación, no archivar la preparación después del flujo restante. **El cambio aún no está listo para archivar en este checkpoint:** Sección 7.1/7.2, regresión final, revisión externa integral y checkpoint manual siguen pendientes. Esta sección completa únicamente documentación 6.1/6.2; no ejecuta Sección 7, sync, archive ni Git mutable.

## Validación de Sección 6 y archivos protegidos

Se contrastó este informe con los cuatro artefactos activos, funciones reales y cobertura/reportes de Secciones 1–5. No se halló comando de lint Markdown/documentación en package.json; se utiliza el validador OpenSpec existente para consistencia estructural, sin considerar eso ejecución de la regresión final 7.1.

| Comando de esta sección | Exit / resultado |
| --- | --- |
| `npx tsc --noEmit` | 0, sin diagnósticos; ejecutado antes de marcar tareas documentales |
| `openspec validate enable-mangaupdates-cover-images --strict` | 0, cambio válido; no sustituye suites ni completa 7.1 |
| `git diff --check` | 0; el archivo nuevo además se comprueba directamente por whitespace y enlaces locales |
| `openspec status --change enable-mangaupdates-cover-images` | 0; artefactos completos, no equivale a implementación completa |
| `openspec instructions apply --change enable-mangaupdates-cover-images --json` | 0; progreso final 12/14, quedan exclusivamente 7.1/7.2 |
| Comprobación local Python de destinos de enlaces y whitespace del informe nuevo | 0, todos los destinos locales existen, sin espacios finales ni líneas vacías extra al EOF |

Las lecturas exploratorias con glob `src/storage/*` y `src/core/libraryBackup*` en rg produjeron diagnóstico de ruta Windows (no resultado de test); se sustituyeron por directorios o archivos concretos. Las fuentes web E1–E4 no fueron recuperables y permanecen OPEN. No hubo nuevas ejecuciones de suites/browser, requests de arte ni contacto externo.

Archivos autorizados: este informe nuevo y tasks.md activo (solo marcas 6.1/6.2). Ningún cambio productivo, de esquema/backup, gates, permisos de red, dependencias, lockfiles, canonical/archived specs o nuevo directorio OpenSpec. Producción permanece omit. SHA256 inicial de package.json personal: `262E90681FAFF16686F79D3F14CE6A6CAE158442D432038F31616B4E2E990C78`; package-lock.json: `7EB6A96DF94D78B76C89A3E0B305AD95E1316DD91D7BB0B7B18DC4B13F3EED05`.

La comprobación final de hashes confirmó ambos valores sin cambios. `git status --short` muestra solo tasks.md, este informe nuevo y la modificación personal preexistente de package.json. No hubo add/commit/push/reset/rebase. Se detiene después de Sección 6 para revisión externa del diff; el usuario realiza el checkpoint manual después de aprobarla.
