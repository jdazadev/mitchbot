import { Request, Response, NextFunction } from 'express';
import { ragService } from '../services/rag.service';
import { enqueueRagUpload } from '../services/rag-upload.service';
import { z } from 'zod';
import { ObjectId } from 'mongodb';
import { logger } from '../utils/logger';
import { getKnowledgeSourcesCollection } from '../models/document.model';
import { aiModelService } from '../services/ai-model.service';
import { promises as fs } from 'fs';

/**
 * Subir un archivo (PDF, TXT, CSV) para indexar como fuente de conocimiento.
 */
export const uploadSource = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se subió ningún archivo' });
    }

    const projectId = (req as any).projectId as string | undefined;
    if (!projectId) return res.status(400).json({ error: 'ProjectId requerido' });
    if (!ObjectId.isValid(projectId)) return res.status(400).json({ error: 'ProjectId inválido' });
    const { path: filePath, originalname, mimetype } = req.file;
    const { collectionName, category, tags, author, accessLevel, createdAt } = req.body;
    const projectCollection = await ragService.getProjectCollectionName(projectId);

    const result = await enqueueRagUpload({
      filePath,
      fileType: mimetype,
      sourceName: originalname,
      collectionName: collectionName || projectCollection,
      projectId,
      category,
      tags: typeof tags === 'string' ? tags.split(',').map((item: string) => item.trim()).filter(Boolean) : tags,
      author,
      accessLevel,
      createdAt,
    });

    res.status(202).json({
      message: 'Archivo en cola para procesamiento',
      sourceId: result.sourceId,
      status: 'Queued',
    });
  } catch (error: any) {
    logger.error('File upload failed', error);
    if (error.message?.includes('no soportado') || error.message?.includes('no permitido')) {
      return res.status(400).json({ error: error.message });
    }
    next(error);
  }
};

/**
 * Escribir un texto manualmente y subirlo como fuente TXT.
 */
const writeTextSchema = z.object({
  title: z.string().min(1, 'El título es obligatorio'),
  content: z.string().min(10, 'El contenido debe tener al menos 10 caracteres'),
  collectionName: z.string().optional(),
});

