## 1. Modelo contextual, SQLite v2 y repositorio de pins

- [x] 1.1 Crear los tipos y helpers acotados de contexto en `src/core/contextualPin.ts`, usando exactamente `String.trim()`, Biblioteca con key vacía y tags normalizadas no vacías con identidad exacta posterior; comprobar whitespace Unicode cubierto por JS y casos válidos/inválidos sin normalizar mayúsculas ni acentos.
- [x] 1.2 Definir `title_pins`, su PK/FK/checks contextuales, defensa de rango entero seguro para `pinned_at` e `idx_title_pins_context` en `src/storage/db.ts`, activar y verificar `PRAGMA foreign_keys = ON`; comprobar por introspección SQLite que columnas, restricciones e índice coincidan con el diseño sin tratar el trim de SQLite como autoridad.
- [x] 1.3 Evolucionar `DATABASE_SCHEMA_VERSION` y la inicialización de 1 a 2 dentro de una transacción, estableciendo `user_version = 2` sólo tras verificar toda la estructura; comprobar que una fixture v1 conserva `saved_titles`, `idx_saved_titles_provider_external`, `app_preferences` y sus datos.
- [x] 1.4 Cubrir inicialización nueva/v0 y reapertura v2 idempotente; comprobar que ejecuciones repetidas no duplican estructuras ni alteran títulos, preferencias o pins.
- [x] 1.5 Inyectar un fallo controlado durante creación/verificación y comprobar rollback completo: la estructura parcial no se publica, `user_version` no queda en 2 y los datos v1 permanecen intactos.
- [x] 1.6 Probar una base con versión futura mayor que 2 y comprobar rechazo explícito sin escrituras ni cambios de versión.
- [x] 1.7 Implementar `src/storage/titlePinsRepo.ts` con lectura por contexto, lectura individual, pin, unpin y eliminación, validando existencia/pertenencia tag dentro de la operación; comprobar independencia Biblioteca/tag, múltiples etiquetas, claves inválidas y ausencia de consultas por card.
- [x] 1.8 Validar y persistir `pinned_at` sólo cuando sea number, `Number.isSafeInteger` y mayor o igual que cero, usándolo únicamente como prioridad descendente dentro del grupo fijado; comprobar `Date.now()` y rechazar decimales, `Infinity`, `NaN`, negativos y enteros fuera del rango seguro, verificando además que pin/unpin no modifica `SavedTitle.updatedAt`.
- [x] 1.9 Ejecutar `npx tsc --noEmit` y las pruebas del checkpoint; revisar los cambios de tipos/SQL y detener Apply para revisión antes de continuar.

## 2. Integridad con SavedTitle, tags y eliminación

- [x] 2.1 Crear helpers con conexión activa para derivar las tags finales normalizadas y eliminar únicamente pins de tags que ya no pertenecen al título; comprobar que se conservan Biblioteca y otras etiquetas.
- [x] 2.2 Integrar la limpieza en el guardado/upsert normal dentro de la misma transacción que reemplaza `tags_json`; comprobar que quitar `Acción` elimina su pin sin afectar otros datos.
- [x] 2.3 Integrar la misma limpieza en actualizaciones de títulos provenientes del merge de backup; comprobar que una actualización de tags no deja pins huérfanos.
- [x] 2.4 Tratar un cambio `Acción` → `Accion` como eliminación y adición: comprobar que desaparece el pin de `Acción` y no se crea ni transfiere uno a `Accion`.
- [x] 2.5 Hacer `deleteSavedTitle` transaccional con limpieza explícita previa, manteniendo cascade como respaldo; comprobar que borrar un título elimina todos sus pins y no afecta otros títulos.
- [x] 2.6 Probar carreras donde el título o la etiqueta desaparecen antes de fijar; comprobar que el repositorio rechaza el pin obsoleto y conserva los demás estados.
- [x] 2.7 Ejecutar `npx tsc --noEmit` y las pruebas de integridad del checkpoint; revisar las transacciones y detener Apply para revisión antes de continuar.

## 3. Backup JSON v2 y compatibilidad v1

