import { Router } from 'express';
import { listUsers, getUser, createUser, updateUser } from '../controllers/users.controller';

const router = Router();

router.get('/', listUsers);          // Listar usuarios
router.get('/:id', getUser);         // Obtener usuario
router.post('/', createUser);        // Crear usuario
router.put('/:id', updateUser);      // Editar usuario (desactivar vía status)

export default router;
