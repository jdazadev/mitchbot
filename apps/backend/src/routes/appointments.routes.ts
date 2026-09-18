import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { listAppointments, getAppointment, updateAppointmentStatus } from '../controllers/appointments.controller';

const router = Router();

router.use(authenticate);

router.get('/', authorize('devadmin', 'admin', 'support', 'assistant'), listAppointments);
router.get('/:id', authorize('devadmin', 'admin', 'support', 'assistant'), getAppointment);
router.patch('/:id/status', authorize('devadmin', 'admin', 'support'), updateAppointmentStatus);

export default router;