- [x] 3.1 Crear el contrato, normalización y parser de JSON v2 sin alterar el contrato de campos de `libraryBackupV1.ts`; comprobar envoltura, `items`, `pins`, identidades lógicas, contextos y que `pinnedAt` acepte sólo number entero seguro no negativo.
- [x] 3.2 Agregar un dispatcher que acepte versiones 1 y 2 y rechace cualquier otra o una envoltura estructuralmente corrupta antes de escribir; comprobar que JSON inválido, `exportedAt` inválido y `pins` no-array no modifican SQLite.
- [x] 3.3 Actualizar exportación para producir `version: 2` con `items` y pins referidos por `provider + externalId`, excluyendo preferencias; comprobar el JSON resultante con Biblioteca, múltiples tags y cero pins.
- [x] 3.4 Mantener v1 sin importación de pins ni desfijado por ausencia, pero aplicar la limpieza normal si un item elegible cambia `tags_json`; ejecutar las fixtures v1 actuales y comprobar que se elimina sólo el pin de una tag perdida mientras se conservan Biblioteca y tags todavía pertenecientes.
- [x] 3.5 Procesar v2 en orden títulos → resolución de identidad local final → pins; comprobar que una colisión de `SavedTitle.id` no rompe la asociación por `provider + externalId`.
- [x] 3.6 Implementar merge aditivo de pins: insertar ausentes con `pinnedAt` entrante, conservar filas y `pinned_at` locales coincidentes y no borrar pins locales ausentes; comprobar idempotencia importando dos veces.
- [x] 3.7 Omitir y reportar individualmente pins con título inexistente, contexto/key inválidos, tag no perteneciente o `pinnedAt` no-number, decimal, infinito, `NaN`, negativo o fuera del rango seguro; comprobar que otros títulos y pins elegibles sí se persisten.
- [x] 3.8 Ampliar el resultado/resumen con pins insertados, conservados, inválidos y fallidos, usando referencias seguras y sin presentar resultados parciales como éxito total; comprobar combinaciones mixtas.
- [x] 3.9 Verificar manualmente exportación e importación v1/v2 en web y en un dispositivo/emulador móvil, incluyendo compartir/seleccionar archivo y mensajes finales.
- [x] 3.10 Ejecutar `npx tsc --noEmit` y toda la suite/fixtures de backup; revisar compatibilidad y detener Apply para revisión antes de continuar.

## 4. Biblioteca: estado contextual, orden y acción Detail

- [x] 4.1 Cargar en lote los pins con ID y `pinnedAt` del contexto Biblioteca al enfocar/refrescar la pantalla y sincronizarlos tras mutaciones; comprobar que no se consulten pins individualmente por card.
- [x] 4.2 Mantener el pipeline búsqueda/filtros → partición pinned/unpinned → fijados por `pinnedAt` descendente con `compareLibraryTitles` como desempate → no fijados por `compareLibraryTitles` → concatenación; comprobar todos los sorts, empates, filtros de estado/tipo y búsqueda por título/tag.
- [x] 4.3 Comprobar que un fijado excluido no aparece, que limpiar búsqueda/filtro lo devuelve arriba y que pins de etiquetas nunca afectan Biblioteca.
- [x] 4.4 Agregar en Detail de Biblioteca una acción hermana `Fijar`/`Desfijar` con labels `Fijar en Biblioteca`/`Desfijar de Biblioteca`, sin `Pressable` anidado; comprobar navegación y acción como zonas independientes con mouse, touch y teclado.
- [x] 4.5 Serializar mutaciones rápidas por título/contexto y aplicar rollback al último estado y `pinnedAt` confirmados ante error; comprobar doble pulsación, respuesta antigua, fallo controlado y reintento utilizable.
- [x] 4.6 Navegar al detalle completo con `pinContext=library` mediante parámetros tipados; comprobar URL web, recarga y regreso a Biblioteca.
- [x] 4.7 Ejecutar `npx tsc --noEmit`, pruebas de orden/estado y revisión manual responsive de Detail en web/móvil; detener Apply para revisión antes de continuar.

## 5. Etiquetas: independencia, orden propio y acción Detail

- [ ] 5.1 Cargar pins sólo para la clave exacta de `selectedTag` y limpiarlos al cambiar/cerrar contexto; comprobar independencia respecto de Biblioteca, otras etiquetas, mayúsculas y acentos.
- [ ] 5.2 Particionar la lista abierta, ordenar fijados por `pinnedAt` descendente con `compareTitlesForCollage` como desempate y no fijados con `compareTitlesForCollage` antes de concatenar; comprobar que no herede el sort de Biblioteca ni agregue selector nuevo.
- [ ] 5.3 Mantener `selectCollageTitles` y `TagCollage` fuera del pipeline de pins; comprobar que fijar/desfijar no cambia las cuatro imágenes ni su orden.
- [ ] 5.4 Agregar a la fila Detail de etiqueta una acción hermana corta `Fijar`/`Desfijar` con label contextual completo, sin controles anidados; comprobar interacción independiente en web, móvil y teclado.
- [ ] 5.5 Aplicar cola/rollback de escritura a la acción contextual y refrescar con seguridad si la etiqueta pierde todos sus títulos; comprobar doble pulsación, error y contexto desaparecido.
- [ ] 5.6 Navegar al detalle con `pinContext=tag` y la clave exacta codificada; comprobar tags con espacios, tildes y caracteres reservados, recarga web y regreso a la etiqueta abierta.
- [ ] 5.7 Ejecutar `npx tsc --noEmit`, pruebas de independencia/orden y revisión manual responsive de la etiqueta abierta; detener Apply para revisión antes de continuar.

