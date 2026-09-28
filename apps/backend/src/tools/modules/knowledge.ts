import { ragService } from '../../services/rag.service';
import { defineToolOperation } from '../operation';
import { ToolModule } from '../types';

const read = defineToolOperation('conocimiento', 'leer', 'ninguna',
  'Busca información del negocio, productos, servicios o preguntas frecuentes en la base de conocimiento.', {
    type: 'object', properties: { query: { type: 'string', description: 'Pregunta o términos de búsqueda del cliente.' } }, required: ['query'],
  }, async (params, context) => {
    const query = String(params.query || context.userMessage || '').trim();
    if (!query) return { success: false, message: 'No se especificó qué información buscar.', error: 'missing_query' };
    try {
      const collectionName = await ragService.getProjectCollectionName(context.projectId);
      const docs = await ragService.search(query, collectionName, 3, context.projectId);
      const text = docs.map(document => (document.pageContent || '').trim()).filter(Boolean).slice(0, 3).join('\n\n');
      return text
        ? { success: true, message: `Información encontrada:\n${text}`, data: { found: true, results: docs.length } }
        : { success: true, message: 'No encontré información relacionada en la base de conocimiento.', data: { found: false } };
    } catch (error: any) {
      return { success: false, message: 'No se pudo consultar la base de conocimiento.', error: error?.message || String(error) };
    }
  });

export const knowledgeModule: ToolModule = {
  id: 'conocimiento', label: 'Conocimiento',
  bindings: [{ id: 'internal', label: 'Módulo interno', operations: ['leer'] }],
  operations: { leer: read },
};
