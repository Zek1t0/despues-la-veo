## MODIFIED Requirements

### Requirement: Appearance combina scheme y palette independientes

El sistema MUST representar Appearance mediante un `scheme` elegido entre `system`, `light` y `dark`, y una `palette` elegida entre Original, Manzana verde, Marea, Crepúsculo de medianoche, Lavanda, Obsidiana y Pinky Clouds. Los IDs estables y su orden de catálogo MUST ser `original`, `green-apple`, `tide`, `midnight-twilight`, `lavender`, `obsidian`, `pinky-clouds`. La palette seleccionada MUST permanecer igual cuando cambie el scheme y cada combinación MUST conservar la luminosidad correspondiente al scheme efectivo. El catálogo MUST resolver exactamente 14 combinaciones. Original usa el ID portable `original`. La paleta personalizable `lavender` conserva su propio ID y definición.

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

### Requirement: el valor predeterminado preserva la apariencia dark actual

Una instalación nueva o una preferencia ausente o inválida MUST usar `dark + original` con la nueva base oscura V2. El ID `original` MUST resolver a los tokens V2 de Original en ambos esquemas, incluso después de importar una copia histórica. Las otras paletas, el esquema elegido y los datos personales MUST conservarse.

#### Scenario: Instalación o actualización sin preferencia
- **WHEN** se inicia sin Appearance válida
- **THEN** se muestra Original oscura y las preferencias de Biblioteca se conservan

#### Scenario: Restauración histórica
- **WHEN** se restaura una Appearance válida con `light + original`
- **THEN** se aplica Original clara según las reglas de restauración vigentes y el próximo backup conserva los mismos identificadores

### Requirement: accent y selección mantienen roles semánticos

El sistema MUST usar accent para identidad e interacción activa y MUST proporcionar un `onAccent` contrastante que no se presuma siempre blanco. Las selecciones MUST resolver explícitamente el trío palette-overridable `selectedSurface`, `selectedForeground` y `selectedBorder`; `textPrimary` y `onAccent` MUST NOT asumirse como foreground de una selección. Las selecciones MUST poder distinguir surface y border seleccionados del accent fuerte, y el accent MUST NOT reemplazar indiscriminadamente todos los fondos, bordes o textos. Original MUST usar los roles de selección de su esquema y comunicar la selección también con un indicador accesible fuera del color.

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

El token global y palette-overridable `borderStrong` MUST proporcionar una boundary visual funcional de al menos `3.0:1` respecto de cada surface relevante cuando delimita inputs o controles cuyo `inputBackground` no se distingue suficientemente por sí mismo. La auditoría histórica 2×6 y sus valores anteriores permanecen documentados en Design; la regresión final MUST usar las 14 `ThemeDefinition` actuales, incluidos los ajustes visuales manuales posteriores. Manzana verde Light MUST conservar su valor intencional `#5a7b5a` sobre `surface/inputBackground #f6f9f6` (`4.4841:1`). Las únicas correcciones posteriores a ese estado manual son Manzana verde Dark `#202920 → #646464` sobre `surface #0b0f09`/`inputBackground #0a0f08` (`3.2662:1`/`3.2715:1`), Marea Dark `#304144 → #4f6c72` sobre `#0b1518`/`#0a1618` (`3.2788:1`/`3.2611:1`) y Crepúsculo de medianoche Dark `#454864 → #606485` sobre `#0e0f20`/`#0d0f21` (`3.3027:1`/`3.3041:1`). Marea Light conserva `#769595` sobre `#fbffff` (`3.2061:1`) y Crepúsculo Light conserva `#9289af` sobre su surface/input final `#fcfbff` (`3.1750:1`). Lavanda, Obsidiana y Pinky Clouds conservan sus valores vigentes. Original MUST verificar su borde funcional contra sus superficies reales. Consumers MUST seguir usando `theme.global.borderStrong` sin branches ni literals propios. El token `border` MUST conservar su responsabilidad de separación sutil/decorativa y no hereda automáticamente el requisito `3:1`; ninguna surface/input se cambia para obtener contraste y no se agrega un token específico de input.

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

### Requirement: Settings permite elegir sin botón Aplicar

El sistema MUST ofrecer `/settings/appearance` como screen normal de Stack accesible desde Ajustes, con selector `Del sistema | Claro | Oscuro` y previews de todas las palettes, con `original` presentado una sola vez como Original. Las menciones históricas a Original u Oscuro + Original identifican el mismo ID portable y su esquema, y el bootstrap y los previews MUST resolver los tokens V2 de Original. Cada selección MUST aplicarse y persistirse automáticamente, sin botón Aplicar.

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

## ADDED Requirements

### Requirement: Controles y áreas seguras de la experiencia principal

Las pantallas principales MUST aplicar insets sin superposición ni doble espacio, usar roles comunes de fondo, superficies, elevación, texto, acciones y estados, y mantener contraste AA aplicable, foco visible y objetivos táctiles de al menos 48 dp en Android donde sea viable sin reducir los existentes.

#### Scenario: Android estrecho con teclado
- **WHEN** se edita un campo a 320 dp con fuente ampliada y navegación de tres botones o gestos
- **THEN** guardar y cancelar se alcanzan con scroll y quedan fuera de las barras del sistema

#### Scenario: Modal accesible
- **WHEN** se abre y cierra un menú o editor con Atrás en Android o Escape en Web
- **THEN** el foco vuelve al disparador y el estado se comunica mediante nombre, texto o indicador además del color
