import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { listOrders, getOrder, updateOrderStatus } from '../controllers/orders.controller';

const router = Router();

router.use(authenticate);

router.get('/', authorize('devadmin', 'admin', 'support', 'assistant'), listOrders);
router.get('/:id', authorize('devadmin', 'admin', 'support', 'assistant'), getOrder);
router.patch('/:id/status', authorize('devadmin', 'admin', 'support'), updateOrderStatus);

export default router;
