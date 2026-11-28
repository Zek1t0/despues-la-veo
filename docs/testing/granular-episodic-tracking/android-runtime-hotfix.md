# Hotfix del runtime Android

Rama `fix/granular-android-runtime`. Baseline `d7f0cb8`, con el change granular integrado y archivado. El árbol y el índice comenzaron limpios.

## Correcciones

- El hook de vigencia usa `AppState` en nativo y los eventos de foco y visibilidad en Web. Antes de registrar un evento Web verifica que el destino pueda registrarlo y retirarlo. La limpieza usa la misma referencia del destino, retira la suscripción nativa y cancela el temporizador. La reevaluación sigue siendo local.
- La ruta de revisión granular en el layout raíz solo lee `window.location` en Web. Los lectores de ubicación de los dos fixtures quedan detrás de esa ruta. La confirmación del informe granular verifica que el documento Web admita registro y retiro de eventos antes de instalar Escape.
- Cada bloque de la ficha tiene una clave con su propio prefijo e ID del título. Conserva su identidad entre renderizados del mismo título y remonta al cambiar de título.

## Reproducción

- `node docs/testing/granular-episodic-tracking/android-runtime.cjs` monta y desmonta el hook con `window` sin APIs DOM, fondo y primer plano de AppState, reloj controlado, cambio de día y limpieza en Android simulado y Web.
- `node docs/testing/enriched-media-metadata/section-7-ui.cjs` ejercita la ruta real de ficha con película, serie, anime y manga, usando un harness de render y servicios aislados. Verifica claves distintas y estables.
- Ejecutar `s3-web.cjs` con `GRANULAR_RUNTIME_TEST=1` y un `S3_METRO_PORT` libre. Chrome abre las cuatro fichas reales tras guardarlas en la biblioteca TEST y comprueba que la consola no emita avisos de claves duplicadas.
- Regresiones focalizadas adicionales en `docs/testing/granular-episodic-tracking/s3.cjs` y `docs/testing/personal-episodic-progress/s2-ui.cjs`.
- TypeScript con `node node_modules/typescript/bin/tsc --noEmit` y exportación Web con `node node_modules/expo/bin/cli export --platform web --output-dir .expo/granular-android-hotfix`, con `EXPO_NO_DOTENV=1`.

## Resultados

El hook del baseline reprodujo `window.addEventListener is not a function` con el mismo fixture nativo. La versión corregida pasó la prueba del hook y las tres regresiones focalizadas. Chrome TEST abrió película, serie, anime y manga sin avisos de claves duplicadas en la consola. Pasaron TypeScript, exportación Web y whitespace. Se preservó el informe histórico de resultados que una suite regenera al ejecutarse.

ADB y el emulador Android no se detectaron en el entorno. La aceptación física del hotfix está pendiente. Todas las comprobaciones de datos usaron fixtures o bases TEST.

## Inventario

- Producción · `app/_layout.tsx`, `app/title/[id].tsx`, `src/components/granular/useGranularDay.ts` y `src/components/granular/GranularImportReview.tsx`.
- Pruebas modificadas · `docs/testing/enriched-media-metadata/section-7-ui.cjs` y `docs/testing/granular-episodic-tracking/s3-web.cjs`.
- Prueba nueva · `docs/testing/granular-episodic-tracking/android-runtime.cjs`.
- Evidencia nueva · este informe.
