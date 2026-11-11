## 1. Selección y validación de URL

- [x] 1.1 Implementar/probar selección original válido → thumbnail válido → null en mapping provider-specific, usando strings controlados del host MangaUpdates sin solicitudes de imagen; verificar casos originales/thumbnail ausentes o inválidos y npx tsc --noEmit.
- [x] 1.2 Reforzar/probar validación inicial HTTPS/host exacto, credenciales, puertos, controles, backslashes, URLs relativas/protocol-relative y hosts engañosos. Afirmar únicamente validación inicial, no destino final tras redirects; ejecutar tests focalizados y TypeScript.

## 2. Composición inactiva search/detail/materialization

- [x] 2.1 Preparar paso coherente de política en búsqueda, detalle y materialización manteniendo omit productivo; probar todas las entradas y ausencia de toggles/bypass/productive fixture providers, sin cambiar disponibilidad Android metadata ni gates Web/iOS; ejecutar tests y TypeScript.
- [x] 2.2 Preparar detalle remoto capaz de renderizar imagen mediante composición test-only, pero siempre placeholder/null en producción MangaUpdates. Verificar mismo input para save y detalle, sin HTTP de sondeo ni alteraciones del cliente API; ejecutar tests y TypeScript.

## 3. Fallbacks reutilizables de UI

- [x] 3.1 Incorporar fallback mínimo en filas Detalle de Buscar/Biblioteca y reutilizar patrones de grid/local detail/collages sin rediseño. Probar ausencia y errores HTTP/red/decode con assets propios/stubs y conservar navegación/layout/accesibilidad/TMDB; ejecutar tests y TypeScript.
- [x] 3.2 Verificar reset por identidad/URL al reciclar vistas y recuperación con nueva imagen propia, sin escrituras de posterUrl por error visual. Cubrir búsqueda/library detail-grid, remoto, local y collages pertinentes; ejecutar tests y TypeScript.

## 4. Regresión SQLite v5 / backup v6 / re-save

- [x] 4.1 Verificar pipeline genérico real y SQLite aislada con URL/null de prueba sin descargar arte: re-save sin duplicación, ID/createdAt/referencias grandes/clasificación/datos personales/pins preservados, initialTags creación-only y voteAverage ausente; probar refresh URL → null y falta de backfill; ejecutar suites y TypeScript.
- [x] 4.2 Verificar export/import/merge v6 URL/null y regresión histórica v1–v6 mediante APIs reales/DBs aisladas, sin nuevas reglas del proveedor, binarios o versiones. Confirmar SQLite user_version 5 y backup 6; ejecutar suites afectadas y TypeScript.

## 5. Checks visuales y runtime sintéticos

- [x] 5.1 Ejercitar componentes con assets originales del desarrollador por composición exclusivamente test-only, separada de tests de URL-policy. Probar carga/fallback/error/reset/offline sin garantía de cache; registrar entorno y checks efectivamente ejecutados sin requerir arte de terceros ni aceptación física Android de covers reales; ejecutar TypeScript.
- [x] 5.2 Realizar smoke Web productivo en omit/TMDB y smoke review aislado; comprobar gates Web/iOS con forbidden-fetch y ninguna nueva petición de imagen MangaUpdates por producción. Distinguir URLs locales históricas de nueva activación; registrar runtime/limitaciones sin afirmar Android real ni iOS validado; ejecutar suites y TypeScript.

## 6. Limitaciones y handoff de activación futura

- [x] 6.1 Documentar evidencia vigente y preguntas abiertas por metadatos, hotlink/display, renderer cache, URL retenida/exportada y binarios. Completar significa evaluación precisa, NO permiso concedido; conservar fuentes/fecha y no contactar al proveedor. Revisar consistencia con spec; TypeScript debe seguir pasando.
- [x] 6.2 Documentar handoff provisional a activate-mangaupdates-cover-images-android sin crearlo: futura verificación independiente de derechos, redirects finales, condiciones de retención/cache/atribución, prueba controlada y aceptación física real antes de activar. Explicar bloqueo futuro si restricciones no se satisfacen, sin proxy/downloader ni infraestructura nueva; verificar que nada de ello bloquea cierre actual y ejecutar TypeScript.

## 7. Regresión técnica final y reporte

- [x] 7.1 Ejecutar tests focalizados y regresiones materialmente afectadas de provider abstraction, expanded media, TMDB/search/credentials, browsing, ratings, storage/backup, Appearance y review isolation; ejecutar npx tsc --noEmit y openspec validate enable-mangaupdates-cover-images --strict; registrar comandos/códigos/fallos sin debilitar cobertura de omit.
- [x] 7.2 Entregar reporte técnico externo revisable con archivos, tests/checks reales, matrices de plataforma, invariantes, limitación redirects, derechos pendientes y handoff. Confirmar omit productivo, sin arte real/dependencias/schema/backfill ni bypass; revisar diff completo y consistencia OpenSpec. Tras revisión externa integral y checkpoint manual del usuario, queda apto para archive solicitado por separado, sin esperar permisos ni activación futura.

Flujo obligatorio: una sección por vez (1 → 2 → 3 → 4 → 5 → 6 → 7), validación y revisión externa del diff por sección, checkpoint manual del usuario y continuación explícita. Ninguna tarea crea commits automáticamente. La regresión final, revisión integral y archive son etapas posteriores a implementación; este update no las ejecuta. Todas las tareas se completan sin permisos sobre arte de terceros; usar exclusivamente datos sintéticos/strings controlados y assets propios para pruebas de imagen.
