import env from './env';
import { logger } from '../utils/logger';

export const checkOllama = async () => {
    try {
        const response = await fetch(`${env.OLLAMA_URL}/api/tags`); // Correct endpoint for Ollama
        if (response.ok) {
            logger.info('✅ Ollama connected successfully');
            return true;
        } else {
            logger.error(`❌ Ollama returned status: ${response.status}`);
            return false;
        }
    } catch (error) {
        logger.error('❌ Ollama connection error:', error);
        return false;
    }
};
