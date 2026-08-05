# Verificación manual: integridad de backups de biblioteca

Esta guía usa únicamente datos sintéticos de `fixtures/`. No importes un backup real ni ejecutes estas pruebas sobre una biblioteca que quieras conservar.

## Estado de verificación

### Ejecución manual web — 2026-08-05

- Plataforma: web.
- Origen aislado: `localhost:8098`.
- Fixtures ejecutados: `00-empty.json` a `10-valid-empty-arrays.json`, en el orden documentado.
- Resultado: los conteos observados coincidieron con la tabla de esta guía.
- Se probaron inserción, actualización, `skipped`, conflicto de tipo, elemento inválido, colisión de ID, resultado parcial, campos opcionales ausentes, `null` explícito permitido y arrays vacíos válidos.
- Se revisaron en web los textos previos, la confirmación y el resultado final en Ajustes.
- `failed` por un fallo SQLite controlado sigue pendiente; todos los fixtures válidos observaron `failed: 0`.
- Android e iOS no fueron verificados.

Ejecutado técnicamente en esta preparación:

- Los 11 fixtures fueron parseados como JSON y se comprobó `version: 1` y la cantidad de elementos.
- `npx.cmd tsc --noEmit` terminó correctamente.
- `git diff --check` terminó correctamente.
- `npm run web -- --port 8098` produjo el bundle web principal (881 módulos) y el worker web de SQLite; se obtuvo HTTP 200 y Metro se detuvo después.
- El diff de paths confirmó que esta sesión no modificó esquema SQLite, dependencias, TMDB ni los tres archivos de producción excluidos.

Pendiente después de la ejecución web:

- No se verificaron los casos específicos de strings obligatorios vacíos, `id` vacío, fechas no finitas o con tipo inválido, ni coincidencias con `updatedAt` igual o ausente.
- No quedó registrada evidencia suficiente para marcar el round-trip completo ni todas las comprobaciones exactas de identidad y fechas de la sección correspondiente.
- No se ejecutaron pruebas en Android o iOS.
- No se forzó un `failed` de persistencia; requiere una prueba automatizada con SQLite desechable e inyección controlada de fallo.

### Ejecución manual web complementaria — 2026-08-05

- Plataforma: web.
- Origen aislado: `localhost:8099`.
- Fixtures ejecutados: `11-invalid-exported-at-null.json` a `26-update-explicit-null.json`.
- Resultado observado: todos los resultados coincidieron con las matrices de esta guía.
- Los fixtures `11` a `15` rechazaron el archivo completo cuando `exportedAt` estaba presente como `null`, número, booleano, objeto o array; no se mostró confirmación ni se modificó la biblioteca. `16-exported-at-absent.json` fue aceptado.
- Strings obligatorios vacíos o compuestos sólo por espacios, `id` vacío o con espacios, fechas negativas y fechas con tipos inválidos fueron rechazados sin escritura.
- En coincidencias del mismo tipo, un `updatedAt` igual o ausente produjo `skipped` y conservó la fila local.
- Las inserciones conservaron exactamente las fechas entrantes válidas y generaron fechas locales coherentes cuando estaban ausentes.
- Las actualizaciones conservaron exactamente `id` y `createdAt` locales y persistieron exactamente el `updatedAt` entrante posterior.
- Los campos opcionales ausentes conservaron sus valores locales.
- `null` explícito borró solamente `year`, `posterUrl`, `overview`, `voteAverage` y `notes`; `genres`, `status` y `tags` se conservaron.
- Un título local ausente del backup permaneció sin cambios.
- El round-trip exportar → importar → exportar conservó todos los campos comparados, incluidos `overview`, `voteAverage` y `genres`.
- Las comparaciones JSON de conflicto de tipo, colisión de ID, campos ausentes e identidad/fechas exactas coincidieron con lo esperado.
- La rama `failed` mediante fallo SQLite controlado no fue ejecutada y sigue pendiente; los fixtures observados terminaron con `failed: 0`.

## Preparar una web aislada

