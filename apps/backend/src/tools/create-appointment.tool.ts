import { appointmentService } from '../services/appointment.service';
import { Tool } from './types';
import { formatDateEs, normalizeTime } from './helpers';

/** Agenda una cita. Requiere confirmación del usuario antes de ejecutarse. */
export const createAppointmentTool: Tool = {
  name: 'create_appointment',
  description: 'Agenda una cita o reserva para el cliente. Requiere confirmación.',
  requiresConfirmation: true,
  parameters: {
    type: 'object',
    properties: {
      date: {
        type: 'string',
        description: 'Fecha de la cita en formato YYYY-MM-DD.',
      },
      time: {
        type: 'string',
        description: 'Hora de la cita en formato HH:mm (24h).',
      },
      service: {
        type: 'string',
        description: 'Servicio o motivo de la cita.',
      },
      notes: {
        type: 'string',
        description: 'Notas adicionales (opcional).',
      },
    },
    required: ['date', 'time', 'service'],
  },
  async execute(params, context) {
    const dateStr = String(params?.date || '').trim();
    const time = normalizeTime(params?.time);
    const service = String(params?.service || '').trim() || 'Consulta general';

    const date = new Date(dateStr);
    if (!dateStr || Number.isNaN(date.getTime())) {
      return { success: false, message: 'No pude agendar la cita: fecha inválida.', error: 'invalid_date' };
    }
    if (!time) {
      return { success: false, message: 'No pude agendar la cita: hora inválida.', error: 'invalid_time' };
    }

    const [hours, minutes] = time.split(':').map(Number);
    date.setHours(hours, minutes, 0, 0);

    const appointment = await appointmentService.create({
      projectId: context.projectId,
      conversationId: context.conversationId,
      contactId: context.contactId,
      date,
      time,
      service,
      notes: params?.notes ? String(params.notes) : undefined,
      status: 'pending',
      createdBy: 'ai_agent',
    });

    return {
      success: true,
      message: `Cita agendada: ${service} el ${formatDateEs(date)} a las ${time}.`,
      data: {
        appointmentId: appointment._id?.toString(),
        date: dateStr,
        time,
        service,
        status: appointment.status,
      },
    };
  },
};
