## Why

DespuésLaVeo nació dark-only y hoy distribuye colores estáticos entre una paleta compartida, una copia privada de React Navigation, `StyleSheet.create`, estilos inline y CSS web. Esto impide cambiar la apariencia global de forma reactiva y coherente, y puede dejar headers, tabs, StatusBar, screens o componentes con colores anteriores.

La aplicación necesita una Appearance local-first que preserve exactamente la identidad dark actual como valor predeterminado, permita combinar luminosidad y personalidad cromática, siga cambios del sistema en runtime y haga portable la intención visual mediante backups compatibles.

## What Changes

- Agregar una preferencia global e independiente de browsing con dos dimensiones persistentes: `scheme` (`system`, `light`, `dark`) y `palette` (`original`, `green-apple`, `tide`, `midnight-twilight`, `lavender`, `obsidian`), con default absoluto `dark + original`.
- Resolver una `ThemeDefinition` tipada, inmutable y completa mediante `LightBase`/`DarkBase` más overrides parciales de palette y estados semánticos; `Dark + Original` preservará prácticamente exacta la baseline visual actual.
- Incorporar una fuente reactiva única para React Navigation, Stack, Tabs, headers, StatusBar, screens, componentes, previews y web; `system` seguirá cambios del OS/browser sin reescribir la preferencia.
- Separar tokens globales, estados semánticos, overlays estructurales sobre imágenes y branding externo. Ratings conservarán sus rangos y señales no basadas sólo en color; el logo y los textos oficiales de TMDB/JustWatch no se recolorearán ni alterarán.
- Persistir Appearance como unidad lógica propia en `app_preferences`, sin reutilizar el dominio de browsing, con actualización optimista, rollback al último valor realmente persistido y coordinación central last-intent-wins que mantenga separadas la intención visible más reciente y la verdad confirmada de storage. Los writes respetarán la queue/transaction global de mutaciones SQLite; imports diferidos y retries asíncronos participarán del mismo orden temporal para no pisar elecciones posteriores.
- Evitar un primer paint principal con un theme falso mediante bootstrap canónico `Dark + Original` y un gate de hidratación corto; los errores de storage desbloquearán la app con fallback seguro sin esperar red o TMDB.
- Agregar la ruta Stack `/settings/appearance`, con selección inmediata y accesible de scheme y previews de palettes construidas desde las mismas `ThemeDefinition` reales; el layout será horizontal en móvil y responsive en viewports anchos.
- Sincronizar `global.css`, superficies del DOM/browser, scrollbars, `color-scheme`, focus visible y seguimiento runtime de system en web, sin duplicar manualmente las definiciones de themes en CSS.
- **BREAKING (formato de exportación, no importación):** evolucionar el export actual de backup v3 a v4, incluyendo `appearance: { scheme, palette }` cuando exista una intención confirmada confiable. Ante un error real de lectura sin verdad persistida conocida, v4 omitirá Appearance en vez de inventarla desde el fallback visual y continuará exportando biblioteca/pins. Continuar importando v1/v2/v3 sin modificar Appearance local; un v4 válido aplicará Appearance sólo después de una restauración confirmada. Appearance ausente, inválida o con palette desconocida no impedirá restaurar biblioteca/pins, conservará Appearance local y será informada cuando corresponda.
- Revisar selectivamente `app.json` durante Apply porque `userInterfaceStyle: "dark"` puede impedir el seguimiento completo de System, preservando cualquier hunk personal protegido. No se agregan dependencias.
- Validar con TypeScript, harnesses Node `.cjs` focalizados, OpenSpec strict y revisión manual real en Android, iOS y web, incluidos contraste, teclado/focus, reload, persistencia, cambios rápidos, backups y paridad dark.

### Goals

- Conseguir una Appearance global, reactiva, local-first y portable, sin themes parciales o stale.
- Mantener scheme y palette como intenciones independientes; cambiar light/dark conserva la misma palette.
- Mantener funcionalidades, datos, navegación y branding existentes mientras toda superficie visual consume un contrato semántico común.

### Non-Goals

- No rediseñar cards, tipografía, animaciones ni navegación funcional salvo `/settings/appearance`.
- No cambiar `SavedTitle`, rating, pinning, sorting, Search, remote detail ni TMDB credential.
- No agregar accounts, backend, Supabase, Material You, palette dinámica, preference `pureBlack`, UI libraries ni reemplazar `StyleSheet` o Expo Router.

### Compatibility, errors and rollback

- Instalaciones existentes o preferences ausentes/inválidas reciben `dark + original`; browsing preferences continúan independientes.
- La tabla genérica `app_preferences` admite el nuevo registro sin cambiar `SavedTitle`; los fallos de lectura/escritura no bloquean biblioteca ni degradan datos. Una ausencia válida de row confirma el default Dark + Original; un error real de lectura no convierte el fallback visual en una elección exportable.
- Backups v1/v2/v3 conservan su comportamiento y nunca cambian Appearance. El parser v4 separa la validez de Appearance de la restauración prioritaria de items/pins.
- La reversión de código puede dejar el registro de Appearance sin uso; no requiere borrar datos. Un rollback anterior a v4 no podrá importar v4, por lo que antes de revertir deberá conservarse/exportarse un backup compatible o mantenerse disponible el importador v4. La implementación se dividirá en checkpoints pequeños y reversibles.

## Capabilities

### New Capabilities

- `global-appearance-themes`: Preferencia global scheme + palette, composición de themes, runtime reactivo, hidratación, Settings/previews, accesibilidad, navegación, StatusBar, web, overlays y branding.

### Modified Capabilities

- `local-view-preferences`: Aclarar que las preferences Detalle/Mosaico y sorting permanecen locales e independientes, mientras la nueva Appearance global usa su propio dominio y sí puede ser portable.
- `library-backup-integrity`: Incorporar export/import v4 con Appearance portable, compatibilidad v1/v2/v3, aplicación posterior al éxito y degradación segura ante palettes desconocidas.

## Impact

- **Theme/runtime:** `src/theme`, nuevo dominio/repo de Appearance, provider root y hooks; migración de colores dependientes de runtime sin reemplazar `StyleSheet`.
- **Navigation/UI:** root Stack, Tabs, StatusBar, Settings, nueva route, shared browsing components y todas las screens que hoy consumen colores.
- **Web/config:** `global.css` y revisión selectiva de `app.json` para System; Android, iOS y web deben compartir la misma resolución efectiva.
- **Persistence/backup:** `app_preferences`, exportadores/parsers/merge de backup y UI de importación/exportación; no se modifica la credencial TMDB ni se introduce red.
- **Riesgos principales:** captura estática de colores, carreras entre intents/writes/imports/retries, composición con otras mutaciones SQLite, flash de hidratación, contraste entre 12 combinaciones scheme/palette, divergencia React/CSS, regresión visual de Dark+Original y restauraciones parciales. Design y tasks exigirán secuencias, harnesses y checkpoints específicos para cada riesgo.
