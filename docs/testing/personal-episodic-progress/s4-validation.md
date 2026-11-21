# S4 — Informe final de implementación y aceptación

Fecha: 2026-11-21, America/Buenos_Aires. Alcance: add-personal-episodic-progress-foundation. Sin integración en main ni archive.

## Estado verificado y tareas

Rama inicial/final: feat/personal-episodic-progress-foundation. HEAD inicial/final: 54840faddd0edcf1226659185ff96aebecd7c044. Árbol e índice inicialmente limpios. git ls-remote confirmó ese HEAD publicado en origin; su historial contiene S2 9bf0eb2 y S1 62e6c0f. El primer intento de red aislada falló; el reintento de solo lectura autorizado pasó. No fetch ni Git de escritura.

Se revisaron proposal/design/tasks/deltas e informes y resultados S1–S3. OpenSpec spec-driven ready: 21/29 al inicio. Quedan verificadas 4.1, 4.3 y 4.4: 24/29. 4.2 permanece pendiente por aceptación de plataformas/accesibilidad incompleta; 4.5 permanece pendiente por revisión externa/checkpoint final. El usuario informó revisión externa y checkpoints manuales de S1–S3. Esa aceptación informada se distingue de la ejecución local: sus marcas 1.9/2.6/3.9 continúan pendientes en tasks.md y no se reescriben retroactivamente.

No modificaciones ajenas iniciales. No se abrió la biblioteca personal. No cambios en SQLite, parsers de backup, repositorios, gates, proveedores, dependencias, navegación ni política de conflictos. El único ajuste de producto S4 es la presentación de fechas en el panel de conflictos, con un helper puro.

## Matriz de versiones y garantías

| Contrato | Evidencia ejecutada |
| --- | --- |
| SQLite nuevo → v9 | S1 y suite de identidad: instalación, estructuras, FK e índices |
| SQLite histórico → v9 | v3/v4/v6 y v8; valores originales, migración repetida y reapertura |
| SQLite v8 → v9 | Tabla independiente vacía; sin backfill desde estados; preservación de tablas previas |
| SQLite futuro | Rechazo sin writes; test dinámico con versión vigente + 1 |
| Fallo de migración/commit | Rollback total, versión previa y datos intactos; sin señal prematura |
| Backup v1–v9 | Parsers históricos intactos; merge histórico, pins, identidad y campos ausentes |
| Backup v10 | Obligatorio progress aun vacío, cuatro variantes/reset, validación y remap |
| Backup v10 sin progress | Rechazo global; no equivale a una lista vacía |
| Backup histórico con progress inyectado | Sin autoridad para modificar progreso local |
| Export actual | JSON v10 completo, sin credenciales/binarios, todos los títulos incluso sensibles ocultos |

Las pruebas comparan valores personales, relojes y relaciones y ejecutan foreign_key_check/integrity donde corresponde; no se limitan a conteos. Borrado del título elimina progreso por cascade, conserva las garantías de membresías e Inbox y no recrea el título desde una intención tardía. Lecturas por lote y snapshots coherentes siguen cubiertos por S1/S2.

## Progreso, concurrencia y frontera avanzada

S1/S2 prueban las cuatro variantes, cero/ausencia/reset, límites, coma/punto, seis decimales exactos, exponentes y formas inválidas, Unicode/controles/longitud, incremento inequívoco, temporada constante, retrocesos, doble envío, errores recuperables, versión obsoleta y decisiones atómicas de reclasificación manual. Se conservan estado, rating, notas, etiquetas, metadata y reloj histórico del título.

s4-boundaries comprueba específicamente que episodio 24 crea una sola posición, sin lista 1–24 ni eventos de consumo; reset mantiene una fila fechada sin ciclo/historial. Cambiar episodeCount editorial de 12 a 48 no mueve la posición manual. No cambian tablas/índices durante estas operaciones; columnas de progreso exactamente saved_title_id, shape_version, mode, season, episode, chapter, label y updated_at. Ninguna identifica unidades editoriales. No se calculan porcentajes ni se crean volúmenes, temporadas editoriales, rewatch, relectura o tablas futuras.

## Portabilidad, conflictos y round trip

