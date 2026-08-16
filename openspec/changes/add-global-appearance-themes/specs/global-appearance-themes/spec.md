## Purpose

Permitir que cada persona elija una apariencia global, accesible, reactiva y local-first que se aplique coherentemente en Android, iOS y web sin alterar el comportamiento funcional de la aplicación.

## ADDED Requirements

### Requirement: Appearance combina scheme y palette independientes

El sistema MUST representar Appearance mediante un `scheme` elegido entre `system`, `light` y `dark`, y una `palette` elegida entre Original, Manzana verde, Marea, Crepúsculo de medianoche, Lavanda y Obsidiana. La palette seleccionada MUST permanecer igual cuando cambie el scheme y cada combinación MUST conservar la luminosidad correspondiente al scheme efectivo.

#### Scenario: cambio de scheme conserva palette
- **GIVEN** una Appearance con palette Lavanda
- **WHEN** el usuario cambia de Oscuro a Claro
- **THEN** la aplicación usa la variante clara de Lavanda
- **AND** la palette persistida continúa siendo Lavanda

#### Scenario: Obsidiana respeta scheme claro
- **WHEN** el usuario combina Claro con Obsidiana
- **THEN** obtiene una apariencia clara monocromática
- **AND** Obsidiana no convierte el scheme efectivo en oscuro

#### Scenario: no existe pure black independiente
- **WHEN** el usuario revisa las opciones de Appearance
- **THEN** no se ofrece una preferencia `pure black` separada
- **AND** la personalidad negra o charcoal queda representada por Obsidiana

### Requirement: el valor predeterminado preserva la apariencia dark actual

El sistema MUST usar `dark + original` ante una instalación nueva, una actualización sin Appearance guardada o una preference ausente o inválida. Esa combinación MUST preservar prácticamente exactos los colores, overlays, rating badges, pin, navegación y branding de la baseline dark existente salvo correcciones aprobadas por separado.

#### Scenario: usuario existente sin Appearance
- **WHEN** un usuario actualiza desde una versión que no guardaba Appearance
- **THEN** la aplicación usa Oscuro + Original
- **AND** no cambia perceptiblemente el look dark previo

#### Scenario: preference inválida
- **WHEN** la Appearance persistida tiene un scheme, palette o estructura desconocidos
- **THEN** la aplicación usa Oscuro + Original de forma segura
- **AND** los títulos y las preferencias de browsing permanecen intactos

### Requirement: System sigue cambios del runtime

Cuando la preference de scheme sea `system`, el sistema MUST seguir reactivamente el scheme del sistema operativo o navegador y MUST NOT reescribir la preference ni la palette al cambiar la luminosidad del entorno.

#### Scenario: cambio runtime de oscuro a claro
- **GIVEN** `scheme: system`, palette Marea y un sistema inicialmente oscuro
- **WHEN** el sistema cambia a claro mientras la aplicación está abierta
- **THEN** toda la aplicación cambia a la variante clara de Marea
- **AND** la preference sigue siendo `scheme: system`, palette Marea

#### Scenario: scheme explícito ignora cambio del sistema
- **GIVEN** `scheme: dark`
- **WHEN** el sistema operativo cambia a claro
- **THEN** la aplicación permanece oscura

### Requirement: el theme efectivo se aplica globalmente y en runtime

El sistema MUST aplicar una única definición efectiva y completa a backgrounds, surfaces, inputs, text, borders, selections, accent, Stack, Tabs, headers, StatusBar, Settings, componentes compartidos, screens y superficies web. Un cambio de scheme o palette MUST actualizar estas superficies como una sola transición observable sin colores anteriores capturados.

#### Scenario: cambio inmediato de palette
- **WHEN** el usuario selecciona Manzana verde
- **THEN** navegación, selección, acciones, screens y componentes visibles adoptan inmediatamente sus tokens efectivos
- **AND** no quedan headers, tabs, cards ni inputs con la palette anterior

#### Scenario: StatusBar acompaña luminosidad
- **WHEN** cambia el scheme efectivo entre oscuro y claro
- **THEN** el contenido de StatusBar adopta el contraste apropiado para el nuevo theme

#### Scenario: browsing permanece independiente
- **WHEN** cambia Appearance global
- **THEN** las elecciones Detalle/Mosaico y los órdenes de Biblioteca, Buscar y Etiquetas no cambian

### Requirement: accent y selección mantienen roles semánticos

El sistema MUST usar accent para identidad e interacción activa y MUST proporcionar un foreground contrastante que no se presuma siempre blanco. Las selecciones MUST poder distinguir surface y border seleccionados del accent fuerte, y el accent MUST NOT reemplazar indiscriminadamente todos los fondos, bordes o textos.

#### Scenario: acción sobre accent
- **WHEN** una acción primaria usa el accent de la palette
- **THEN** su contenido usa un foreground contrastante definido por el mismo theme

