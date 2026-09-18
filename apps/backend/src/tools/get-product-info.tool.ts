import { ragService } from '../services/rag.service';
import { Tool } from './types';

/** Consulta información de productos/servicios en la base de conocimiento (RAG) */
export const getProductInfoTool: Tool = {
  name: 'get_product_info',
  description: 'Busca información de productos o servicios en la base de conocimiento del negocio. Úsala para precios, características o disponibilidad.',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Términos de búsqueda del producto o servicio (por ejemplo "precio corte de cabello").',
      },
    },
    required: ['query'],
  },
  async execute(params, context) {
    const query = String(params?.query || context.userMessage || '').trim();
    if (!query) {
      return { success: false, message: 'No se especificó qué producto buscar.', error: 'missing_query' };
    }

    try {
      const collectionName = await ragService.getProjectCollectionName(context.projectId);
      const docs = await ragService.search(query, collectionName, 3, context.projectId);
      const text = docs
        .map(d => (d.pageContent || '').trim())
        .filter(Boolean)
        .slice(0, 3)
        .join('\n\n');

      if (!text) {
        return {
          success: true,
          message: 'No encontré información sobre ese producto en la base de conocimiento.',
          data: { found: false },
        };
      }

      return {
        success: true,
        message: `Información encontrada:\n${text}`,
        data: { found: true, results: docs.length },
      };
    } catch (error: any) {
      return {
        success: false,
        message: 'No se pudo consultar la base de conocimiento.',
        error: error?.message || String(error),
      };
    }
  },
};
