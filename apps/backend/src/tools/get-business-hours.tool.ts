import { configService } from '../services/config.service';
import { Tool } from './types';
import { DAY_LABELS_ES, DAY_NAMES, parseHoursRange } from './helpers';

/** Horario de atención configurado para el negocio */
export const getBusinessHoursTool: Tool = {
  name: 'get_business_hours',
  description: 'Devuelve el horario de atención del negocio. Úsala cuando el cliente pregunte cuándo abren o cierran.',
  parameters: {
    type: 'object',
    properties: {},
  },
  async execute(): Promise<any> {
    const hours = await configService.get('business.hours');

    if (!hours || typeof hours !== 'object') {
      return {
        success: true,
        message: 'No hay un horario de atención configurado para el negocio.',
        data: { configured: false },
      };
    }

    const lines: string[] = [];
    const data: Record<string, string> = {};
    // Mostrar de lunes a domingo
    const orderedDays = [...DAY_NAMES.slice(1), DAY_NAMES[0]];
    for (const day of orderedDays) {
      const range = parseHoursRange((hours as any)[day]);
      const label = DAY_LABELS_ES[day as keyof typeof DAY_LABELS_ES];
      if (!range) {
        lines.push(`${label}: cerrado`);
        data[day] = 'closed';
      } else {
        lines.push(`${label}: ${range.open} - ${range.close}`);
        data[day] = `${range.open}-${range.close}`;
      }
    }

    return {
      success: true,
      message: `Horario de atención:\n${lines.join('\n')}`,
      data,
    };
  },
};
