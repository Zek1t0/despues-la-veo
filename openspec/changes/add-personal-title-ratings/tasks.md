## 1. Dominio y SQLite v3

- [x] 1.1 Añadir `SavedTitle.personalRating` con semántica canónica de décimas enteras `10..100 | null` y helpers centrales de validación, format y parse; comprobar extremos, décimas válidas y rechazo sin clamp de `9`, `101`, `10.5`, `NaN` e infinitos mediante pruebas focalizadas.
- [x] 1.2 Diseñar e implementar la evolución transaccional SQLite v2→v3 con `personal_rating INTEGER NULL` y protección `NULL` o entero `10..100`, publicando `user_version = 3` sólo después de verificar la columna y estructuras existentes.
- [x] 1.3 Añadir fixtures/pruebas de migración para v0→v1→v2→v3, v1→v2→v3, v2→v3, reapertura v3 y rechazo de future version; verificar conservación exacta de `saved_titles`, índice de identidad, `app_preferences` y `title_pins`.
- [x] 1.4 Ejecutar el checkpoint de sección (`npx tsc --noEmit` y pruebas de dominio/migración) y revisar que ninguna escritura ajena a OpenSpec haya tocado `app.json`, `package.json` o `TitleGridCard.tsx`.

## 2. Repositorio, escritura y protección TMDB

- [x] 2.1 Extender row mapping, INSERT/UPSERT y materializadores para leer/escribir/validar `personal_rating` sin coerción y comprobar round-trip `null`, `10`, `87` y `100`.
- [x] 2.2 Añadir un setter UPDATE-only de puntuación que actualice `personal_rating` y un `updated_at` no decreciente, preserve el orden lógico ante colisiones de `Date.now()`, participe de la serialización existente, valide filas afectadas y falle sin insertar cuando el título no existe.
- [x] 2.3 Corregir de forma acotada el re-save TMDB para preservar `id`, `createdAt`, `status`, `tags`, `notes` y `personalRating`, actualizar sólo metadata TMDB y mantener `voteAverage` independiente; cubrir con regresiones de metadata personalizada y TMDB sin `vote_average`.
- [x] 2.4 Probar el caso de borrado concurrente para confirmar que un write pendiente no resucita el `SavedTitle`, ejecutar `npx tsc --noEmit` y revisar el diff de la sección.

## 3. Backup v3

- [x] 3.1 Crear el contrato/parser v3 con `items`, pins v2 y `personalRating` obligatorio por item (`null | integer 10..100`), rechazando/reportando items v3 que omitan la propiedad y conservando `present: false` sólo al normalizar v1/v2.
- [x] 3.2 Actualizar exportación para emitir `version: 3` y siempre incluir `personalRating` en cada item, también cuando sea `null`, sin incluir preferencias; comprobar JSON de títulos puntuados y sin calificar.
- [x] 3.3 Implementar materialización y merge: inserts v1/v2 ausentes→null; v3 number/null exacto; fechas anteriores/iguales→preserve; v3 posterior number/null→replace/clear; v1/v2 posterior ausente→preservar rating local mientras actualiza campos elegibles.
- [x] 3.4 Reutilizar en v3 identidad portable y procesamiento items-before-pins con merge aditivo/idempotente e informes v2, sin alterar `pinnedAt` local existente.
- [x] 3.5 Añadir fixtures/pruebas v3 para propiedad obligatoria, `null`, enteros válidos, propiedad ausente e inválidos, corrupción estructural, round-trip, conflictos, reimportación, v1/v2 sobre rating local y combinaciones de pins.
- [x] 3.6 Actualizar textos/resúmenes de Ajustes para versiones 1/2/3, ejecutar checkpoint (`npx tsc --noEmit`, pruebas de backup y validación de fixtures) y revisar que un archivo inválido no escriba SQLite.

## 4. Sorting de Biblioteca

- [x] 4.1 Extender `LibrarySort` y validación de preferencias con `personal-rating-desc` y `personal-rating-asc`, preservando `rating-desc` y preferencias ya guardadas.
- [x] 4.2 Implementar comparators personales sobre enteros canónicos con null siempre al final, dirección correcta y desempate title→id; cubrir todos-null, extremos y empates.
- [x] 4.3 Añadir labels inequívocos para TMDB y ambos sorts personales sin cambiar el pipeline search/filter→split pinned/unpinned.
- [x] 4.4 Probar prioridad de pins, empate de `pinnedAt` y el ejemplo Batman/Interstellar/Dune/Arrival; ejecutar `npx tsc --noEmit` y pruebas focalizadas de preferencias/comparators.

