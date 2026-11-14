Estado: **APPLY parcial: secciones 1 y 2 verificadas dentro del alcance autorizado**. 1.6 cerrada administrativamente por revisión externa informada y checkpoint `083131c56362eeba270bed816b5deb084362579f` confirmado. 2.1–2.8 verificadas; **2.9 pendiente** de revisión externa del diff y checkpoint manual. No avanzar a sección 3. Una tarea de implementación por vez; checkpoints manuales, sin commits automáticos. No modificar ni cerrar el change anterior como efecto lateral.

## 1. Contratos y normalización de metadata

- [x] 1.1 Reconfirmar rama/HEAD/estado y dependencia SQLite6/backup7/manualIdentity del change anterior; registrar diferencias y orden de deltas compartidos. Comprobar que no se asume archive/integración ni cierre de 3.5/4.4 y que existe autorización APPLY separada.
- [x] 1.2 Comprobar incorporación de ajustes de revisión externa D2.1/D3.1/D4.1 y ratificación ya recibida de SQLite7/backup8 y defaults D7/D8; registrar alcance de desarrollo y gates cerrados. Verificar coherencia de los artefactos antes de migrar o habilitar enriquecimiento, sin solicitar nuevamente aprobación de defaults ya ratificados.
- [x] 1.3 Crear contratos enriquecidos y patch de presencia/completitud con validadores puros acotados. Comprobar casos completos, omitido/null/inválido, unidades, fechas imposibles, strings extensos, IDs distintos, URLs inválidas y categorías separadas de tags.
- [x] 1.4 Ampliar parser/mapping/proyección Kitsu con transporte simulado y campos realmente soportados; conservar canonical/alias/idiomas, score original/escala, imágenes recibidas, edad/guía/nsfw y procedencia. Verificar fixtures completos/parciales y no JSON bruto, no voteAverage Kitsu, no total calculado ni traducciones inventadas.
- [x] 1.5 Incorporar proyección pública TMDB al presentador neutral sin cambiar voteAverage legacy ni credenciales; preservar omisión de score y capacidades actuales MangaUpdates. Verificar contratos de ambas fuentes y manuales sin fuente falsa.
- [x] 1.6 Checkpoint 1: ejecutar suites puras/contratos y `npx tsc --noEmit`, revisar diff y documentar límites reales. Obtener revisión/checkpoint manual de sección antes de persistencia.

## 2. Persistencia y backups

- [x] 2.1 Preparar fixtures aislados v6 nuevos/históricos/mixtos y procedimiento de copia SQLite consistente con WAL y export v7. Verificar recuperación ensayada sin datos personales y baseline exacto de todas las identidades/timestamps/pins/preferencias.
- [x] 2.2 Implementar bootstrap v7 y migración aditiva v6→v7 con tablas/índices/FKs D3 y selección de fuente. Verificar cadena histórica, padre compuesto UNIQUE, FK/cascade, datos sin origen inequívoco, timestamps no inventados y conservación exacta de tablas anteriores.
- [x] 2.3 Implementar repositorios de documentos/alias/preferencias y patch remoto transaccional con relojes separados, baseline histórico separado en selección y resolución única D3.1. Verificar no-ops, null sin fallback, colección parcial, fuente activa/ambigua, ausencia de mezcla entre fuentes, edición concurrente, respuesta vieja, borrado sin recreación y rollback de documento/proyección/alias/evento.
- [x] 2.4 Integrar materialización, save/re-save y lecturas/snapshots existentes con metadata opcional sin alterar manuales o personales. Verificar referencias múltiples, overrides personales si existen, clasificación conocida, legacy TMDB y offline sin HTTP.
- [x] 2.5 Implementar parser/export v8 con documentos, baseline separado, selección/reloj, proyección compatible coherente, referencias, preferencias e historial opcional bajo D3.1/D5. Verificar round-trip de ambas fuentes y selección, rechazo parcial de item contradictorio, JSON sin binarios/credenciales y dispatch histórico1–7 sin autoridad de claves modernas.
- [x] 2.6 Implementar merge v8 independiente por propiedad/relojes y remap de pins/eventos/selección con rematerialización final D3.1. Verificar refresh→import1–7 antiguo incluso con nota elegible, documentos v8 de distinta antigüedad por referencia, selección más reciente/empate/ausente, metadata activa visible/exportable sin degradación, colisiones/reimport, timestamps futuros y savepoints. Comparar personales íntegros contra resultados históricos sin cambiar sus reglas de merge.
- [x] 2.7 Integrar preferencias poscommit y exportación consistente en Ajustes. Verificar rollback, preferencias inválidas parciales, Appearance intacta y round-trip offline de biblioteca mixta e historial deduplicado.
- [x] 2.8 Implementar invalidación acotada de biblioteca poscommit D4.1 reutilizando recargas/snapshots, guardas de generación y foco actuales. Verificar cambio remoto visible en cards/detalle/selectores sin navegar ni HTTP extra, no-op sin revisión de presentación, frescura observable, rollback sin notificación, unsubscribe/unmount, agrupación de IDs y edición personal concurrente sin pérdida de borrador ni cambio remoto de updatedAt.
- [ ] 2.9 Checkpoint 2: ejecutar matriz real SQLite/migración/import1–8 y fallos por fase/publicación/commit/reopen, TypeScript y revisión del diff. Verificar futura versión rechazada y restauración v6 ensayada sin downgrade; obtener checkpoint manual.

