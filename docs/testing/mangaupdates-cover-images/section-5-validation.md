# Sección 5 — verificación sintética y smoke Web automatizado

Fecha: 2026-11-09. Cambio: `enable-mangaupdates-cover-images`, esquema `spec-driven`.

**Estado vigente: 5.1 y 5.2 completas. Progreso: 10/14.** El smoke real headless que se documenta a continuación sustituye los pendientes manuales de iteraciones anteriores. No se implementaron Secciones 6–7 ni se ejecutó la regresión final de todo el milestone. Se requiere revisión externa del diff y checkpoint del usuario antes de Sección 6.

## Smoke real local Windows del 2026-11-09 — 5.2 completa

### Archivos de esta iteración y método

Creado: `docs/testing/mangaupdates-cover-images/section-5-browser-verification.cjs`.

Modificados: este informe y `openspec/changes/enable-mangaupdates-cover-images/tasks.md` (solo 5.2 en esta iteración). Se conserva la marca anterior 5.1 y su test sin reescritura. El cambio personal de package.json permanece byte a byte; lockfile, código productivo, SQLite v5, backup v6, allowlist y canonical/archived specs intactos.

Chrome **156.0.8078.80**, Windows 10/Win64 según user-agent, CDP 1.3, Node v22.18.0. Se descubrieron Chrome y Edge locales; Playwright/Puppeteer no están instalados en el proyecto. Se utilizó el Chrome instalado con `--headless=new`, CDP mediante WebSocket nativo de Node, sin dependencias nuevas. No se invocó Computer Use, nube, navegador gráfico, sesión personal o agente de navegador.

El runner crea un user-data-dir temporal y tres BrowserContexts desechables: producción antes, review y producción después. Inicia dos Metro propios con entornos distintos y comprueba que los puertos estén libres; no reutiliza ni detiene Metro ajenos. La ejecución aprobada fuera del sandbox fue necesaria para acceder al Chrome/localhost del mismo Windows. No se desactivó el sandbox de Chrome ni se alteró seguridad del sistema.

Comando de la corrida completa exitosa (**exit 0**):

```powershell
$env:SECTION5_EVIDENCE_DIR='C:/Users/elias/.codex/visualizations/2026/11/09/01a1be53-8076-7162-b49a-e9044322649d/section-5-browser-evidence/run-6'
node docs/testing/mangaupdates-cover-images/section-5-browser-verification.cjs
```

Para repetir, elegir otro directorio absoluto de evidencia fuera del repositorio o dejar que el runner cree uno fechado bajo TEMP. No hace falta instalar paquetes ni cambiar scripts. `CHROME_PATH` es opcional si Chrome está en otra ubicación; por defecto usa `C:/Program Files/Google/Chrome/Application/chrome.exe`.

Procesos Metro ejecutados mediante `spawn(node, [require.resolve('expo/bin/cli'), ...])`, equivalentes a los comandos del proyecto siguientes; ambos reciben `EXPO_OFFLINE=1` y `CI=1` para checks CLI/no interacción:

```powershell
# Proceso productivo: EXPO_PUBLIC_MEDIA_REVIEW se elimina solo de su env hijo.
npx expo start --web --localhost --port 8135
# Proceso review separado: EXPO_PUBLIC_MEDIA_REVIEW=1 solo en su env hijo.
npx expo start --web --localhost --port 8105
```

La invocación exacta de node/Expo, argumentos Chrome, PIDs y user-agent están en result.json. No se imprime ni utiliza una credencial de navegador personal. El contexto nuevo confirmó TMDB no configurado; la variable legacy de entorno no se convirtió en una credencial configurada de la app.

### Evidencia conservada fuera del repositorio

Directorio: `C:/Users/elias/.codex/visualizations/2026/11/09/01a1be53-8076-7162-b49a-e9044322649d/section-5-browser-evidence/run-6/`.

- [result.json](C:/Users/elias/.codex/visualizations/2026/11/09/01a1be53-8076-7162-b49a-e9044322649d/section-5-browser-evidence/run-6/result.json): 26 checks pasados, versión, visitas y comandos.
- [network.json](C:/Users/elias/.codex/visualizations/2026/11/09/01a1be53-8076-7162-b49a-e9044322649d/section-5-browser-evidence/run-6/network.json): requests/responses/failures y redirects, correlacionables por sessionId/requestId; URL, tipo, status e initiator. No guarda headers, cuerpos ni tokens.
- [console.json](C:/Users/elias/.codex/visualizations/2026/11/09/01a1be53-8076-7162-b49a-e9044322649d/section-5-browser-evidence/run-6/console.json): warnings/errores reales y notas de instrumentación.
- `production-before-storage.json`, `production-after-storage.json`, `review-storage.json`: nombres físicos OPFS y logicalPath leído de la cabecera de 512 bytes del AccessHandlePoolVFS existente. Solo storage de los contextos temporales.
- `owned-codec.json`: dimensiones decodificadas y rechazo de bytes inválidos.
- PNG y snapshots DOM de producción Buscar/Biblioteca/Grid/ruta bloqueada, review corpus/detalle/fallo de imagen/biblioteca/Grid; logs Metro/Chrome. Se inspeccionaron las capturas de Buscar, detalle con fallback y Grid review, sin regresión visual obvia en ese viewport 1280×900.

