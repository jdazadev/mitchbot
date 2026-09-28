import { appointmentService } from '../../services/appointment.service';
import { configService } from '../../services/config.service';
import { defineToolOperation } from '../operation';
import { DAY_LABELS_ES, DAY_NAMES, formatDateEs, generateSlots, normalizeTime, parseHoursRange, weekdayName } from '../helpers';
import { ToolModule } from '../types';

const read = defineToolOperation('agenda', 'leer', 'ninguna',
  'Consulta horarios de atención y, si se indica una fecha, los horarios disponibles para citas.', {
    type: 'object', properties: {
      date: { type: 'string', description: 'Fecha a consultar en formato YYYY-MM-DD (opcional).' },
      service: { type: 'string', description: 'Servicio deseado (opcional).' },
    },
  }, async (params, context) => {
    const hours = await configService.get('business.hours');
    const orderedDays = [...DAY_NAMES.slice(1), DAY_NAMES[0]];
    const schedule = orderedDays.map(day => {
      const range = parseHoursRange(hours?.[day]);
      return `${DAY_LABELS_ES[day]}: ${range ? `${range.open} - ${range.close}` : 'cerrado'}`;
    });
    const dateStr = String(params.date || '').trim();
    if (!dateStr) return { success: true, message: `Horario de atención:\n${schedule.join('\n')}`, data: { schedule } };

    const date = new Date(`${dateStr}T00:00:00`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== dateStr) {
      return { success: false, message: 'Fecha inválida. Usa el formato YYYY-MM-DD.', error: 'invalid_date' };
    }
    const day = weekdayName(date);
    const range = parseHoursRange(hours?.[day]);
    if (!range) return { success: true, message: `El negocio está cerrado el ${dateStr}.`, data: { date: dateStr, available: [], closed: true } };
    const slotMinutes = Number(await configService.get('business.slot_minutes')) || 30;
    const slots = generateSlots(range.open, range.close, slotMinutes);
    const booked = await appointmentService.findByDate(context.projectId, date);
    const bookedTimes = new Set(booked.map(appointment => appointment.time).filter(Boolean) as string[]);
    const available = slots.filter(slot => !bookedTimes.has(slot));
    const service = params.service ? ` para ${params.service}` : '';
    const summary = available.length ? available.join(', ') : 'ninguno';
    return {
      success: true,
      message: `Horario de atención:\n${schedule.join('\n')}\n\nDisponibilidad${service} el ${dateStr}: ${summary}.`,
      data: { date: dateStr, available, booked: [...bookedTimes], open: range.open, close: range.close },
    };
  });

const create = defineToolOperation('agenda', 'crear', 'confirmacion_cliente',
  'Agenda una cita o reserva para el cliente. Solicita confirmación antes de crearla.', {
    type: 'object', properties: {
      date: { type: 'string', description: 'Fecha de la cita en formato YYYY-MM-DD.' },
      time: { type: 'string', description: 'Hora de la cita en formato HH:mm (24h).' },
      service: { type: 'string', description: 'Servicio o motivo de la cita.' },
      notes: { type: 'string', description: 'Notas adicionales (opcional).' },
    }, required: ['date', 'time', 'service'],
  }, async (params, context) => {
    const dateStr = String(params.date || '').trim();
    const time = normalizeTime(params.time);
    const service = String(params.service || '').trim() || 'Consulta general';
    const date = new Date(`${dateStr}T00:00:00`);
    if (!dateStr || Number.isNaN(date.getTime())) return { success: false, message: 'No pude agendar la cita: fecha inválida.', error: 'invalid_date' };
    if (!time) return { success: false, message: 'No pude agendar la cita: hora inválida.', error: 'invalid_time' };
    const [hours, minutes] = time.split(':').map(Number);
    date.setHours(hours, minutes, 0, 0);
    const appointment = await appointmentService.create({
      projectId: context.projectId, conversationId: context.conversationId, contactId: context.contactId,
      date, time, service, notes: params.notes ? String(params.notes) : undefined, status: 'pending', createdBy: 'ai_agent',
    });
    return { success: true, message: `Cita agendada: ${service} el ${formatDateEs(date)} a las ${time}.`, data: { appointmentId: appointment._id?.toString(), date: dateStr, time, service, status: appointment.status } };
  });

const edit = defineToolOperation('agenda', 'editar', 'confirmacion_cliente',
  'Reprograma o actualiza una cita existente. Solicita confirmación antes de modificarla.', {
    type: 'object', properties: {
      appointmentId: { type: 'string', description: 'Identificador de la cita.' },
      date: { type: 'string', description: 'Nueva fecha YYYY-MM-DD (opcional).' },
      time: { type: 'string', description: 'Nueva hora HH:mm (opcional).' },
      service: { type: 'string', description: 'Nuevo servicio (opcional).' },
      notes: { type: 'string', description: 'Nuevas notas (opcional).' },
    }, required: ['appointmentId'],
  }, async (params, context) => {
    const update: Record<string, unknown> = {};
    if (params.date !== undefined) {
      const date = new Date(`${String(params.date)}T00:00:00`);
      if (Number.isNaN(date.getTime())) return { success: false, message: 'Fecha inválida.', error: 'invalid_date' };
      if (params.time) {
        const time = normalizeTime(params.time);
        if (!time) return { success: false, message: 'Hora inválida.', error: 'invalid_time' };
        const [hour, minute] = time.split(':').map(Number);
        date.setHours(hour, minute, 0, 0);
        update.time = time;
      }
      update.date = date;
    } else if (params.time) {
      const time = normalizeTime(params.time);
      if (!time) return { success: false, message: 'Hora inválida.', error: 'invalid_time' };
      update.time = time;
    }
    for (const key of ['service', 'notes'] as const) if (params[key] !== undefined) update[key] = String(params[key]);
    const appointment = await appointmentService.updateDetails(String(params.appointmentId), context.projectId, update);
    if (!appointment) return { success: false, message: 'No encontré la cita indicada en este proyecto.', error: 'not_found' };
    return { success: true, message: 'La cita fue actualizada.', data: appointment };
  });

const remove = defineToolOperation('agenda', 'eliminar', 'aprobacion_operador',
  'Solicita cancelar una cita existente. Requiere aprobación de un operador.', {
    type: 'object', properties: { appointmentId: { type: 'string', description: 'Identificador de la cita a cancelar.' } }, required: ['appointmentId'],
  }, async (params, context) => {
    const appointment = await appointmentService.updateStatus(String(params.appointmentId || ''), 'cancelled', context.projectId);
    if (!appointment) return { success: false, message: 'No encontré la cita indicada en este proyecto.', error: 'not_found' };
    return { success: true, message: 'La cita fue cancelada.', data: { appointmentId: appointment._id?.toString(), status: appointment.status } };
  });

export const agendaModule: ToolModule = {
  id: 'agenda', label: 'Agenda',
  bindings: [{ id: 'internal', label: 'Módulo interno', operations: ['leer', 'crear', 'editar', 'eliminar'] }],
  operations: { leer: read, crear: create, editar: edit, eliminar: remove },
};
