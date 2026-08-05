# Verificación manual: integridad de backups de biblioteca

Esta guía usa únicamente datos sintéticos de `fixtures/`. No importes un backup real ni ejecutes estas pruebas sobre una biblioteca que quieras conservar.

## Estado de verificación

Ejecutado técnicamente en esta preparación:

- Los 11 fixtures fueron parseados como JSON y se comprobó `version: 1` y la cantidad de elementos.
- `npx.cmd tsc --noEmit` terminó correctamente.
- `git diff --check` terminó correctamente.
- `npm run web -- --port 8098` produjo el bundle web principal (881 módulos) y el worker web de SQLite; se obtuvo HTTP 200 y Metro se detuvo después.
- El diff de paths confirmó que esta sesión no modificó esquema SQLite, dependencias, TMDB ni los tres archivos de producción excluidos.

No ejecutado todavía:

- Ningún fixture fue importado mediante la interfaz; por lo tanto, los conteos de merge de esta guía son expectativas derivadas del contrato, no resultados observados.
- No se verificaron visualmente Biblioteca, Ajustes, confirmaciones ni round-trip.
- No se ejecutaron pruebas en Android o iOS.
- No se forzó un `failed` de persistencia; requiere una prueba automatizada con SQLite desechable e inyección controlada de fallo.

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

## Registro de ejecución

Copiá una fila por fixture y completala sin marcar como ejecutado lo que no se observó:

| Fecha | Plataforma | Navegador/dispositivo | Puerto/perfil aislado | Fixture | Esperado | Observado | Resultado | Observaciones |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| AAAA-MM-DD | web / Android / iOS | versión | detalle | archivo.json | seis conteos | seis conteos | pasa / falla / pendiente | texto |

Si algo difiere, detené la secuencia, conservá el fixture y el registro sintético, y reportá el paso exacto. No pruebes un posible bug contra datos reales.

## Descartar o restaurar el entorno

- Cerrá Expo con `Ctrl+C`.
- Si usaste una ventana privada o perfil temporal, cerralo y eliminá el perfil.
- Si usaste un perfil persistente, borrá los datos del sitio correspondientes únicamente al origen de prueba (por ejemplo, `localhost:8099`). Verificá el origen exacto antes de borrar.
- Si necesitás repetir, elegí otro puerto/perfil limpio y confirmá Biblioteca vacía.
- En emulador o dispositivo descartable, eliminá los datos de esa instalación de prueba o reinstalala. No borres datos de la instalación real.