La suite S3 se volvió a ejecutar completa: base A → v10 → base B vacía → reexport semántico equivalente; tres reimports sin duplicados ni cambios SQLite y reapertura del archivo TEST. Fixtures con series/anime/manga, cuatro variantes, reset, ausencia, manual portable/legacy, múltiples proveedores, estado/rating/notas/tags, pins, metadata, preferencias/apariencia, actividad, colección vacía/poblada y recomendaciones pending/incorporated/discarded.

S4 añade un título Kitsu marcado sensible, preferencia hideSensitive activa y episodio manual 24; exporta el título y su progreso aunque se oculte en presentación. Lo restaura en otra base, reimporta tres veces y compara exactamente personales, metadata, progreso y preferencias. No se usan backups personales reales.

| Conflicto | Resultado verificado |
| --- | --- |
| Sin progreso local | Importa activo/reset válido |
| Misma posición con cualquier reloj | Preserva registro local exacto |
| Diferencia, retroceso o número mayor | Conserva local y genera informe |
| Reset local/posición entrante y viceversa | Conflicto; ninguna resurrección automática |
| Reloj anterior, igual o posterior | No elige ganador por fecha |
| ID ocupado sin equivalencia | Nunca enlaza al ocupante casual |
| Múltiples candidatos tras remap | Exactos se unifican; contradictorios se omiten |
| Aplicación explícita | Nueva transacción y reloj propio mayor; no repite import global |
| Progreso/clasificación/identidad cambiados o título eliminado | Rechaza candidato obsoleto sin sobrescribir ni recrear |
| Informe abandonado/cerrado | No aplica pendientes; informe temporal exportable completo |

Fallos inyectados reejecutados: lectura de exportación, parser/JSON/envoltorio, resolución de identidades, insert de título, write de progreso, commit global después de writes mixtos, commit de resolución y observer que lanza. Se verifica aislamiento por registro, rollback global, reintento, publicación poscommit y ausencia de modificaciones incidentales. Ajustes real en hook-host verifica apariencia diferida solo poscommit, descarte ante rollback, cancelación y limpieza de informe al perder foco.

## Dos fallos históricos y otros harnesses obsoletos

s4-historical reproduce ambos fallos sobre fuentes y pruebas de d724f1a, anterior al change, mediante git show en memoria. Guarda solo nombre relativo, aserción y resultado, sin stack/rutas privadas. Reproducidos antes de editar pruebas y sobre el baseline histórico.

1. section-2-storage esperaba una fila de actividad del instante 100 ms. El contrato vigente retiene 90 días/2000 eventos y la elimina correctamente frente al reloj real. La prueba ahora fija/restaura Date.now en 1000 y además verifica que una fila permanece justo a los 90 días y desaparece un milisegundo después. No cambia producción ni se elimina la aserción de actividad.
2. section-2-integration-verification de rating esperaba personalRatingPresentation, composedAccessibilityLabel, ratingBadge y el antiguo rendering inline de imagen. El contrato actual mantiene un único Pressable accesible y delega imagen/error a MediaPoster → DetailPoster. Se actualizaron nombres/propiedad del layout y se verifican explícitamente etiqueta compuesta, rating, pin, título de dos líneas, capa decorativa oculta, error/placeholder y collage. Permanecen los checks de que Buscar/collage no exhiben rating. No se cambió producto para satisfacer regex viejas.

La ampliación de regresión expuso tres harnesses adicionales desactualizados: dos suites de identidad fijaban schema 6 (y trataban 7 como futuro), y el harness de Ajustes de organización carecía de mocks de useFocusEffect/Review y esperaba export v9. Se actualizaron a SQLite v9, versión futura real y export público v10, manteniendo comparación íntegra de la representación histórica v9. Un fixture SQL crudo ahora inicializa el baseline requerido desde v7 antes de reabrir; la prueba de refresh comprueba el reloj personal conservado, conforme al contrato v8 ya vigente. Sin cambios de esquema, repositorios o política editorial. Todos estos tests pasan en la regresión final.

Los runners históricos S1–S3 que clasificaban exit 1 esperado ya no son el runner vigente después de corregir esas pruebas. Se conservan como evidencia de sus checkpoints; S4 exige exit 0 en todas sus suites, sin silenciar los fallos.

## Diagnóstico del build/asset Web

Comando original informado en S3: npx expo export --platform web --output-dir dist/s3-web. Su excepción completa original no estaba preservada en S3: no se puede afirmar retrospectivamente el archivo exacto de aquel intento.

