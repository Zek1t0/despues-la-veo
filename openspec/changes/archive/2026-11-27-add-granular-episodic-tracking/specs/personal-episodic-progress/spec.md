## ADDED Requirements

### Requirement: Posición manual y decisiones granulares independientes
El sistema MUST identificar el cursor como posición manual. La creación, el marcado, el desmarcado, las acciones múltiples, la actualización editorial y la restauración granular MUST NOT alterar automáticamente cursor, estado, rating, notas o etiquetas. La cobertura granular MUST mostrarse como dato separado conforme a su propio contrato.

#### Scenario: Huecos y cursor intacto
- **WHEN** un título tiene cursor T3/E10 sin marcas, se marcan 1, 2, 5 y 10 y luego se desmarca 10
- **THEN** no se infiere consumo inicial, quedan tres marcas y el cursor y restantes datos personales conservan sus valores

## MODIFIED Requirements

### Requirement: Posición manual independiente y durable
El sistema MUST permitir registrar una posición actual por título local, manual o con cero o varias referencias externas, sin red ni credenciales. MUST persistirla tras reiniciar y mantener un reloj propio. Registrar, corregir, incrementar o restablecer MUST NOT modificar status, rating, notas, etiquetas, createdAt/updatedAt históricos del título, metadata, colecciones o recomendaciones. MUST NOT inferir progreso desde planned, watching, done o dropped ni cambiar esos estados automáticamente. El refresh o cambio de fuente MUST NOT convertir ni borrar progreso. Las operaciones del cursor manual MUST NOT registrar eventos de consumo ni nuevas entradas de progreso en Actualizaciones.

#### Scenario: Primer episodio de un pendiente
- **WHEN** se guarda el episodio 1 de un título planned sin conexión
- **THEN** al reiniciar se recupera la posición y se conservan planned y todos los demás campos y relojes del título

#### Scenario: Terminado sin posición completa
- **WHEN** se cambia explícitamente watching a done teniendo episodio 8 y total editorial 12
- **THEN** se conserva episodio 8 sin completar posiciones ni producir marcas individuales

#### Scenario: Proveedor cerrado o cambio editorial
- **WHEN** un título guardado tiene su proveedor bloqueado o cambia su total o fuente editorial
- **THEN** su posición personal sigue disponible y no se reabre ni termina automáticamente

### Requirement: Elegibilidad conservadora por clasificación
El sistema MUST ofrecer posición manual a audiovisual/tv y cómics excepto one-shot, incluidos manga, manhwa, manhua y webtoon. MUST permitir activación explícita en anime ova, ona o special y en formatos null de audiovisual o comic, sin deducir serialización de la cantidad editorial. MUST NOT ofrecer controles de cursor en movie, music, one-shot o literature. B MUST NOT habilitar controles granulares en movie, music o one-shot y MUST preservar decisiones de títulos que pasan a ser incompatibles. B admite unidades manuales para literatura explícitamente serializada sin activar controles de cursor. MUST limitar episodios a audiovisual y capítulos a comic; posición especial MUST ser admisible en ambos medios elegibles. Un progreso existente incompatible MUST seguir visible como conservado, sin incremento o reinterpretación y con explicación; una importación histórica o cambio editorial MUST NOT borrarlo.

#### Scenario: Película anime
- **WHEN** se abre un anime con formato movie sin progreso
- **THEN** no aparecen controles episódicos por pertenecer a Anime

#### Scenario: Literatura serializada
- **WHEN** se habilitan unidades manuales para literatura explícitamente serializada
- **THEN** se admiten unidades granulares y no aparecen controles de cursor

#### Scenario: Manual sin formato
- **WHEN** se abre un manual comic con formato null
- **THEN** se puede activar explícitamente capítulo o especial sin proveedor ni total

### Requirement: Barra de posición honesta y cobertura no inferida
El sistema MUST mostrar una barra de posición manual solo con total editorial entero positivo conocido, fuente/procedencia identificada y evidencia explícita de equivalencia entre el ámbito y numeración de ese total y la posición. MUST limitarla a episodio continuo entero dentro de 0–total, rotular «Posición X de Y» y aclarar que no representa cantidad vista; MUST NOT mostrar porcentajes o cobertura derivados del cursor ni inferir unidades consumidas. B puede mostrar barras y porcentajes separados del cursor exclusivamente bajo el contrato de cobertura granular. Total desconocido, fuente ambigua, incompatibilidad, temporada sin total propio, capítulo decimal, especial o posición superior al total MUST suprimir la barra sin impedir guardar. Los totales existentes sin evidencia de numeración MUST NOT bastar para activarla. Un cambio editorial MUST reevaluar u ocultar la barra sin alterar posición. El cursor MUST NOT iniciar consultas externas para obtener esa evidencia. B permite descargas explícitas conforme al contrato de inventario.

#### Scenario: Total existente sin equivalencia
- **WHEN** existe episodeCount de Kitsu pero no evidencia de que comparte numeración y ámbito con el cursor manual
- **THEN** se muestra solo la posición textual, sin barra ni porcentaje derivados del cursor

#### Scenario: Escala compatible y salto de episodios
- **WHEN** una escala acreditada 1–12 coincide con el episodio continuo 8 introducido tras un salto
- **THEN** se puede mostrar Posición 8 de 12, nunca ocho episodios vistos ni 67 % de cobertura

### Requirement: Extensión granular conserva incertidumbre
La fundación histórica A conserva una posición manual sin catálogo, marcas individuales, volúmenes o ciclos de consumo. La posición MUST NOT convertirse automáticamente en todas las unidades anteriores vistas/leídas ni usar su número como identidad editorial. Una evolución a B MUST preservar esa posición y su procedencia manual sin reinterpretar correspondencias ambiguas, incluidas temporadas, huecos, especiales, renumeraciones y rewatch/relectura.

#### Scenario: Evolución con huecos desconocidos
- **WHEN** B incorpore unidades individuales a un título con episodio manual 24
- **THEN** los episodios 1–24 no se consideran vistos por esa posición y la cobertura solo puede calcularse bajo el contrato granular, usando unidades acreditadas y marcas explícitas
