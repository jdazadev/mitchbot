/** Registro integrado de Meta activo en las pruebas; va después de `isolated-env`. */
process.env.META_APP_ID = '100200300';
process.env.WHATSAPP_SIGNUP_CONFIG_ID = '400500600';
process.env.CREDENTIALS_KEY = Buffer.alloc(32, 7).toString('base64');
