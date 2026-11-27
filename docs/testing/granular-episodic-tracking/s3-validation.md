# S3 — Interfaz y cobertura granular

Checkpoint S2 publicado: `d9db948bb6936a164be57a6dff079aaff94421e4`. La aprobación externa de S2 cierra 2.5. 2.3 sigue abierta para verificación real de TMDB y 3.6 para revisión externa de S3.

## Ejecución reproducible

- `node docs/testing/granular-episodic-tracking/s1.cjs`, `s2.cjs` y `s3.cjs`. Bases SQLite TEST. S3 compara cobertura con el estado durable, orden y filtros, 4 de 12, fechas inciertas, especiales, guía vencida, alcance vacío y la segunda transacción fallida de una selección de 501 sin revertir la primera.
- `node docs/testing/granular-episodic-tracking/s3-web.cjs`. Chrome headless con perfil temporal, Metro local, dotenv desactivado y red externa deshabilitada en el resolver de nombres. Se monta la interfaz Expo con el mismo componente de la ruta productiva. El modo de revisión abre una base SQLite distinta. Las guías usan transporte inyectado. Las capturas salen a un directorio TEST y se pueden guardar con `S3_EVIDENCE_DIR`. La corrida local usó `.expo/s3-evidence`, ignorado por Git.
- Regresiones pertinentes de progreso manual, límites de backup v10, Colecciones/Inbox e identidad universal. Se deshabilitó únicamente la escritura de los informes históricos de las suites, conservando sus aserciones. Pasaron también las secciones 1–5 de credenciales TMDB, incluida la de transporte.
- TypeScript sin emisión, exportación Web con `EXPO_NO_DOTENV=1`, OpenSpec estricto y whitespace de archivos nuevos y modificados.

## Mediciones

Páginas de 40 unidades. Unidad de medida de Chrome: nodos de unidad presentes al estabilizar la primera vista. El conteo de consultas mide un recorrido completo bajo SQLite de Node 22 y no implica tiempo de render ni rendimiento de un dispositivo físico.

| Unidades | Consultas SQLite en recorrido | Unidades montadas en lista | Unidades montadas en cuadrícula |
|---:|---:|---:|---:|
| 12 | 2 | 12 | 12 |
| 100 | 6 | 40 | 40 |
| 1000 | 50 | 40 | 40 |
| 5000 | 250 | 40 | 40 |

El agregado de marcas de tres títulos empleó una consulta por lote. Biblioteca y Colecciones lo leen dentro de sus snapshots locales. La prueba de 501 decisiones confirmó una primera transacción de 500 y un rechazo de la segunda; el agregado permaneció en 500.

## Evidencia y alcance

Las capturas reales de Chrome representan ficha TEST con la última posición manual, lista, cuadrícula con hueco, selección y rango a 320 px. La guía acreditada se ejercita solo con fixtures. La cobertura editorial exige evidencia vigente y el cruce con identidades y coordenadas durables activas. El resumen general se limita a conteos cuando no existe un alcance editorial acreditado.

Siguen pendientes aceptación física Android y la matriz completa manual de temas, fuentes ampliadas, teclado y lectores de pantalla. No se usó la biblioteca personal ni credenciales reales. Las guías de producción siguen parciales. La distribución queda bloqueada hasta completar la portabilidad y la aceptación.

La última corrida Web pasó. Se observaron E1 y E5 sin celdas intermedias fabricadas, la confirmación de las dos marcas, el filtro Marcadas con dos filas y la vista previa de 1 a 5 con tres altas y dos coincidencias a 320 px. La guía TEST de dos temporadas incluyó T0 en el índice. El filtro Anunciadas mostró T1/E12, la sinopsis permaneció oculta inicialmente y la confirmación del lote quedó deshabilitada hasta autorizar ese episodio. Se guardó con la opción explícita Hoy. La verificación de 501 y la segunda transacción fallida se hizo con SQLite TEST, no con 501 clics en Web.

## Revisión externa de S3 (P1–P5)

