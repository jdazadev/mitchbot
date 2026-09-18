import { configService } from '../services/config.service';
import { appointmentService } from '../services/appointment.service';
import { Tool } from './types';
import { generateSlots, parseHoursRange, weekdayName } from './helpers';

/** Consulta los horarios disponibles para agendar una cita/servicio */
export const getServiceAvailabilityTool: Tool = {
  name: 'get_service_availability',
  description: 'Consulta los horarios disponibles para agendar una cita en una fecha concreta.',
  parameters: {
    type: 'object',
    properties: {
      date: {
        type: 'string',
        description: 'Fecha a consultar en formato YYYY-MM-DD.',
      },
      service: {
        type: 'string',
        description: 'Servicio deseado (opcional).',
      },
    },
    required: ['date'],
  },
  async execute(params, context) {
    const dateStr = String(params?.date || '').trim();
    const date = new Date(dateStr);
    if (!dateStr || Number.isNaN(date.getTime())) {
      return { success: false, message: 'Fecha inválida. Usa el formato YYYY-MM-DD.', error: 'invalid_date' };
    }

    const hours = await configService.get('business.hours');
    const day = weekdayName(date);
    const range = parseHoursRange(hours?.[day]);
    if (!range) {
      return {
        success: true,
        message: `El negocio está cerrado el ${dateStr}.`,
        data: { date: dateStr, available: [], closed: true },
      };
    }

    const slotMinutes = Number(await configService.get('business.slot_minutes')) || 30;
    const slots = generateSlots(range.open, range.close, slotMinutes);

    const booked = await appointmentService.findByDate(context.projectId, date);
    const bookedTimes = new Set(booked.map(a => a.time).filter(Boolean) as string[]);
    const available = slots.filter(slot => !bookedTimes.has(slot));

    const service = params?.service ? ` para ${params.service}` : '';
    return {
      success: true,
      message: available.length > 0
        ? `Horarios disponibles${service} el ${dateStr}: ${available.join(', ')}.`
        : `No hay horarios disponibles${service} el ${dateStr}.`,
      data: { date: dateStr, available, booked: Array.from(bookedTimes), open: range.open, close: range.close },
    };
  },
};
