## 1. Contratos de identidad local y externa

- [x] 1.1 Definir el contrato mínimo de referencia externa (`provider`, `resourceNamespace`, `externalId`), canonicalizar/rechazar whitespace exterior en provider/namespace y separar esos campos del item local; comprobar igualdad por valores almacenados y que el ID externo permanezca opaco en tests puros.
- [x] 1.2 Adaptar la materialización TMDB para producir exactamente `tmdb/<movie|tv>/<String(id numérico validado)>`, preservar ID local, `createdAt`, rating, status, tags y notas, y mantener la semántica vigente de `updatedAt` al refrescar; comprobar namespaces con igual ID y variantes textuales del mismo ID numérico.
- [x] 1.3 Ejecutar una revisión externa del diff real de la sección 1, resolver findings y detener APPLY para el checkpoint manual de commit/push antes de continuar.

## 2. Schema SQLite v4 y migración íntegra

- [ ] 2.1 Definir y verificar el schema v4 de `saved_titles`, `media_provider_references`, `legacy_saved_title_identities` y `title_pins`, incluidos primary keys, tokens canónicos sin whitespace exterior, checks, foreign keys, cascades e índices; comprobar una base nueva, referencias no canónicas rechazadas y reapertura idempotente.
- [ ] 2.2 Reorganizar el bootstrap para que no cree/verifique `idx_saved_titles_provider_external` antes de evolucionar una base v3 y para que versiones 0–2 alcancen v4 respetando las etapas históricas; comprobar versiones nuevas, históricas y futuras rechazadas.
- [ ] 2.3 Implementar la migración transaccional v3→v4 mediante tablas temporales, preservando IDs, snapshots, ratings, tags, notas, estados, timestamps, preferencias, pins y `pinned_at`; comprobar conteos y valores exactos antes/después.
- [ ] 2.4 Migrar cada fila TMDB a una referencia `tmdb/type/external_id` y cada fila manual a identidad legacy sin ProviderReference; comprobar IDs opacos no UUID, ambos tipos TMDB y datos inválidos que abortan sin publicar `user_version = 4`.
- [ ] 2.5 Agregar inyección de fallos representativa en creación, copia, verificación y publicación de versión; comprobar rollback completo, ausencia de huérfanos y conservación de la base v3.
- [ ] 2.6 Ejecutar una revisión externa del diff real de la sección 2, resolver findings y detener APPLY para el checkpoint manual de commit/push antes de continuar.

## 3. Repositorios y semántica de escritura

- [ ] 3.1 Implementar helpers `WithDb` para cargar items con sus referencias y resolver una referencia completa sin `initDb`, cola ni transacción interna; comprobar cero, una y varias referencias por item.
- [ ] 3.2 Reemplazar lookups y upserts por `provider + resourceNamespace + externalId`, manteniendo la composición pública `initDb → runSerializedStorageMutation → withTransactionAsync → helperWithDb`; comprobar rollback ante referencia duplicada.
- [ ] 3.3 Actualizar borrado y limpieza relacional para conservar pins válidos y eliminar por cascade referencias externas e identidades legacy; comprobar que no queden filas huérfanas y que pinning no altere `updatedAt`.
- [ ] 3.4 Demostrar con regresiones que `tmdb/movie/N` y `tmdb/tv/N` coexisten, que re-guardar cada uno preserva sólo sus propios datos personales y que el lookup de uno nunca devuelve el otro.
- [ ] 3.5 Ejecutar `npx tsc --noEmit`, revisar contratos de ratings `10..100 | null`, tags, status, clocks y snapshots, y corregir toda regresión de storage antes del checkpoint.
- [ ] 3.6 Ejecutar una revisión externa del diff real de la sección 3, resolver findings y detener APPLY para el checkpoint manual de commit/push antes de continuar.

## 4. Backup v5 e import histórico

