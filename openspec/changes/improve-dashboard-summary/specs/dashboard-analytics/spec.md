# dashboard-analytics (delta)

## MODIFIED Requirements

### Requirement: Aislamiento de las métricas por proyecto

Todas las métricas del dashboard —conversaciones totales, activas y cerradas, volumen por período y por emisor, distribución por canal, actividad reciente, tasa de respuesta y tiempo de primera respuesta, backlog, cobertura del bot, leads capturados, citas agendadas, tasa de conversión, distribución de sentimiento y uso de herramientas— SHALL calcularse únicamente sobre los datos del proyecto resuelto. El sistema SHALL NOT mezclar datos de otros proyectos.

#### Scenario: Conteo total acotado al proyecto

- **WHEN** existen conversaciones en varios proyectos y el usuario consulta el total de conversaciones
- **THEN** el total corresponde solo a las conversaciones del proyecto activo

#### Scenario: Conteos por estado acotados al proyecto

- **WHEN** el usuario consulta conversaciones activas y cerradas
- **THEN** ambas cifras se calculan solo sobre las conversaciones del proyecto activo

#### Scenario: Volumen y distribución acotados al proyecto

- **WHEN** el usuario consulta el volumen por período y la distribución por canal
- **THEN** ambos se calculan solo con las conversaciones del proyecto activo

#### Scenario: Actividad reciente acotada al proyecto

- **WHEN** el usuario consulta la actividad reciente
- **THEN** solo se devuelven eventos del proyecto activo

#### Scenario: Métricas de negocio y automatización acotadas al proyecto

- **WHEN** el usuario consulta leads, citas, conversión, cobertura del bot, sentimiento o uso de herramientas
- **THEN** cada métrica se calcula solo con los registros del proyecto activo

#### Scenario: Métricas de mensajería acotadas al proyecto

- **WHEN** el usuario consulta la tasa de respuesta, el tiempo de primera respuesta, el backlog o el volumen por emisor
- **THEN** cada métrica se calcula solo con las conversaciones y mensajes del proyecto activo

### Requirement: Selección del rango temporal de las métricas

El sistema SHALL permitir acotar las métricas por un rango temporal expresado como número de días o como fechas de inicio y fin. Cuando no se indique rango, SHALL NOT aplicar recorte temporal. El aislamiento por proyecto SHALL mantenerse con cualquier rango.

#### Scenario: Rango por días

- **WHEN** el usuario selecciona los últimos 7, 30 o 90 días
- **THEN** todas las métricas del dashboard se recalculan para ese rango
- **AND** siguen acotadas al proyecto activo

#### Scenario: Sin rango

- **WHEN** no se indica rango temporal
- **THEN** el sistema calcula las métricas sin recorte de fechas

## ADDED Requirements

### Requirement: Métrica real de tasa de respuesta

El sistema SHALL calcular la tasa de respuesta como el porcentaje de conversaciones del rango que, teniendo al menos un mensaje entrante del cliente, cuentan con al menos una respuesta posterior del bot o de un agente humano. El sistema SHALL NOT devolver un valor fijo ni estimado. Cuando no existan conversaciones en el rango, la tasa SHALL ser `0%`.

#### Scenario: Cálculo sobre datos reales

- **WHEN** el usuario consulta la tasa de respuesta para un rango
- **THEN** el valor refleja la proporción real de conversaciones atendidas en ese rango

#### Scenario: Sin datos

- **WHEN** no existen conversaciones en el rango consultado
- **THEN** la tasa de respuesta es `0%`

#### Scenario: Sin valor fijo

- **WHEN** la tasa de respuesta se muestra en el Resumen
- **THEN** su valor proviene del cálculo sobre la mensajería y no de una constante

### Requirement: Tiempo de primera respuesta

El sistema SHALL calcular el tiempo de primera respuesta como la mediana del intervalo entre el primer mensaje entrante del cliente y la primera respuesta posterior (del bot o de un agente humano) de cada conversación del rango. Las conversaciones sin respuesta SHALL excluirse del cálculo. Cuando no exista ninguna conversación con respuesta, la métrica SHALL mostrar un estado vacío.

#### Scenario: Mediana real

- **WHEN** el usuario consulta el tiempo de primera respuesta para un rango
- **THEN** el valor corresponde a la mediana de los intervalos reales de las conversaciones atendidas

#### Scenario: Conversaciones sin respuesta excluidas

- **WHEN** existen conversaciones cuyo primer mensaje del cliente nunca fue respondido
- **THEN** esas conversaciones no participan en el cálculo de la mediana

#### Scenario: Sin datos suficientes

- **WHEN** ninguna conversación del rango tiene respuesta
- **THEN** la métrica se presenta como estado vacío en lugar de un valor

### Requirement: Backlog accionable

El sistema SHALL exponer el trabajo pendiente del proyecto como el número de conversaciones en estado `pending_human` y el total de mensajes no leídos. Ambos valores SHALL actualizarse con el rango temporal aplicado donde corresponda y SHALL calcularse sobre el proyecto activo.

