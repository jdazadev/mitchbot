Plan: Subida de archivos RAG en segundo plano (Redis + BullMQ)

Objetivo
- Evitar bloqueos en el UI cuando los archivos tardan en procesar.
- Exponer progreso y logs internos en tiempo real.
- Mantener trazabilidad por fuente (sourceId) y tiempos por etapa.

Arquitectura propuesta
1) API de subida
   - POST /brain/sources/upload: recibe archivo, registra fuente como Queued y encola job.
   - Responde 202 con { sourceId, status: "Queued" }.

2) Cola con Redis (BullMQ)
   - Queue: rag-upload
   - Worker: procesa archivo por sourceId.
   - Reintentos y control de fallas via BullMQ.

3) Estados y progreso
   - status: Queued | Processing | Indexed | Failed
   - stage: queued | extracting | chunking | embedding | indexing | finalizing
   - progress: 0-100
   - timestamps: startedAt, finishedAt, updatedAt

4) Logs internos
   - Guardar logs por fuente en Mongo: { timestamp, level, stage, message }.
   - Endpoint GET /brain/sources/:id/logs.

5) UI/UX
   - Tabla de fuentes muestra status, stage y barra de progreso.
   - Boton "Ver logs" abre detalle inline con logs.
   - Polling cada 4s para refrescar estado sin bloquear.

Implementacion
- Backend:
  - Model: extender KnowledgeSource con status/stage/progress/logs.
  - Servicios: rag-upload.service (enqueue), rag-job.service (logs/progreso).
  - Worker: rag-upload.worker con BullMQ.
  - Controller: uploadSource encola, getSourceLogs/getSourceStatus.
  - index.ts importa worker para iniciar.

- Frontend:
  - Brain.vue: progreso, stage label y logs UI.
  - brain.service: endpoint logs.

Observabilidad
- Logs internos por fuente.
- Etapas con timestamps para detectar cuellos de botella.

Notas
- Redis ya disponible.
- Ajustar limites de logs si crecen demasiado (p. ej. cap de 100 entries).
