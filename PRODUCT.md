# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Operadores de conversación para PYMEs, equipos de soporte/ventas, y agencias de marketing que gestionan chatbots de clientes. Todos trabajan el mismo rol: responder y automatizar conversaciones de clientes que llegan por WhatsApp, Instagram o Web, con un agente IA asistido por RAG y herramientas (tool use).

## Product Purpose

Mitchbot es un SaaS multi-canal de chatbot con IA y RAG: unifica conversaciones de clientes, automatiza respuestas con agentes IA y permite toma de control humano. El éxito es que un operador configure su negocio, suba su base de conocimiento y atienda/automatice el chat de sus clientes desde un solo dashboard.

## Positioning

Automatización conversacional con IA + base de conocimiento (RAG) + herramientas de negocio (citas, pedidos, FAQ) en un único dashboard multi-canal (`auto_pilot` / `human_takeover`), aislado por proyecto.

## Operating Context

- Dashboard web de uso diario (Operate): Messaging en tiempo real, Clients, Brain (RAG), Agents, Settings, Dashboard analytics, Users, Profile.
- Multi-proyecto por usuario; cada proyecto define canales, agente y configuración de negocio.
- Chat público (TestChat) embebible como cara del cliente final.
- Español por defecto, con inglés (i18n).

## Capabilities and Constraints

- Stack: Vue 3 + TypeScript + Tailwind 3 + Pinia + Vue Router + vue-i18n; backend Express + MongoDB + Redis + Qdrant; LangChain/OpenRouter.
- Realtime vía Socket.io (badge de no leídos, modos de chat, insights, tools).
- Los modelos de IA provienen del entorno (solo lectura en Settings).
- La personalización de marca a nivel de proyecto (color, nombre, logo) quedó decidida como requisito del rediseño: debe expuesta en el sistema de diseño (CSS variables/tokens) para poder ser configurada por proyecto. El backend/almacenamiento de esta configuración está pendiente de diseño (decisión abierta).

## Brand Commitments

- Nombre del producto: **Mitchbot**.
- Logotipo provisional: montaje tipográfico del nombre (sin assets gráficos disponibles; no inventar logo final).
- Idioma visible: español.

## Evidence on Hand

- Implementación funcional completa; sin assets de marca, testimonios ni cases reales. No fabricarlos.

## Product Principles

1. El operador atiende conversaciones: claridad y velocidad de escaneo primero; la identidad de marca vive en detalles precisos.
2. Un sistema de diseño tokenizado: el color del proyecto es una variable, no un estilo fijo.
3. Honestidad funcional: solo elementos con comportamiento real.
4. Consistencia multi-vista: un solo lenguaje de componentes en todo el dashboard y el chat público.

## Accessibility & Inclusion

- Interfaz bilingüe (es/en) obligatoria en ambos catálogos.
- Contraste y foco visibles en modo claro/oscuro.