#### Scenario: elemento seleccionado
- **WHEN** una opción queda seleccionada
- **THEN** presenta estado visual de selección coherente
- **AND** mantiene una señal no basada únicamente en el color

### Requirement: estados semánticos permanecen independientes de palettes

El sistema MUST conservar significados propios para danger/error/destructive, disabled y PersonalRating low, medium y high. Las palettes MUST NOT reasignar esos significados, aunque el scheme pueda proporcionar variantes contrastantes. PersonalRating MUST conservar los rangos `10..74 low`, `75..84 medium` y `85..100 high` y MUST seguir comunicándose además del color.

#### Scenario: rating high bajo Lavanda
- **WHEN** una puntuación personal entre 85 y 100 se muestra con palette Lavanda
- **THEN** conserva el significado high y su valor numérico accesible
- **AND** no se convierte en un estado violeta por identidad de palette

#### Scenario: danger bajo Marea
- **WHEN** se muestra una acción destructiva con palette Marea
- **THEN** conserva semántica de danger/error
- **AND** no se representa como azul sólo por la palette

### Requirement: overlays y branding conservan responsabilidades propias

El sistema MUST mantener separados del theme global los scrims, foregrounds y borders necesarios para legibilidad sobre posters arbitrarios. El pin contextual MUST seguir siendo un diamond-outline pasivo top-right y MUST coexistir sin solaparse con el rating. El sistema MUST renderizar el logo oficial TMDB actual sin tint ni filtros y MUST preservar exactamente el notice TMDB y la atribución JustWatch existentes de forma legible en todos los themes.

#### Scenario: poster en theme claro
- **WHEN** una TitleGridCard se muestra bajo un theme claro
- **THEN** sus overlays pueden permanecer oscuros para mantener legibilidad
- **AND** el pin sigue visible, pasivo y sin cambiar contextual pinning

#### Scenario: créditos bajo cualquier theme
- **WHEN** se abre About/Créditos con cualquier combinación soportada
- **THEN** el logo `tmdb-primary-full-blue.png` se muestra sin recolorear
- **AND** se lee exactamente `This product uses the TMDB API but is not endorsed or certified by TMDB.`
- **AND** se lee exactamente `Los datos de disponibilidad en streaming, alquiler y compra son provistos por JustWatch a través de TMDB.`

### Requirement: Appearance se persiste con última intención y error recuperable

El sistema MUST persistir scheme y palette como una sola intención local independiente de TMDB, red, cuentas y browsing preferences. La coordinación MUST distinguir la intención más reciente mostrada de `confirmedPersisted`, entendido como el último valor que se sabe realmente escrito. Cada write exitoso MUST actualizar `confirmedPersisted` al valor escrito aunque su intención ya haya sido superseded, pero MUST NOT reemplazar la UI si existe una intención posterior. Si el write de la intención más reciente falla, la UI MUST volver exactamente a `confirmedPersisted`, informar el error y no afectar la biblioteca. Los writes de Appearance MUST componerse de forma serializada con las demás mutaciones SQLite públicas sin anidar la serialización ni la transacción.

#### Scenario: reinicio conserva Appearance
- **WHEN** el usuario selecciona Claro + Crepúsculo de medianoche y reinicia la aplicación
- **THEN** se recupera la misma combinación

#### Scenario: selecciones rápidas
- **WHEN** el usuario elige palette A y luego palette B antes de terminar el primer guardado
- **THEN** la UI y el almacenamiento terminan representando palette B
- **AND** una finalización tardía de A no sobrescribe B

#### Scenario: éxito superseded seguido por fallo latest
- **GIVEN** `confirmedPersisted` es C
- **WHEN** el usuario selecciona A, luego B, el write de A termina exitosamente y el write de B falla
- **THEN** el éxito de A actualiza `confirmedPersisted` a A
- **AND** mientras B está pendiente la UI continúa mostrando B
- **AND** al fallar B la UI vuelve exactamente a A
- **AND** storage, `confirmedPersisted` y la Appearance recuperada al reiniciar son A

#### Scenario: intención superseded coalesced antes del write
- **GIVEN** `confirmedPersisted` es C
- **WHEN** A es superseded por B y se descarta antes de escribir A
- **THEN** `confirmedPersisted` permanece C hasta que algún write termina exitosamente

#### Scenario: fallo al persistir
- **WHEN** falla el guardado de una nueva Appearance
- **THEN** la aplicación restaura la última Appearance realmente confirmada como persistida
- **AND** informa que la elección no quedó guardada
- **AND** no modifica títulos, pins, ratings ni otras preferences

#### Scenario: rechazo de write no rompe mutaciones posteriores
- **WHEN** un write de Appearance falla dentro de la serialización de storage
- **THEN** la operación informa el fallo y conserva el valor realmente persistido
- **AND** la queue continúa aceptando writes posteriores de Appearance y otras mutaciones del producto

