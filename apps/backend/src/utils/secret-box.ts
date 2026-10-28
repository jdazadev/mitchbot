import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const VERSION = 'v1';

/** Error al abrir un secreto: clave distinta, datos alterados o formato desconocido. */
export class SecretBoxError extends Error {
  constructor(message = 'No se pudo descifrar el secreto') {
    super(message);
    this.name = 'SecretBoxError';
  }
}

function keyFrom(base64Key: string) {
  const key = Buffer.from(base64Key, 'base64');
  if (key.length !== 32) throw new SecretBoxError('La clave de cifrado debe ser de 32 bytes');
  return key;
}

/** Cifra con AES-256-GCM: `v1.<iv>.<tag>.<datos>` en base64url. */
export function seal(plain: string, base64Key: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyFrom(base64Key), iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [VERSION, iv, cipher.getAuthTag(), data].map(part => typeof part === 'string' ? part : part.toString('base64url')).join('.');
}

/** Descifra lo que produjo `seal`; lanza `SecretBoxError` si no cuadra. */
export function open(sealed: string, base64Key: string) {
  const [version, iv, tag, data] = sealed.split('.');
  if (version !== VERSION || !iv || !tag || data === undefined) throw new SecretBoxError('Formato de secreto desconocido');
  try {
    const decipher = createDecipheriv('aes-256-gcm', keyFrom(base64Key), Buffer.from(iv, 'base64url'));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8');
  } catch (error) {
    if (error instanceof SecretBoxError) throw error;
    throw new SecretBoxError();
  }
}
