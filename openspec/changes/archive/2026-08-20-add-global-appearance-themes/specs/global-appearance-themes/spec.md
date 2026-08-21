## Purpose

Permitir que cada persona elija una apariencia global, accesible, reactiva y local-first que se aplique coherentemente en Android, iOS y web sin alterar el comportamiento funcional de la aplicación.

## ADDED Requirements

### Requirement: Appearance combina scheme y palette independientes

El sistema MUST representar Appearance mediante un `scheme` elegido entre `system`, `light` y `dark`, y una `palette` elegida entre Original, Manzana verde, Marea, Crepúsculo de medianoche, Lavanda, Obsidiana y Pinky Clouds. Los IDs estables y su orden de catálogo MUST ser `original`, `green-apple`, `tide`, `midnight-twilight`, `lavender`, `obsidian`, `pinky-clouds`. La palette seleccionada MUST permanecer igual cuando cambie el scheme y cada combinación MUST conservar la luminosidad correspondiente al scheme efectivo. El catálogo final de esta feature MUST resolver exactamente 2 × 7 = 14 `ThemeDefinition`; Pinky Clouds es la última ampliación de producto autorizada dentro de este change.

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

#### Scenario: Pinky Clouds pertenece al mismo resolver
- **WHEN** se resuelve `pinky-clouds` bajo Light o Dark
- **THEN** el resolver compone la misma base del scheme más overrides parciales autorizados
- **AND** devuelve una `ThemeDefinition` completa sin agregar tokens
- **AND** ningún screen o componente necesita un branch por palette

### Requirement: Pinky Clouds tiene identidad rosa global con valores exactos

Pinky Clouds MUST teñir perceptiblemente la masa visual formada por `background`, `surface`, `surfaceSecondary` e `inputBackground`, además de accent, selection y borders. MUST NOT equivaler a Original con botones rosas, MUST mantener cards claramente pink-tinted y MUST conservar Dark como una experiencia oscura berry/plum, no como una pantalla rosa brillante. Sus overrides exactos MUST ser los definidos a continuación; la implementación MUST NOT recalcularlos ni diferirlos a revisión visual.

#### Scenario: Pinky Clouds Light exacta
- **WHEN** se resuelve Light + Pinky Clouds
- **THEN** los overrides globales son `background #FFF3F9`, `surface #FFE4F1`, `surfaceSecondary #FFCEE7`, `inputBackground #FFF7FB`, `textMuted #6B4F5D`, `border #FDA6D2`, `borderStrong #B24A7D`, `accent #AA4275`, `onAccent #FFFFFF`, `selectedSurface #FDA6D2`, `selectedForeground #5A1838` y `selectedBorder #DB5A7B`
- **AND** `textPrimary` y `textSecondary` heredan de `LightBase`
- **AND** `accent/surface` mide `4.7044:1`, `onAccent/accent` mide `5.6069:1`, `selectedForeground/selectedSurface` mide `7.1259:1` y `borderStrong/surface` mide `4.2267:1`

#### Scenario: Pinky Clouds Dark exacta
- **WHEN** se resuelve Dark + Pinky Clouds
- **THEN** los overrides globales son `background #160B12`, `surface #211019`, `surfaceSecondary #321624`, `inputBackground #28111D`, `border #55263D`, `borderStrong #8D5A70`, `accent #FD7690`, `onAccent #211019`, `selectedSurface #5C2440`, `selectedForeground #F2F2F2` y `selectedBorder #DB5A7B`
- **AND** los tokens de texto no enumerados heredan de `DarkBase`
- **AND** `accent/surface` mide `7.0875:1`, `onAccent/accent` mide `7.0875:1`, `selectedForeground/selectedSurface` mide `10.5299:1` y `borderStrong/surface` mide `3.3214:1`

