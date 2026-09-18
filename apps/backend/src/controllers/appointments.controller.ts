import { Request, Response, NextFunction } from 'express';
import { appointmentService } from '../services/appointment.service';
import { AppointmentStatus } from '../models/appointment.model';

const VALID_STATUS: AppointmentStatus[] = ['pending', 'confirmed', 'completed', 'cancelled'];

export const listAppointments = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = (req as any).projectId as string | undefined;
    if (!projectId) return res.status(400).json({ error: 'ProjectId requerido' });

    const status = req.query.status as AppointmentStatus | undefined;
    if (status && !VALID_STATUS.includes(status)) {
      return res.status(400).json({ error: 'Status inválido' });
    }

    const appointments = await appointmentService.findAll(projectId, status);
    res.json(appointments);
  } catch (error) {
    next(error);
  }
};

export const getAppointment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const appointment = await appointmentService.findById(req.params.id);
    if (!appointment) return res.status(404).json({ error: 'Cita no encontrada' });
    res.json(appointment);
  } catch (error) {
    next(error);
  }
};

export const updateAppointmentStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status } = req.body || {};
    if (!VALID_STATUS.includes(status)) {
      return res.status(400).json({ error: 'Status inválido' });
    }
    const appointment = await appointmentService.updateStatus(req.params.id, status);
    if (!appointment) return res.status(404).json({ error: 'Cita no encontrada' });
    res.json(appointment);
  } catch (error) {
    next(error);
  }
};
