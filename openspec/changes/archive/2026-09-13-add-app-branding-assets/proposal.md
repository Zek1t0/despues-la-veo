## Why

DespuésLaVeo todavía usa los assets visuales iniciales de Expo y no tiene completa su identidad instalable en Android, iOS y Web. Formalizar el branding permite que builds, launchers y navegador presenten una marca coherente antes de distribuir la aplicación.

## What Changes

- Establecer `DespuésLaVeo` como nombre visible y conservar `despues-la-veo` como slug técnico.
- Establecer `com.zekito.despueslaveo` como Android package e iOS bundle identifier.
- Reemplazar los placeholders de Expo por assets finales bajo `assets/branding/`.
- Configurar el icono general para Android/iOS, el favicon web y el splash screen.
- Configurar el adaptive icon de Android con foreground y background separados.
- Configurar un icono monocromático para themed icons de Android compatibles.
- Mantener el branding como identidad estática del producto, separado de la apariencia configurable en `src/theme`.
- Dejar fuera del alcance cambios de UI, dominio, storage, backups, cuentas y variantes de build.

## Capabilities

### New Capabilities

- `app-branding`: Define la identidad instalable y los assets de marca que presentan DespuésLaVeo en Android, iOS y Web.

### Modified Capabilities

Ninguna.

## Impact

- Afecta la metadata de Expo en `app.json` y reemplaza/reorganiza assets estáticos bajo `assets/branding/`.
- Afecta futuros builds nativos de Android e iOS y la presentación del sitio web en el navegador.
- No requiere dependencias nuevas ni cambios en rutas, componentes, APIs, modelos, SQLite o formatos de backup.
- Los datos existentes no cambian, pero un build instalado con otro package o bundle identifier se considera otra aplicación y no comparte automáticamente su almacenamiento local. Antes de adoptar los identificadores definidos se deberá confirmar si existen builds distribuidos que deban conservar su identidad.