#### Scenario: anchors e identidad no se diluyen
- **WHEN** se inspeccionan los overrides Pinky Clouds
- **THEN** Deep `#B24A7D`, Medium `#DB5A7B`, Vivid `#FD7690`, Soft `#FDA6D2` y Cloud `#FFCEE7` permanecen usados literalmente
- **AND** `#AA4275` y los tonos adicionales conservan la familia pink/magenta como derivaciones aprobadas para contraste, Light tint o Dark plum/berry
- **AND** Pinky Clouds no comparte accidentalmente la definición completa de otra palette ni modifica Original u Obsidiana

#### Scenario: semantic y structural permanecen palette-independent
- **WHEN** se resuelve Pinky Clouds bajo cualquiera de los dos schemes
- **THEN** no overridea `dangerSurface`, `dangerBorder`, `dangerText`, `onDangerSurface`, `disabledSurface`, `disabledText`, `personalRatingLow*`, `personalRatingMedium*`, `personalRatingHigh*`, `personalRatingErrorText`, `imageOverlay*`, `onImageOverlay*` ni `imageOverlayBorder`
- **AND** esos grupos conservan los mismos valores scheme-aware y las mismas responsabilidades auditadas que las otras palettes

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

Cuando la preference de scheme sea `system`, el sistema MUST seguir reactivamente el scheme del sistema operativo o navegador y MUST NOT reescribir la preference ni la palette al cambiar la luminosidad del entorno. En Android native con Expo SDK 54, la integración MUST usar `userInterfaceStyle: "automatic"` y la versión compatible de `expo-system-ui`, incluido su config plugin cuando la configuración Expo/CNG real lo requiera. `useColorScheme` MUST continuar como fuente runtime React; `expo-system-ui` MUST limitarse a habilitar/configurar la integración native y MUST NOT introducir un segundo estado de theme.

#### Scenario: cambio runtime de oscuro a claro
- **GIVEN** `scheme: system`, palette Marea y un sistema inicialmente oscuro
- **WHEN** el sistema cambia a claro mientras la aplicación está abierta
- **THEN** toda la aplicación cambia a la variante clara de Marea
- **AND** la preference sigue siendo `scheme: system`, palette Marea

#### Scenario: scheme explícito ignora cambio del sistema
- **GIVEN** `scheme: dark`
- **WHEN** el sistema operativo cambia a claro
- **THEN** la aplicación permanece oscura

#### Scenario: integración Android native habilita System real
- **GIVEN** una build Android generada con Expo SDK 54, `userInterfaceStyle: "automatic"` y `expo-system-ui` compatible
- **WHEN** la configuración Expo/CNG se inspecciona y el dispositivo cambia entre claro y oscuro
- **THEN** la configuración native resultante permite que `useColorScheme` observe el cambio real
- **AND** la preference persistida continúa siendo `scheme: system` con la misma palette
- **AND** SystemUI no mantiene ni persiste una copia paralela de Appearance

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

El sistema MUST usar accent para identidad e interacción activa y MUST proporcionar un `onAccent` contrastante que no se presuma siempre blanco. Las selecciones MUST resolver explícitamente el trío palette-overridable `selectedSurface`, `selectedForeground` y `selectedBorder`; `textPrimary` y `onAccent` MUST NOT asumirse como foreground de una selección. Las selecciones MUST poder distinguir surface y border seleccionados del accent fuerte, y el accent MUST NOT reemplazar indiscriminadamente todos los fondos, bordes o textos. Dark + Original MUST conservar `selectedSurface: #ffffff`, `selectedForeground: #0b0b0b` y `selectedBorder: #ffffff`.

#### Scenario: acción sobre accent
- **WHEN** una acción primaria usa el accent de la palette
- **THEN** su contenido usa un foreground contrastante definido por el mismo theme

#### Scenario: elemento seleccionado
- **WHEN** una opción queda seleccionada
- **THEN** presenta contenido con `selectedForeground` contrastante sobre `selectedSurface`
- **AND** delimita la selección con `selectedBorder`
- **AND** mantiene una señal no basada únicamente en el color

#### Scenario: selección no reutiliza foregrounds incompatibles
- **GIVEN** una palette donde `selectedSurface` difiere de `accent`
- **WHEN** se renderiza contenido sobre la selección
- **THEN** usa el `selectedForeground` resuelto por esa palette
- **AND** no reutiliza automáticamente `textPrimary` ni `onAccent`

