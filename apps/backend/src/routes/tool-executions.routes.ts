import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { listPendingToolExecutions, listToolExecutions, resolveToolExecution } from '../controllers/tool-executions.controller';

const router = Router();
router.use(authenticate);
router.get('/pending', authorize('approver', 'admin'), listPendingToolExecutions);
router.post('/:id/approve', authorize('approver', 'admin'), resolveToolExecution('approved'));
router.post('/:id/reject', authorize('approver', 'admin'), resolveToolExecution('rejected'));
router.get('/', listToolExecutions);

export default router;