### Esperado frente a observado

| Check real de navegador | Observado |
| --- | --- |
| Producción antes de review | `/buscar` carga; input real con consulta; mensaje TMDB no configurado y CTA Configurar TMDB. Solo Películas/Series como categorías remotas. Cambio a Series funciona, sin TEST ni categorías MangaUpdates. |
| Biblioteca y modalidades | Tab Librería navega a `/libreria`; biblioteca vacía del perfil temporal. Opciones reales cambian Mosaico y Detalle, sin errores. La presentación poblada se prueba en review, sin inyectar fixtures en producción. |
| Ruta remota Web | Visita directa a `http://localhost:8135/mangaupdates/series/42` muestra no habilitado en esta plataforma; sin Guardar en Biblioteca ni requests MangaUpdates. |
| Review real | `http://localhost:8105/dev/media-review` muestra TEST, los dos nombres de DB y 20 fixtures originales. Abrir fixture, guardar por el flujo existente y abrir detalle local funcionan. |
| Edición/persistencia review | Cambiar estado a Viendo y escribir la nota propia `Section 5 owned browser note`, Guardar y volver, y reabrir: nota y status persisten. El estado se verifica en la etiqueta accesible de la fila cargada del repositorio. |
| Aislamiento entre DBs review | La biblioteca primaria contiene 1 título guardado y la restaurada sigue vacía. Cabeceras OPFS confirman `/media-review-primary.db` y `/media-review-restore.db`, sin `/despues-la-veo.db` en el origen review. |
| Imagen nula y rota | Fixture inicial con poster null presenta placeholder. El control existente Guardar con portada rota de prueba usa `http://127.0.0.1:1/review-missing.png`; Chrome emite fallo real ERR_UNSAFE_PORT y la pantalla conserva placeholder, título/metadata y nota. No se añadió URL/route/flag productivo para probarlo. |
| Grid review poblado | La misma biblioteca de 1 título alterna Detalle/Mosaico con controles reales; muestra título, Viendo y placeholder tras error. |
| Codec de navegador, prueba separada | `HTMLImageElement.decode()` decodifica los bytes del SVG propio existente con naturalWidth=40/naturalHeight=60 y rechaza bytes corruptos PNG. Se ejecuta fuera de la composición de la app; no se inyecta portada en storage ni se afirma éxito de carga de un componente por este codec aislado. |
| Producción después de review | Nuevo BrowserContext, review desactivado, mismo Metro productivo: se repiten Buscar/Series, estado sin token, biblioteca vacía, modalidades y ruta MangaUpdates bloqueada. OPFS contiene solo `/despues-la-veo.db`, sin review DBs. No hay nota/fixture review ni banner TEST. |
| Consola/runtime | 0 Runtime.exceptionThrown y 0 errores inesperados de consola. Se registran deprecaciones RN Web pointerEvents y errores de red esperados de la URL rota. |

URLs visitadas directamente: `http://localhost:8135/buscar` y `http://localhost:8135/mangaupdates/series/42`, antes y después de review; `http://localhost:8105/dev/media-review` para review. `/libreria` se alcanzó por el tab real; las vistas de review navegan internamente en su contenedor, sin rutas productivas.

### Network completo y límites de interpretación

Network.enable se activa antes de navegar, sin filtro por tipo, tanto en páginas como en workers auto-adjuntados. Se capturaron **38 requests: 31 respuestas HTTP 200 y 7 fallos Image ERR_UNSAFE_PORT**. Tipos observados: Document, Script, Other, Fetch, Font e Image. No hubo XHR ni redirects observados; están habilitados en la captura si ocurren. El tipo Fetch de Network es distinto del dominio CDP Fetch usado para interceptar.

**0 requests MangaUpdates API/CDN, 0 intentos bloqueados de activación.** La instrumentación de página incluye una defensa Fetch que abortaría cualquier dominio MangaUpdates y contaría el intento como fallo del test; no se activó. Los workers no soportan Fetch.enable en este Chrome: eso se registra como nota, se mantiene Network.enable del worker y se reanuda su ejecución; no se presenta como garantía de intercepción de worker. La prueba afirma ausencia observada en el recorrido instrumentado, no una propiedad universal de toda URL histórica ni de navegación futura.

