import { Router } from 'express';
import { getAllConfig, getConfig, setConfig, setAllConfig } from '../controllers/config.controller';

const router = Router();

router.get('/', getAllConfig);          // Obtener todas las configuraciones
router.get('/:key', getConfig);        // Obtener configuración por clave
router.put('/:key', setConfig);        // Actualizar configuración por clave
router.put('/', setAllConfig);         // Actualizar múltiples configuraciones

export default router;