### Requirement: borderStrong delimita controles funcionales con contraste no textual

El token global y palette-overridable `borderStrong` MUST proporcionar una boundary visual funcional de al menos `3.0:1` respecto de cada surface relevante cuando delimita inputs o controles cuyo `inputBackground` no se distingue suficientemente por sí mismo. La auditoría histórica 2×6 y sus valores anteriores permanecen documentados en Design; la regresión final MUST usar las 14 `ThemeDefinition` actuales, incluidos los ajustes visuales manuales posteriores. Manzana verde Light MUST conservar su valor intencional `#5a7b5a` sobre `surface/inputBackground #f6f9f6` (`4.4841:1`). Las únicas correcciones posteriores a ese estado manual son Manzana verde Dark `#202920 → #646464` sobre `surface #0b0f09`/`inputBackground #0a0f08` (`3.2662:1`/`3.2715:1`), Marea Dark `#304144 → #4f6c72` sobre `#0b1518`/`#0a1618` (`3.2788:1`/`3.2611:1`) y Crepúsculo de medianoche Dark `#454864 → #606485` sobre `#0e0f20`/`#0d0f21` (`3.3027:1`/`3.3041:1`). Marea Light conserva `#769595` sobre `#fbffff` (`3.2061:1`) y Crepúsculo Light conserva `#9289af` sobre su surface/input final `#fcfbff` (`3.1750:1`). Original, Lavanda, Obsidiana y Pinky Clouds conservan sus valores vigentes. Consumers MUST seguir usando `theme.global.borderStrong` sin branches ni literals propios. El token `border` MUST conservar su responsabilidad de separación sutil/decorativa y no hereda automáticamente el requisito `3:1`; ninguna surface/input se cambia para obtener contraste y no se agrega un token específico de input.

#### Scenario: input necesita una boundary identificable
- **GIVEN** un input cuyo background es cercano a la surface circundante
- **WHEN** el consumer usa `theme.global.borderStrong`
- **THEN** el borde resuelto alcanza al menos `3.0:1` respecto de esa surface
- **AND** conserva la personalidad cromática de la palette sin convertirse en accent

#### Scenario: audit de consumers de borderStrong
- **WHEN** Section 12 fortalece `borderStrong`
- **THEN** inventaría y clasifica todos sus consumers reales
- **AND** confirma que corresponden a una strong boundary
- **AND** si alguno depende deliberadamente de ser sutil, detiene la implementación antes de cambiar valores o crear tokens

#### Scenario: border decorativo permanece separado
- **WHEN** una separación es sutil o decorativa y no resulta necesaria para identificar un control
- **THEN** puede continuar usando `border`
- **AND** no se exige automáticamente contraste `3:1` a todos los borders del producto

### Requirement: textMuted conserva contraste normal en sus backgrounds reales

El token global, scheme-aware y palette-overridable `textMuted` MUST mantener su responsabilidad de texto auxiliar neutro y menos prominente que `textSecondary`/`textPrimary`, pero MUST alcanzar `4.5:1` cuando se usa como texto normal sobre cada background real del consumer. Light + Crepúsculo de medianoche MUST resolver exclusivamente su override Light a `#6e6e6e` en lugar del heredado `#707070`: el finding histórico `#707070` sobre el entonces-current `background #f4f3fa` (`4.4917:1`) permanece como evidencia, mientras que sobre las surfaces finales ajustadas por el usuario `#6e6e6e` alcanza `4.6718:1` en `background #f5f4fd` y `4.9488:1` en `surface #fcfbff` e `inputBackground #fcfbff`. LightBase, las demás palettes Light y todos los valores Dark MUST permanecer intactos. Consumers MUST continuar usando `theme.global.textMuted`, sin branches, literals ni tokens adicionales.

