import { MongoClient, Db } from 'mongodb';
import env from './env';

const client = new MongoClient(env.MONGODB_URI);

let db: Db;

export const connectDatabase = async () => {
  try {
    await client.connect();
    console.log('✅ MongoDB connected successfully');
    db = client.db(); // Connect to default database in URI
    void db.collection('messages')
      .createIndex({ conversationId: 1, createdAt: -1, _id: -1 })
      .catch((error) => console.warn('⚠️ Could not create the messages pagination index:', error));
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

export const getDatabase = (): Db => {
  if (!db) {
    throw new Error('Database not initialized. Call connectDatabase first.');
  }
  return db;
};

export const closeDatabase = async () => {
  await client.close();
};
