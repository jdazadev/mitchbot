import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { MulterError } from 'multer';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error(err);

  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Validation Error',
      details: err.issues,
    });
  }

  if (err instanceof MulterError) {
    return res.status(400).json({
      error: 'File Upload Error',
      message: err.message,
    });
  }

  // Generic Error
  return res.status(500).json({
    error: 'Internal Server Error',
    message: err.message,
  });
};
