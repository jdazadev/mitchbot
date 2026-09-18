import { Router } from 'express';
import { uploadSource, writeTextSource, searchKnowledge, listSources, getStats, deleteSource, getSourceLogs, getSourceStatus, getSourceExtractedText, extractTextOnly, convertPdfToImages } from '../controllers/brain.controller';
import { upload } from '../middleware/upload.middleware';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.post('/sources/upload', authenticate, upload.single('file'), uploadSource); // Subir PDF, TXT o CSV
router.post('/sources/write', authenticate, writeTextSource);                       // Escribir texto manualmente
router.get('/sources', authenticate, listSources);                                  // Listar fuentes
router.get('/sources/:id/status', authenticate, getSourceStatus);                   // Estado por fuente
router.get('/sources/:id/logs', authenticate, getSourceLogs);                      // Logs por fuente
router.get('/sources/:id/extracted-text', authenticate, getSourceExtractedText);   // Texto extraido
router.delete('/sources/:id', authenticate, deleteSource);                          // Eliminar fuente
router.get('/stats', authenticate, getStats);                                       // Estadísticas
router.get('/search', authenticate, searchKnowledge);                               // Buscar en knowledge base

router.post('/dev/extract', authenticate, upload.single('file'), extractTextOnly); // Extraer texto sin indexar (herramienta interna)
router.post('/dev/pdf-to-images', authenticate, upload.single('file'), convertPdfToImages); // Convertir PDF a imagenes (herramienta interna)

export default router;
