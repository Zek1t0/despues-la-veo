# S5 — Regresión integral y aceptación

## Preflight y estado

`feat/granular-episodic-tracking`, HEAD `01e46ea84e568b2402a29d96d7d5f090569c3564` confirmado mediante consulta de solo lectura a origin. El árbol y el índice estaban limpios. Se revisaron los artefactos OpenSpec, los resultados S1–S4 y las excepciones del cierre de la fundación. Continúan vigentes SQLite v10 y exportación v11.

La aprobación externa y publicación de S4 cierran 4.5. La regresión integral cierra 5.1. Quedan 2.3, 5.2 y 5.3 pendientes, para un total de 21/24. La revisión de este diff y el checkpoint manual siguen pendientes.

## Matriz y trazabilidad

| Suites | Resultado y cobertura |
| --- | --- |
| S1 | Pasó. SQLite nuevo, histórico y v9, rollback de migración, reapertura, FK, índices y cascadas. Identidad portable, orden decimal, aislamiento por propietario y datos personales, tres estados de decisión, fechas civiles, retroceso de reloj, reintentos y transacciones de 500. |
| S2 | Pasó. Esquema v10 final y rechazo del v10 intermedio. T0, parciales, renumeración, mudanza, retiro, cancelación, 429, presupuesto, recuperación, idiomas, offline e invalidación transaccional. Altas, rangos de 200, rechazo de 201, coincidencias, preview obsoleta y rollback. |
| S3 | Pasó. Cursor independiente, resúmenes sin cursor, lecturas agrupadas, alcance de cobertura, vencimiento, fecha y zona civil, concurrencia de vistas, preservación de fechas y particiones independientes. |
| S4 | Pasó. Round trip A→B→reexportación con tres reimportaciones y reapertura. v1–v10 conservan contratos y descartan campos granulares artificiales. v11 exige bloque granular, incluye desmarcados, resuelve dependencias por identidad y conserva local ante conflictos. Se repitieron fallos parciales/globales, candidatos obsoletos, T2 sobre índice T1 y 15 unidades parciales sobre snapshot de 12. |
| Regresiones históricas | Pasaron 33/33. Backup, progreso manual, identidad universal, Biblioteca, Colecciones, Inbox, entradas manuales, metadata, rating y proveedores. Se suprimió exclusivamente la escritura de los JSON de resultados históricos en el runner y sus hijos. |
| TMDB | Pasaron 5/5 suites de credenciales, transporte, Ajustes, límites y atribución. Las pruebas usan fixtures y controles de filtración. |

La matriz cubre los requisitos de identidad y decisión de seguimiento granular, guías y alta manual del inventario editorial, portabilidad y resolución del backup y separación de la posición manual. Los cambios S5 son de evidencia y harness. Las aserciones históricas se conservaron.

## Reproducción

- Ejecutar `node docs/testing/granular-episodic-tracking/sN.cjs` para N de 1 a 4.
- Ejecutar `node docs/testing/personal-episodic-progress/s4-regressions.cjs` y `node docs/testing/tmdb-user-credential/section-N-verification.cjs` para N de 1 a 5. El runner histórico normalmente escribe sus informes.
- Ejecutar `s3-web.cjs` y `s4-web.cjs` del directorio granular con `S5_ACCEPTANCE=1`, puertos Metro separados y `S3_EVIDENCE_DIR` / `S4_EVIDENCE_DIR` en `.expo/s5-evidence`. Los scripts abren perfiles Chrome nuevos y fixtures SQLite TEST aislados. Metro usa modo offline y desactiva dotenv.
- Ejecutar `node node_modules/typescript/bin/tsc --noEmit`, `node node_modules/expo/bin/cli export --platform web --output-dir .expo/granular-s5-final-review` con `EXPO_NO_DOTENV=1` y `openspec validate add-granular-episodic-tracking --strict`.
- Verificar whitespace con `git diff --check HEAD` y una lectura directa de cada archivo nuevo, e índice con `git diff --cached --exit-code`.

## Aceptación y límites

Chrome TEST recorrió escritorio y 320 px, claro y oscuro, foco y activación con Enter, edición por rango, huecos, selección compartida, menú de unidad, fecha opcional y futuro con confirmación explícita. Se comprobó el vencimiento con reloj TEST y evento de regreso de foco, la separación de marcas fuera del denominador y la ocultación inicial de sinopsis. Las pruebas de agregados ejercitan Biblioteca y Colecciones por lote.

**Resultado anterior a la corrección de Escape.** En Ajustes, al abrir la confirmación de un conflicto granular, el foco llegó a Cancelar. Escape dejó la confirmación abierta y no aplicó el candidato. La cancelación explícita siguió disponible. Este resultado corresponde a la ejecución inicial de S5. La corrección y su nueva verificación constan a continuación.

### Revisión externa de accesibilidad