Las siete fallas provienen exclusivamente de la URL rota localhost:1 ya presente en el corpus/control review y sus remontajes. Son **rechazos reales del navegador antes de HTTP**, no respuestas HTTP 404 ni pruebas de timeout/red offline reales. HTTP/network/decode por componente siguen cubiertos como eventos simulados por 5.1. El rechazo de PNG en el codec separado sí es real. No se hizo GET a artwork MangaUpdates ni se desactivó la protección de puertos inseguros.

La evidencia manual previa del usuario de 13 títulos/13 WebP 200 y Slow 4G se conserva en el apartado histórico siguiente. El perfil aislado no contiene esos datos, no se intentó copiar el perfil personal y no se infiere que esos recursos históricos sean MangaUpdates. No se afirma cero GET de URLs locales/importadas genéricas.

### Fallos intermedios y correcciones del runner

Todos los intentos usaron el mismo comando node del runner, con SECTION5_EVIDENCE_DIR por corrida; no se modificó producto para resolverlos.

| Corrida | Exit | Resultado/corrección |
| --- | --- | --- |
| 1, TEMP por defecto bajo sandbox | 1 | Timeout esperando DevToolsActivePort. Chrome no expuso CDP; cleanup propio ejecutado. Se reintentó con ejecución local fuera del sandbox. |
| 2, directorio run-2 | 1 | Chrome/CDP y Metro sí arrancaron, pero Fetch.enable no existe en el target worker y la instrumentación inicial lo dejó pausado: página vacía y timeout. Se añadió soporte diferenciado de worker, reanudación en finally y espera de la instrumentación completa. No fue un fallo del producto. |
| 3, run-3 | 1 | Selector exacto Librería no incluía glyphs de iconos del tab. Se ajustó al DOM observado y se cerraron explícitamente los modales de opciones. |
| 4, run-4 | 1 | Esperaba nombres lógicos en nombres físicos OPFS; Expo usa pool de archivos opacos. Se inspeccionó AccessHandlePoolVFS y se leen las cabeceras lógicas, sin escrituras. |
| 5, run-5 | 1 | Expectativa aria-selected sobre el control Estado no coincidía con el DOM Web. Se verifica la persistencia desde la etiqueta real de la fila reabierta, que anuncia Viendo. |
| 6, run-6 | 0 | Smoke completo, 26 assertions y limpieza exitosa. |

Los directorios run-2 a run-6 conservan failure/console/network/result cuando corresponde; no se borró evidencia de fallos. Un diagnóstico CDP desde sandbox devolvió exit 1 EACCES a localhost; la lectura equivalente fuera del sandbox devolvió 0. Un rg exploratorio con wildcard Windows devolvió un error de ruta y se reemplazó por lectura directa del archivo VFS; no se trató como resultado de test. Sin fallos de producto pendientes encontrados por este smoke.

### Regresiones, limpieza y estado

Se ejecutaron nuevamente **los 23 comandos node de la tabla histórica de este informe**, cada uno exit 0: focused Section 5, Secciones 1–4, TMDB/browsing/credenciales/themes, gates Web/iOS y las dos suites review isolation. La fixture que genera review se preservó/restauró con el wrapper finally ya documentado. Node:sqlite emitió su ExperimentalWarning habitual.

`npx tsc --noEmit`: exit 0, sin diagnósticos. `git diff --check`: exit 0. El runner browser final: exit 0. No se ejecutó la regresión final completa de Sección 7.

Chrome se cerró por Browser.close; taskkill se usó únicamente con los PIDs propios capturados por spawn y su árbol. PIDs de la corrida exitosa: Chrome 29572, Metro producción 14620, Metro review 24256. Comprobación posterior: ninguno existe; no quedan listeners 8135/8105 ni directorio chrome-profile de run-6. Los logs y capturas se conservan fuera del repo; no se alteraron sesiones o procesos ajenos.

Producción permanece **coverPolicy=omit** y Web/iOS mantienen sus gates (iOS: evidencia automatizada, no renderizado físico). No se obtuvo ni afirma aceptación Android/iOS nativa, derechos de arte, cache offline o control de redirects del renderer. No se requieren smokes manuales redundantes para 5.2: las verificaciones pendientes se completaron con ejecución real headless. Solo queda la revisión externa del diff y el checkpoint manual del usuario antes de cualquier continuación a Sección 6.

## Historial anterior — pendientes manuales sustituidos por el smoke anterior

## Continuación del 2026-11-09 — evidencia del usuario y revalidación

Esta continuación encontró 5.1 ya marcada en el árbol y ambos archivos de Sección 5 existentes, aunque el nuevo pedido describía ambas tareas como unchecked. `openspec status --change enable-mangaupdates-cover-images --json` e `openspec instructions apply --change enable-mangaupdates-cover-images --json` confirmaron el cambio ready, esquema spec-driven y progreso 9/14. Se preservó ese estado: no se cambió ningún checkbox en esta continuación; 5.2 sigue sin marcar.

