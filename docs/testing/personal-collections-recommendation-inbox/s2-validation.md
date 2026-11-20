# S2 — Inbox de recomendaciones: evidencia técnica y revisión

Fecha de ejecución: 2026-11-20. Change: `add-personal-collections-and-recommendation-inbox`.

## Preflight y alcance

- Rama inicial y final: `feat/personal-collections-recommendation-inbox`.
- HEAD inicial y final: `78a955ab14c764dca77d1fb18d17cf116436b7d4`, checkpoint S1 (`feat: add personal collections and v9 backup support`).
- `git ls-remote origin refs/heads/feat/personal-collections-recommendation-inbox` confirmó ese mismo SHA en origin mediante consulta de solo lectura. `main` es ancestro de HEAD; no se hizo fetch ni se modificaron referencias.
- Worktree e índice iniciales limpios. Índice final vacío; todos los cambios de esta ejecución están sin staging. No había cambios locales ajenos que proteger.
- SQLite continúa en v8: se inspeccionaron las tres tablas, índices no únicos de referencias Inbox, CHECKs, FKs, trigger de captura inmutable y trigger de reapertura al borrar títulos. No se modificaron esquema, migraciones ni versión.
- Se preservaron Biblioteca, sus cinco pestañas, Colecciones, formularios de S1, filtros, Mosaico, Detalle, pins y selector «¿Qué veo hoy?». Organizar cambia únicamente para activar el destino Inbox.
- No se implementó S3 ni se ejecutó staging, commit, push, merge o archive. Sin dependencias nuevas ni cambios a providers/gates/credenciales.

## Implementación y decisiones

**Captura:** dominio puro con nombre, HTTP(S) y/o referencia completa; exige al menos un identificador útil. Texto opcional vacío se normaliza a null. Nombre, persona, origen y comentario son texto plano. Enlaces inválidos o con credenciales se rechazan sin escrituras parciales. Pegar/guardar/editar/abrir no consulta proveedores, descarga previews, sigue redirecciones ni navega al enlace. Una URL válida desconocida se conserva literalmente como contexto.

**Referencias URL:** allowlist local para TMDB movie/tv con ID canónico y slug opcional, y Kitsu anime con ID decimal; hosts oficiales enumerados explícitamente, sin subdominios arbitrarios. MangaUpdates legacy no se interpreta como ID API: conserva URL y permite referencia completa explícita. No se añadió transporte ni reconocimiento por heurísticas.

**Persistencia:** repositorio Inbox sobre la tabla v8 existente. ID de intención estable en el formulario; reintentos idénticos no duplican la captura. Edición conserva originalCapture, estado y vínculo. Original normalizado inmutable también por trigger. Las mutaciones públicas usan una entrada a la cola, una inicialización y una transacción; WithDb no abre transacciones anidadas. Errores dejan borrador y último estado confirmado. Invalidación posterior al commit.

**Estados:** Pendiente inicial; Incorporada exige destino válido; Descartada/Pendiente sin vínculo. Descartar o reabrir no modifica ni elimina títulos. No hay eliminación definitiva de recomendaciones. Borrar un título usa el trigger S1, devuelve todas sus recomendaciones a Pendiente y conserva sus contextos.

**Resolución:** búsqueda local explícita con referencias completas primero y sugerencias textuales después. Incluso un único resultado por nombre exige «Vincular». Coincidencias visibles presentan título/medio/año y arte permitido. Una referencia compartida muestra advertencia y ofrece revisar registros existentes; IDs diferentes mantienen persona/comentario/original independientes.

**Catálogo e incorporación:** una ruta contextual reutiliza Buscar y sus categorías, adaptadores, credenciales y gates. En contexto Inbox, escribir/cambiar categoría no envía consultas: hay envío deliberado por consulta/categoría y botón deshabilitado si TMDB no está configurado. Se conserva recommendationId en los resultados y las fichas remotas, con retorno al registro. Los helpers releen identidad fuerte dentro de la transacción: existente vincula sin llamar al refresh; nuevo usa el guardado vigente y vincula antes del commit. El formulario manual vigente admite alta transaccional y confirmación explícita de candidatos existentes. Reintentos por ID recuperan el vínculo ya confirmado; cambiar de obra externa requiere reapertura. La red ocurre antes de la transacción. Las fichas conservan controles de errores, bloqueo de doble envío y descarte de respuestas obsoletas; Kitsu contextual respeta contenido sensible.

