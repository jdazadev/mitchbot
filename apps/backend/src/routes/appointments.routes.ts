import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { listAppointments, getAppointment, updateAppointmentStatus } from '../controllers/appointments.controller';

const router = Router();

router.use(authenticate);

router.get('/', authorize('admin', 'support', 'assistant'), listAppointments);
router.get('/:id', authorize('admin', 'support', 'assistant'), getAppointment);
router.patch('/:id/status', authorize('admin', 'support'), updateAppointmentStatus);

export default router;
