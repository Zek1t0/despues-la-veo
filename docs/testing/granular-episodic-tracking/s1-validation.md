# S1 — Validación de persistencia granular

Base de revisión: `31941c8c9c0fa6455a563a5449f50bf18b86b703`. Los fixtures usan SQLite de Node 22, archivos temporales aislados y un stub que impide abrir la biblioteca personal. La prueba focal también rechaza llamadas de red.

| Ejecución | Evidencia |
|---|---|
| `node docs/testing/granular-episodic-tracking/s1.cjs` | Alta nueva, migración desde v6 y v9, reapertura, rechazo de v11 SQLite y fallo inyectado tras publicar user_version. Compara catálogo y filas v9 antes y después del rollback. |
| Misma suite | Comprueba FK compuesta, rechazo de borrado de grupo con unidades, cascada de título, referencias incompatibles, renumeración, retiro reversible, capítulos con orden exacto y UUID de desempate y cursor obsoleto de paginación. |
| Misma suite | Simula doble envío y cambio obsoleto, falla la segunda escritura y luego el commit. Comprueba reloj, revisión, ausencia de invalidación tras rollback, una fecha bisiesta y rechazo de fechas inválidas o futuras. |
| Misma suite | T3/E10 se conserva al pasar de cero decisiones a cuatro marcas y después a tres positivas y una negativa. Compara filas completas de tablas anteriores, incluidas las de título, metadata, pines, Colecciones e Inbox. Reabre el archivo y verifica la decisión negativa. |
| Regresiones de la fundación | Tres suites esperaban v9 como destino de migración. Se actualizó el destino a 10 y el fixture de versión futura a 11 en la suite correspondiente. La comparación histórica exige explícitamente que las tablas nuevas estén vacías al migrar sin datos granulares. Las tres suites pasaron al volver a ejecutarse. |

La habilitación granular explícita se guarda en estado propio por título. En literatura permite capítulos o especiales sin habilitar el cursor. La revisión de lista también cambia cuando cambia una decisión, para detectar selecciones o páginas obsoletas. El repositorio admite hasta 500 decisiones por transacción. La identidad externa valida la referencia del título propietario al escribir y se mantiene durable aunque la guía cambie.

La suite automatizada comprueba reapertura de SQLite. La aceptación en Android físico y el arranque offline del bundle siguen pendientes. El build Web comprueba compilación y exportación estática. La distribución sigue bloqueada hasta portabilidad y aceptación.

Comprobaciones finales exitosas: TypeScript sin emisión, exportación Web con EXPO_NO_DOTENV=1 a un directorio ignorado, OpenSpec estricto y las 33 suites del barrido de regresión de la fundación. Se suprimió la generación de informes JSON del runner histórico en la segunda pasada para conservar los informes archivados.

## Revisión externa de S1

La suite focalizada pasó con un reloj local inyectado anterior a una fecha de consumo ya persistida. El reintento equivalente con revisiones antiguas conservó la fila completa y la revisión de lista sin escrituras ni invalidaciones. Se rechazaron una fecha futura para una nueva decisión y un día civil inexistente.

En un título TEST con 501 unidades válidas se confirmó un lote de 500 marcas en una transacción y se repitió sin cambiar las decisiones. La selección de 501 rechazó antes de escribir. Un fallo inyectado en la escritura 250 del desmarcado revirtió el lote completo y conservó revisión e invalidaciones. El desmarcado posterior confirmó 500 decisiones negativas y emitió una sola invalidación después del commit.

Pasaron nuevamente la suite focalizada (`node docs/testing/granular-episodic-tracking/s1.cjs`), las regresiones de progreso manual e identidad SQLite, TypeScript sin emisión, OpenSpec estricto y whitespace del diff acumulado.