1. Cerrá cualquier servidor Expo de este proyecto.
2. Desde la raíz, iniciá `npm run web -- --port 8099`.
3. Abrí la URL que informa Expo (normalmente `http://localhost:8099`). Usá un perfil de navegador temporal, una ventana privada nueva o un navegador dedicado a pruebas. La base web queda asociada al almacenamiento de ese perfil/origen; el puerto alternativo evita reutilizar el origen habitual.
4. En Biblioteca, confirmá que no haya títulos. Si aparecen datos, no continúes: cerrá esa sesión y usá otro perfil temporal limpio.
5. Anotá navegador, sistema operativo, fecha y puerto en el registro del final.

El puerto alternativo aísla la web por origen, pero no demuestra aislamiento en Android/iOS. En dispositivos, usá una instalación o emulador descartable y nunca la biblioteca real.

## Cómo importar un fixture

1. Abrí Ajustes y elegí **Importar biblioteca**.
2. Seleccioná el JSON indicado dentro de `docs/testing/library-backup-integrity/fixtures/`.
3. Antes de confirmar, verificá los conteos de válidos e inválidos, el aviso de merge sin borrado, la protección por tipo/fecha y la advertencia de resultado parcial.
4. Confirmá la importación.
5. Compará el resumen de Ajustes con la tabla siguiente. Las seis categorías siempre deben verse.
6. Revisá Biblioteca después de cada paso y registrá el resultado.

## Secuencia principal y conteos esperados

Empezá con una base vacía y respetá este orden. Cada fila parte del estado dejado por la anterior.

| Paso | Fixture | Previo: válidos / inválidos | inserted | updated | skipped | conflicts | invalid | failed |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | `00-empty.json` | 0 / 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| 2 | `01-insert-new.json` | 1 / 0 | 1 | 0 | 0 | 0 | 0 | 0 |
| 3 | `02-older-skipped.json` | 1 / 0 | 0 | 0 | 1 | 0 | 0 | 0 |
| 4 | `03-newer-updated.json` | 1 / 0 | 0 | 1 | 0 | 0 | 0 | 0 |
| 5 | `04-type-conflict.json` | 1 / 0 | 0 | 0 | 0 | 1 | 0 | 0 |
| 6 | `05-invalid-field.json` | 0 / 1 | 0 | 0 | 0 | 0 | 1 | 0 |
| 7 | `06-id-collision.json` | 1 / 0 | 1 | 0 | 0 | 0 | 0 | 0 |
| 8 | `07-mixed-partial.json` | 4 / 1 | 1 | 1 | 1 | 1 | 1 | 0 |
| 9 | `08-optional-fields-absent.json` | 1 / 0 | 1 | 0 | 0 | 0 | 0 | 0 |
| 10 | `09-explicit-null.json` | 1 / 0 | 1 | 0 | 0 | 0 | 0 | 0 |
| 11 | `10-valid-empty-arrays.json` | 1 / 0 | 1 | 0 | 0 | 0 | 0 | 0 |

`failed` queda en cero en todos los fixtures: un fallo de persistencia depende de una avería SQLite, no de un dato JSON contractual. No corrompas, bloquees ni modifiques la base para forzarlo; esa comprobación queda pendiente de una prueba automatizada con una base desechable y un fallo inyectado.

## Comprobaciones visuales

- Tras el paso 2, Biblioteca debe mostrar **Película Ficticia Alfa** con sus datos sintéticos.
- El paso 3 no debe cambiar el título ni la sinopsis local.
- Tras el paso 4 debe verse **Película Ficticia Alfa Actualizada**, con sinopsis actualizada, voto `8.5` y género `Actualización sintética`.
- El paso 5 no debe convertirla en serie ni modificarla; Ajustes debe mostrar referencia y motivo del conflicto.
- El paso 6 no debe agregar una tarjeta; Ajustes debe identificar `genres` como inválido.
- El paso 7 debe agregar una serie distinta sin reemplazar Alfa, aunque ambas entradas hayan solicitado el mismo `id`.
- El paso 8 debe describirse como resultado parcial y mostrar las seis categorías, incluida `failed: 0`; los elementos inválido y conflictivo deben incluir referencia y motivo.
- El paso 9 debe crear valores predeterminados: `planned`, `tags: []`, `genres: []` y anulables en `null`.
- Los pasos 10 y 11 deben aceptarse sin errores; los nulos permitidos y arrays vacíos deben sobrevivir.
- Un título local creado manualmente y ausente de todos los fixtures debe seguir en Biblioteca al finalizar.