- [ ] 4.1 Definir parser y serializer v5 con items, referencias externas canónicas, pins por `itemId` y Appearance compatible; exigir que el exporter incluya identidad legacy manual en todo local-only histórico y rechace emitir un local-only sin referencia ni legacy, comprobando sus round-trips.
- [ ] 4.2 Desacoplar los validadores v1–v4 de unions live para congelar literalmente `manual|tmdb` y `movie|tv`; ejecutar todas las fixtures y verificaciones históricas existentes sin cambiar su interpretación.
- [ ] 4.3 Implementar la resolución v5 por referencias convergentes o identidad legacy manual, conservar IDs libres y remapear IDs ocupados sólo cuando una referencia externa garantiza reimportación; comprobar repeat import por referencia y por legacy, más conflicto sin remap para local-only sin identidad.
- [ ] 4.4 Implementar el merge de contenido v5 sobre items existentes preservando ID/`createdAt`, orden por `updatedAt` y presencia versus `null` explícito; comprobar que incoming ausente/anterior/igual no sobrescriba datos locales y que incoming posterior actualice sólo campos presentes.
- [ ] 4.5 Restaurar referencias libres cuando todas las referencias resueltas convergen en el mismo item, conservar referencias locales ausentes del backup y rechazar cualquier divergencia antes de adjuntar o mover metadata/datos personales; comprobar cada caso y reimportación idempotente.
- [ ] 4.6 Implementar detección de referencias duplicadas o cruzadas entre items y asegurar que conflictos no fusionen ni reasocien metadata, rating, tags, notas, status o pins; comprobar resultados `conflicts`, `invalid` y `failed` por separado.
- [ ] 4.7 Adaptar imports v1–v4 para derivar referencias TMDB desde sus items, resolver manual mediante identidad legacy y restaurar pins sólo cuando el item asociado determine una identidad única; comprobar pins no ambiguos, ambiguos y sin item.
- [ ] 4.8 Preservar savepoints por item/pin, una transacción pública para el merge principal y la activación posterior de Appearance; comprobar resultado parcial, rechazo estructural sin writes y fallo separado de Appearance.
- [ ] 4.9 Actualizar exportación y la pantalla de Ajustes para emitir v5 y presentar sus categorías de resultado sin cambiar browsing preferences ni credenciales; comprobar mensajes web/native y que v1–v4 sigan importables.
- [ ] 4.10 Ejecutar una revisión externa del diff real de la sección 4, resolver findings y detener APPLY para el checkpoint manual de commit/push antes de continuar.

## 5. Adaptación mínima de TMDB y rutas

- [ ] 5.1 Adaptar el detalle remoto TMDB para consultar y guardar por la referencia completa formada desde sus params `type/id`; comprobar detección independiente y navegación para movie/tv con el mismo ID.
- [ ] 5.2 Adaptar el detalle local y consumidores de `SavedTitle` para encontrar la referencia TMDB entre cero o varias referencias, conservar `/title/[id]` y omitir el enlace remoto en items local-only; comprobar funcionamiento sin credencial ni red.
- [ ] 5.3 Verificar que búsqueda, carga atómica de detalle remoto, imágenes, watch providers, credenciales, atribución, filtros `movie|tv`, `voteAverage` y labels mantienen sus contratos sin introducir una interfaz general de providers.
- [ ] 5.4 Ejecutar `npx tsc --noEmit` y una verificación manual web de buscar→detalle TMDB→guardar→detalle local para ambos namespaces y modo offline local.
- [ ] 5.5 Ejecutar una revisión externa del diff real de la sección 5, resolver findings y detener APPLY para el checkpoint manual de commit/push antes de continuar.

## 6. Regresión integral y cierre de implementación

- [ ] 6.1 Ejecutar la suite dirigida de schema/migración con bases v0–v4, reapertura, versión futura y fallos inyectados; verificar valores y relaciones, no sólo conteos.
- [ ] 6.2 Ejecutar round-trips de backup v5 y regresiones de imports v1–v4 con merge existing-item por `updatedAt`/presencia/null, referencias añadidas pero no borradas, repeat import local-only por legacy, ratings, tags, notas, pins, conflictos y Appearance compatible/incompatible/fallida.
- [ ] 6.3 Verificar las capacidades canónicas afectables: personal rating y sorting, prioridad de pins, limpieza de tag pins, browsing preferences fuera del backup, Appearance separado y credencial TMDB excluida.
- [ ] 6.4 Ejecutar `npx tsc --noEmit`, las verificaciones automatizadas relevantes y una pasada manual final en web; registrar resultados y cualquier límite de plataforma pendiente.
- [ ] 6.5 Ejecutar una revisión externa final del diff real completo, resolver findings y dejar el cambio listo para el checkpoint manual final de commit/push sin archivar OpenSpec.