#### Scenario: texto auxiliar sobre background Midnight Light
- **GIVEN** Light + Crepúsculo de medianoche
- **AND** un texto auxiliar normal sobre el `background` final `#f5f4fd`
- **WHEN** el consumer usa `theme.global.textMuted`
- **THEN** resuelve `#6e6e6e`
- **AND** alcanza aproximadamente `4.6718:1`

#### Scenario: textMuted se valida sólo contra backgrounds reales
- **WHEN** Section 12 inventaría consumers de `textMuted`
- **THEN** valida `#6e6e6e` sobre `background #f5f4fd`, `surface #fcfbff` e `inputBackground #fcfbff`
- **AND** todos alcanzan al menos `4.5:1`
- **AND** no convierte el pair sintético `textMuted/surfaceSecondary` en un cambio sin un consumer real

#### Scenario: corrección permanece local a la palette
- **WHEN** se resuelve una palette Light distinta de Crepúsculo de medianoche o cualquier palette Dark
- **THEN** `textMuted` conserva su valor previamente aprobado
- **AND** no existe lógica de palette en screens o components

### Requirement: estados semánticos permanecen independientes de palettes

El sistema MUST conservar significados propios para danger/error/destructive, disabled, feedback de persistencia de PersonalRating y PersonalRating low, medium y high. Las palettes MUST NOT reasignar esos significados, aunque el scheme pueda proporcionar variantes contrastantes. `dangerText` MUST representar texto standalone general de error/feedback, mientras `onDangerSurface` MUST proporcionar el foreground scheme-aware y contrastante colocado sobre `dangerSurface`; ninguno MUST sustituir indiscriminadamente al otro. El token semantic y scheme-aware `personalRatingErrorText` MUST representar exclusivamente el feedback/error standalone de persistencia de PersonalRating, MUST permanecer palette-independent y MUST NOT reemplazar `dangerText` ni los pares low/medium/high. Antes de migrar consumers, la baseline Dark + Original MUST inventariar cada foreground semántico actual mediante consumer/archivo, valor actual y responsabilidad/token futuro; la coincidencia accidental con un color de PersonalRating MUST NOT aceptarse como prueba de `dangerText`. Si un único token no puede preservar dos presentaciones actuales, el catálogo MUST permanecer consumer-driven y mínimo, o la divergencia MUST documentarse como corrección futura de accesibilidad antes de cambiar el consumer. PersonalRating MUST conservar los rangos `10..74 low`, `75..84 medium` y `85..100 high` y MUST seguir comunicándose además del color.

#### Scenario: parity de foregrounds semánticos
- **WHEN** se valida Dark + Original antes de migrar consumers
- **THEN** el feedback de error `#f4b8b8` de `app/settings/tmdb.tsx` se ancla a su responsabilidad futura
- **AND** el `ratingError` de persistencia de PersonalRating en `app/title/[id].tsx` registra el histórico `#5a2a2a`, se resuelve como `semantic.personalRatingErrorText` y finaliza en Dark como `#9b7b7b` por la corrección accesible explícita de Section 12
- **AND** los foregrounds reales usados sobre disabled `#303030` y `#3b3b3b` se registran junto con sus surfaces
- **AND** ninguna migración cambia esos foregrounds silenciosamente

#### Scenario: feedback de persistencia de PersonalRating conserva ownership con excepción accesible de parity
- **GIVEN** el consumer `ratingError` de `app/title/[id].tsx`
- **WHEN** se migra Saved Title Detail en Section 9
- **THEN** usa `theme.semantic.personalRatingErrorText`
- **AND** la migración inicial conserva como evidencia histórica Dark + Original `#5a2a2a`
- **AND** Section 12 reemplaza deliberadamente sólo el valor Dark por `#9b7b7b`, con contraste aproximado `5.00:1` sobre la surface real `#101010`, `5.17:1` sobre background `#0b0b0b` y `4.84:1` sobre surfaceSecondary `#141414`
- **AND** Light usa `#7d2020`, con contraste aproximado `10.00:1` sobre `surface #ffffff` y `9.26:1` sobre `background #f6f6f6`
- **AND** todas las palettes Dark resuelven `#9b7b7b` y todas las palettes Light resuelven `#7d2020`
- **AND** ninguna palette puede modificar el token
- **AND** `dangerText` permanece separado y conserva Dark `#f4b8b8`
- **AND** dominio `10..100 integer | null`, queue, persistencia, optimistic behavior, rollback y lifecycle de error de PersonalRating permanecen intactos
- **AND** la corrección accesible Dark queda documentada como excepción deliberada de parity y no como drift accidental