## Comprobar identidad, fechas y round-trip

1. Después del paso 2, exportá la biblioteca y guardá ese JSON de prueba. Buscá Alfa y anotá `id`, `createdAt`, `overview`, `voteAverage` y `genres`.
2. Ejecutá el paso 4 y volvé a exportar.
3. Confirmá que `id` y `createdAt` sean exactamente los anotados, que `updatedAt` sea exactamente `1893456003000` y que los tres campos enriquecidos coincidan con `03-newer-updated.json`.
4. En una sesión web temporal nueva y vacía (otro puerto o perfil), importá el segundo export. Exportá inmediatamente otra vez y compará el elemento: `overview`, `voteAverage` y `genres` deben conservarse en el round-trip.
5. Para campos ausentes en una coincidencia, observá que el paso 4 no incluye `status`, `tags`, `year`, `posterUrl` ni `notes`; esos valores deben seguir iguales a los insertados en el paso 2.

Los exports generados durante esta prueba también son datos sintéticos. Eliminarlos al terminar evita confundirlos con backups útiles.

## Matriz manual ejecutada: envoltura y validación

Cada fila debe ejecutarse sobre un origen descartable. Cuando el archivo se rechaza completamente no existe confirmación ni resumen final: las seis categorías son **no aplicables** y la biblioteca debe quedar idéntica.

| Caso | Estado previo | Fixture | Previo válidos/inválidos | inserted | updated | skipped | conflicts | invalid | failed | Comparación posterior |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| `exportedAt: null` | Biblioteca con un título testigo | `11-invalid-exported-at-null.json` | archivo rechazado | N/A | N/A | N/A | N/A | N/A | N/A | Exportar antes y después; el array `items` debe ser idéntico. |
| `exportedAt` número | Igual | `12-invalid-exported-at-number.json` | archivo rechazado | N/A | N/A | N/A | N/A | N/A | N/A | Mismo control. |
| `exportedAt` booleano | Igual | `13-invalid-exported-at-boolean.json` | archivo rechazado | N/A | N/A | N/A | N/A | N/A | N/A | Mismo control. |
| `exportedAt` objeto | Igual | `14-invalid-exported-at-object.json` | archivo rechazado | N/A | N/A | N/A | N/A | N/A | N/A | Mismo control. |
| `exportedAt` array | Igual | `15-invalid-exported-at-array.json` | archivo rechazado | N/A | N/A | N/A | N/A | N/A | N/A | Mismo control. |
| `exportedAt` ausente | Biblioteca vacía | `16-exported-at-absent.json` | 0/0 | 0 | 0 | 0 | 0 | 0 | 0 | Exportar y confirmar que sigue sin items. |
| Strings obligatorios vacíos/espacios | Biblioteca vacía | `17-invalid-required-empty.json` | 0/4 | 0 | 0 | 0 | 0 | 4 | 0 | El export posterior debe seguir con `items: []`. |
| `id` vacío/espacios | Biblioteca vacía | `18-invalid-id-empty.json` | 0/2 | 0 | 0 | 0 | 0 | 2 | 0 | El export posterior debe seguir con `items: []`. |
| Fechas negativas | Biblioteca vacía | `19-invalid-negative-dates.json` | 0/2 | 0 | 0 | 0 | 0 | 2 | 0 | El export posterior debe seguir con `items: []`. |
| Fechas con string, `null`, objeto o array | Biblioteca vacía | `20-invalid-date-types.json` | 0/6 | 0 | 0 | 0 | 0 | 6 | 0 | El export posterior debe seguir con `items: []`. |

Para los fixtures `11` a `15`, comprobar además que el error menciona `exportedAt` y que nunca aparece el diálogo de confirmación. Para `17` a `20`, confirmar que el detalle identifica el campo inválido y que ningún valor se reemplaza por un predeterminado.

JSON no puede representar `NaN`, `Infinity` o `-Infinity`: esos tokens vuelven inválido al archivo JSON completo y ya están cubiertos por el caso de JSON inválido, no por un elemento `invalid`.

## Matriz manual ejecutada: fechas, presencia y merge