## 5. Presentación pasiva Detail/list

- [x] 5.1 Añadir formato compartido de puntuación personal pasiva en Biblioteca Detail/list, visualmente distinto de TMDB y sin controles nested; comprobar `null`, `1.0`, `8.7` y `10.0`.
- [x] 5.2 Mostrar el mismo valor global en Etiquetas Detail/list sin snapshots/tablas contextuales, sin alterar membership, pins o collages.
- [x] 5.3 Verificar por diff que Grid, `TitleGridCard.tsx`, `TagCollage.tsx` y Search no recibieron cambios de rating, y ejecutar `npx tsc --noEmit`.

## 6. Editor del detalle completo y rapid writes

- [x] 6.1 Presentar por separado “Tu puntuación” y “TMDB” en `app/title/[id].tsx`, con estados `Sin calificar` y TMDB ausente coherentes.
- [x] 6.2 Implementar con componentes existentes un editor exacto de `0.1` que muestre valor, recorra razonablemente `1.0..10.0`, ofrezca incrementar/disminuir y una acción separada para quitar, sin 91 botones ni dependencia nueva.
- [x] 6.3 Añadir `PersonalRatingIntentQueue` específica y mínima con confirmed/latest, optimistic UI, secuencia, persistencia serial y rollback sólo del último fallo relevante.
- [x] 6.4 Probar `null→87→88→91→null`, `87@T→88→89` con colisión simulada de reloj, falla superada, falla final, navegación/recarga y título eliminado durante write; confirmar rating final, `updatedAt` no decreciente y distinguible cuando el merge lo requiere, convergencia UI/storage y ausencia de INSERT implícito.
- [x] 6.5 Ejecutar checkpoint (`npx tsc --noEmit` y pruebas de editor/cola/repositorio) y revisar que el detalle siga guardando estado, tags y notas correctamente.

## 7. Accesibilidad, responsive y validación manual

- [x] 7.1 [MANUAL] Verificar en web con teclado y lector/inspector accesible que el editor anuncia valor actual, incremento, decremento y quitar como acciones claras, con foco visible y sin controles nested.
- [x] 7.2 [MANUAL] Verificar en viewport móvil angosto que los targets táctiles son razonables, el rango completo es alcanzable y el detalle no desborda.
- [x] 7.3 [MANUAL] Revisar Biblioteca Detail y Etiquetas Detail en anchos móvil/web con valores null, mínimo, intermedio y máximo; confirmar que las filas siguen legibles y no permiten editar.
- [x] 7.4 [MANUAL] Confirmar visualmente que Grid conserva únicamente Movie/Serie, pin contextual y título; que Search no muestra/edita/ordena rating; y que collages no cambian.
- [x] 7.5 [MANUAL] Ejecutar un flujo de re-save TMDB sobre un título con estado, tags, notas y rating personalizados y comprobar que toda metadata personal permanece intacta.

## 8. Regresión final y readiness para Archive

- [x] 8.1 Ejecutar la suite completa disponible y `npx tsc --noEmit`; resolver sólo regresiones atribuibles a este change y documentar cualquier limitación del harness.
- [x] 8.2 Ejecutar `npx.cmd openspec validate add-personal-title-ratings --strict` y confirmar que proposal, design, specs y tasks permanecen coherentes con la implementación.
- [x] 8.3 Revisar `git diff` y `git status --short` para separar cambios locales preexistentes en `app.json`, `package.json` y `src/components/browsing/TitleGridCard.tsx`; confirmar que no forman parte del diff legítimo de la feature.
- [x] 8.4 [MANUAL] Realizar revisión externa final del diff completo contra proposal/design/specs, con foco en datos existentes, migración v3, merge backup, metadata TMDB, pins, accesibilidad y scope exclusions; registrar hallazgos antes de considerar Archive.
- [x] 8.5 Preparar el informe de readiness con pruebas automáticas y manuales, estrategia de reversión y hallazgos externos; no archivar hasta que el usuario lo solicite explícitamente.
