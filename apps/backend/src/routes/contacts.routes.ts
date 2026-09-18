import { Router } from 'express';
import { listContacts, getContact, updateContact, archiveContact, restoreContact } from '../controllers/contacts.controller';

const router = Router();

router.get('/', listContacts);              // Listar contactos (excluye archivados por defecto)
router.get('/:id', getContact);             // Obtener contacto por ID
router.put('/:id', updateContact);          // Editar contacto
router.put('/:id/archive', archiveContact); // Archivar contacto (soft delete)
router.put('/:id/restore', restoreContact); // Restaurar contacto archivado

// NO hay POST / para crear contacto manualmente
// Los contactos se crean automáticamente al contestar el primer mensaje del cliente

export default router;
