## Context

La configuración estática actual vive en `app.json` y ya referencia `assets/icon.png`, `assets/favicon.png`, `assets/splash-icon.png` y `assets/adaptive-icon.png`, pero esos archivos son placeholders iniciales. El package Android localmente configurado es provisional y falta el bundle identifier de iOS. Véase `proposal.md` para la motivación y `specs/app-branding/spec.md` para el contrato observable.

El cambio cruza la configuración de Android, iOS y Web, pero no necesita entrar en el runtime React Native. Expo SDK 54 y la configuración existente permiten resolverlo mediante metadata y assets estáticos, sin dependencias nuevas.

## Goals / Non-Goals

**Goals:**

- Centralizar los archivos finales de marca bajo `assets/branding/` con nombres explícitos y referencias verificables.
- Configurar nombre, slug e identificadores nativos estables para producción.
- Aprovechar las variantes nativas de Android sin duplicar lógica en la aplicación.
- Mantener el cambio pequeño, reversible y limitado a configuración/recursos estáticos.

**Non-Goals:**

- Hacer que iconos o splash respondan a `src/theme` o a preferencias del usuario.
- Introducir configuración dinámica, `eas.json` o identificadores por ambiente.
- Cambiar componentes, rutas, textos internos, modelos, persistencia o backups.
- Crear materiales de tienda, iconos de notificaciones o un rediseño general de UI.

## Decisions

### 1. Mantener configuración Expo estática

Se actualizará `app.json` en lugar de introducir `app.config.ts/js`. Las decisiones son únicas para producción y no existen variantes dev/preview/prod, por lo que una configuración dinámica agregaría complejidad sin aportar comportamiento requerido.

Alternativa considerada: configuración dinámica por variables de entorno. Se descarta porque las variantes están explícitamente fuera de alcance.

### 2. Centralizar los assets en una estructura de branding

Los activos finales se ubicarán así:

```text
assets/branding/
├── icon.png
├── favicon.png
├── splash.png
├── adaptive/
│   ├── foreground.png
│   └── background.png
└── monochrome.png
```

`icon.png` será la composición general para iconos móviles; `favicon.png` será una reducción diseñada para web; `splash.png` será la imagen central del arranque; el adaptive icon tendrá capas independientes; y `monochrome.png` contendrá solo la silueta apta para themed icons.

Alternativa considerada: conservar archivos sueltos en `assets/`. Se descarta porque mezcla placeholders, branding y recursos funcionales como el logo de TMDB, y hace menos evidente qué archivos forman una unidad.

### 3. Usar identificadores nativos iguales y definitivos

`android.package` e `ios.bundleIdentifier` serán `com.zekito.despueslaveo`. Compartir la cadena base simplifica la administración y representa un namespace propietario en formato reverse-DNS.

Se confirmó que no existen builds distribuidos ni registros de tienda que requieran conservar otro application identifier. Por tanto, `com.zekito.despueslaveo` no contradice una identidad publicada anterior. Cambiar el identificador después no sería una migración in-place: el sistema operativo lo trataría como otra aplicación.

### 4. Separar branding instalable de theme

Todas las referencias permanecerán en `app.json` y `assets/branding/`. No se importará la configuración Expo desde `src/`, no se agregarán tokens a `src/theme` y no se derivarán assets según la preferencia de Appearance.

Alternativa considerada: reutilizar colores o paletas del theme para fondos nativos. Se descarta porque el branding se resuelve al construir la app, mientras que el theme es estado configurable en runtime y portable mediante backup.

### 5. Configurar las capacidades por plataforma

- La propiedad general de icono apuntará a `assets/branding/icon.png`.
- El favicon web apuntará a `assets/branding/favicon.png`.
- El splash apuntará a `assets/branding/splash.png` con su fondo fijo de marca.
- El adaptive icon Android apuntará a `adaptive/foreground.png`, `adaptive/background.png` y `monochrome.png` mediante las propiedades compatibles de Expo SDK 54.
- iOS usará el icono general, salvo que la validación técnica demuestre que debe declararse también como override específico sin cambiar el asset acordado.