## 3. Pósteres banners y puntuaciones

- [ ] 3.1 Revisar evidencia primaria vigente de campos/arte Kitsu y comprobar en desarrollo permitido los endpoints/proyecciones/hosts/variantes reales; documentar restricciones explícitas y resultado parcial si corresponde. Verificar producción/iOS cerrados y sin ampliar permisos MangaUpdates, sin equiparar acceso público con autorización comercial.
- [ ] 3.2 Reutilizar DetailPoster/TitleGridCard/placeholder y selector de variantes, agregar banner compartido con política URL compartida D2.1 también para imports/legacy. Verificar hosts legítimos distintos autorizados, hosts engañosos/sufijos, userinfo, protocolos/puertos inválidos, localhost, IPv4/IPv6 y representaciones alternativas rechazadas antes de pasar URI al renderer; comprobar sin sondeos HTTP y fallback sin afectar ficha.
- [ ] 3.3 Verificar controles efectivos de destinos finales/redirects del renderer Web/Android permitido y documentar límites DNS/rebinding sin prometer bloqueo total. Probar variantes directas revisadas, destino final inválido comprobable y redirect no verificable→placeholder, fallos de imagen, cambios de URL/identidad, ancho/densidad y cero descargas permanentes/binarios/proxy.
- [ ] 3.4 Crear presentación pública sobre 10 con etiqueta de fuente y puntuación personal diferenciada. Verificar original 82.28/100→8,2/10, cero válido, null/invalid, TMDB legacy y ausencia de promedio entre fuentes.
- [ ] 3.5 Checkpoint 3: TypeScript, suites de presentación y smoke Web/Android permitido de imágenes/puntuaciones en temas claros/oscuros. Registrar evidencia y plataformas no verificadas; revisar diff/checkpoint manual sin abrir release.

## 4. Detalle enriquecido e idiomas

- [ ] 4.1 Integrar campos enriquecidos en detalle remoto y guardado con componentes compartidos y view models sin lógica Kitsu genérica. Verificar catálogo/estado editorial distinto del personal, unidades/fechas, advertencias con fuente y snapshot legible offline.
- [ ] 4.2 Implementar preferencia ordenada de idiomas/scripts y fallback D9 con ajustes persistidos. Verificar español ausente, inglés, en_jp romanizado, idiomas adicionales, alias sin idioma y título personal prioritario sin alterar identidad/timestamps.
- [ ] 4.3 Integrar selector de título y búsqueda local por alias en biblioteca/Etiquetas y resultados existentes con proyección única D3.1. Verificar cambio A→B sin HTTP ni campos exclusivos de A, selección ambigua sin ganador automático, mismos IDs/overrides/personales al cambiar fuente o idioma, y ausencia de duplicados/regresiones de filtros y ordenamientos.
- [ ] 4.4 Checkpoint 4: suites de selectores/búsqueda/round-trip, TypeScript y smoke Web estrecho/Android de detalle/Ajustes. Revisar temas/accesibilidad/diff y obtener checkpoint manual.

## 5. Actualización individual global y automática

- [ ] 5.1 Implementar capacidades y bindings explícitos TMDB/MangaUpdates/Kitsu reutilizando clientes/políticas. Verificar matriz por plataforma/credencial/gates, tipo MangaUpdates compatible, fuentes múltiples ambiguas y manuales sin HTTP.
- [ ] 5.2 Implementar coordinador individual con single-flight, señal/generación y commit remoto limitado. Verificar éxito/no-op/404/offline/timeout/payload inválido y carrera con edición/borrado/cancelación, sin pérdida personal ni recreación.
- [ ] 5.3 Incorporar acción individual en detalle guardado y representación local durante consulta. Verificar doble toque, error/reintento, indisponibilidad explicada, fuente elegida y ningún fetch por abrir fichas con auto desactivado.
- [ ] 5.4 Implementar run global incremental, contadores/resumen y cancelación con consumidores compartidos. Verificar biblioteca oculta incluida, un run activo, no saturar colas, conservación de commits previos, fallo de una fuente sin impedir otras y reinicio interrupted sin reanudación automática.
- [ ] 5.5 Verificar políticas HTTP con reloj/transporte simulados: 429/Retry-After válido/ausente/inválido, 401/403, 5xx, límites compartidos, cancelación en espera y transporte sin aborto. Confirmar ausencia de bucles, cuotas inventadas y consultas de créditos/watch providers innecesarias.
- [ ] 5.6 Implementar defaults aprobados: auto-refresh habilitado al abrir, intervalo 7 días configurable/desactivable y cooldown automático 15 minutos tras fallo sin acortar espera mayor de proveedor. Verificar límites temporales con reloj falso, preferencia explícita preservada, fecha ausente/futura, múltiples aperturas, restauración y ninguna revisión global automática al inicio; no atribuir defaults a cuotas externas.
- [ ] 5.7 Checkpoint 5: suites deterministas de coordinación/HTTP/carreras, TypeScript y smoke de actualización individual/global/auto con datos aislados. Revisar diff, estado de gates y checkpoint manual.