**Interfaz:** listado por estado (Pendientes inicial), contador, filas de texto/contexto y fragmento del comentario de dos líneas; sin portadas ficticias ni grandes placeholders. Una portada vinculada solo se presenta si es visible y permitida. Detalle con acción principal local, secundaria de catálogo y acciones de edición/estado discretas; captura original consultable. Formularios y botones usan OrganizationUI y tokens S1, agrupación horizontal flexible, superficies táctiles de 44 px, sin sexta pestaña ni rediseño global.

## Backup v9 operativo

Exporta títulos, identidades y datos portables previos, Colecciones/membresías y todas las recomendaciones (incluidas descartadas, editadas y vinculadas), con originalCapture, campos actuales, referencia, estado, vínculo y relojes. Snapshot consistente por cola/transacción, sin filtrar sensibles ni exportar credenciales/binarios/preferencias excluidas.

Importa títulos antes de relaciones. Los vínculos solo usan el mapa de identidades portables del archivo, nunca el ocupante casual de un ID local. Recomendaciones se fusionan por ID estable y updatedAt estrictamente mayor; igualdad conserva local. Captura original incompatible para el mismo ID genera conflicto recuperable antes de comparar frescura. Compartir referencia entre IDs distintos no genera conflicto ni fusión. Savepoint por registro; fallo de transacción revierte todo. Vínculo irresoluble se conserva Pendiente con contexto/reloj entrante y se informa. Se acepta v9 S1 sin recommendations; ausencia no borra. Parsers históricos v1–v8 intactos.

Round trip real verificado a SQLite TEST vacía y con colisión de identidad manual: colecciones vacías/pobladas, miembros, los tres estados, ediciones, referencias compartidas y enlaces recuperados. Reimportación sin duplicados; contenidos personales y portables conservados. El importador histórico de metadata avanza su revisión interna de control de escrituras al reimportar documentos: la prueba de reimportación excluye únicamente ese contador técnico, preservando todos los campos de contenido/fechas/relaciones. Las pruebas de vinculación comparan filas completas, incluida esa revisión, y exigen igualdad exacta.

## Validaciones ejecutadas

| Comprobación | Resultado |
| --- | --- |
| `npx tsc --noEmit` | PASS |
| `npx expo export --platform web --output-dir web-s2-final` | PASS; artefactos trasladados después a dist ignorado |
| `npx openspec validate add-personal-collections-and-recommendation-inbox --strict` | PASS |
| `git diff --check` y `git diff --no-index --check` entre NUL y cada archivo nuevo | PASS; sin usar índice. Se normalizaron finales de línea de los archivos S2 para eliminar CR duplicados |
| `node docs/testing/personal-collections-recommendation-inbox/s2-verification.cjs` | PASS: SQLite real TEST, FKs, offline, URLs, estados, duplicados legítimos, preservación exacta al vincular, incorporación/reintento/concurrencia, gates, rollback de vínculo/commit, eliminación y reapertura de todos los vínculos, v9 completo, remap, conflictos, igualdad, S1 sin Inbox y reinicio |
| `node docs/testing/personal-collections-recommendation-inbox/s2-ui.cjs` | PASS: componentes/hooks reales, estados/listas/formulario/borrador, candidatos ambiguos con confirmación, navegación catálogo/manual/TMDB y retorno, doble pulsación, Kitsu sensible, gate Web cerrado de MangaUpdates y flujo Android simulado, errores; propiedades de layout a 320/360/400/1280 px y fuente 100/200% en todas las paletas claras/oscuras |
| `node docs/testing/personal-collections-recommendation-inbox/s1-ui.cjs` | PASS: regresiones visuales de componentes S1; expectativa de Organizar actualizada a Inbox habilitada |
| `node docs/testing/personal-collections-recommendation-inbox/s1-verification.cjs` | PASS: regresiones de S1/portabilidad; fixtures de Inbox ahora tienen captura válida y se comprueba su exportación S2 |
| `node docs/testing/anime-catalog-manual-entries/b3-ui-verification.cjs` | PASS: búsqueda/detalle, carreras/respuestas obsoletas/abortos/gates y guardado normal |
| `node docs/testing/enriched-media-metadata/section-7-ui.cjs` | PASS: Biblioteca/Tags/Buscar, preferencias sensibles y contenido oculto sin arte/HTTP |
| `node docs/testing/provider-abstraction/section-3-buscar-verification.cjs` | PASS tras pulido: el primer intento de S2 fallaba porque la expresión regular esperaba keyExtractor literal anterior; HEAD S1 ya usa gridItemKey. Se comprobó la misma falta de coincidencia leyendo `git show HEAD:app/(tabs)/buscar.tsx`. Se actualizó exclusivamente esa comprobación: ejecuta el extractor vigente y verifica identidad completa, separación de proveedor/namespace/ID y ausencia de colisiones/delimitadores de FlatList. Las demás aserciones se conservan; el script completo pasa |

