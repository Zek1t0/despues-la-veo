## Purpose

Permitir al desarrollador mantener dependencias y revisar cambios reales con evidencia reproducible, protegiendo contenido personal y conservando decisiones y checkpoints humanos explícitos.

## ADDED Requirements

### Requirement: comandos de desarrollo con intención explícita
El proyecto MUST conservar android e ios como compilación/ejecución nativa, ofrecer android:start e ios:start para iniciar el servidor y abrir el destino, y conservar start y web. MUST documentar requisitos de plataforma sin afirmar que Windows compila iOS localmente ni que run implica expo-dev-client instalado.

#### Scenario: elegir build o inicio
- **WHEN** el desarrollador usa android o ios, o sus variantes :start
- **THEN** obtiene respectivamente expo run:android/run:ios o expo start --android/--ios
- **AND** start continúa siendo expo start y web expo start --web

### Requirement: bundle externo de cambios reales
El helper MUST requerir un baseline Git explícito resoluble a commit y destino externo al repositorio. MUST mostrar branch, HEAD, status, límite de revisión y archivos afectados. MUST entregar únicamente manifest.md, net.patch y untracked/ con nuevos archivos permitidos no ignorados. net.patch MUST representar la diferencia tracked FINAL completa desde baseline hasta working tree dentro del alcance permitido, con salida Git binaria segura. El manifiesto sanitizado MUST identificar separadamente committed, staged y unstaged, incluidos archivos cuyos cambios se cancelan en el neto. MUST NOT presentar net.patch como historial de contenido intermedio ni exigir patches completos de cada capa. MUST conservar contenido real permitido, adiciones, modificaciones, borrados, renames y binarios, incluidas rutas con espacios y Unicode; las exclusiones MUST hacer explícitos los límites de completitud.

#### Scenario: capas simultáneas y archivos nuevos
- **WHEN** hay commits posteriores al baseline, cambios staged/unstaged sobre un mismo archivo y un archivo nuevo
- **THEN** net.patch permite revisar el resultado tracked final respecto del baseline, el manifiesto identifica separadamente las capas y untracked/ conserva el contenido real del archivo nuevo
- **AND** el bundle no afirma exportar el contenido de versiones intermedias

#### Scenario: cambios que se cancelan
- **WHEN** un archivo difiere en committed, staged o unstaged pero vuelve al contenido del baseline en working tree
- **THEN** el manifiesto identifica sus capas y la cancelación aunque no aparezca en net.patch
- **AND** no se generan patches intermedios para reconstruir esa historia

#### Scenario: borrado rename binario y Unicode
- **WHEN** los archivos permitidos contienen un borrado, un rename, un binario y nombres con espacios o Unicode
- **THEN** el reviewer puede examinar el contenido y los cambios sin pérdida ni corrupción de bytes o nombres

#### Scenario: entrada inválida
- **WHEN** falta el baseline, no resuelve a commit o el destino se encuentra dentro del repo incluso mediante enlace
- **THEN** el helper falla con diagnóstico y no exporta contenido

### Requirement: exclusión previa a materializar contenido
El helper MUST filtrar contenido personal/sensible antes de escribir cualquier patch, snapshot, archivo temporal o salida exportada. MUST proteger archivos env privados, credenciales, DBs locales, backups y generados, admitir exclusiones explícitas y registrar sus motivos sin revelar secretos. MUST NOT confiar únicamente en gitignore ni seguir enlaces hacia contenido externo. Un bundle parcial MUST declarar sus exclusiones; una revisión completa MUST NOT ocultar cambios de aplicación aprobados mediante exclusiones genéricas.

#### Scenario: secreto tracked o nuevo
- **WHEN** un archivo sensible está tracked, fue borrado o es untracked y coincide con la política de protección
- **THEN** ninguna versión de su contenido aparece en los artefactos y el manifiesto identifica la exclusión sin copiar valores privados

#### Scenario: exclusión que cruza un rename
- **WHEN** uno de los extremos del rename es sensible
- **THEN** el helper protege ambos extremos antes de exportar, no recupera ese contenido mediante detección de renames y declara el alcance omitido

### Requirement: incorporación explícita del package personal
El flujo MUST conservar los cambios personales previos de package.json hasta la revisión y commit manual de A1. MUST distinguir una captura parcial protegida, la revisión explícita de los scripts aprobados y la revisión completa posterior. MUST NOT excluir silenciosamente scripts o dependencias aprobados de la revisión final.