- P1: Mosaico muestra el resumen aunque solo haya marcas. Sus etiquetas accesibles distinguen cursor, marcas y clasificación incompatible. Se probaron también los agregados antes y después de desmarcar, y se conservó la lectura por lote en Detalle, Mosaico y Colecciones.
- P2: La ficha presenta hasta tres unidades de la fuente elegida. Se comprobaron lista manual, guía acreditada mediante fixture y guía parcial sin barra. La descarga de índice y temporada requiere acción explícita. La ruta de unidades hereda la fuente y temporada seleccionadas.
- P3: Chrome TEST inyecta demora en la previsualización, cambia desde, hasta, modo y grupo, cancela y abre otro editor. Una respuesta anterior no restaura la confirmación. También se inyecta un fallo de lectura en un grupo y se comprueba que desaparezcan las filas anteriores. Las confirmaciones identifican cada unidad por coordenada, grupo y sufijo de identidad. La proyección visible está vinculada a propietario, fuente, temporada, grupo, filtro y día civil.
- P4: Conservar fechas es el modo inicial. Una marca positiva existente conserva su fecha (o ausencia), timestamp y revisión si no cambia. Una marca nueva o una decisión negativa vuelta a marcar queda sin fecha en ese modo. Hoy, Fecha elegida y Quitar fechas son cambios explícitos. Desmarcar escribe una decisión negativa sin fecha. La prueba mezcla los cuatro estados y compara el cursor manual antes y después.
- P5: El panel destaca las marcas y delimita el alcance de la barra. Los próximos anuncios excluyen retirados. El cambio de día invalida la proyección anterior y solicita únicamente una lectura local. Hay capturas separadas de tema claro y oscuro. La acreditación real de TMDB sigue pendiente.

Comandos de repetición: las suites S1–S3, s2-ui del progreso manual, s4-boundaries del progreso manual, S2 de Colecciones/Inbox, sección 3 de identidad universal y secciones 1–5 de credenciales TMDB. El harness Web es s3-web.cjs, con salida configurada mediante S3_EVIDENCE_DIR. El build usa EXPO_NO_DOTENV=1. Las capturas se mantienen en .expo/s3-evidence, fuera del diff.

Resultado de la revisión: pasaron S1–S3, las regresiones indicadas, las cinco suites TMDB, TypeScript, exportación Web, OpenSpec estricto y whitespace. Chrome TEST completó el recorrido ampliado en claro y oscuro, incluida la salida de un grupo con lectura en curso. La captura acreditada muestra 1 de 11 estrenados (9 %). La corrida de revisión observó 12/12 unidades montadas en lista/cuadrícula para 12, y 16/40 a la apertura para 100, 1000 y 5000. Es un conteo del DOM en esa corrida, no un umbral fijo. Quedan 2.3 y 3.6 pendientes.

## Pulido final P6–P8

- P6. La ficha y la ruta calculan vigencia desde las fechas en memoria del índice y del snapshot. Se agenda la siguiente expiración exacta cuando se acerca y se muestrea únicamente el reloj para detectar retrocesos y cambios de zona. El regreso al primer plano, foco Web y visibilidad vuelven a muestrear de inmediato. Si el día no cambia, ocultar o recuperar la barra por vigencia no relanza la lectura SQLite. Los cambios de día recomponen la proyección local y no consultan al proveedor.
- P7. El valor destacado de una guía acreditada es el cociente de estrenados ordinarios marcados sobre estrenados ordinarios elegibles. Una marca futura, especial, retirada o de otro alcance conserva su decisión y se cuenta fuera de ese denominador. El reloj determinista cubre el instante exacto a siete días, índice anterior al snapshot, retroceso dentro del día y fechas civiles distintas en Buenos Aires y Tokio. La prueba mezcla unidades ordinarias, especiales, futuras y retiradas. La guía parcial u obsoleta muestra conteos sin porcentaje.
- P8. La cuadrícula presenta una sola acción por celda. Seleccionar varias activa un modo explícito, con borde, contraste, estado accesible y texto de selección separados del consumo. La lista agrupa edición y retiro o reactivación en Opciones. Las fechas civiles se muestran como DD/MM/AAAA sin transformación UTC. En la confirmación solo aparece un UUID cuando coordenada y grupo son ambiguos.

Repetición: ejecutar s1.cjs, s2.cjs, s3.cjs y s3-web.cjs. El harness Chrome conserva las carreras P3, el cambio de tema y el rango a 320 px. Simula el regreso tras el vencimiento y comprueba que desaparece la barra y permanecen las unidades; al restaurar el reloj TEST se recupera la métrica. El perfil y SQLite son aislados, con capturas solo en .expo/s3-evidence. Se mantienen los límites de aceptación física y los pendientes 2.3 y 3.6.

Resultado final de P6–P8: S1, S2, S3, regresiones pertinentes de progreso manual, backup v10, Colecciones/Inbox e identidad, cinco suites TMDB, TypeScript, build Web, OpenSpec estricto y whitespace aprobados. Chrome TEST pasó en claro, oscuro y a 320 px. Se activó la selección por teclado con Enter, se comprobó el menú Opciones y se regeneró la captura con contraste corregido. La corrida montó 12/12 unidades iniciales (lista/cuadrícula) con 12 registros y 16/80 con 100, 1000 y 5000. No se ejecutó aceptación física ni se usó la biblioteca personal.