**Inventario exclusivo de esta continuación:** se modificó únicamente este informe. No se crearon archivos ni se modificó el test de Sección 5. Los inventarios y fallos del desarrollo original que figuran más abajo son históricos de la iteración anterior, no cambios ni fallos nuevos. Se releyeron artefactos, tests/reportes previos, el test de integración existente y el arranque/aislamiento de review. No se detectó una carencia material adicional en los casos solicitados que justificara duplicar cobertura de Sección 3 o de la integración ya escrita.

### Evidencia manual recibida, sin repetir el navegador

Fuente: relato explícito del usuario en este chat, recibido el 2026-11-09. Entorno declarado: Chrome/Windows, Web productiva normal, review desactivado. No se aportaron versión exacta de Chrome, origen/puerto ni hora de ejecución; no se infieren. No se capturaron nuevas pantallas ni se invocó navegador, Computer Use o agente gráfico.

El usuario verificó Buscar correctamente renderizado, mensaje de configuración de credencial sin token TMDB y ausencia de categorías MangaUpdates Web. Biblioteca cargó 13 títulos locales existentes; Detalle y Mosaico mostraron los pósteres. El detalle local mostró póster, metadata, puntuación personal, estado, etiquetas y notas. DevTools mostró 13 respuestas WebP HTTP 200, también con emulación Slow 4G. No observó regresión obvia de layout.

Se acepta como **evidencia visual manual parcial de producción**, separada de los stubs. Las respuestas 200 no prueban fallos HTTP/decode, comportamiento offline, redirects ni origen/proveedor de todas las imágenes: no se aportó ese desglose. No prueba ausencia de requests MangaUpdates en todos los tipos de recurso, review isolation en navegador, renderizado nativo ni aceptación Android/iOS. Tampoco demuestra búsqueda TMDB exitosa con credencial: lo probado fue el estado sin token. No se marca 5.2 con esta evidencia parcial.

### Revalidación automatizada de esta continuación

Se ejecutaron nuevamente **todos los 23 comandos `node` de la tabla de comandos de este informe**: cada uno terminó con exit 0. Esto incluye el focused Section 5 sin cambios, Secciones 1–4, mapping/search/detail/credenciales TMDB, browsing/themes, gates Web/iOS y las dos suites de review isolation. La suite de review que genera TEST-section5-review-v6.json se ejecutó con el mismo wrapper PowerShell documentado más abajo, preservando/restaurando sus bytes en finally; exit 0. No hubo fallos intermedios de tests ni correcciones de código en esta continuación.

`npx tsc --noEmit`: exit 0, sin diagnósticos. `git diff --check`: exit 0 antes y después de actualizar el informe. Node emitió el aviso experimental habitual de node:sqlite. El primer batch de descubrimiento terminó con exit 1 porque su último comando `rg --files -g AGENTS.md` no encontró coincidencias; no fue fallo de OpenSpec ni de una suite. Los fallos de harness y no-index descritos posteriormente pertenecen a la iteración anterior y no se repitieron.

Resultados: gates productivos Web/iOS y forbidden-fetch pasan en simulación; producción mantiene omit; review conserva sus dos DBs aisladas y cero init/preferencias/credenciales personales o fetch de catálogo según suites existentes. El test nuevo respecto de Sección 3 sigue aportando composición ejecutable desde pantallas/renderItem hasta pósteres e interacción, pero hooks e Image continúan simulados. No existe evidencia nueva de decodificación real ni de ejecución física nativa por estos tests.

Hashes de package.json y package-lock.json coinciden con los valores registrados al final de este informe. No se modificaron producción, dependencias, allowlist, derechos, SQLite v5, backup v6, canonical/archived specs ni Secciones 6–7; no hubo mutaciones Git.

### Pendiente manual actual, sin repetir el smoke visual ya aportado

El checklist productivo original más abajo queda parcialmente satisfecho por el relato anterior; no se pide repetir las capturas o el recorrido visual ya realizado. Queda inspeccionar Network en **todos** los tipos de recurso (sin filtro exclusivo de imágenes), desde recarga y durante navegación/búsqueda, y confirmar la ruta remota Web bloqueada si todavía no se comprobó. Registrar API MangaUpdates separadamente de URLs históricas/importadas del renderer genérico. No abrir ni descargar arte real como parte del smoke, ni afirmar cero GET posible de una URL local histórica.