Estas secuencias son independientes. Reiniciar con una biblioteca vacía entre secuencias.

| Secuencia | Estado previo necesario | Fixture | inserted | updated | skipped | conflicts | invalid | failed | Campos a comparar en el JSON exportado |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Fecha igual | Importar `01-insert-new.json`; exportar y guardar Alfa | `21-equal-updated-at.json` | 0 | 0 | 1 | 0 | 0 | 0 | El objeto Alfa completo debe ser idéntico; especialmente `title`, `id`, `createdAt`, `updatedAt`, `overview`, `voteAverage` y `genres`. |
| `updatedAt` ausente en coincidencia | Importar `01`; exportar y guardar Alfa | `22-absent-updated-at-match.json` | 0 | 0 | 1 | 0 | 0 | Los mismos campos deben permanecer idénticos. |
| Inserción con fechas exactas | Biblioteca vacía | `23-insert-exact-dates.json` | 1 | 0 | 0 | 0 | 0 | 0 | `id = fixture-exact-dates-id`, `createdAt = 1893456023000` y `updatedAt = 1893456023999`. |
| Inserción con fechas ausentes | Biblioteca vacía; anotar la hora inmediatamente antes y después | `24-insert-dates-absent.json` | 1 | 0 | 0 | 0 | 0 | 0 | `createdAt` y `updatedAt` deben ser números finitos, no negativos, iguales entre sí y comprendidos entre las horas anotadas. |
| Actualización con opcionales ausentes | Importar `01`; exportar Alfa como línea base | `25-update-optional-fields-absent.json` | 0 | 1 | 0 | 0 | 0 | 0 | `title` cambia; `updatedAt = 1893456003000`; `id`, `createdAt`, `year`, `posterUrl`, `overview`, `voteAverage`, `genres`, `status`, `tags` y `notes` permanecen exactamente iguales a la línea base. |
| Actualización con `null` explícito | Importar `01`; exportar Alfa como línea base | `26-update-explicit-null.json` | 0 | 1 | 0 | 0 | 0 | 0 | `year`, `posterUrl`, `overview`, `voteAverage` y `notes` pasan a `null`; `id` y `createdAt` siguen exactos; `updatedAt = 1893456004000`; `genres`, `status` y `tags` se conservan. |

## Matriz manual ejecutada: permanencia, identidad y round-trip

| Caso | Estado previo necesario | Fixture/acción | Resultado esperado | Comparación JSON obligatoria |
| --- | --- | --- | --- | --- |
| Título local ausente del backup | Biblioteca vacía; crear manualmente un título testigo y exportar | Importar `00-empty.json` | `inserted 0`, `updated 0`, `skipped 0`, `conflicts 0`, `invalid 0`, `failed 0` | El objeto testigo debe seguir presente y ser idéntico campo por campo. |
| Conservación exacta de identidad y datos enriquecidos | Importar `01`, exportar; luego importar `25` y exportar | `01-insert-new.json` + `25-update-optional-fields-absent.json` | Primera importación `1/0/0/0/0/0`; segunda `0/1/0/0/0/0` | `id = fixture-shared-id` y `createdAt = 1893456000000` no cambian; `updatedAt = 1893456003000`; `overview`, `voteAverage` y `genres` conservan exactamente los valores de `01`. |
| Round-trip completo | En origen A vacío importar `01`, exportar A; en origen B vacío importar ese export y volver a exportar B | Export A generado, no un fixture nuevo | En A `1/0/0/0/0/0`; en B `1/0/0/0/0/0` | Comparar los objetos ordenando claves si hace falta: todos los campos deben coincidir, especialmente `id`, `createdAt`, `updatedAt`, `overview`, `voteAverage` y `genres`. |
| Conflicto de tipo | Estado dejado por `01` | `04-type-conflict.json` | `0/0/0/1/0/0` | Alfa debe ser idéntica antes y después. |
| Colisión de ID | Estado dejado por `01` | `06-id-collision.json` | `1/0/0/0/0/0` | Alfa conserva `fixture-shared-id`; el nuevo elemento existe con otro `id` y sus fechas entrantes exactas. |
| Resultado mixto sin fallo SQLite | Ejecutar la secuencia principal hasta `06` | `07-mixed-partial.json` | `1/1/1/1/1/0` | Exportar y confirmar las filas insertada/actualizada; los elementos conflictivo e inválido no deben existir. |

