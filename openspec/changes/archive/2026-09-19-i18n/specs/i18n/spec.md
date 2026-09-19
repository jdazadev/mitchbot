## Purpose

Define la internacionalización de la interfaz del dashboard (español e inglés) y del chat público del cliente, con selección de idioma, catálogos de traducción y persistencia de la preferencia.

## ADDED Requirements

### Requirement: Selección del idioma de la interfaz

El sistema SHALL ofrecer un selector de idioma en la barra superior del dashboard con español e inglés, con español por defecto. La preferencia SHALL persistir entre sesiones en el dispositivo del usuario y SHALL aplicarse de inmediato a la interfaz sin recargar. El atributo `lang` del documento SHALL reflejar el idioma activo.

#### Scenario: Idioma por defecto

- **WHEN** el usuario abre el dashboard sin una preferencia guardada
- **THEN** la interfaz se muestra en español

#### Scenario: Cambio de idioma inmediato

- **WHEN** el usuario selecciona inglés en el selector
- **THEN** toda la interfaz cambia a inglés sin recargar

#### Scenario: Persistencia

- **WHEN** el usuario cambia el idioma y vuelve a abrir la aplicación
- **THEN** la interfaz conserva el idioma elegido

#### Scenario: Atributo de idioma del documento

- **WHEN** el idioma activo es inglés
- **THEN** el atributo `lang` del documento es `en`

### Requirement: Catálogos de traducción sin textos mezclados

El sistema SHALL obtener todos los textos visibles del dashboard de los catálogos de traducción y SHALL NOT contener textos de interfaz hardcodeados en las vistas. Ambos catálogos SHALL estar completos; cuando falte una clave, el sistema SHALL recurrir al español como respaldo.

#### Scenario: Sin idiomas mezclados

- **WHEN** el usuario navega entre las vistas del dashboard en español
- **THEN** no aparecen textos en inglés hardcodeados en los mismos flujos

#### Scenario: Clave faltante con respaldo

- **WHEN** una clave no existe en el catálogo de inglés
- **THEN** el sistema muestra el texto en español en lugar de la clave

#### Scenario: Cobertura de vistas

- **WHEN** se cambia el idioma
- **THEN** el cambio se refleja en el menú, la barra superior y todas las vistas del dashboard

### Requirement: Idioma del chat público independiente

El sistema SHALL mostrar el chat público del cliente en el idioma del agente configurado para el proyecto, de forma independiente del idioma elegido en el dashboard. El idioma del dashboard SHALL NOT alterar los textos del chat público.

#### Scenario: Chat público en el idioma del agente

- **WHEN** el agente del proyecto está configurado en inglés y un cliente abre el chat público
- **THEN** los textos de la interfaz del chat se muestran en inglés

#### Scenario: Independencia respecto al dashboard

- **WHEN** un agente del dashboard cambia el idioma de su interfaz a inglés mientras el agente del proyecto está configurado en español
- **THEN** el chat público sigue mostrándose en español