#### Scenario: antes de incorporar scripts
- **WHEN** se genera un bundle con la protección personal predeterminada
- **THEN** package.json se excluye antes de exportar y el manifiesto declara que ese bundle no completa la revisión de scripts

#### Scenario: scripts revisables y checkpoint posterior
- **WHEN** se revisa explícitamente la incorporación exacta de scripts y luego el usuario crea su checkpoint manual
- **THEN** el reviewer puede examinar el diff real de package.json y el bundle completo posterior lo incluye junto con los cambios de dependencias aprobados

#### Scenario: protección personal en cierre completo
- **WHEN** se solicita un bundle completo manteniendo package.json protegido o excluyendo otro cambio aprobado
- **THEN** se rechaza la declaración de completitud y se exige resolver o declarar el límite pendiente antes de cerrar

### Requirement: generación de revisión sin efectos sobre el proyecto
El helper MUST NOT modificar source, índice, configuración Git, branch ni commits, y MUST NOT ejecutar tests, installs, hooks de revisión externos o comandos de usuario. La ejecución de validaciones MUST permanecer separada. MUST informar fallo si detecta cambios concurrentes que impiden una captura consistente.

#### Scenario: generación exitosa o fallida
- **WHEN** termina o falla una captura sobre un checkout estable
- **THEN** los bytes originales, entradas del índice y estado Git permanecen iguales y solo se escribe en el destino externo

### Requirement: remediación con decisión concreta y compatibilidad
Antes de cambiar dependencias, el flujo MUST presentar advisories completos vigentes, versión instalada/propuesta, ruta transitiva, exposición runtime/tooling, rangos, compatibilidad, impacto del lockfile, tests y riesgo residual por candidato. MUST aplicar solo el subconjunto explícitamente aprobado. MUST revalidar shell-quote incluyendo advisories nuevos sin asumir que 1.9.0 los resuelve. MUST NOT migrar implícitamente SDK/RN/Router ni usar audit fix --force. Cada override MUST requerir justificación, paquete/versión/ruta exactos, plan de compatibilidad y aprobación específica.

#### Scenario: gate no aprobado
- **WHEN** se ha preparado una matriz pero no se aprobó un candidato u override
- **THEN** no se aplica ese cambio y se conserva la evidencia de la decisión pendiente

#### Scenario: advisory sin solución compatible
- **WHEN** no existe un fix publicado compatible, como el hallazgo deepmerge de la exploración si sigue vigente
- **THEN** se documentan condición de explotación, efecto, alternativas descartadas y revisión futura, sin inventar un parche ni exigir una migración mayor para cerrar
- **AND** el cierre requiere aceptación explícita del riesgo residual por el usuario

### Requirement: evidencia proporcional y cierre independiente
El flujo MUST conservar validación relevante, revisión externa del diff real, corrección de bloqueantes y commit/push manual para A1 y A2 antes de continuar. A3 MUST completar validación y regresión final antes de UN evento externo que examine tanto el diff real A3 desde el checkpoint A2 como el diff real completo desde f234faa. Tras corregir bloqueantes, revalidar lo pertinente y obtener aprobación externa de ambas coberturas y aceptación de residuales, MUST realizarse UN checkpoint final manual, sin checkpoint A3 intermedio ni segunda revisión completa rutinaria. Archive, revisión externa del archive, checkpoint manual de archive e integración a main MUST ser posteriores y separados. MUST informar resueltos/residuales, archivos, scripts/lockfile, compatibilidad, comandos/resultados/límites y ambos baselines externos. MUST conservar datos, SQLite v5, backups v6/import histórico, providers y gates sin activar arte MangaUpdates.

#### Scenario: revisión final conjunta
- **WHEN** A3 tiene validación y regresión final disponibles
- **THEN** un único evento externo examina el diff A3 desde A2 y el diff completo desde el baseline integrado, incluidos nuevos archivos y cambios aprobados de package.json/lockfile
- **AND** las correcciones se revalidan y revisan en ese mismo ciclo hasta aprobar ambas coberturas antes del único checkpoint final manual
- **AND** archive y su revisión externa permanecen independientes y posteriores

#### Scenario: evidencia simulada o suite costosa
- **WHEN** se usan Node/Web/plataformas simuladas o una validación previa sigue aplicando
- **THEN** se declaran sus límites, no se acredita Android físico y se repiten suites caras solo por cambios/fallos/brechas materiales

#### Scenario: cierre técnico con residuales aceptados
- **WHEN** pasó la regresión pertinente, se resolvieron bloqueantes y el usuario aceptó residuales documentados
- **THEN** se informa preparación para archive independiente, sin archivarlo ni integrar automáticamente