export const writeTextSource = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = writeTextSchema.parse(req.body);
    const projectId = (req as any).projectId as string | undefined;
    if (!projectId) return res.status(400).json({ error: 'ProjectId requerido' });
    if (!ObjectId.isValid(projectId)) return res.status(400).json({ error: 'ProjectId inválido' });
    const projectCollection = await ragService.getProjectCollectionName(projectId);

    const result = await ragService.processWrittenText({
      title: data.title,
      content: data.content,
      collectionName: data.collectionName || projectCollection,
      projectId,
    });

    res.status(201).json({
      message: 'Texto procesado y guardado exitosamente',
      chunks: result.chunks,
      sourceId: result.sourceId,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Obtener estado de una fuente
 */
export const getSourceStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = (req as any).projectId as string | undefined;
    if (!projectId) return res.status(400).json({ error: 'ProjectId requerido' });
    if (!ObjectId.isValid(projectId)) return res.status(400).json({ error: 'ProjectId inválido' });
    const sourceId = req.params.id;
    if (!ObjectId.isValid(sourceId)) return res.status(400).json({ error: 'SourceId inválido' });
    const source = await getKnowledgeSourcesCollection().findOne({
      _id: new ObjectId(sourceId),
      projectId: new ObjectId(projectId),
    });
    if (!source) return res.status(404).json({ error: 'Fuente no encontrada' });
    res.json({
      status: source.status,
      stage: source.stage,
      progress: source.progress,
      errorMessage: source.errorMessage,
      updatedAt: source.updatedAt,
      finishedAt: source.finishedAt,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Listar todas las fuentes de conocimiento.
 */
export const listSources = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = (req as any).projectId as string | undefined;
    if (!projectId) return res.status(400).json({ error: 'ProjectId requerido' });
    if (!ObjectId.isValid(projectId)) return res.status(400).json({ error: 'ProjectId inválido' });
    const query = { projectId: new ObjectId(projectId) };
    const sources = await getKnowledgeSourcesCollection()
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();
    res.json(sources);
  } catch (error) {
    next(error);
  }
};

/**
 * Obtener texto extraido (Markdown)
 */
export const getSourceExtractedText = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = (req as any).projectId as string | undefined;
    if (!projectId) return res.status(400).json({ error: 'ProjectId requerido' });
    if (!ObjectId.isValid(projectId)) return res.status(400).json({ error: 'ProjectId inválido' });
    const sourceId = req.params.id;
    if (!ObjectId.isValid(sourceId)) return res.status(400).json({ error: 'SourceId inválido' });
    const source = await getKnowledgeSourcesCollection().findOne({
      _id: new ObjectId(sourceId),
      projectId: new ObjectId(projectId),
    });
    if (!source) return res.status(404).json({ error: 'Fuente no encontrada' });
    res.json({
      extractedMarkdown: source.extractedMarkdown || '',
      extractionMethod: source.extractionMethod,
      extractedAt: source.extractedAt,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Obtener logs de una fuente
 */
export const getSourceLogs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = (req as any).projectId as string | undefined;
    if (!projectId) return res.status(400).json({ error: 'ProjectId requerido' });
    if (!ObjectId.isValid(projectId)) return res.status(400).json({ error: 'ProjectId inválido' });
    const sourceId = req.params.id;
    if (!ObjectId.isValid(sourceId)) return res.status(400).json({ error: 'SourceId inválido' });
    const source = await getKnowledgeSourcesCollection().findOne({
      _id: new ObjectId(sourceId),
      projectId: new ObjectId(projectId),
    });
    if (!source) return res.status(404).json({ error: 'Fuente no encontrada' });
    res.json({ logs: source.logs || [] });
  } catch (error) {
    next(error);
  }
};

/**
 * Estadísticas del Brain/RAG.
 */
export const getStats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sourcesColl = getKnowledgeSourcesCollection();
    const projectId = (req as any).projectId as string | undefined;
    if (!projectId) return res.status(400).json({ error: 'ProjectId requerido' });
    if (!ObjectId.isValid(projectId)) return res.status(400).json({ error: 'ProjectId inválido' });
    const query = { projectId: new ObjectId(projectId) };
    const [totalDocs, indexedSources] = await Promise.all([
      sourcesColl.countDocuments(query),
      sourcesColl.find({ ...query, status: 'Indexed' }).toArray(),
    ]);
    
    const totalVectors = indexedSources.reduce((acc, curr) => acc + (curr.vectorCount || 0), 0);
    const failedCount = await sourcesColl.countDocuments({ ...query, status: 'Failed' });
    
    res.json({
      totalDocs,
      totalVectors,
      syncStatus: failedCount > 0 ? 'Warning' : totalDocs > 0 ? 'Healthy' : 'Empty',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Buscar en la base de conocimiento usando RAG.
 */
export const searchKnowledge = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { q, collectionName } = req.query;
    if (!q) return res.status(400).json({ error: 'El parámetro "q" es requerido' });

    const projectId = (req as any).projectId as string | undefined;
    if (!projectId) return res.status(400).json({ error: 'ProjectId requerido' });
    if (!ObjectId.isValid(projectId)) return res.status(400).json({ error: 'ProjectId inválido' });
    const embeddingConfig = await aiModelService.getActiveEmbeddingConfig(projectId);
    if (!embeddingConfig) {
      return res.status(400).json({ error: 'RAG no configurado: falta modelo de embeddings' });
    }

    const projectCollection = await ragService.getProjectCollectionName(projectId);

    const results = await ragService.search(
      q as string, 
      (collectionName as string) || projectCollection,
      3,
      projectId
    );
    res.json(results);
  } catch (error) {
    next(error);
  }
};

/**
 * Eliminar una fuente de conocimiento.
 */
export const deleteSource = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = (req as any).projectId as string | undefined;
    if (!projectId) return res.status(400).json({ error: 'ProjectId requerido' });
    if (!ObjectId.isValid(projectId)) return res.status(400).json({ error: 'ProjectId inválido' });
    const source = await getKnowledgeSourcesCollection().findOne({
      _id: new ObjectId(req.params.id),
      projectId: new ObjectId(projectId),
    });
    if (!source) return res.status(404).json({ error: 'Fuente no encontrada' });

    const deleted = await ragService.deleteSource(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Fuente no encontrada' });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

/**
 * Extraer texto de un archivo sin indexar (DevAdmin).
 */
export const extractTextOnly = async (req: Request, res: Response, next: NextFunction) => {
  const filePath = req.file?.path;
  try {
    if (!req.file || !filePath) {
      return res.status(400).json({ error: 'No se subio ningun archivo' });
    }

    const projectId = (req as any).projectId as string | undefined;
    if (!projectId) return res.status(400).json({ error: 'ProjectId requerido' });
    if (!ObjectId.isValid(projectId)) return res.status(400).json({ error: 'ProjectId invalido' });

    const { originalname, mimetype } = req.file;

    const result = await ragService.extractTextOnly({
      filePath,
      fileType: mimetype,
      sourceName: originalname,
      projectId,
    });

    res.json({
      extractedMarkdown: result.text,
      method: result.method,
      pages: result.pages?.length || 0,
    });
  } catch (error: any) {
    logger.error('Extract text failed', error);
    if (error.message?.includes('no soportado') || error.message?.includes('no permitido')) {
      return res.status(400).json({ error: error.message });
    }
    next(error);
  } finally {
    if (filePath) {
      await fs.unlink(filePath).catch(() => null);
    }
  }
};

/**
 * Convertir PDF a imagenes (DevAdmin).
 */
export const convertPdfToImages = async (req: Request, res: Response, next: NextFunction) => {
  const filePath = req.file?.path;
  try {
    if (!req.file || !filePath) {
      return res.status(400).json({ error: 'No se subio ningun archivo' });
    }

    const projectId = (req as any).projectId as string | undefined;
    if (!projectId) return res.status(400).json({ error: 'ProjectId requerido' });
    if (!ObjectId.isValid(projectId)) return res.status(400).json({ error: 'ProjectId invalido' });

    if (req.file.mimetype !== 'application/pdf') {
      return res.status(400).json({ error: 'Tipo de archivo no permitido. Solo PDF.' });
    }

    const maxPages = Math.min(Math.max(Number(req.body?.maxPages) || 6, 1), 10);
    const result = await ragService.convertPdfToImages({ filePath, maxPages, projectId });

    res.json({
      images: result.images,
      pages: result.pages,
    });
  } catch (error: any) {
    logger.error('PDF to images failed', error);
    next(error);
  } finally {
    if (filePath) {
      await fs.unlink(filePath).catch(() => null);
    }
  }
};