#### Scenario: Conversaciones esperando humano

- **WHEN** el usuario abre el Resumen
- **THEN** ve cuántas conversaciones están en `pending_human`

#### Scenario: Mensajes sin leer

- **WHEN** existen conversaciones con mensajes no leídos
- **THEN** el Resumen muestra la suma de no leídos del proyecto

### Requirement: Cobertura del bot

El sistema SHALL calcular la cobertura del bot como el porcentaje de conversaciones del rango en modo `auto_pilot` frente al total de conversaciones del rango (siendo el resto `human_takeover`). Cuando no existan conversaciones en el rango, la cobertura SHALL ser `0%`.

#### Scenario: Distribución de modos

- **WHEN** el usuario consulta la cobertura del bot para un rango
- **THEN** el valor refleja la proporción real de conversaciones atendidas por el bot frente a las de takeover humano

### Requirement: Leads capturados

El sistema SHALL exponer como "leads capturados" el número de contactos creados dentro del rango temporal, acotado al proyecto activo.

#### Scenario: Conteo de leads del rango

- **WHEN** el usuario consulta los leads capturados para un rango
- **THEN** el valor corresponde a los contactos creados dentro de ese rango en el proyecto activo

### Requirement: Citas agendadas

El sistema SHALL exponer el número de citas creadas en el rango temporal, desglosadas por estado (`pending`, `confirmed`, `completed`, `cancelled`), acotado al proyecto activo.

#### Scenario: Citas por estado

- **WHEN** el usuario consulta las citas agendadas para un rango
- **THEN** el Resumen muestra el total de citas y su desglose por estado

### Requirement: Tasa de conversión

El sistema SHALL exponer la tasa de conversión como el porcentaje de contactos (leads) creados en el rango sobre las conversaciones creadas en el mismo rango. Cuando no existan conversaciones en el rango, la tasa SHALL ser `0%`.

#### Scenario: Conversión de conversaciones a leads

- **WHEN** el usuario consulta la tasa de conversión para un rango
- **THEN** el valor corresponde a `leads / conversaciones` del rango

### Requirement: Distribución agregada de sentimiento

El sistema SHALL agregar el sentimiento de las conversaciones del rango que tengan análisis disponible, mostrando la distribución entre `positive`, `neutral` y `negative`. Las conversaciones sin análisis SHALL excluirse. Cuando ninguna conversación del rango tenga análisis, el sistema SHALL mostrar un estado vacío en lugar de valores fijos.

#### Scenario: Distribución real

- **WHEN** el usuario consulta la distribución de sentimiento para un rango
- **THEN** el Resumen muestra la proporción de conversaciones positivas, neutrales y negativas analizadas

#### Scenario: Sin análisis disponibles

- **WHEN** ninguna conversación del rango tiene sentimiento calculado
- **THEN** el bloque muestra un estado vacío

### Requirement: Uso de herramientas

El sistema SHALL exponer las herramientas más ejecutadas en el rango, con su número de ejecuciones y su tasa de éxito (ejecuciones en estado `executed` sobre el total). Cuando no existan ejecuciones en el rango, el sistema SHALL mostrar un estado vacío.

#### Scenario: Top de herramientas

- **WHEN** el usuario consulta el uso de herramientas para un rango
- **THEN** el Resumen lista las herramientas ordenadas por número de ejecuciones con su tasa de éxito

#### Scenario: Sin ejecuciones

- **WHEN** no hay ejecuciones de herramientas en el rango
- **THEN** el bloque muestra un estado vacío

### Requirement: Volumen de mensajes por emisor

El sistema SHALL exponer, además del volumen de conversaciones, el volumen de mensajes agrupado por período y por emisor, distinguiendo al menos cliente, bot y agente humano. Los mensajes internos de herramientas SHALL NOT contarse como mensajes de conversación.

#### Scenario: Desglose por emisor

- **WHEN** el usuario consulta el volumen para un rango y período
- **THEN** el Resumen muestra la cantidad de mensajes de cliente, bot y agente humano por período

### Requirement: Actividad reciente con eventos reales

El sistema SHALL registrar eventos de actividad del proyecto al menos al crear una conversación, al cerrarla, al crear un contacto y al ejecutar una herramienta. El Resumen SHALL mostrar los eventos registrados del proyecto activo ordenados del más reciente al más antiguo. Cuando no existan eventos, SHALL mostrar un estado vacío.

#### Scenario: Eventos registrados

- **WHEN** ocurre la creación de una conversación, el cierre de una conversación, la creación de un contacto o la ejecución de una herramienta
- **THEN** se registra un evento de actividad asociado al proyecto

#### Scenario: Actividad visible en el Resumen

- **WHEN** el proyecto tiene eventos de actividad registrados
- **THEN** el Resumen muestra los más recientes en orden cronológico inverso

#### Scenario: Sin actividad

- **WHEN** el proyecto no tiene eventos de actividad
- **THEN** el Resumen muestra un estado vacío
