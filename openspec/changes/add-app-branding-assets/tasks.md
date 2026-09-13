## 1. Preparación de identidad

- [x] 1.1 Confirmar que no existen builds distribuidos ni registros de tienda que requieran conservar otro Android package o iOS bundle identifier. Resultado: no existen antecedentes distribuidos ni registros de tienda que condicionen el uso de `com.zekito.despueslaveo`.
- [x] 1.2 Incorporar los assets finales aprobados en la estructura `assets/branding/` acordada y comprobar que todos son PNG legibles con dimensiones y transparencia apropiadas para su destino.
- [x] 1.3 Validar visualmente el icono general y el favicon a tamaño real, confirmando que son reconocibles y que no contienen elementos del placeholder de Expo.
- [x] 1.4 Validar las capas adaptive foreground/background bajo máscaras representativas y comprobar que `monochrome.png` funciona como silueta de un solo color para themed icons.

## 2. Configuración Expo

- [x] 2.1 Actualizar en `app.json` el nombre visible a `DespuésLaVeo`, conservar el slug `despues-la-veo` y configurar `com.zekito.despueslaveo` como package Android y bundle identifier iOS; verificar los valores en la configuración Expo resuelta.
- [x] 2.2 Reconfigurar el icono general, favicon y splash para usar `assets/branding/icon.png`, `assets/branding/favicon.png` y `assets/branding/splash.png`; verificar que cada ruta resuelta existe.
- [x] 2.3 Configurar el adaptive icon Android con `adaptive/foreground.png`, `adaptive/background.png` y `monochrome.png`; verificar que Expo SDK 54 reconoce las tres propiedades sin warnings de configuración.
- [x] 2.4 Buscar referencias a los placeholders anteriores y eliminarlos únicamente cuando ninguna configuración o módulo los utilice; comprobar que el asset funcional de TMDB permanece intacto.

## 3. Verificación multiplataforma

- [x] 3.1 Ejecutar la validación de configuración Expo y `npx tsc --noEmit`, corrigiendo cualquier ruta inválida o error sin introducir dependencias nuevas.
- [x] 3.2 Revisar manualmente Web y confirmar que la aplicación conserva su funcionamiento y que el navegador muestra el favicon y branding finales. Resultado: validación manual completada correctamente.
- [x] 3.3 Compilar, instalar y revisar Android en un dispositivo físico; confirmar el nombre visible, icono, adaptive icon y splash, y verificar estructuralmente la configuración de `monochromeImage`. Resultado: branding Android validado correctamente.
- [x] 3.4 Verificar estructuralmente iOS mediante Expo public config e introspection; confirmar `ios.bundleIdentifier: com.zekito.despueslaveo` y la resolución correcta de los assets/configuración de icono y splash. Resultado: validación estructural completada correctamente en Windows.
- [x] 3.5 Confirmar mediante diff y pruebas de humo que no hubo cambios en `src/theme`, UI, dominio, storage, backups, cuentas ni formatos persistidos.

> Seguimiento no bloqueante: cuando exista acceso a macOS y a un dispositivo o simulador iOS, comprobar visualmente el nombre, icono y splash. Esta prueba no se realizó en el entorno Windows actual y no condiciona el cierre de la change.
