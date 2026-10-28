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
    void db.collection('messages')
      .createIndex(
        { 'external.platform': 1, 'external.messageId': 1 },
        { unique: true, partialFilterExpression: { 'external.messageId': { $exists: true } } },
      )
      .catch((error) => console.warn('⚠️ Could not create the messages external id index:', error));
    void db.collection('messages')
      .createIndex({ 'delivery.externalId': 1 }, { partialFilterExpression: { 'delivery.externalId': { $exists: true } } })
      .catch((error) => console.warn('⚠️ Could not create the messages delivery id index:', error));
    void db.collection('projects')
      .createIndex(
        { 'config.whatsapp.phoneNumberId': 1 },
        { unique: true, partialFilterExpression: { 'config.whatsapp.phoneNumberId': { $type: 'string' } } },
      )
      .catch((error) => console.warn('⚠️ Could not create the projects WhatsApp number index:', error));
    void db.collection('projects')
      .createIndex(
        { 'config.instagram.accountId': 1 },
        { unique: true, partialFilterExpression: { 'config.instagram.accountId': { $type: 'string' } } },
      )
      .catch((error) => console.warn('⚠️ Could not create the projects Instagram account index:', error));
    void db.collection('conversations')
      .createIndex({ projectId: 1, lastMessageAt: -1, _id: -1 })
      .catch((error) => console.warn('⚠️ Could not create the conversations inbox index:', error));
    void db.collection('channel_credentials')
      .createIndex({ projectId: 1, channel: 1 }, { unique: true })
      .catch((error) => console.warn('⚠️ Could not create the channel credentials project index:', error));
    void db.collection('channel_credentials')
      .createIndex({ channel: 1, account: 1 }, { unique: true })
      .catch((error) => console.warn('⚠️ Could not create the channel credentials account index:', error));
    void db.collection('push_subscriptions')
      .createIndex({ endpoint: 1 }, { unique: true })
      .catch((error) => console.warn('⚠️ Could not create the push subscriptions index:', error));
    void db.collection('push_subscriptions')
      .createIndex({ userId: 1 })
      .catch((error) => console.warn('⚠️ Could not create the push subscriptions user index:', error));
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
