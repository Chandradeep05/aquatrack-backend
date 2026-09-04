import mongoose from 'mongoose';
import { env } from './env';

export const connectDB = async (): Promise<void> => {
  try {
    const conn = await mongoose.connect(env.MONGODB_URI);
    console.log(`[Database] MongoDB connected successfully to ${conn.connection.host}/${conn.connection.name}`);
  } catch (error: any) {
    console.error(`[Database Error] Failed to connect to MongoDB: ${error.message}`);
    process.exit(1);
  }
};

export const disconnectDB = async (): Promise<void> => {
  try {
    await mongoose.disconnect();
    console.log('[Database] Disconnected from MongoDB cleanly');
  } catch (error: any) {
    console.error(`[Database Error] Error disconnecting from MongoDB: ${error.message}`);
  }
};
