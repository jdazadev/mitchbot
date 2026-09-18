import { Router } from 'express';
import { listContacts, getContact, updateContact, archiveContact, restoreContact } from '../controllers/contacts.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.get('/', authenticate, listContacts);              // Listar contactos (excluye archivados por defecto)
router.get('/:id', authenticate, getContact);             // Obtener contacto por ID
router.put('/:id', authenticate, updateContact);          // Editar contacto
router.put('/:id/archive', authenticate, archiveContact); // Archivar contacto (soft delete)
router.put('/:id/restore', authenticate, restoreContact); // Restaurar contacto archivado

// NO hay POST / para crear contacto manualmente
// Los contactos se crean automáticamente al contestar el primer mensaje del cliente

export default router;