Los conteos y las comparaciones JSON de esta matriz quedaron registrados en la ejecución web complementaria de `localhost:8099`.

## Verificación controlada de `failed`

### Ejecución controlada con SQLite descartable — 2026-08-05

Se ejecutó el harness reproducible `controlled-sqlite-failure.cjs` con Node 22 y su SQLite real integrado. El harness no carga `src/storage/db.ts` ni `expo-sqlite`: llama a la misma implementación de merge mediante una conexión inyectada y crea un archivo exclusivo en el directorio temporal del sistema.

Comando ejecutado desde la raíz del proyecto:

```powershell
node docs\testing\library-backup-integrity\controlled-sqlite-failure.cjs
```

Procedimiento controlado:

1. Crear una base con nombre `despues-la-veo-controlled-import-<pid>-<timestamp>.sqlite`, distinto de `despues-la-veo.db`.
2. Crear `saved_titles` y su índice único solamente en esa base.
3. Crear un trigger temporal `BEFORE INSERT` que ejecuta `RAISE(ABORT, 'controlled import failure')` sólo para `external_id = 'controlled-failure'`.
4. Procesar, en orden, un elemento exitoso, el elemento destinado a fallar y un segundo elemento exitoso posterior.
5. Consultar SQLite para comprobar las filas realmente persistidas y la ausencia de la fila fallida.
6. Cerrar y eliminar el archivo descartable en un bloque de limpieza, tanto ante éxito como ante error.

Resultado realmente observado:

| inserted | updated | skipped | conflicts | invalid | failed |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 2 | 0 | 0 | 0 | 0 | 1 |

- Referencia observada: `Controlled SQLite Failure [manual/movie/controlled-failure]`.
- Motivo observado: `controlled import failure`.
- Persistidos: `controlled-success-before-id` y `controlled-success-after-id`.
- La presencia de `controlled-success-after-id` demuestra que el procesamiento continuó después del fallo.
- No existió ninguna fila con `external_id = 'controlled-failure'`; el elemento fallido no quedó parcialmente persistido.
- Base utilizada: `C:\Users\elias\AppData\Local\Temp\despues-la-veo-controlled-import-35024-1785958419589.sqlite`.
- Limpieza observada: `Disposable database removed`; el archivo dejó de existir al finalizar.
- La base de producción `despues-la-veo.db` nunca fue abierta.

La ejecución web mixta de `07-mixed-partial.json` ya había observado `inserted`, `updated`, `skipped`, `conflicts` e `invalid`, con referencias y motivos. Combinada con este fallo SQLite real, queda cubierta la tarea 4.7 sin corromper, bloquear ni abrir una base existente.

## Registro de ejecución

Copiá una fila por fixture y completala sin marcar como ejecutado lo que no se observó:

| Fecha | Plataforma | Navegador/dispositivo | Puerto/perfil aislado | Fixture | Esperado | Observado | Resultado | Observaciones |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| AAAA-MM-DD | web / Android / iOS | versión | detalle | archivo.json | seis conteos | seis conteos | pasa / falla / pendiente | texto |
| 2026-08-05 | web | no informado | `localhost:8099`, origen aislado | `11` a `26` y secuencias asociadas | matrices de esta guía | coincidieron con lo esperado | pasa | `failed` controlado no ejecutado; permaneció en 0 |

Si algo difiere, detené la secuencia, conservá el fixture y el registro sintético, y reportá el paso exacto. No pruebes un posible bug contra datos reales.

## Descartar o restaurar el entorno

- Cerrá Expo con `Ctrl+C`.
- Si usaste una ventana privada o perfil temporal, cerralo y eliminá el perfil.
- Si usaste un perfil persistente, borrá los datos del sitio correspondientes únicamente al origen de prueba (por ejemplo, `localhost:8099`). Verificá el origen exacto antes de borrar.
- Si necesitás repetir, elegí otro puerto/perfil limpio y confirmá Biblioteca vacía.
- En emulador o dispositivo descartable, eliminá los datos de esa instalación de prueba o reinstalala. No borres datos de la instalación real.
