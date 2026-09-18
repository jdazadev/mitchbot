El secreto para filtrar rapido y bien en Qdrant no esta en el vector en si, sino en como disenas el Payload y en como divides el documento original.

Aqui tienes la arquitectura recomendada y el plan de refactor para el flujo de subida RAG:

1. Arquitectura de ingesta (proceso)
No subes un PDF o Word completo directamente a Qdrant. El flujo correcto es:

1) Extraccion: convierte el archivo a texto plano.
   - PDF y CSV: usar el modelo LLM tipo file.
   - TXT: lectura directa (sin LLM).
2) Chunking: fragmenta el texto (ej. 500-1000 tokens) con overlap.
3) Embedding: genera el vector por fragmento con el modelo de embeddings activo.
4) Upsert: sube vector + payload estructurado a Qdrant.

2. Payload ideal (metadatos)
Para filtros potentes, el payload debe ser un espejo del documento:

JSON
{
  "document_id": "doc_98765",
  "chunk_id": 4,
  "text": "Contenido exacto del fragmento...",
  "source": "manual_de_usuario_v2.pdf",
  "category": "recursos_humanos",
  "tags": ["vacaciones", "politica", "2024"],
  "author": "Maria Perez",
  "created_at": "2024-03-15T08:30:00Z",
  "access_level": "empleados",
  "project_id": "project_123",
  "source_id": "mongo_id"
}

Por que este formato ayuda a filtrar mejor:
- text: Qdrant devuelve el texto directamente para usar en el contexto RAG.
- document_id + chunk_id: trazabilidad y borrado por documento completo.
- category/tags/access_level: filtros categoricos rapidos.
- created_at: filtros por rango (fechas).

3. Indices dinamicos en payload (config en BD)
Qdrant no indexa campos de payload automaticamente. Para filtrar rapido, crea indices
en campos clave definidos en BD.

Config sugerida (app_config):
key: rag.qdrant_payload_indexes
value:
[
  { "field": "category", "type": "keyword" },
  { "field": "tags", "type": "keyword" },
  { "field": "access_level", "type": "keyword" },
  { "field": "created_at", "type": "datetime" }
]

4. Ajustes en pipeline
- Enriquecer KnowledgeSource con metadata: category, tags, author, accessLevel, sourceCreatedAt.
- Inyectar metadata en cada chunk (payload completo).
- Asegurar indices antes de insertar vectores.

5. Reindexado y borrado
- Reindex debe regenerar payload completo con metadata.
- Borrado por document_id/source_id para eliminar todo el documento.
