Plan: Extraccion y chunking RAG (opcion 2)

Fecha
- 2026-04-01

Objetivo
- Mejorar la recepcion y extraccion de texto antes del embedding.
- Usar modelos multimodales (OpenRouter) para PDF e imagen.
- Mantener chunking controlado para indexacion estable.

Opciones evaluadas
1) OCR/Extraccion previa (no implementada)
   - PDF: intento LLM file -> parser pdf-parse -> OCR local si parece escaneado.
   - Imagen: OCR local con fallback a LLM file si OCR no devuelve texto.
   - CSV/TXT: lectura directa (CSV puede pasar por LLM file si esta configurado).
   - Chunking: RecursiveCharacterTextSplitter (1000 chars, overlap 200) sobre texto limpio.

2) LLM multimodal (opcion elegida)
   - Envio directo de PDF/imagen a un modelo vision (OpenRouter) usando tipo file/image.
   - Menor dependencia de OCR local y binarios nativos.

Decision
- Se implementa la opcion 2 (LLM multimodal) usando OpenRouter en providers tipo file/image.

Detalle del flujo implementado
- PDF
  - Intento LLM tipo file (si existe).
  - Si no hay texto, extraer via pdf-parse.
  - Si parece escaneado, usar LLM vision (file/image segun config).
- Imagen
  - LLM vision con provider tipo image (fallback a file si falta image).
- CSV/TXT
  - CSV intenta LLM file y si falla se lee raw.
  - TXT se lee raw.
- Chunking
  - Limpieza de saltos de linea y espacios.
  - RecursiveCharacterTextSplitter (chunkSize 1000, overlap 200).

Notas
- Se registra extractionMethod para trazabilidad (parser, csv, raw, llm_file, llm_vision).
