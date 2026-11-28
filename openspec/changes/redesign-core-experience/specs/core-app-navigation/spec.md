## Purpose

Permitir entrar rápidamente a la biblioteca local y navegar entre exploración, actividad y organización con retornos predecibles.

## ADDED Requirements

### Requirement: Biblioteca es la entrada y la barra tiene tres destinos

La app MUST iniciar en Biblioteca y la barra MUST mostrar Biblioteca, Buscar y Actividad. Ajustes MUST poder abrirse mediante icono nombrado en el encabezado. Biblioteca MUST dar acceso a Colecciones, Etiquetas, Inbox, alta manual y selector local. Los destinos deben usar nomenclatura consistente y conservar rutas entrantes y contexto de retorno aplicable.

#### Scenario: Inicio y organización
- **WHEN** se abre la aplicación y se entra a Etiquetas o Inbox
- **THEN** Biblioteca aparece primero, la barra conserva tres destinos y se puede regresar al origen

#### Scenario: Ruta entrante y retorno contextual
- **WHEN** se abre un enlace existente a Ajustes, Etiquetas, Organizar o una ficha y se usa Atrás
- **THEN** la ruta sigue resolviendo y se conserva el origen cuando existe o un regreso funcional a Biblioteca cuando se entra directamente