Para el smoke separado de review, usar los comandos existentes que se conservan en este informe: detener el Metro productivo con Ctrl+C, cerrar su tab, ejecutar `$env:EXPO_PUBLIC_MEDIA_REVIEW = '1'` y `npx expo start --web --localhost --port 8105`, y abrir manualmente `http://localhost:8105/dev/media-review`. Comprobar TEST, media-review-primary.db/media-review-restore.db, guardar/editar/navegar con el corpus propio y aislamiento de biblioteca personal. No se necesita token TMDB. Al salir, detener Metro, cerrar review y quitar la variable con `Remove-Item Env:EXPO_PUBLIC_MEDIA_REVIEW -ErrorAction SilentlyContinue`; quitar EXPO_OFFLINE si se configuró solo para esa prueba. Reiniciar es necesario para cambiar modo.

**Estado final de la continuación:** 5.1 sigue legítimamente marcada por la cobertura sintética; 5.2 sigue pendiente de review manual y Network completo. Progreso 9/14. Detención en Sección 5, con revisión externa del diff y checkpoint manual antes de continuar.

## Archivos exactos

Creados:

- `docs/testing/mangaupdates-cover-images/section-5-verification.cjs`
- `docs/testing/mangaupdates-cover-images/section-5-validation.md`

Modificado:

- `openspec/changes/enable-mangaupdates-cover-images/tasks.md` — únicamente 5.1.

No se modificó código productivo ni los tests de Secciones 1–4. Se reutilizó sin editar `fixtures/developer-poster.svg`, un dibujo geométrico original existente.

## Entorno, capacidades y separación de evidencia

Windows, PowerShell, Node v22.18.0, TypeScript del proyecto. Se inspeccionaron package.json, los harnesses anteriores, las pantallas y sus bindings existentes, componentes y hook de error, y los informes de Secciones 1–4. No hay renderer Node de React Native, react-test-renderer, jsdom o Playwright entre las dependencias del proyecto. Se reutiliza la técnica existente de transpilar TS/TSX con TypeScript y aislar módulos mediante Module._load, sin instalar dependencias.

Por instrucción del usuario este turno usó solo terminal. **No se invocó Computer Use, no se controló un navegador, no se arrancó un servidor ni se hizo smoke Web.** El arranque y timeout del intento anterior no constituyen evidencia de este turno.

| Tipo de evidencia | Ejecutado y alcance |
| --- | --- |
| Inspección estática | Lectura de artefactos/componentes/contratos; algunas regresiones históricas incluyen assertions de source. No acredita comportamiento visual. |
| Integración ejecutable nueva | Ejecuta las funciones reales de pantallas, hooks, renderItem, navegación y componentes hijos en Node; hooks, vistas nativas, efectos de foco e Image están simulados. No es un renderer de React ni una implementación de FlatList. |
| Eventos Image simulados | URI elegible, onError etiquetado HTTP/red/decode/offline, placeholder y reset. Los nombres de error son entradas del test, no respuestas de red reales. |
| Persistencia real | Suite existente de Sección 4: 18 SQLite aisladas en memoria; review existente: archivos SQLite temporales y DBs en memoria. El test nuevo usa repositorios en memoria/spies, no SQLite. |
| Renderizado/decodificación Web | No ejecutado. Pendiente del usuario. |
| Renderizado nativo / aceptación física Android / iOS | No ejecutado ni afirmado. El branch Android del detalle remoto es una simulación de plataforma. |

Los URLs `https://assets.example.invalid/section5-owned-{a,b}.svg` son claves de un registro de bytes propio del test. A contiene los bytes del SVG existente; B es una variante de color generada en memoria. No son hosts autorizados por el mapper, endpoints ni assets publicados. Image es un stub: el registro verifica asociación con bytes propios, **no decodifica esos bytes**. No se pasó el SVG por la allowlist MangaUpdates, ni se añadió host, ruta productiva, proveedor de imágenes, toggle o downloader.

## Aumento de confianza respecto de Sección 3

Sección 3 llama directamente a DetailPoster/TitleGridCard/celda y verifica parte del wiring de pantallas mediante source. El test nuevo parte de pantallas y datos normalizados: ejecuta búsqueda/debounce/preferencias, toma su FlatList real y llama al renderItem real. Ejecuta recursivamente el árbol resultante, manteniendo hosts de componentes entre cambios de props y remontándolos por keys. Esto comprueba que **las identidades, URLs, estilos y callbacks realmente suministrados por las pantallas** llegan a los componentes probados, sin reconstruir a mano sus props ni usar regex para probar esa integración.

No pretende reimplementar reconciliación React o reciclado nativo: usa un slot de composición controlado para ejercitar A → B → A y callbacks retenidos; keyExtractor se evalúa como función real. Las transiciones de layout se hacen mediante onSelect real de las opciones de la pantalla y se verifica la escritura de preferencia. Solo el shell modal ViewOptionsPanel se sustituye por descriptor: no se valida foco físico de su modal. El foco de las filas se verifica por sus props y la activación por onPress; teclado, screen reader y píxeles quedan para smoke manual.