#### Scenario: import diferido no pisa selección posterior
- **GIVEN** el usuario confirma un backup cuya Appearance es A
- **WHEN** la restauración de items/pins queda pendiente, el usuario selecciona B y luego la restauración termina exitosamente
- **THEN** la restauración de biblioteca/pins conserva su resultado exitoso
- **AND** la Appearance final mostrada, persistida y recuperada al reiniciar es B
- **AND** A no se convierte artificialmente en la intención más reciente por terminar tarde el merge

### Requirement: hidratación evita un primer paint principal incorrecto

El sistema MUST usar Oscuro + Original como bootstrap canónico y MUST retener brevemente la UI principal hasta resolver la Appearance local. La hidratación MUST NOT esperar TMDB ni red; ante error de storage MUST desbloquear la app con fallback seguro y una vía recuperable.

#### Scenario: preference clara almacenada
- **GIVEN** Claro + Marea almacenado
- **WHEN** inicia la aplicación
- **THEN** usa Oscuro + Original sólo como bootstrap breve
- **AND** publica Claro + Marea antes de mostrar la UI principal

#### Scenario: storage no disponible
- **WHEN** la lectura de Appearance falla
- **THEN** la aplicación se desbloquea con Oscuro + Original
- **AND** la biblioteca local continúa utilizable
- **AND** el problema puede comunicarse o reintentarse sin esperar red

#### Scenario: retry stale no pisa un write posterior
- **GIVEN** la lectura inicial falló y un retry comenzó a leer una Appearance antigua A
- **WHEN** durante el retry el usuario selecciona B, el write de B termina exitosamente y después llega el resultado A
- **THEN** el resultado stale A se descarta
- **AND** `displayed`, `confirmedPersisted`, storage y la Appearance recuperada al reiniciar permanecen B

#### Scenario: retry stale después de fallo de una intención nueva
- **GIVEN** un retry está pendiente
- **WHEN** comienza una intención posterior, su write falla y luego llega el resultado viejo del retry
- **THEN** la UI se reconcilia contra el `confirmedPersisted` realmente vigente
- **AND** el resultado viejo del retry no reemplaza esa verdad persistida

### Requirement: Settings permite elegir sin botón Aplicar

El sistema MUST ofrecer `/settings/appearance` como screen normal de Stack accesible desde Ajustes, con selector `Del sistema | Claro | Oscuro` y previews de todas las palettes. Cada selección MUST aplicarse y persistirse automáticamente, sin botón Aplicar.

#### Scenario: selección accesible de palette
- **WHEN** una palette está seleccionada
- **THEN** se distingue mediante label, check o icono y borde o indicador visual
- **AND** expone estado selected a tecnologías de asistencia
- **AND** puede operarse mediante teclado y focus visible en web

#### Scenario: preview fiel
- **WHEN** se muestran previews de palettes
- **THEN** cada preview representa background, surfaces, text, accent y border o selection de la misma definición real que usaría la aplicación
- **AND** no usa un segundo catálogo de colores sólo para previews

#### Scenario: layout responsive
- **WHEN** la pantalla se muestra en móvil
- **THEN** las palettes pueden recorrerse horizontalmente
- **WHEN** se muestra en un viewport ancho
- **THEN** aprovecha el espacio disponible sin quedar forzada a una tira angosta

### Requirement: web permanece sincronizada y accesible

El sistema MUST mantener `html`, `body`, root, background del browser, scrollbars y color-scheme coherentes con el theme efectivo, MUST reaccionar al scheme del navegador cuando la preference sea System y MUST mantener focus visible y operación por teclado. Esta sincronización MUST usar los valores efectivos de la aplicación y no un catálogo CSS independiente.

#### Scenario: reload web con preference persistida
- **WHEN** la web recarga con una Appearance guardada
- **THEN** puede mostrar brevemente el bootstrap Oscuro + Original
- **AND** después de hidratar React y las superficies DOM/browser comparten el theme efectivo

#### Scenario: system cambia en web
- **GIVEN** scheme Del sistema
- **WHEN** cambia `prefers-color-scheme` durante la sesión
- **THEN** React, DOM, scrollbars y browser color-scheme se actualizan coherentemente

### Requirement: todas las combinaciones mantienen accesibilidad funcional

El sistema MUST mantener contraste y señales adicionales al color para selected/unselected, tabs activas/inactivas, buttons, disabled, danger/error, links, rating, pin, inputs/placeholders, scheme/palette selection y focus web en todas las combinaciones soportadas.

#### Scenario: validación de catálogo completo
- **WHEN** se valida una release con Light y Dark para las seis palettes
- **THEN** se revisan contraste, legibilidad, focus y señales no cromáticas de los estados críticos
- **AND** ninguna combinación se publica si vuelve ilegible una superficie requerida
