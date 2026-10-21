## ADDED Requirements

### Requirement: Objetivos de SLA por proyecto

Cada proyecto SHALL tener un objetivo de respuesta en minutos y uno de resolución en horas (por defecto 15 minutos y 24 horas), y SHALL poder activar o desactivar los avisos de espera vencida.

#### Scenario: Cambiar los objetivos

- **WHEN** un administrador guarda 5 minutos de respuesta y 8 horas de resolución en Configuración → Opciones
- **THEN** el Resumen y la bandeja usan esos objetivos

#### Scenario: Objetivo inválido

- **WHEN** se envía un objetivo de respuesta de 0 minutos o mayor de 1440
- **THEN** la API responde 400

### Requirement: Espera del cliente

El sistema SHALL registrar desde cuándo espera respuesta el cliente y SHALL dejar de considerarlo en espera cuando reciba una respuesta del bot o del operador, una solicitud de confirmación o una plantilla. El aviso de error del bot SHALL NOT contar como respuesta.

#### Scenario: Varios mensajes seguidos

- **WHEN** el cliente envía tres mensajes sin respuesta
- **THEN** la espera cuenta desde el primero

#### Scenario: Respuesta del operador

- **WHEN** el operador responde
- **THEN** la conversación deja de estar en espera

### Requirement: Cumplimiento en el Resumen

El Resumen SHALL mostrar, para el rango elegido, el porcentaje de turnos respondidos dentro del objetivo, el porcentaje de conversaciones resueltas dentro del objetivo, la mediana de espera y las conversaciones abiertas que esperan fuera de plazo, con acceso a cada una.

#### Scenario: Respuestas en plazo

- **WHEN** dos turnos del rango se respondieron en 2 y 40 minutos con un objetivo de 15
- **THEN** la respuesta en plazo es del 50 %

#### Scenario: Espera vencida sin respuesta

- **WHEN** un cliente lleva más que el objetivo sin respuesta
- **THEN** su turno cuenta como fuera de plazo y la conversación aparece en "Esperando fuera de plazo"

### Requirement: Estado de la espera en la bandeja

La bandeja SHALL marcar las conversaciones cuya espera supera el objetivo como "Fuera de plazo", y las que superan el 75 % como "Vence pronto", actualizándose sin recargar.

#### Scenario: Cliente esperando

- **WHEN** el último mensaje del cliente supera el objetivo de respuesta sin contestar
- **THEN** la conversación muestra "Fuera de plazo" en la bandeja

#### Scenario: Respuesta en vivo

- **WHEN** alguien responde la conversación
- **THEN** la marca desaparece sin recargar

### Requirement: Aviso de espera vencida

Si los avisos están activos y una espera supera el objetivo de respuesta con la conversación abierta, el sistema SHALL avisar al proyecto una sola vez por espera.

#### Scenario: Aviso al vencer

- **WHEN** vence el objetivo y el cliente sigue sin respuesta
- **THEN** el equipo recibe una notificación con la conversación

#### Scenario: Respondida a tiempo

- **WHEN** la conversación se responde antes de vencer el objetivo
- **THEN** no se envía ningún aviso