| Superficie | Evidencia nueva |
| --- | --- |
| Buscar Detalle/Mosaico | Ciclo real query/debounce/capability y cambio de vista; casos movie, tv y manga. Manga se inyecta explícitamente en SearchScreen solo en el proceso de test, sin activar la shell productiva Web. Los diez casos de fila del test (seis de Buscar y cuatro de Biblioteca) ejercitan null, URL elegible, HTTP/red/decode/offline simulados, nueva URL, misma URL/nueva identidad, ABA, callbacks obsoletos, navegación, foco declarado, etiqueta de apertura única y cero writes. |
| Biblioteca Detalle/Mosaico | Pantalla por defecto y snapshots de repositorio en memoria con títulos MangaUpdates/TMDB; filas reales, preferencias reales de pantalla y navegación con ID local/pinContext. Se conserva Leyendo, puntuación TMDB 7.8 y datos personales según tipo. |
| Detalle MangaUpdates remoto | Pantalla real y gate Android existente; cliente de metadata sustituido. El materializador real se llama con omit y se compone una URL propia únicamente en memoria del test. Error visual no guarda ni escribe; guardar explícitamente conserva esa URL en el input y navega al ID local. URL nueva, null y rutas 42 → 43 → 42 ignoran callbacks anteriores. Errores/cambio de URL no refetchean metadata (tres llamadas, una por ruta). Atribución presente, sin voteAverage de MangaUpdates. |
| Detalle local | Pantalla por defecto con repositorio aislado: falla offline simulada sin imagen disponible, metadata/tags/notas/rating siguen presentes, y Leyendo sigue siendo editable. Solo esa edición explícita produce un write; posterUrl no cambia. Rutas ABA y refresh de foco con URL nueva/null llegan al LocalPoster real y descartan callbacks viejos. |
| Collage | TagCollage y sus cuatro celdas reales: dos imágenes/dos placeholders, error aislado de un sibling, cambio URL, reorder y remount ABA completo. Se distingue callback todavía vigente de sibling que solo fue reordenado de callback perteneciente a celda desmontada. Sin writes. |

Se comprueban dimensiones declaradas 80×120/radio10 (Buscar), 70×105/radio12 (Biblioteca), 96×144/radio12 (remoto), 72×108/radio12 (local); grid 2:3/radio14, ancho calculado positivo y póster absoluto; collage 16:9 y celdas 50%×50%. Las imágenes mantienen resizeMode cover y accessible=false. Esto verifica props de layout/crop, no medidas de píxeles en navegador. No hubo cambios de estilos productivos.

Los datos de entrada de filas están congelados recursivamente y se comparan después de errores; los spies comprueban cero escrituras por fallo visual. El detalle local permite una escritura explícita de status y el remoto una de save, diferenciadas de errores. La suite nueva finaliza con **0 intentos de transporte y 0 aperturas de DB personal**. No hay garantía de caché ni disponibilidad offline de imágenes.

## Web/iOS productivos, TMDB y review: automatizado

- Secciones 1–2 mantienen las assertions de omit default/explicit y composición productiva. No se debilitaron para las pruebas de URLs propias.
- `expanded-media-domain/section-8-verification.cjs` prueba gates finitos Web/iOS, resolución de categorías y loaders con cliente que falla si se alcanza; `section-8-ui-verification.cjs` y cover Section 2 prueban rutas deshabilitadas sin llamada al detalle. `section-6-verification.cjs` prueba transportes deterministas y forbidden-fetch/plataformas. Todo pasó sin HTTP real.
- TMDB mapping, búsqueda movie/tv, lifecycle, detalle/SQLite save y credenciales pasaron. Los resultados de red TMDB son stubs; no se verificó una credencial real en navegador en este turno. El estado real de credencial debe registrarlo el usuario sin compartir su valor.
- Review isolation: las suites existentes prueban flag exacto + dev, producción fuera de opt-in, dos nombres de DB aislados, shared save/edit/pins/backup/reopen/reset y cero init/preferencias/credenciales personales o fetch de catálogo. La suite de UI sigue siendo hook-host; la de persistencia usa SQLite real.
- No se infiere que ningún GET pueda originarse de una URL local/importada histórica. Los renderers genéricos conservan ese contrato; los gates bloquean API MangaUpdates y nueva composición remota, no purgan URLs ni caché histórica. No se solicitó ninguna URL histórica o arte real en estas pruebas.

## Comandos ejecutados y exit codes

Desde `D:/dev/despues-la-veo`. Las **23 suites** siguientes terminaron con **exit 0**, sin cambios a tests anteriores:

| Comando exacto | Exit final |
| --- | --- |
| `node docs/testing/mangaupdates-cover-images/section-5-verification.cjs` | 0 |
| `node docs/testing/mangaupdates-cover-images/section-1-verification.cjs` | 0 |
| `node docs/testing/mangaupdates-cover-images/section-2-verification.cjs` | 0 |
| `node docs/testing/mangaupdates-cover-images/section-3-verification.cjs` | 0 |
| `node docs/testing/mangaupdates-cover-images/section-4-verification.cjs` | 0 |
| `node docs/testing/provider-abstraction/section-2-tmdb-mapping-verification.cjs` | 0 |
| `node docs/testing/provider-abstraction/section-3-buscar-verification.cjs` | 0 |
| `node docs/testing/provider-abstraction/section-5-detail-verification.cjs` | 0 |
| `node docs/testing/expanded-media-domain/section-3-ui-verification.cjs` | 0 |
| `node docs/testing/expanded-media-domain/section-4-verification.cjs` | 0 |
| `node docs/testing/expanded-media-domain/section-6-verification.cjs` | 0 |
| `node docs/testing/expanded-media-domain/section-8-verification.cjs` | 0 |
| `node docs/testing/expanded-media-domain/section-8-ui-verification.cjs` | 0 |
| `node docs/testing/expanded-media-domain/section-5-verification.cjs` | 0 |
| `node docs/testing/expanded-media-domain/section-5-ui-verification.cjs` | 0 |
| `node docs/testing/tmdb-user-credential/section-1-verification.cjs` | 0 |
| `node docs/testing/tmdb-user-credential/section-2-verification.cjs` | 0 |
| `node docs/testing/tmdb-user-credential/section-3-verification.cjs` | 0 |
| `node docs/testing/tmdb-user-credential/section-4-verification.cjs` | 0 |
| `node docs/testing/tmdb-user-credential/section-5-verification.cjs` | 0 |
| `node docs/testing/global-appearance-themes/section-5-verification.cjs` | 0 |
| `node docs/testing/global-appearance-themes/section-7-verification.cjs` | 0 |
| `node docs/testing/global-appearance-themes/section-8-verification.cjs` | 0 |
| `npx tsc --noEmit` | 0, sin diagnósticos |
| `git diff --check` | 0 |
| `openspec status --change enable-mangaupdates-cover-images --json` | 0 |
| `openspec instructions apply --change enable-mangaupdates-cover-images --json` | 0, ready; inicio 8/14 |

La suite review de persistencia escribe su fixture TEST existente. Se conservaron sus bytes previos y se restauraron en finally sin Git, con el comando exacto siguiente (exit 0):

```powershell
$reviewFixturePath = Join-Path (Get-Location) 'docs/testing/expanded-media-domain/TEST-section5-review-v6.json'
$reviewFixtureBefore = [System.IO.File]::ReadAllBytes($reviewFixturePath)
try {
  node docs/testing/expanded-media-domain/section-5-verification.cjs
  $reviewTestExit = $LASTEXITCODE
} finally {
  [System.IO.File]::WriteAllBytes($reviewFixturePath, $reviewFixtureBefore)
}
exit $reviewTestExit
```

Fallos intermedios del comando `node docs/testing/mangaupdates-cover-images/section-5-verification.cjs`, todos **exit 1**, corregidos en el test nuevo sin tocar producción:

1. `ERR_MODULE_NOT_FOUND` ExpoSecureStore: importar el adapter TMDB alcanzaba su cliente nativo. Se aisló tmdbClient con un transporte que lanza y cuenta intentos, manteniendo el adapter y capabilities inyectadas. No se carga SecureStore.
2. Selector de activación esperaba `Abrir Owned`; la etiqueta real incluye tipo (`Abrir Película Owned`). Se corrigió el selector conservando assertions de rol/foco y anuncio único.
3. Notas se buscaron como Text; son el valor de TextInput multiline. Se verifica ese valor real.
4. Expectativa incorrecta del test sobre reorder del collage: una celda B con key estable sigue montada, por lo que su callback sigue vigente. Se corrigió para verificar ese comportamiento y se añadió reemplazo completo A/B → C/D → A/B para probar callbacks desmontados.

Las ejecuciones posteriores y la corrida de regresión terminaron en 0. Node emitió `ExperimentalWarning` de node:sqlite en las suites que lo usan; no es un fallo. Una lectura inicial PowerShell con Get-Content sobre `[id].tsx` produjo errores no terminantes por wildcard (el batch devolvió 0); se repitió correctamente con `Get-Content -LiteralPath`. No se considera esa primera lectura evidencia de inspección exitosa.

Al cierre se repitieron el test focalizado, TypeScript, diff-check y apply instructions: exit 0, progreso confirmado 9/14. Como los archivos nuevos todavía no están tracked, se comprobaron además con `git diff --no-index --check -- NUL docs/testing/mangaupdates-cover-images/section-5-verification.cjs` y el mismo comando para `section-5-validation.md`: ambos exit 1 por diferencia respecto de NUL (no-index implica exit-code), sin diagnósticos de whitespace; Git avisó que LF será convertido a CRLF cuando toque esos archivos. No se modificó configuración Git ni se normalizaron archivos personales.

