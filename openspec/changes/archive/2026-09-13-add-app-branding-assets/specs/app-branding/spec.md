## Purpose

Define la identidad instalable consistente con la que DespuésLaVeo se presenta en launchers, pantallas de inicio y navegadores de Android, iOS y Web.

## ADDED Requirements

### Requirement: Identidad nominal estable
El sistema MUST presentar `DespuésLaVeo` como nombre visible de la aplicación, MUST conservar `despues-la-veo` como slug técnico y MUST identificar los builds de producción mediante `com.zekito.despueslaveo` tanto en Android como en iOS.

#### Scenario: Metadata resuelta para las plataformas objetivo
- **WHEN** se resuelve la configuración de la aplicación para Android, iOS o Web
- **THEN** el nombre visible es `DespuésLaVeo` y el slug es `despues-la-veo`
- **AND** Android usa `com.zekito.despueslaveo` como package e iOS usa `com.zekito.despueslaveo` como bundle identifier

#### Scenario: Configuración iOS verificada estructuralmente
- **WHEN** la configuración pública e introspectada de Expo se resuelve para iOS en un entorno sin acceso a una build iOS real
- **THEN** `ios.bundleIdentifier` es `com.zekito.despueslaveo`
- **AND** los assets y la configuración de icono y splash destinados a iOS se resuelven mediante rutas existentes y compatibles
- **AND** esta verificación estructural no sustituye la comprobación visual futura en un dispositivo o simulador iOS

### Requirement: Iconos instalables de marca
El sistema MUST usar assets finales de DespuésLaVeo en lugar de los placeholders de Expo para representar la aplicación instalada en Android e iOS.

#### Scenario: Aplicación instalada en una plataforma móvil
- **WHEN** el usuario instala un build de DespuésLaVeo en Android o iOS
- **THEN** el launcher presenta el icono de marca correspondiente y no un placeholder de Expo

### Requirement: Adaptive icon de Android
El sistema MUST proporcionar un adaptive icon de Android compuesto por foreground y background de marca separados, de forma que el sistema pueda aplicar sus máscaras compatibles sin perder el elemento principal.

#### Scenario: Launcher aplica una máscara adaptativa
- **WHEN** Android representa el icono mediante una máscara adaptive compatible
- **THEN** el foreground y el background de marca forman un icono reconocible
- **AND** el elemento principal permanece dentro de la zona visible

### Requirement: Icono monocromático de Android
El sistema MUST proporcionar una representación monocromática de la marca para dispositivos Android compatibles con themed icons.

#### Scenario: Usuario habilita themed icons
- **WHEN** un launcher Android compatible solicita la variante monocromática
- **THEN** muestra una silueta reconocible de DespuésLaVeo coloreada por el sistema

### Requirement: Identidad web
El sistema MUST presentar un favicon final de DespuésLaVeo en los navegadores compatibles y MUST evitar reutilizar el favicon placeholder de Expo.

#### Scenario: Usuario abre la aplicación web
- **WHEN** el navegador carga DespuésLaVeo
- **THEN** la pestaña o superficie equivalente muestra el favicon de marca configurado

### Requirement: Splash screen de marca
El sistema MUST mostrar durante el arranque nativo un splash screen de DespuésLaVeo con imagen y fondo de marca compatibles con Android e iOS.

#### Scenario: Inicio de un build nativo
- **WHEN** el usuario abre un build de producción o preview representativo en Android o iOS
- **THEN** se muestra el splash de marca mientras carga la aplicación
- **AND** la transición no muestra un asset placeholder de Expo

### Requirement: Assets de branding válidos
El conjunto de branding MUST incluir assets legibles, con formato y dimensiones aceptados por la configuración de las plataformas objetivo; una referencia inexistente, un archivo inválido o un placeholder MUST impedir considerar la capacidad terminada.

#### Scenario: Validación detecta un asset inválido
- **WHEN** un asset configurado no existe, no puede decodificarse o incumple las restricciones de su plataforma
- **THEN** la verificación informa el asset afectado
- **AND** el cambio no se considera listo para distribución

### Requirement: Branding independiente de la apariencia y los datos
El branding instalable MUST permanecer fijo para cada build y MUST ser independiente de la paleta o scheme seleccionados por el usuario. La incorporación del branding MUST preservar modelos de dominio, storage local y compatibilidad de backups.

#### Scenario: Usuario cambia la apariencia
- **WHEN** el usuario cambia el scheme o la paleta dentro de la aplicación
- **THEN** los assets instalables de branding del build no cambian

#### Scenario: Actualización sobre la misma identidad instalada
- **WHEN** el usuario actualiza desde un build anterior que usa los mismos identificadores de Android o iOS
- **THEN** sus datos locales y backups conservan el mismo comportamiento y formato
