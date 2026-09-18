import { ragService } from '../services/rag.service';
import { Tool } from './types';

/** Responde preguntas frecuentes usando la base de conocimiento (RAG) */
export const getFaqAnswerTool: Tool = {
  name: 'get_faq_answer',
  description: 'Responde preguntas frecuentes usando la base de conocimiento del negocio (políticas, envíos, garantías, etc.).',
  parameters: {
    type: 'object',
    properties: {
      question: {
        type: 'string',
        description: 'La pregunta del cliente que se desea responder.',
      },
    },
    required: ['question'],
  },
  async execute(params, context) {
    const question = String(params?.question || context.userMessage || '').trim();
    if (!question) {
      return { success: false, message: 'No se especificó la pregunta.', error: 'missing_question' };
    }

    try {
      const collectionName = await ragService.getProjectCollectionName(context.projectId);
      const docs = await ragService.search(question, collectionName, 3, context.projectId);
      const text = docs
        .map(d => (d.pageContent || '').trim())
        .filter(Boolean)
        .slice(0, 3)
        .join('\n\n');

      if (!text) {
        return {
          success: true,
          message: 'No encontré una respuesta a esa pregunta en la base de conocimiento.',
          data: { found: false },
        };
      }

      return {
        success: true,
        message: `Respuesta basada en la base de conocimiento:\n${text}`,
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