#### Scenario: foreground sobre danger surface
- **GIVEN** Dark + Original con `dangerSurface #4a1f1f`
- **WHEN** un texto o icono se coloca dentro de esa surface
- **THEN** usa `onDangerSurface #f2f2f2`
- **AND** el `dangerText #f4b8b8` permanece reservado para error o feedback standalone
- **AND** bajo Light `onDangerSurface` conserva contraste adecuado con el `dangerSurface` claro

#### Scenario: rating high bajo Lavanda
- **WHEN** una puntuación personal entre 85 y 100 se muestra con palette Lavanda
- **THEN** conserva el significado high y su valor numérico accesible
- **AND** no se convierte en un estado violeta por identidad de palette

#### Scenario: danger bajo Marea
- **WHEN** se muestra una acción destructiva con palette Marea
- **THEN** conserva semántica de danger/error
- **AND** no se representa como azul sólo por la palette

### Requirement: overlays y branding conservan responsabilidades propias

El sistema MUST mantener separados del theme global los scrims, foregrounds y borders necesarios para legibilidad sobre posters arbitrarios. TitleGridCard MUST conservar las tres intensidades estructurales consumer-driven: `imageOverlay` para el título, `imageOverlayMedium` para el type badge e `imageOverlayStrong` para el pin. TagGridCard MUST usar `imageOverlayLabel` exclusivamente para el nombre y contador colocados directamente sobre los cuatro posters arbitrarios de TagCollage, `onImageOverlay` para el nombre y `onImageOverlaySecondary` para el contador. Los foregrounds estructurales MUST NOT provenir de tokens globales palette-overridable. Estos tokens MUST conservar su responsabilidad sobre imágenes bajo Light y Dark, MUST NOT ser palette-overridable y MUST NOT abrir un catálogo preventivo de intensidades o foregrounds adicionales. El pin contextual MUST seguir siendo un diamond-outline pasivo top-right y MUST coexistir sin solaparse con el rating. El sistema MUST renderizar el logo oficial TMDB actual sin tint ni filtros y MUST preservar exactamente el notice TMDB y la atribución JustWatch existentes de forma legible en todos los themes.

#### Scenario: paridad exacta de overlays de TitleGridCard
- **WHEN** se resuelve Dark + Original
- **THEN** `imageOverlay` es `rgba(11, 11, 11, 0.78)` para el title overlay
- **AND** `imageOverlayMedium` es `rgba(11, 11, 11, 0.82)` para el type badge
- **AND** `imageOverlayStrong` es `rgba(11, 11, 11, 0.90)` para el pin overlay
- **AND** `imageOverlayLabel` es `rgba(11, 11, 11, 0.94)` para el nombre y contador de TagGridCard sobre TagCollage
- **AND** `onImageOverlay` es `#f2f2f2` para el nombre de TagGridCard
- **AND** `onImageOverlaySecondary` es `#bdbdbd` para su contador
- **AND** las cuatro intensidades permanecen structural y palette-independent

#### Scenario: label de etiqueta sobre posters bajo Light
- **WHEN** TagGridCard se muestra bajo un theme Light con cualquier palette
- **THEN** su nombre y contador conservan `imageOverlayLabel rgba(11, 11, 11, 0.94)` como scrim oscuro
- **AND** el nombre usa `onImageOverlay #f2f2f2` y el contador usa `onImageOverlaySecondary #bdbdbd`
- **AND** ambos foregrounds permanecen structural y palette-independent
- **AND** posición, padding, typography, contador, navegación, posters y press target no cambian

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

