# agent-configuration Specification

## Purpose

Define los ajustes de configuración del agente de IA, en particular el idioma en el que responde, restringido a español e inglés.

## Requirements

### Requirement: Idioma del agente limitado a español e inglés

El sistema SHALL permitir configurar el idioma del agente únicamente entre español e inglés. El sistema SHALL NOT ofrecer las opciones Portugués ni "Detectar"/automático, y SHALL rechazar cualquier valor de idioma distinto de español o inglés. Los agentes existentes con un idioma no soportado SHALL normalizarse a español. El idioma configurado SHALL determinar el idioma de las respuestas del agente.

#### Scenario: Opciones de idioma restringidas

- **WHEN** el usuario abre la configuración del agente
- **THEN** solo se ofrecen Español e Inglés
- **AND** no aparecen Portugués ni "Detectar"

#### Scenario: Valor de idioma inválido rechazado

- **WHEN** se envía un idioma distinto de español o inglés
- **THEN** el sistema rechaza la solicitud con un error de validación

#### Scenario: Normalización de agentes existentes

- **WHEN** un agente almacenado tiene idioma portugués o automático
- **THEN** el sistema lo trata como español

#### Scenario: Idioma aplicado a las respuestas

- **WHEN** el agente está configurado en inglés y recibe un mensaje
- **THEN** responde en inglés
