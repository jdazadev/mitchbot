import { QdrantClient } from '@qdrant/js-client-rest';
import env from './env';

const qdrantClient = new QdrantClient({ url: env.QDRANT_URL });

export const connectQdrant = async () => {
    try {
        const collections = await qdrantClient.getCollections();
        console.log('✅ Qdrant connected successfully');
        console.log('Qdrant collections:', collections.collections.map((c: any) => c.name));
    } catch (error) {
        console.error('❌ Qdrant connection error:', error);
        // Do not exit process here, Qdrant might be optional or failing initially
    }
};

export default qdrantClient;