El sistema MUST persistir scheme y palette como una sola intención local independiente de TMDB, red, cuentas y browsing preferences. La coordinación MUST distinguir la intención más reciente mostrada de `confirmedPersisted`, entendido como el último valor que se sabe realmente escrito. Selecciones normales y reservas diferidas de import MUST compartir una única secuencia monotónica administrada por el mismo coordinator; consumers MUST NOT fabricar IDs ni decidir precedencia. El coordinator MUST distinguir el watermark causal que decide si una reserva puede activarse del lifecycle displayed/write normal ya activo, sin crear otro contador o sistema de precedencia. Una reserva no activada MUST NOT coalescer, cancelar ni suprimir por sí sola el success/failure/rollback de una selección normal previa. Cada write exitoso MUST actualizar `confirmedPersisted` al valor escrito aunque su intención ya haya sido superseded, pero MUST NOT reemplazar la UI si existe una intención normal posterior. Si un normal write que todavía sustenta `displayed` falla, la UI MUST volver exactamente a `confirmedPersisted` aunque exista una reserva diferida causalmente posterior todavía no activada. Los writes de Appearance MUST componerse de forma serializada con las demás mutaciones SQLite públicas sin anidar la serialización ni la transacción.

#### Scenario: reinicio conserva Appearance
- **WHEN** el usuario selecciona Claro + Crepúsculo de medianoche y reinicia la aplicación
- **THEN** se recupera la misma combinación

#### Scenario: Pinky Clouds persiste sin migración de payload
- **WHEN** se guarda `{ version: 1, scheme, palette: "pinky-clouds" }`
- **THEN** `pinky-clouds` se acepta como `AppearancePaletteId` válido y se hidrata normalmente
- **AND** la versión del payload permanece `1`
- **AND** el default continúa siendo Dark + Original

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

#### Scenario: reserva diferida no adelanta efectos
- **GIVEN** `displayed` y `confirmedPersisted` son C
- **WHEN** el coordinator reserva una Appearance importada A
- **THEN** la reserva consume el siguiente orden monotónico compartido y devuelve un handle propio
- **AND** `displayed`, `confirmedPersisted` y storage permanecen C
- **AND** no comienza ningún write ni mutación SQLite

#### Scenario: reserva no coalesce una selección normal queued
- **GIVEN** `select(B)` obtuvo orden N, muestra B y su write continúa queued
- **WHEN** A se reserva con orden N+1 pero aún no se activa
- **THEN** B conserva su lifecycle normal de persistencia
- **AND** no se elimina ni se coalesce únicamente por la reserva A

#### Scenario: normal write exitoso durante una reserva
- **GIVEN** `confirmedPersisted` es C, B está displayed y su write está pendiente
- **WHEN** se reserva A y después el write de B termina exitosamente
- **THEN** `displayed`, `confirmedPersisted` y storage son B mientras A siga sin activar
- **AND** descartar A conserva B como resultado final
- **AND** activar A puede aplicar A con su orden original si A continúa causalmente latest

#### Scenario: normal write fallido durante una reserva
- **GIVEN** `confirmedPersisted` y storage son C, B está displayed y su write está pendiente
- **WHEN** se reserva A y después el write de B falla
- **THEN** `displayed` vuelve inmediatamente a C aunque A siga reservada
- **AND** `confirmedPersisted` y storage permanecen C
- **AND** descartar A conserva C y no revive B

#### Scenario: export durante reserva usa success confirmado
- **GIVEN** B terminó exitosamente y `confirmedPersisted` es B
- **WHEN** A permanece reservada pero no activada y se exporta
- **THEN** la Appearance portable es B
- **AND** no se exportan C ni A

#### Scenario: activación conserva el orden reservado
- **GIVEN** A fue reservada con orden N y no apareció ningún intent posterior
- **WHEN** su merge termina exitosamente y la reserva se activa después de salir de la mutación principal
- **THEN** A conserva el orden N en vez de recibir un orden nuevo
- **AND** adopta el pipeline optimista y de persistencia normal de Appearance
- **AND** su write usa la boundary pública de mutación global existente