S4 reprodujo el mismo comando y capturó un fallo equivalente: EPERM, operation not permitted, mkdir en dist/s3-web/_expo/static. El bundling y el inventario de assets/bundles se habían completado; la excepción proviene de persistMetroFilesAsync/saveAssets de Expo, durante mkdir de ese directorio (no de un JSON de backup ni de SQLite). No se identificó un archivo de asset individual fallido: el recurso afectado fue el directorio de salida.

El intento inmediatamente siguiente con el mismo comando/ruta pasó, y npx expo export --platform web --output-dir dist/s4-web también pasó. s4-build-results.json conserva los tres resultados, incluido el exit 1 observado; por eso el script diagnóstico devuelve 1 si alguna repetición falló, aunque la salida final esté verificada. Clasificación: fallo transitorio de escritura/permisos del entorno Windows al persistir assets. Se desconoce el agente concreto del bloqueo; no se atribuye sin evidencia a antivirus, watchers o concurrencia de Expo. No es un defecto de exportación de datos personales. No se aplicaron cambios especulativos de permisos, dependencias o limpieza de directorios.

## Validación final ejecutada

| Comprobación | Resultado real |
| --- | --- |
| s4-regressions.cjs | PASS, 33 suites, todos exit 0 |
| s4-historical.cjs | PASS, dos fallos previos reproducidos desde d724f1a |
| s4-boundaries.cjs | PASS, fechas/entrada inválida/Intl, incertidumbre y contenido sensible |
| npx tsc --noEmit | PASS |
| npx expo export --platform web --output-dir dist/s4-web | PASS |
| openspec validate add-personal-episodic-progress-foundation --strict | PASS |
| diff --check, incluidos textos nuevos contra /dev/null | Sin errores de whitespace |

El runner incluye migraciones S1, UI S2, portabilidad/revisión/Ajustes S3, nuevas fronteras S4, identidad universal, manuales/proveedores, metadata/backups/feed/actividad/cinco pestañas, búsqueda/carreras/gates, rating, picker y Colecciones/Inbox/persistencia/rollback. No ejecuta sondas live. No se modificaron proveedores, gates, repositorio S1, schema o dependencias.

La primera pasada ampliada falló en los tres harnesses obsoletos descritos; la pasada final completa pasó. Las correcciones no quitan aserciones ni convierten errores en éxitos esperados. Evidencia heredada redirigida a archivos s4-inherited-*; informes publicados anteriores no sobrescritos.

## Aceptación Web realizada y excepciones

Solo modo EXPO_PUBLIC_MEDIA_REVIEW=1, bases media-review-primary.db y media-review-restore.db. ReviewRoot evita montar la biblioteca personal. Servidor de revisión detenido al finalizar. Capturas reales sin datos privados:

- s4-web-dates.jpg: escritorio oscuro, posiciones y fechas/hora locales legibles.
- s4-web-320-light.jpg: revisión a 320 px en claro, texto envuelto y acciones accesibles.
- s4-web-unicode-320.jpg: especial de 120 puntos de código Unicode, oscuro, multilínea y scroll.

Se ejecutó import/export v10 TEST, conservación local frente a candidato, Cancelar por Enter con foco inicial, aplicación confirmada y reexportación. Tras cerrar informe, Biblioteca restaurada anunció posición; ficha incrementó T3/E10 a T3/E11, corrigió a temporada 0/episodio 4 sin cambio de Planeado/rating, conservó borrador ante Escape, mostró confirmación de reset y canceló sin borrar. Recarga y reapertura mostraron T0/E04 persistido. Se confirmó cambio explícito a especial y se guardaron 120 puntos de código Unicode, sin truncamiento ni incremento ambiguo.

La fuente sintética se desconectó antes de una recarga; su flag en memoria se restablece al recargar. Por ello se acredita persistencia SQLite/reapertura, no arranque real del bundle con el navegador sin red. Las suites SQLite sí bloquean red durante reapertura. Doble envío y errores de escritura se verificaron en harnesses controlados, no se afirma doble clic físico adicional en S4.

No se ejecutó medición visual real de fuente al 200 % ni lector de pantalla físico. Los harnesses comprueban composición con fontScale 1/2; no equivalen a aceptación física. Colecciones y Mosaico tienen regresión de componentes/snapshots, sin navegación a bases personales. No se amplían esas afirmaciones a aceptación manual de todas las superficies.