Todas las DBs usadas fueron archivos temporales TEST creados con node:sqlite, foreign_keys activos y foreign_key_check limpio. Los harness rechazan acceso a DB personal; fetch externo está bloqueado. No se consultaron proveedores productivos ni bibliotecas personales. Las ramas simuladas Android son pruebas de componentes, no Android físico.

El intento directo de exportar a `dist/s2-final` compiló el bundle pero falló al escribir una carpeta con EPERM. Se repitió la exportación a una carpeta temporal del workspace, como en el primer build correcto, y se trasladaron sus artefactos al directorio ignorado.

Avisos no bloqueantes del build: base Browserslist antigua y NO_COLOR/FORCE_COLOR. Sin actualización de dependencias. Ningún valor de credencial se incorpora a este informe.

## Estado de tareas y límites

- 2.1–2.4 completas técnicamente. Progreso global: 8/15; 1.5 sigue sin marcar y 2.5 queda abierta para checkpoint manual independiente. S3 intacta.
- No se realizó aceptación visual/manual en navegador Web ni Android físico, lectores de pantalla, teclado/safe areas Android o consultas remotas productivas. Los harness no prueban layout píxel a píxel, CORS real, apertura del teclado ni persistencia del runtime expo-sqlite de cada plataforma.
- Revisar visualmente contraste, textos extensos y foco en los dispositivos objetivo antes de aceptar 2.5. Los gates mantienen las restricciones vigentes; Web no ofrece MangaUpdates productivo y Kitsu conserva su elegibilidad de build/plataforma.
- Merge aditivo sin tombstones: ausencia no borra y una copia anterior puede recuperar registros borrados. Original incompatible mantiene registro local y requiere revisión del informe. Los relojes entre dispositivos mantienen el contrato actualizado mayor/igualdad local.

## Recorrido manual pendiente para Web y Android

Usar instalación/origen y biblioteca TEST separados, nunca la biblioteca personal. Repetir en ambas plataformas; las fuentes disponibles pueden diferir legítimamente.

1. Biblioteca → Organizar → Bandeja. Confirmar acceso a Colecciones intacto y cinco pestañas. Crear offline por nombre, URL genérica y referencia reconocida; comprobar que Biblioteca no crece ni hay solicitudes al pegar/editar/abrir. Guardar dos recomendaciones de personas distintas para la misma referencia.
2. Editar contexto; consultar captura original. Descartar/reabrir y recorrer los tres filtros/contadores. Cancelar sin perder datos confirmados; provocar un error y reintentar con el borrador.
3. «Buscar en mi biblioteca»: confirmar homónimos manualmente, probar candidato único/cero resultados. Vincular un título TEST con rating/notas/tags/pins; comparar todos sus personales y metadata. Vincular varias recomendaciones a ese título.
4. «Buscar en catálogo»: escribir sin enviar, comprobar cero consultas; enviar en fuente elegible. Probar TMDB sin credencial, gate restringido y red fallida. Abrir resultado, incorporar y regresar al registro. Repetir acción sin duplicar título. Probar alta manual y confirmación de un candidato existente.
5. Borrar el título TEST y comprobar que todas sus recomendaciones vuelven a Pendiente con contexto. Reiniciar offline. Exportar v9 e importar en otro destino TEST vacío; revisar Colecciones/miembros/Inbox/vínculos y reimportar sin duplicados. Importar una copia S1 sin Inbox y confirmar conservación local.
6. Revisar 320–400 px, escritorio, fuente ampliada, textos largos, portadas ausentes, sensibles ocultos, claro/oscuro/paletas, foco/teclado/lector y teclado/safe areas Android. Registrar observaciones y aceptación explícita antes de marcar 2.5.

## Inventario completo del diff acumulado S2

El inventario siguiente compara el worktree con el checkpoint S1 e incluye archivos nuevos, sin staging. Los artefactos generados bajo dist están ignorados y no forman parte del diff.

Total: 17 modificados y 13 nuevos (30 archivos, incluido el pulido posterior).