#### Scenario: descarte no recicla orden
- **GIVEN** A fue reservada con orden N
- **WHEN** el restore se rechaza, aborta o lanza y la reserva se descarta
- **THEN** A no puede activarse ni escribir posteriormente
- **AND** `displayed` y `confirmedPersisted` no cambian
- **AND** el próximo intent obtiene un orden posterior a N

#### Scenario: imports repetidos comparten precedencia
- **GIVEN** el import A se reservó con orden N
- **WHEN** otro import D se reserva con orden N+1 antes de activar A
- **THEN** activar A informa supersession y no escribe
- **AND** D puede activarse si continúa siendo el intent lógico más reciente

#### Scenario: fallo al activar no revierte datos restaurados
- **GIVEN** items y pins terminaron de importarse y la reserva sigue vigente
- **WHEN** la activación intenta persistir Appearance y el write falla
- **THEN** el coordinator aplica su rollback normal al `confirmedPersisted` real
- **AND** items y pins permanecen importados
- **AND** el resultado informa el fallo de Appearance por separado

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

#### Scenario: catálogo final ordenado
- **WHEN** se presenta el catálogo de Appearance
- **THEN** el orden es Original, Manzana verde, Marea, Crepúsculo de medianoche, Lavanda, Obsidiana y Pinky Clouds
- **AND** Pinky Clouds usa ID estable `pinky-clouds` y label `Pinky Clouds`

#### Scenario: selección accesible de palette
- **WHEN** una palette está seleccionada
- **THEN** se distingue mediante label, check o icono y borde o indicador visual
- **AND** expone estado selected a tecnologías de asistencia
- **AND** puede operarse mediante teclado y focus visible en web

#### Scenario: preview fiel
- **WHEN** se muestran previews de palettes
- **THEN** cada preview representa background, surfaces, text, accent y border o selection de la misma definición real que usaría la aplicación
- **AND** no usa un segundo catálogo de colores sólo para previews
- **AND** la preview Pinky Clouds se deriva de la misma `ThemeDefinition` real

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

El sistema MUST mantener contraste y señales adicionales al color para selected/unselected, tabs activas/inactivas, buttons, disabled, danger/error, links, rating, pin, inputs/placeholders, scheme/palette selection y focus web en todas las combinaciones soportadas. Además, un gate puro de Section 1 MUST calcular relative luminance para rechazar cualquier combinación effective Light cuyos backgrounds/surfaces sean obviamente oscuros o cuya relación básica `textPrimary`/`background` sea incoherente. Este gate acotado MUST NOT sustituir el audit completo de contraste de release.

#### Scenario: invariant puro de luminosidad Light
- **WHEN** el harness recorre Light con las siete palettes
- **THEN** verifica mediante relative luminance que `background`, `surface`, `surfaceSecondary` e `inputBackground` permanezcan en el rango claro documentado
- **AND** verifica que `textPrimary` sea más oscuro que `background` y mantenga contraste básico suficiente
- **AND** rechaza una definición como background `#111111` con text `#eeeeee` aunque ninguno sea negro o blanco puro

#### Scenario: validación de catálogo completo
- **WHEN** se valida una release con Light y Dark para las siete palettes
- **THEN** se revisan contraste, legibilidad, focus y señales no cromáticas de los estados críticos
- **AND** ninguna combinación se publica si vuelve ilegible una superficie requerida

#### Scenario: auditoría consumer-driven de Pinky Clouds
- **WHEN** se auditan las dos `ThemeDefinition` Pinky Clouds
- **THEN** todo texto normal sobre sus surfaces reales, inputs, accent, selection, semantic states y personal-rating pairs alcanza `>=4.5:1`
- **AND** `borderStrong` alcanza `>=3.0:1` contra cada surface funcional relevante
- **AND** no se exige threshold de texto al par sintético `accent/surfaceSecondary` Light cuando no existe un consumer de texto normal sobre esa surface
- **AND** la matriz numérica completa y sus pares reales quedan registrados en Design
