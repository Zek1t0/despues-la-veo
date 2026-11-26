# S2 — Inventario editorial y manual

Base publicada de S1: 2e3ea6fef3be41e626172a9b0d93de54d3e2a283. La aprobación externa de S1 y su checkpoint publicado permiten cerrar 1.5. La revisión externa y el checkpoint de S2 siguen pendientes en 2.5.

## Contrato y límites de evidencia

La [referencia de serie TMDB](https://developer.themoviedb.org/reference/tv-series-details) y la [referencia de temporada TMDB](https://developer.themoviedb.org/reference/tv-season-details) documentan rutas separadas. Fixtures modelan el índice con id, season_number y episode_count y el alcance de temporada con id, season_number y episodes. Validan IDs y pertenencia, T0, fecha civil y metadata opcional. La concordancia de conteos probada con fixtures no demuestra su significado en el despliegue. La política 429 la aplica el cliente existente.

No hubo consultas autenticadas reales: este entorno no contó con una credencial TMDB autorizada y aislada para TEST ni con runtime Android disponible. Quedan pendientes payloads reales, significado/alcance del contador, T0 real, CORS Web y Android. El build Web solo acredita exportación estática. La tarea 2.3 sigue abierta. Sin validación del contador en runtime, las descargas reales conservan la clasificación parcial y no ejecutan retiro por ausencia. Los fixtures inyectados ejercitan explícitamente las reglas de acreditación.

## SQLite y servicios

SQLite permanece en v10. Las tablas granular_guide_indices y granular_guide_snapshots quedan separadas del descriptor durable y las decisiones. La fuente está delimitada por el servicio TMDB y la clave de propietario, ID de serie, idioma y, para snapshots, número de temporada. El snapshot conserva revisión, fecha, estado, discrepancias, IDs de membresía y metadata de unidades en un único payload. El verificador exacto distingue el esquema final de un v10 intermedio. Un v10 intermedio falla sin reparación automática. Para fixtures se parte de v9 o se crea una base nueva.

Cada acción de temporada realiza una consulta de alcance y como máximo una adicional de índice. La acción explícita de índice puede reutilizar su caché. El mismo alcance en curso se comparte y una acción distinta para el mismo dueño se rechaza mientras la primera está activa. La referencia y clasificación del propietario y la generación en memoria se verifican antes de confirmar. La descarga no se inicia por lectura de la caché. La transacción conserva decisiones y revierte altas, retiros y caché en conjunto ante fallo.

El servicio manual reutiliza las operaciones individuales S1. La vista previa y confirmación de rango validan modo, grupo, máximo de 200 enteros, clasificación y revisión. Las coincidencias manuales se informan con identidad y retiro. La omisión debe ser explícita. Las nuevas unidades quedan sin decisiones y las retiradas no se reactivan.

## Ejecuciones

| Verificación | Resultado |
|---|---|
| `node docs/testing/granular-episodic-tracking/s2.cjs` | PASS. SQLite aislada y transporte inyectado. Presupuesto y deduplicación, T0 y opcionales, IDs y coordenadas inválidos, paginación parcial, 429, 404 y cancelación. |
| Misma suite | PASS. Refresco equivalente, renumeración y mudanza de identidad, referencia obsoleta, colisión, retiro acreditado, rollback, vencimiento exacto y reloj anterior a la consulta, marcado local tras vencimiento. Se comprueban filas históricas completas. |
| Misma suite | PASS. 200 altas sin marcas, rechazo de 201, solapamientos, coincidencia retirada, vista previa obsoleta y rollback tras colisión de UUID dentro del rango. Rechazo del esquema v10 intermedio. |
| `node docs/testing/granular-episodic-tracking/s1.cjs` | PASS. Alta nueva, migración v9 a v10 final, reapertura, rollback y persistencia personal S1. |
| Regresiones de progreso manual S1, identidad universal secciones 2 y 3 y mapeo TMDB sección 2 | PASS. Se suprimió la escritura de informes históricos al ejecutar la suite de progreso. |
| Credenciales TMDB secciones 1–5 | PASS en la revisión final. La sección 1 incluye transporte, validador, carreras y ausencia de filtraciones. |
| Credenciales TMDB sección 2 antes de la corrección | FAIL. Reproducido en el árbol S2 y mediante la misma aserción sobre los blobs del checkpoint S1. |
| TypeScript, build Web, OpenSpec estricto y whitespace | PASS. Exportación Web con la carga de dotenv desactivada, en un directorio ignorado. |

La biblioteca personal no se abrió en las pruebas. La distribución sigue bloqueada hasta completar portabilidad y aceptación.

## Revisión final de S2

La sección 2 de credenciales fallaba en `testNoEnvAndNoLibraryCoupling`, línea 206, al exigir que el contenido de cada archivo no incluyera el identificador de la variable retirada. Se ejecutó la suite sobre el árbol S2 y se reprodujo la aserción del escaneo con los blobs de S1 enumerados por `git ls-tree` y leídos por `git show`. La primera coincidencia de ambos fue `enriched-media-metadata/section-5-checks.json`. El análisis de las cinco apariciones encontró cuatro nombres de variable en líneas del log de Expo y una mención documental. Ninguna aparición asignaba o mostraba un valor de credencial. Se sustituyó el nombre por un marcador neutro en esos tres documentos. Se mantuvo intacto el escaneo de seguridad.

La nueva ejecución de S1 y S2 validó otra vez el esquema v10 final y los casos de integridad descritos arriba. No se cambió la implementación de inventario en esta revisión. Se verificó disponibilidad de ADB en PATH y en las ubicaciones estándar del SDK, y la presencia de una configuración específica de credenciales TEST sin leer valores personales. No se encontró ADB ni una credencial TEST autorizada. Las comprobaciones contra endpoints desplegados, episodio y temporada cero reales, alcance del contador, CORS y Android siguen sin ejecutar. La tarea 2.3 permanece abierta y el runtime conserva guías parciales.

Para repetir credenciales y transporte, ejecutar `node docs/testing/tmdb-user-credential/section-N-verification.cjs` para N de 1 a 5. El barrido histórico se ejecuta con `docs/testing/personal-episodic-progress/s4-regressions.cjs`. En esta revisión se interceptó únicamente la escritura de informes terminados en `-results.json`, tanto en el runner como en sus procesos hijos, para preservar la evidencia archivada.

Resultado final: 33 de 33 suites históricas, S1, S2, cinco suites de credenciales (incluido transporte), TypeScript, build Web, OpenSpec estricto y whitespace aprobados.

## Hallazgos finales P1 y P2

- P1. Una guía descargada sin habilitar el contrato de acreditación permanece parcial. Tras un 429, una respuesta del mismo grupo que conserva las coordenadas previas incorpora la unidad nueva en el primer intento. La suite comprueba la actualización de la fecha, las decisiones positiva y negativa intactas y la conservación exacta del snapshot y su fecha frente a coordenadas duplicadas.
- P2. Una incorporación invalida la acreditación del mismo alcance en otro idioma. Una mudanza invalida los snapshots que contenían la unidad y los del alcance de destino. Un retiro invalida los snapshots afectados. La traducción de etiquetas sin cambio estructural conserva el estado acreditado. Las pruebas en español e inglés verifican estado persistido, disponibilidad de la caché obsoleta y rollback conjunto de snapshots y unidades sin invalidación publicada.
- La planificación previa de una respuesta parcial rechaza reinterpretaciones y colisiones de coordenadas con unidades activas. También se rechaza reutilizar un UUID para dos episodios de la misma respuesta.
- La suite S2 ejecuta estos casos con transporte inyectado y SQLite TEST. 2.3 y 2.5 permanecen pendientes.

Validación de P1/P2: S1, S2, regresiones de progreso manual, migración e identidad, mapeo TMDB, credenciales 1–5, TypeScript, OpenSpec estricto y whitespace pasaron. El build Web compiló en el sandbox, pero Expo recibió EPERM al persistir assets en dos intentos. La exportación completa pasó con dotenv desactivado en una ejecución autorizada fuera del sandbox.