## Smoke manual pendiente para 5.2 — comandos existentes

Estos comandos **no se ejecutaron en este turno**. Proceden de `docs/testing/expanded-media-domain/section-9-1-validation.md` (producción port 8111) y `section-5-validation.md` (review port 8105). La opción EXPO_OFFLINE ya documentada solo suprime checks de red del CLI; no simula respuestas ni pone offline la aplicación.

Producción, PowerShell desde el repo:

```powershell
Remove-Item Env:EXPO_PUBLIC_MEDIA_REVIEW -ErrorAction SilentlyContinue
$env:EXPO_OFFLINE = '1'
npx expo start --web --localhost --port 8111
```

Abrir manualmente `http://localhost:8111/buscar` en un origen de prueba, sin importar fixtures en la biblioteca personal. Verificar:

1. Tabs normales y ausencia de banner TEST; Buscar solo Películas/Series. Escribir una consulta y cambiar categoría. Si no hay credencial configurada, registrar el estado y CTA reales; no publicar el token. Si ya hay credencial disponible, comprobar búsqueda normal TMDB y apertura de detalle, imágenes/placeholder y navegación.
2. Revisar Detalle/Mosaico y Biblioteca/Etiquetas existentes, dimensiones/crop, placeholders, foco de teclado y nombres accesibles. Si no hay datos guardados, registrar esa limitación sin afirmar un smoke poblado.
3. Visitar manualmente `http://localhost:8111/mangaupdates/series/42`: debe mostrar plataforma no habilitada, sin API MangaUpdates ni controles para guardar remotamente. No hay nuevas categorías manga/manhwa/manhua productivas Web.
4. Con Network abierto desde antes de recargar, conservar evidencia de navegación/búsqueda/detalle: ninguna petición API MangaUpdates ni nueva imagen MangaUpdates generada por composición productiva. No abrir ni descargar artwork real para probarlo. Si existen URLs importadas históricas, distinguir su origen: el renderer genérico puede intentar cargarlas bajo el contrato previo; no afirmar cero GET de todo URL local.

Detener Metro con Ctrl+C y cerrar el tab productivo antes de review. En una terminal separada/reiniciada:

```powershell
$env:EXPO_PUBLIC_MEDIA_REVIEW = '1'
npx expo start --web --localhost --port 8105
```

Abrir manualmente `http://localhost:8105/dev/media-review`. Verificar banner TEST, corpus original, nombres `media-review-primary.db`/`media-review-restore.db` y exclusión de DB personal. Ejercitar solo el flujo existente: sembrar/guardar obra propia, Biblioteca Detalle/Mosaico y detalle local, editar, navegar y comprobar aislamiento. No es catálogo MangaUpdates ni smoke de disponibilidad remota. El corpus de review no se modificó para añadir portadas; su placeholder no acredita decodificación de imágenes.

Salir con Ctrl+C, cerrar tab/app review y restaurar entorno conforme a la documentación:

```powershell
Remove-Item Env:EXPO_PUBLIC_MEDIA_REVIEW -ErrorAction SilentlyContinue
Remove-Item Env:EXPO_OFFLINE -ErrorAction SilentlyContinue
```

Enviar resultados con fecha, navegador/versión, comandos y modo/origen, estado de credencial sin valor, pantallas/acciones observadas, evidencia de Network y cualquier error/limitación. **5.2 permanece sin marcar hasta evaluar esa evidencia.** No requiere ni acredita iOS físico o imágenes Android nativas.

## Invariantes y cierre de esta sección

Producción MangaUpdates sigue **omit** explícito en búsqueda y las dos materializaciones de detalle; defaults siguen omit. No se cambió política/host/rights, gate Web/iOS, SQLite v5, backup v6, dependencias, canonical specs, archivos archivados, scripts ni lockfiles. No se agregó infraestructura o arte real. No se contactó al proveedor.

La modificación personal inicial de package.json se conservó: SHA256 antes/después `262E90681FAFF16686F79D3F14CE6A6CAE158442D432038F31616B4E2E990C78`. package-lock.json antes/después: `7EB6A96DF94D78B76C89A3E0B305AD95E1316DD91D7BB0B7B18DC4B13F3EED05`. Git se usó solo para status/diff/diff --check; sin staging, commit, push ni cambio de branch.

5.1 se marca porque la composición sintética automatizada solicitada pasa en todas las superficies y registra con precisión los límites de carga/error/offline simulados. No equivale a aceptación visual Web o nativa. Pendientes: 5.2 y todas las tareas 6.1/6.2/7.1/7.2. Se detiene aquí, sin archive/sync ni avance a Sección 6.
