import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Crear directorio de uploads si no existe
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const fileFilter = (req: any, file: Express.Multer.File, cb: any) => {
  const isDevExtract = req.path?.includes('/dev/extract');
  const isDevPdfPreview = req.path?.includes('/dev/pdf-to-images');
  const baseTypes = [
    'application/pdf',
    'text/plain',
    'text/csv',
    'application/csv',
  ];
  const imageTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif', 'image/tiff', 'image/bmp'];
  const allowedTypes = isDevPdfPreview
    ? ['application/pdf']
    : (isDevExtract ? [...baseTypes, ...imageTypes] : [...baseTypes, ...imageTypes]);
  const baseExtensions = ['.pdf', '.txt', '.csv'];
  const imageExtensions = ['.png', '.jpg', '.jpeg', '.webp', '.heic', '.heif', '.tiff', '.tif', '.bmp'];
  const allowedExtensions = isDevPdfPreview
    ? ['.pdf']
    : (isDevExtract ? [...baseExtensions, ...imageExtensions] : [...baseExtensions, ...imageExtensions]);
  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedTypes.includes(file.mimetype) || allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    const message = isDevPdfPreview
      ? 'Tipo de archivo no permitido. Solo PDF.'
      : (isDevExtract
        ? 'Tipo de archivo no permitido. Solo se aceptan PDF, TXT, CSV o imagenes.'
        : 'Tipo de archivo no permitido. Solo se aceptan PDF, TXT, CSV o imagenes.');
    cb(new Error(message), false);
  }
};

export const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});
