import { Router } from 'express';
import { register, login, getProfile, updateProfile, logout } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.post('/register', register);              // Registro abierto (primer usuario = admin)
router.post('/login', login);                    // Login
router.post('/logout', authenticate, logout);    // Logout (requiere token)
router.get('/profile', authenticate, getProfile);      // Ver perfil (requiere token)
router.put('/profile', authenticate, updateProfile);   // Actualizar perfil (requiere token)

export default router;