Android: no hay adb/emulator en PATH ni procesos Android detectados. No aceptación física/emulada, migración en dispositivo, TalkBack, compartir nativo ni reinicio Android. Los dobles de transporte Android de S3 siguen siendo pruebas automatizadas, no aceptación física. 4.2 permanece pendiente por estas excepciones.

## Riesgos residuales y límites

- No tombstones generales: el merge puede recuperar títulos, colecciones o relaciones borradas desde un backup antiguo; su ausencia no borra local. Reset de progreso es una decisión vacía fechada, no un historial o tombstone universal.
- No downgrade de SQLite v9 ni conversión silenciosa de backup v10 a v9. Conservar copia previa y restaurar en entorno compatible separado si se revierte.
- Informe de conflictos temporal; exportarlo antes de salir si debe conservarse. Los pendientes no se aplican solos.
- El reloj personal no prueba causalidad entre dispositivos ni consumo. No se elige por número o fecha mayor.
- Posición manual no equivale a cobertura, episodios previos, rewatch o lectura completa. No barras con las fuentes reales actuales.
- EPERM intermitente del build queda documentado; salida final verificada. Se desconoce el responsable ambiental exacto.
- Revisión externa, aceptación Android/accesibilidad y cierre administrativo siguen pendientes. No archive ni merge automático.

## Recorrido mínimo pendiente antes de archive

Revisar diff/evidencia S4. En instalación TEST Android, migrar copia sintética v8, probar cuatro variantes, corrección/+1/reset/reapertura sin red, export/import v10 remapeado y conflicto obsoleto, compartir informe y TalkBack. En Web completar zoom/fuente 200 %, lector real, arranque offline del bundle y recorrido manual de Detalle/Mosaico/Colecciones/Inbox. Registrar resultados o excepciones aceptadas explícitamente; solo entonces revisar 4.2/4.5 y las marcas manuales previas que correspondan. No usar biblioteca personal ni backups reales para pruebas destructivas.

## Privacidad e inventario

Nuevos JSON/textos inspeccionados para rutas absolutas y nombres de usuarios: evidencia usa nombres relativos/fixtures y marcadores de raíz. No credenciales, notas privadas, backups personales o binarios ajenos. Los fixtures sensibles son sintéticos. Los checkpoints previos permanecen intactos salvo los harnesses cuya actualización necesaria se justifica arriba.

Inventario acumulado S4 obtenido de Git a continuación. Índice final vacío, HEAD intacto; sin staging, commit, push, merge, sync ni archive.
- README.md
- docs/testing/enriched-media-metadata/section-2-storage.cjs
- docs/testing/personal-collections-recommendation-inbox/s3-settings.cjs
- docs/testing/personal-title-rating/section-2-integration-verification.cjs
- docs/testing/universal-media-identity/section-2-sqlite-v4-verification.cjs
- docs/testing/universal-media-identity/section-3-persistence-verification.cjs
- openspec/changes/add-personal-episodic-progress-foundation/tasks.md
- src/components/progress/ProgressImportReview.tsx
- docs/testing/personal-episodic-progress/s4-boundaries.cjs
- docs/testing/personal-episodic-progress/s4-boundary-results.json
- docs/testing/personal-episodic-progress/s4-build-results.json
- docs/testing/personal-episodic-progress/s4-build.cjs
- docs/testing/personal-episodic-progress/s4-historical-results.json
- docs/testing/personal-episodic-progress/s4-historical.cjs
- docs/testing/personal-episodic-progress/s4-inherited-s1-results.json
- docs/testing/personal-episodic-progress/s4-inherited-s2-results.json
- docs/testing/personal-episodic-progress/s4-inherited-s3-results.json
- docs/testing/personal-episodic-progress/s4-inherited-s3-settings-results.json
- docs/testing/personal-episodic-progress/s4-inherited-s3-ui-results.json
- docs/testing/personal-episodic-progress/s4-inherited-s4-boundary-results.json
- docs/testing/personal-episodic-progress/s4-regression-results.json
- docs/testing/personal-episodic-progress/s4-regressions.cjs
- docs/testing/personal-episodic-progress/s4-validation.md
- docs/testing/personal-episodic-progress/s4-web-320-light.jpg
- docs/testing/personal-episodic-progress/s4-web-dates.jpg
- docs/testing/personal-episodic-progress/s4-web-unicode-320.jpg
- src/core/progressConflictDate.ts
