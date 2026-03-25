<p align="center">
  <img width="1024" height="1024" alt="image" src="https://github.com/user-attachments/assets/525778cb-21b6-4f59-a0e9-5b7df453c3c3" />
</p>

# Después-La-Veo

Después-La-Veo es una app hecha con Expo + React Native + Expo Router para descubrir, guardar y organizar películas y series.

La idea nace de un problema simple pero real: Alguien te recomienda algo interesante para ver o vos mismo lo encontraste, querés guardarlo rápido y no perderlo entre capturas, links, mensajes o pestañas abiertas.

La app permite buscar contenido en TMDB, ver detalles enriquecidos y guardarlo localmente en una biblioteca propia con tags, notas y estado de seguimiento.

---

## Qué hace

- Buscar películas y series desde TMDB
- Ver detalle completo con:
  - poster
  - rating
  - géneros
  - overview
  - director y reparto
  - proveedores / dónde ver
- Guardar títulos en una biblioteca local
- Mantener datos útiles en local para evitar requests innecesarios
- Clasificar con tags automáticos y manuales
- Exportar / importar la biblioteca en JSON versionado
- Usar la app también en web

---

## Stack

- **Expo**
- **React Native**
- **Expo Router**
- **TypeScript**
- **SQLite** (`expo-sqlite`)
- **TMDB API**
- **Ionicons**
- **react-native-safe-area-context**

---
## Por qué hice este proyecto

Hice este proyecto por dos razones principales:

### 1. Resolver un problema real

Este proyecto nació de algo muy cotidiano: una amiga suele recomendarme películas y series, pero por mi mala memoria muchas veces las termino olvidando. En vez de depender de chats, capturas o links perdidos, decidí construir una app para guardarlas rápido, tenerlas organizadas y poder volver a encontrarlas fácilmente.

### 2. Aprender construyendo un producto útil

También quise usar este proyecto para practicar decisiones de arquitectura y desarrollo más cercanas a una app real:

- navegación file-based con Expo Router
- persistencia local con SQLite
- diseño mobile-first
- separación entre UI, providers y almacenamiento
- exportación/importación de datos
- optimización UX usando snapshots locales para no depender de requests constantes

---

## Decisiones técnicas

### Expo + React Native
Elegí Expo para desarrollar una app multiplataforma con una sola base de código y poder probar también una versión web.

### Expo Router
Usé Expo Router para ordenar la navegación por archivos y mantener una estructura clara de pantallas, tabs y rutas dinámicas.

### SQLite local-first
La biblioteca del usuario se guarda en SQLite para que la app sea útil incluso sin backend propio. También me permitió trabajar un enfoque más cercano a una app local-first.

### Snapshot local de títulos
Cuando un usuario guarda un título, además de guardar la referencia externa, se persiste un snapshot liviano con campos útiles como overview, voteAverage y genres. Esto mejora la pantalla Biblioteca porque evita hacer requests extra solo para renderizar cards.

### Tags automáticos desde géneros
Al guardar contenido desde TMDB, los géneros también se transforman en tags automáticos. Eso mejora el filtrado desde el primer guardado y reduce fricción en la organización.

### Export / Import versionado
La app soporta exportar e importar la biblioteca en JSON versionado para facilitar backups y futuras migraciones de datos.

---

## Estructura del proyecto

```txt
app/
  (tabs)/
    _layout.tsx
    buscar.tsx
    biblioteca.tsx
    etiquetas.tsx
    ajustes.tsx
  tmdb/[type]/[id].tsx
  title/[id].tsx

src/
  core/
    savedTitle.ts
  providers/tmdb/
    tmdbApi.ts
    tmdbClient.ts
    tmdbTypes.ts
  storage/
    db.ts
    savedTitlesRepo.ts
  theme/
    colors.ts
```

---

## Variables de entorno

Crear un archivo .env.local en la raíz:

```env
EXPO_PUBLIC_TMDB_TOKEN=tu_token
```

--- 

## Cómo correr el proyecto

```Bash
npm install
npx expo start
```

Para web:
```Bash
npx expo start --web
```

---

## Demo

En progreso.

---

## Lo que aprendí

Este proyecto me ayudó a practicar:

- navegación en Expo Router
- manejo de rutas dinámicas
- persistencia local con SQLite
- diseño de tipos y repositorios
- separación básica de responsabilidades
- pensar UX más allá de “que funcione”

Autor

Duarte Ezequiel (Zekito)
GitHub: https://github.com/Zek1t0