## 6. Detalle completo y validación del contexto de origen

- [ ] 6.1 Parsear los parámetros de `/title/[id]` en un contexto discriminado y validar tag no vacío y pertenencia exacta actual; comprobar library/tag válidos, parámetros múltiples o desconocidos y valores vacíos.
- [ ] 6.2 Aplicar fallback explícito a Biblioteca cuando falte contexto, sea inválido o el título ya no contenga la etiqueta; comprobar deep links, recarga web y contexto obsoleto sin creación de pin tag.
- [ ] 6.3 Mostrar la acción explícita `Fijar en …`/`Desfijar de …` y el estado del contexto validado, sin mezclar pins de Biblioteca/tag; comprobar las cuatro combinaciones del ejemplo Batman.
- [ ] 6.4 Persistir la acción mediante `titlePinsRepo`, no mediante el save de `SavedTitle`; comprobar que estado, notas, tags y `updatedAt` no cambian al fijar/desfijar.
- [ ] 6.5 Integrar cola, rollback visual, mensaje de error y reintento en el detalle; comprobar doble pulsación y fallo de escritura en web y móvil.
- [ ] 6.6 Ejecutar `npx tsc --noEmit` y pruebas de rutas/contextos; revisar manualmente navegación directa, desde Biblioteca y desde etiquetas antes de continuar.

## 7. Indicadores Grid, accesibilidad y responsive

- [ ] 7.1 Extender `TitleGridCard` con un indicador contextual no interactivo y sin apariencia de botón, comenzando por la propuesta de badge superior derecho con icono + `Fijado`; comprobar que `pointerEvents="none"`, tipo y título preserven el contrato de la card.
- [ ] 7.2 Mantener exactamente un `Pressable` navegable en cada card Grid y enriquecer su label con el estado contextual; inspeccionar el árbol y comprobar click/touch/teclado sobre badge y resto de card.
- [ ] 7.3 Pasar únicamente el pin del contexto visible desde Biblioteca y etiqueta abierta; comprobar que un pin global no se indica dentro de un tag y viceversa.
- [ ] 7.4 Revisar Grid y Detail en PC, anchos móviles estrechos y móvil común, y ajustar cuando sea necesario texto, icono, tamaño, truncamiento o posición del indicador; comprobar la presentación finalmente elegida sin rediseñar cards ni cambiar su semántica/interacción.
- [ ] 7.5 Verificar contraste, foco, lectura accesible, áreas táctiles y ausencia de dependencia de hover o long press en todas las acciones nuevas.
- [ ] 7.6 Ejecutar `npx tsc --noEmit` y la revisión manual visual/accesible web-móvil; detener Apply para aprobación del pulido antes del cierre.

## 8. Verificación integral y cierre de implementación

- [ ] 8.1 Ejecutar pruebas completas de migración 1→2, idempotencia, rollback, versión futura, FK e integridad explícita sobre fixtures controladas; documentar resultados y rutas de recuperación.
- [ ] 8.2 Ejecutar matriz de dominio: Biblioteca/tag independientes, múltiples tags, quitar/cambiar tag, borrar título, contexto obsoleto y garantía de `updatedAt` intacto.
- [ ] 8.3 Ejecutar matriz de presentación: búsqueda, filtros, todos los sorts de Biblioteca, orden propio de tag, collages intactos, Detail/Grid y errores de escritura.
- [ ] 8.4 Ejecutar matriz de backup: v1 sin importar pins pero con limpieza por tags realmente removidas, v2 round-trip, colisión de ID local, merge aditivo, `pinnedAt` local conservado, validación de entero seguro, repetición idempotente y pins inválidos/huérfanos omitidos y reportados.
- [ ] 8.5 Verificar manualmente export/import, navegación, acciones, responsive y accesibilidad en web y móvil; confirmar que no existen `Pressable` anidados ni controles secundarios en `TitleGridCard`.
- [ ] 8.6 Revisar el diff completo y confirmar ausencia de ratings, drag-and-drop, orden manual, entidades Tag, cambios de collages/ViewOptionsPanel, dependencias nuevas y modificaciones a `app.json` o `package.json`.
- [ ] 8.7 Ejecutar `npx tsc --noEmit` y todos los comandos de pruebas finales, registrar cualquier verificación manual pendiente y resolver fallos antes de marcar implementación completa.
- [ ] 8.8 Ejecutar `npx.cmd openspec validate add-contextual-title-pinning --strict` y corregir cualquier inconsistencia de artefactos detectada antes del handoff final.
- [ ] 8.9 Obtener revisión externa final del diff completo y aprobación explícita antes de Archive; no archivar mientras esta tarea permanezca pendiente.