Se conserva el mecanismo de splash actualmente presente para evitar agregar o actualizar dependencias dentro de este cambio. Migrarlo al config plugin de `expo-splash-screen` podrá proponerse por separado si se aprueba la dependencia/configuración correspondiente.

### 6. Validar cada plataforma según las capacidades del entorno

| Plataforma | Validación de cierre | Estado | Seguimiento |
| --- | --- | --- | --- |
| Android | Compilación, instalación y revisión visual del nombre, icono, adaptive icon y splash en un dispositivo físico. | Realizada y aprobada. | Ninguno para cerrar esta change. |
| Web | Revisión manual de la carga del favicon y del branding en el navegador. | Realizada y aprobada. | Ninguno para cerrar esta change. |
| iOS | Expo public config e introspection, incluyendo `ios.bundleIdentifier` y la resolución de los assets/configuración de icono y splash. | Realizada correctamente en Windows. | Revisión visual en dispositivo o simulador cuando exista acceso a macOS/iOS; es no bloqueante. |

Los requisitos funcionales de branding de iOS se mantienen sin cambios. La validación estructural es la comprobación ejecutable y obligatoria en el entorno Windows actual; no se afirma que se haya realizado una build ni una revisión visual iOS. Esa comprobación física queda diferida como seguimiento y no impide cerrar la feature.

## Risks / Trade-offs

- [El namespace nuevo no coincide con un build ya distribuido] → Confirmar el historial de builds y registros de tienda antes de publicar; si existe una identidad estable anterior, detener la implementación y revisar la decisión en OpenSpec.
- [Cambiar el identificador separa el sandbox y hace parecer que los datos desaparecieron] → No presentar el nuevo ID como actualización de una app con ID distinto; conservar los IDs acordados desde el primer build distribuido.
- [El adaptive foreground queda recortado por alguna máscara] → Validarlo visualmente con máscaras representativas y mantener el elemento principal en la zona segura.
- [El background PNG no es aceptado o no compone correctamente] → Verificar dimensiones iguales a las del foreground y la configuración resuelta antes del build.
- [El icono monocromático contiene grises, color o detalles demasiado finos] → Validar transparencia y silueta a tamaño real en un launcher compatible.
- [Expo Go o un development build no representa fielmente el splash] → Verificarlo en un preview o build de producción representativo.
- [Windows no permite ejecutar una build iOS local real] → Verificar ahora la configuración pública e introspectada, el bundle identifier y la resolución de assets; diferir la revisión visual iOS como seguimiento no bloqueante.
- [Reorganizar assets deja referencias rotas] → Resolver la configuración Expo y comprobar que cada ruta existe antes de eliminar placeholders obsoletos.

## Migration Plan

1. Registrar la confirmación de que `com.zekito.despueslaveo` no contradice una identidad ya distribuida.
2. Incorporar y validar los assets finales en `assets/branding/`.
3. Actualizar conjuntamente las referencias y metadata de `app.json`.
4. Resolver la configuración Expo y ejecutar la verificación TypeScript requerida por el proyecto.
5. Revisar manualmente el favicon/branding en Web y el nombre, iconos y splash en un dispositivo Android físico.
6. Verificar estructuralmente iOS mediante Expo public config e introspection, incluidos el bundle identifier y la resolución de assets/configuración.
7. Registrar la revisión visual iOS como seguimiento no bloqueante para cuando exista acceso a macOS y un dispositivo o simulador iOS.
8. Eliminar los placeholders anteriores solo después de confirmar que ninguna referencia los utiliza.

La reversión consiste en restaurar las referencias y metadata previas de `app.json` y los assets anteriores. No existe migración ni rollback de SQLite o backups porque esas capas no se modifican. Si el nuevo identificador ya fue publicado en una tienda, revertirlo no debe tratarse como rollback técnico ordinario: requiere una decisión de distribución específica.
