# Sistema de Personalidad Dinámica del Chatbot ✅

> Reemplaza el campo de texto libre `systemPrompt` por un sistema visual de configuración que genera el prompt automáticamente.

---

## Configuraciones del Bot

### 1. Rol (selección única)
El rol define el comportamiento base del bot.

| Opción | Descripción |
|:-------|:------------|
| **Asistente** _(por defecto)_ | Ayuda general, responde preguntas |
| **Profesor** | Explica conceptos, enseña paso a paso |
| **Vendedor** | Persuade, cierra ventas, destaca beneficios |
| **Soporte** | Resuelve problemas técnicos, guía procesos |
| **Atención al cliente** | Gestión de quejas, seguimiento, satisfacción |

---

### 2. Personalidad (máximo 3 rasgos)
Define el tono y estilo de comunicación del bot.

**Opciones:** Formal, Empático, Irreverente, Directo, Objetivo, Entusiasta, Sarcástico, Sociable, Amable, Alegre, Neutro _(por defecto)_.

---

### 3. Contexto del Agente
El **nombre** y la **descripción** del agente se agregan como contexto directo dentro del system prompt.

---

### 4. Creatividad (Temperatura)
Slider numérico de 0.0 a 1.0 con etiquetas visuales:

| Rango | Etiqueta | Descripción |
|:------|:---------|:------------|
| 0.0–0.2 | Muy baja | Respuestas predecibles y consistentes |
| 0.2–0.4 | Baja | Poco variadas pero coherentes |
| 0.4–0.6 | Media | Balance entre coherencia y variedad |
| 0.6–0.8 | Alta | Más creativo y variado |
| 0.8–1.0 | Muy alta | Máxima creatividad |

> ⚠️ Para Alta y Muy alta: mostrar advertencia — "Cuidado: aumenta el riesgo de que el bot pierda coherencia lógica o invente hechos."

**Valor por defecto:** 0.5

---

### 5. Uso de Emojis (selección única)

| Opción | Instrucción en el prompt |
|:-------|:------------------------|
| **Bajo** | "Usa emojis de forma mínima, solo cuando sea necesario" |
| **Medio** _(por defecto)_ | "Usa emojis ocasionalmente para dar calidez" |
| **Alto** | "Usa emojis frecuentemente en tus respuestas" |

---

### 6. Idioma del Bot (selección única)

| Opción | Instrucción en el prompt |
|:-------|:------------------------|
| **Español** _(por defecto)_ | "Responde siempre en español" |
| **Inglés** | "Always respond in English" |
| **Portugués** | "Sempre responda em português" |
| **Detectar automáticamente** | "Responde en el mismo idioma que use el usuario" |

---

### 7. Longitud de Respuesta (selección única)

| Opción | Instrucción en el prompt |
|:-------|:------------------------|
| **Corta** | "Responde de forma breve, máximo 1-2 oraciones" |
| **Media** _(por defecto)_ | "Responde en párrafos cortos, con la información necesaria" |
| **Detallada** | "Responde de forma completa y detallada" |

---

### 8. Comportamiento RAG (selección única)

| Opción | Descripción |
|:-------|:------------|
| **Strict RAG** | Solo responde con información de los documentos proporcionados |
| **Híbrido** _(por defecto)_ | Prioriza documentos, pero puede complementar con conocimiento general |
| **Conocimiento general** | Usa su conocimiento general libremente |

---

### 9. Mensajes automáticos (checkboxes)
Tres toggles que controlan el comportamiento del bot:

- **Saludar siempre** → Saluda al iniciar la conversación o al retomar tras 6 horas.
- **Despedir siempre** → Se despide cuando el usuario se despide o cuando la conversación se cierra.
- **Cuando no sepa la respuesta** → El bot se disculpa y aconseja contactar con un asesor.

**Keywords de despedida (chips)**: Se agregan como chips individuales para definir las palabras clave que activan la despedida automática.

---

### 10. Instrucciones Adicionales (opcional)
Campo de texto libre para agregar instrucciones específicas que no cubren las opciones anteriores.

**Placeholder:** _"Ej: No menciones precios, siempre sugiere contactar a un asesor para cotizaciones..."_

---

## Generación Automática del System Prompt

Todas las configuraciones anteriores se combinan para generar un system prompt automático. El flujo es:

```
Configuraciones del usuario (UI)
        │
        ▼
  buildSystemPrompt()       ← Nueva función en el backend
        │
        ▼
  System Prompt generado    → Se usa en ai.service.ts
```

### Ejemplo de prompt generado:

```
Eres un vendedor empático y entusiasta. 
Nombre del agente: Asistente de Ventas.
Descripción del agente: Atiende consultas y guía al cliente en la compra.
Responde siempre en español. 
Usa emojis frecuentemente en tus respuestas.
Responde en párrafos cortos, con la información necesaria.
Basa tus respuestas en la información de los documentos proporcionados. Si no encuentras la respuesta, puedes complementar con tu conocimiento general.
Saluda al iniciar la conversación o si se retoma luego de 6 horas.
Despídete cuando el usuario se despida o cuando la conversación se cierre.
Si no sabes la respuesta, discúlpate y aconseja contactar con un asesor.

Instrucciones adicionales: No menciones precios, siempre sugiere contactar a un asesor.
```

---

## Vista Previa
Botón para abrir un chat en burbuja y probar la configuración actual.

**Requisitos para la vista previa:**
- Debe haber un proveedor LLM activo
- Debe haber un modelo seleccionado
- Si no se cumplen, mostrar mensaje explicativo

---

## Ubicación en la UI
Esta configuración reemplaza la pestaña **"Agente IA"** en la vista `Settings.vue`. El textarea de `systemPrompt` actual se elimina y se reemplaza por los controles visuales descritos arriba.
