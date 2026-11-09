## Context

Ver propuesta para motivación y definición de terminado. Baseline: mapping omit por defecto, opción técnica reference-https; detalle/materialización original, búsqueda thumbnail primero. Composición productiva omite portadas y detalle remoto muestra placeholder. Android validado para metadatos, no para imágenes; API Web/iOS bloqueada.

Exploración completada 2026-11-08: GET acotados PNG original 284×400/thumbnail 107×150 de Berserk y JPEG 278×400 de Solo Leveling; sin redirects en esas muestras. HEAD 400 no impidió GET200. No prueba estabilidad ni comportamiento del renderer nativo. Sin aceptación física de imágenes. Fuentes previas: https://api.mangaupdates.com/ y https://api.mangaupdates.com/openapi.yaml; atribución/caching/espaciado API no establecen derechos suficientes del arte. Se conserva evidencia, sin nueva auditoría legal ni contacto.

## Goals / Non-Goals

**Goals:** selección/rendering inactivos comprobables con strings y assets propios; cierre técnico independiente de terceros y handoff preciso.

**Non-Goals:** activar producto, usar arte real, obtener permisos, exigir aceptación real Android, ampliar hosts/plataformas, cache propia/prefetch/downloader/proxy/backfill, schema o dependencias.

## Decisions

### 1. Preparación y activación independientes

Producción permanece omit durante y al terminar este cambio. Preparar paso coherente de política search/detail/materialización sin toggles de usuario ni bypass productivo. La validación Android de metadatos no autoriza arte. Una composición test-only puede ejercitar capacidad sin registrarse como provider productivo ni alterar review neutral.

El futuro activate-mangaupdates-cover-images-android verificará derechos/hotlink, cache del renderer, retención/export URL, atribución/restricciones, redirects y aceptación física con imágenes reales antes de cambiar política. No se crea ahora; ninguno de esos resultados condiciona cerrar preparación. Documentar evaluación pendiente basta para completar tareas documentales; no se marca permiso concedido ni se exige email.

### 2. Selección y validación inicial

En src/providers/mangaupdates/mapping.ts validar candidatos independientemente: original → thumbnail del mismo registro → null. HTTPS absoluto, host exacto cdn.mangaupdates.com, sin credenciales ni puerto diferente del estándar HTTPS; rechazar controles, backslashes y formas ambiguas/inseguras. Probar host engañoso/subdominio/sufijo, esquema, puerto, ausencia e invalidez. No sondear HEAD/GET ni derivar alternativas. Fallo de carga/decode muestra placeholder sin cascada de peticiones de candidatos.

La allowlist controla URL INICIAL. React Native Image/networking nativo puede seguir redirects automáticamente; este cambio no implementa ni afirma enforcement del host final. GETs históricos sin redirect no lo prueban. La futura aceptación debe evaluar cadena/destinos y condiciones: si restricciones eventuales no pueden satisfacerse, activación bloqueada. No añadir proxy, downloader ni infraestructura para resolverlo aquí.

### 3. UI y composición mínimas

Archivos previstos: src/providers/mangaupdates/mapping.ts, src/components/search/mangaUpdatesSearch.ts, app/mangaupdates/series/[id].tsx, app/(tabs)/buscar.tsx y app/(tabs)/libreria.tsx; adapter.ts solo por adaptación mínima necesaria. Detalle remoto preparado para imagen pero recibe null productivo. Misma política en todas las materializaciones. Filas Detalle Buscar/Biblioteca necesitan fallback/reset por identidad y URL.

Reutilizar/verificar src/components/browsing/TitleGridCard.tsx, TagCollage.tsx y LocalPoster de app/title/[id].tsx; modificar solo por carencia demostrada. No agregar imágenes a filas que no las tienen ni servicio genérico. Preservar layout, foco, activación, accesibilidad sin anuncios duplicados y TMDB.

### 4. Tests separados, sin bypass

URL-policy usa strings controlados representando host MangaUpdates, sin fetch CDN. Componentes reciben assets sintéticos/originales del desarrollador directamente por composición test-only, sin ampliar allowlist ni pasar assets ajenos por mapper productivo. HTTP/red/decode fallidos mediante stubs/eventos o assets propios inválidos; no servidor nuevo. No toggles productivos ni catálogo nuevo.

Cubrir búsqueda Detalle/Mosaico, detalle remoto, Biblioteca Detalle/Mosaico, local detail y collages; reset por ID/URL, reciclado, offline sin imagen disponible y ausencia de mutación ante fallo. Checks visuales/runtime sintéticos registran entorno real. Web sintético no acredita Android de arte real; iOS no validado. Pruebas reales y derechos quedan para otro cambio.

### 5. Persistencia e invariantes

Usar mangaUpdatesMaterializationInput → saveProviderTitle y SQLite/export/import reales en DBs aisladas, con URL/null de prueba sin descargar imagen. No estrechar import genérico por allowlist de un proveedor. SQLite 5 → 5; backup 6 → 6; históricos v1–v6 intactos. Sin binarios/sentinels/campos.

Re-save conserva ID/createdAt, referencias, clasificación monotónica y status/tags/notas/personalRating/pins; initialTags=[] creación-only, input MangaUpdates sin voteAverage. Refresh posterUrl puede limpiar con null, sin backfill ni preservación monotónica de covers. Fallo visual no escribe null. Producto omit sigue materializando null; capacidad URL solo con entradas/composición de prueba explícitas.

### 6. Evidencia y plataformas

Separar metadatos API, referencia/rendering, cache transitoria, URL retenida/exportada y almacenamiento/redistribución binaria. Evaluación completa significa evidencia y preguntas fielmente documentadas, no licencia. URL pública/GET200/atribución/open-source no conceden permiso. Cache DTO no es cache de imágenes; no garantizar cero bytes cacheados ni imagen offline.

Android conserva metadatos y portadas omitidas. Web/iOS API bloqueada antes de HTTP/cache. No habilitar nuevas imágenes locales/importadas en esos entornos; lectores genéricos existentes siguen compatibles y pueden renderizar URLs importadas. No afirmar cero GET de imágenes existentes ni confundirlos con API prohibida.

## Risks / Trade-offs

- Nombre enable sugiere activación → mantener identificador solicitado y declarar preparación inactiva en todos los artefactos.
- Redirect nativo fuera del host inicial → limitación documentada; evaluación/bloqueo futuro sin enforcement ficticio.
- Derechos pendientes → solo assets propios; no bloquean cierre técnico.
- Error reciclado → reset por identidad/URL y tests.
- URL/cache variable → fallback y ningún compromiso de imagen offline.

## Migration Plan

Sin migración ni activación. Implementar sección por sección: verificar cada una, revisión externa del diff y checkpoint manual del usuario antes de continuar. Luego regresión final, reporte, revisión integral externa y checkpoint manual; archive solo por solicitud separada. No ejecutar Git automáticamente.

Revertir preparación sin cambiar datos/esquema; omit permanece siempre. Archivar preparación no autoriza activación. Handoff deja pendientes derechos, redirects y aceptación física real sin tareas incompletables dentro de este milestone.