| Estado | Archivo |
| --- | --- |
| Modificado | `app/(tabs)/ajustes.tsx` |
| Modificado | `app/(tabs)/buscar.tsx` |
| Modificado | `app/kitsu/anime/[id].tsx` |
| Modificado | `app/mangaupdates/series/[id].tsx` |
| Modificado | `app/manual-entry.tsx` |
| Modificado | `app/organize/index.tsx` |
| Nuevo | `app/organize/recommendations/[id].tsx` |
| Nuevo | `app/organize/recommendations/catalog.tsx` |
| Nuevo | `app/organize/recommendations/index.tsx` |
| Modificado | `app/tmdb/[type]/[id].tsx` |
| Modificado | `docs/testing/personal-collections-recommendation-inbox/s1-ui.cjs` |
| Modificado | `docs/testing/personal-collections-recommendation-inbox/s1-verification.cjs` |
| Nuevo | `docs/testing/personal-collections-recommendation-inbox/s2-ui.cjs` |
| Nuevo | `docs/testing/personal-collections-recommendation-inbox/s2-validation.md` |
| Nuevo | `docs/testing/personal-collections-recommendation-inbox/s2-verification.cjs` |
| Modificado | `docs/testing/provider-abstraction/section-3-buscar-verification.cjs` |
| Modificado | `openspec/changes/add-personal-collections-and-recommendation-inbox/design.md` |
| Modificado | `openspec/changes/add-personal-collections-and-recommendation-inbox/tasks.md` |
| Modificado | `src/components/ManualEntryForm.tsx` |
| Nuevo | `src/components/organization/RecommendationForm.tsx` |
| Nuevo | `src/components/organization/useRecommendationInbox.ts` |
| Modificado | `src/core/libraryBackupV9.ts` |
| Nuevo | `src/core/recommendationInbox.ts` |
| Nuevo | `src/core/recommendationResolution.ts` |
| Modificado | `src/providers/kitsu/AnimeDetail.tsx` |
| Modificado | `src/storage/libraryBackupExport.ts` |
| Modificado | `src/storage/organizationBackupImport.ts` |
| Nuevo | `src/storage/recommendationInboxRepo.ts` |
| Nuevo | `src/storage/recommendationIncorporation.ts` |
| Nuevo | `src/storage/recommendationSnapshot.ts` |

## Pulido funcional posterior de S2

Se preservó el diff previo, rama y HEAD, con índice vacío. Solo cambian en este pulido `recommendationResolution.ts`, `RecommendationForm.tsx`, `s2-ui.cjs`, la aserción histórica de `section-3-buscar-verification.cjs` y este informe. SQLite, backup, Colecciones, proveedores, gates y tareas OpenSpec no se modificaron.

La comparación de sugerencias Inbox conserva la búsqueda previa y suma una variante sin puntuación, símbolos ni espacios, usando el plegado existente de mayúsculas y tildes latinas. Busca por fragmentos en nombre/aliases/tags sin cambiar referencias canónicas ni ordenamiento. Spiderman, Spider-Man, Spider Man, spíder.man y Spider—Man proponen los mismos registros; Spider-Woman sigue siendo otra obra. La referencia fuerte conserva precedencia. La normalización solo amplía candidatos y nunca identifica ni vincula automáticamente.

El campo persistido origin mantiene su contrato. Solo su etiqueta pasa a «Dónde te lo recomendaron (opcional)», con placeholder «WhatsApp, Discord, YouTube…». Persona conserva su significado y guardado independiente. OrganizationInput mantiene etiqueta flexible sin truncamiento y los mismos controles, tokens y ancho adaptable.

Pruebas ampliadas: equivalencias de puntuación/tildes/caso, fragmentos, obras similares distintas, aliases, precedencia canónica, visibilidad sensible y pantalla real con Spiderman: tres sugerencias separadas, cero escrituras antes de confirmar Vincular. El formulario verifica placeholder y persistencia de origin/person por separado; continúa la cobertura de captura, errores, catálogo y retorno manual/remoto, y propiedades de layout estrecho/fuente ampliada en el harness. La comprobación histórica estaba obsoleta, no reveló regresión de identidad: ahora ejecuta la expresión real de keyExtractor con gridItemKey.

Validación del pulido: TypeScript, OpenSpec estricto, git diff --check (incluidos nuevos sin staging), s2-ui.cjs y section-3-buscar-verification.cjs. No se repitieron migraciones ni backups, que permanecen intactos. Sin nueva aceptación visual Web/Android físico: 1.5 y 2.5 siguen abiertas. El emparejamiento por fragmentos puede proponer más de una obra; la confirmación manual es deliberadamente obligatoria. No se avanzó a S3.