- `GranularImportReview` lleva el foco a la acción de cancelación al abrir y lo devuelve al botón que inició la confirmación al cancelar. Ambos flujos, aplicación y descarte del informe, usan la misma cancelación para Escape y para el botón explícito. El listener Web se registra únicamente mientras hay una confirmación. Un bloqueo síncrono protege una aplicación en curso. La resolución efectiva sigue llamando al mismo servicio de revalidación y escritura.
- Chrome TEST verifica la desaparición de ambas confirmaciones, la restauración del foco, la conservación del informe y del número de conflictos pendientes, y una aplicación retenida por el fixture. Durante esa aplicación, Escape deja abierta la confirmación, Cancelar queda deshabilitado y, tras liberar el fixture, el servicio real completa la escritura.
- La evidencia anterior se conserva. El solapamiento visible de la captura original se reprodujo al duplicar solo `font-size` en textos con `line-height` explícito. Al escalar ambos valores a 200 %, las capturas mostraron líneas separadas. La ficha, la ruta y el informe usan contenedores flexibles y controles con altura mínima. Las alturas fijas revisadas pertenecen a la barra y a la imagen, que carecen de texto interno. No se alteraron los estilos de producción por el artefacto de la simulación.
- Las nuevas capturas están en `.expo/s5-evidence/a11y`: ficha, ruta e informe en 1100 y 320 px, al tamaño normal y duplicado, más el panel de cobertura ampliado. La simulación solo cambia las métricas tipográficas y conserva el wrapping, las alturas y el layout de producción. Sigue pendiente el ajuste físico de fuente al 200 %.
- El ensayo de arranque en frío con Metro sigue reproduciendo `ERR_INTERNET_DISCONNECTED`. El harness también acepta una navegación exitosa si se monta la ruta y se reabre SQLite. La aceptación de un bundle instalado queda pendiente por falta de runtime apropiado.
- La revisión repitió S1–S4, la regresión de accesibilidad Web de S5, TypeScript, el build Web, OpenSpec estricto y whitespace. Permanecen abiertas 2.3, 5.2 y 5.3.

Chrome TEST repitió el flujo v11, la aplicación y conservación explícitas, el informe exportable y los filtros de lista/cuadrícula. Con la pestaña cargada y la red desactivada, T2 siguió navegable y T1 mostró 15 unidades conocidas sin porcentaje. Tras habilitar la red local y navegar nuevamente, el fixture reabrió SQLite B sin repoblarla y conservó las 15. El arranque en frío del sitio TEST con caché HTTP deshabilitada y red desactivada se bloqueó en Chromium con `ERR_INTERNET_DISCONNECTED`. Este ensayo se hizo con Metro, y el build estático se verificó por separado.

La captura de reapertura a 320 px duplica el tamaño computado del texto por CDP. Es una simulación de interfaz y deja pendiente la aceptación completa con ajuste real de fuente al 200 %. Android, TalkBack y lectores de pantalla físicos no se ejecutaron. Se mantienen las excepciones de accesibilidad física y arranque offline de la fundación.

Sin credencial TMDB TEST autorizada ni runtime Android detectado. No se ejecutaron solicitudes reales a endpoints desplegados. El alcance real de `episode_count`, T0, completitud, opcionales, fechas, CORS y Android siguen pendientes en 2.3. Las guías de producción conservan parcialidad conforme al contrato.

Una temporada con referencia disputada y sin alcance inequívoco queda fuera del selector. Si el índice identifica un alcance, se conserva ese alcance con aviso y sin incorporar el grupo discrepante. La restauración no reconstruye evidencia editorial y los backups antiguos pueden recrear títulos eliminados porque el proyecto carece de tombstones generales.

Durante el futuro Sync debe actualizarse a v11 la nota introductoria de formato vigente en `library-backup-integrity`. La distribución queda pendiente de aceptación y revisión.

**Cierre administrativo del 27 de noviembre de 2026.** La revisión externa aprobó las correcciones de Escape, foco, escritura en curso y simulación tipográfica. Se verificó en origin el checkpoint S5 `8a3701410ecbf68b7ade5de11c9b1f81909c77a3`, se completó 5.3 y se actualizó la nota de formato vigente en la sincronización. Quedan 2.3 y 5.2 abiertas.

## Rendimiento medido

Chrome TEST usó un viewport de 1100 × 950 para el recorrido a escala, páginas de interfaz de 40 unidades y `FlatList` con 8 filas iniciales, 8 por lote, ventana de 5 viewports y hasta 6 columnas. El barrido SQLite independiente solicita páginas de 20 y cuenta consultas de paginación; la consulta agregada se midió sobre tres títulos.

| Unidades | Consultas de paginación SQLite | Consultas agregadas | Lista a 500 ms | Cuadrícula al alternar | Cuadrícula a 500 ms |
| --- | ---: | ---: | ---: | ---: | ---: |
| 12 | 2 | 1 | 12 | 12 | 12 |
| 100 | 6 | 1 | 16 | 40 | 80 |
| 1.000 | 50 | 1 | 16 | 40 | 80 |
| 5.000 | 250 | 1 | 16 | 40 | 80 |

Se observó 16/40 y 16/80 en la misma corrida, según el momento de muestreo tras alternar. A seis columnas, la primera página de 40 cabe en siete filas. El umbral `onEndReached` de 0,4 puede solicitar la segunda página antes de la muestra de 500 ms. La diferencia coincide con una página adicional de 40, y ambas muestras quedan registradas. Cada escala comprobó filtros y persistencia de selección entre las dos vistas. El JSON de conteos y las capturas están en `.expo/s5-evidence`.

## Inventario completo desde S4

- Modificado · `docs/testing/granular-episodic-tracking/s3-web.cjs`
- Modificado · `docs/testing/granular-episodic-tracking/s4-web.cjs`
- Modificado · `openspec/changes/add-granular-episodic-tracking/tasks.md`
- Modificado · `src/components/granular/GranularImportReview.tsx`
- Modificado · `src/dev/mediaReview/GranularBackupReview.tsx`
- Nuevo · `docs/testing/granular-episodic-tracking/s5-validation.md`