## 6. Pestaña Actualizaciones e historial

- [ ] 6.1 Integrar repositorio de actividad y hooks transaccionales en altas, metadata real y mutaciones personales/pins/manuales. Verificar un evento por operación confirmada, no-op/rollback/reintento idempotente, sin notas completas ni eventos por apertura/Sin cambios.
- [ ] 6.2 Aplicar retención aprobada: eventos 90 días/2000 y revisiones 30 días/20 (primer límite), hasta 100 detalles de error/run con contadores agregados completos; mantener cascade y paginación estable. Verificar fronteras temporales/cantidad, orden de poda, 150 errores→100 detalles/total150, referencias borradas y run activo protegido, sin tratar límites como condiciones de proveedores.
- [ ] 6.3 Agregar ruta y quinta pestaña Actualizaciones con temas/safe areas existentes. Verificar orden de tabs, etiquetas/iconos, anchos estrechos, fuentes grandes, lectores de pantalla y regreso al detalle guardado.
- [ ] 6.4 Construir cabecera de última revisión, acción/cancelación, progreso y resumen con errores acotados. Verificar vacío/offline/running/parcial/cancelled/interrupted, totales consistentes y última revisión completada distinta del último intento.
- [ ] 6.5 Incorporar feed virtualizado y agrupación por fecha local con Todos/Metadata/Mi actividad. Verificar navegación, medianoche/zona horaria, filtros, importación sin eventos masivos y revisión de 500 no-ops con un resumen.
- [ ] 6.6 Checkpoint 6: suites de eventos/retención/backup y TypeScript; smoke Web/Android en todas las paletas/claro/oscuro/sistema. Revisar diff/evidencia y checkpoint manual.

## 7. Contenido sensible y preferencias

- [ ] 7.1 Implementar presentación de edad/guía/advertencias y semántica sensible por fuente conocida. Verificar nsfw true/false/ausente, ageRating sin equivalencia argentina y desconocido sin afirmación de aptitud.
- [ ] 7.2 Incorporar preferencia opcional inicialmente desactivada y selectores en búsqueda/descubrimiento existente/biblioteca/Etiquetas. Verificar desconocidos visibles, cobertura parcial sin HTTP adicional, ocultamiento reversible sin borrar ni modificar pins/personales.
- [ ] 7.3 Incorporar aviso/acceso deliberado a ficha guardada oculta y preservar alcance global/export. Verificar enlace directo sin arte previo al aviso, restore de preferencia válida/inválida y título oculto incluido en backup/revisión.
- [ ] 7.4 Checkpoint 7: regresiones de filtros/preferencias y TypeScript, smoke de temas/accesibilidad/datos aislados. Revisar diff y obtener checkpoint manual.

## 8. Regresiones validación manual y revisión externa

- [ ] 8.1 Ejecutar matriz TMDB de credenciales/búsqueda/detalle/watch providers/arte/atribución/save; MangaUpdates Android y gates Web/iOS; Kitsu desarrollo y bloqueo producción/iOS; manuales create/edit/delete/offline. Verificar alcance real sin nuevos proveedores/matching.
- [ ] 8.2 Ejecutar regresiones de identidad universal, clasificación, ratings personales, tags/notas/status/pins, SQLite y backups1–8 con fixtures aislados. Verificar datos completos antes/después, errores parciales, rollback y documentos ausentes sin pérdida.
- [ ] 8.3 Completar validación manual Web/Android de todos los recorridos nuevos, cinco tabs, temas y layouts; registrar runtime/dispositivo/origen y resultados reales. No sustituir aceptación física por simulación ni cerrar tareas pendientes del change anterior.
- [ ] 8.4 Ejecutar `npx tsc --noEmit` y `openspec validate add-enriched-media-metadata-and-library-updates --strict`; revisar diff final, paquete/lock intactos y exclusiones (sin binarios/ZIP, nube, episodios vistos o gates ampliados). Documentar comandos/exits y límites.
- [ ] 8.5 Preparar entrega de implementación para revisión externa con evidencia, matriz de preservación/recuperación, decisiones ratificadas y pendientes reales; registrar resultado antes de cierre. Checkpoint manual separado; no archive/sync/merge/commit/push automáticos.
