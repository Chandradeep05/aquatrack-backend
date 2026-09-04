import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const validateEnv = () => {
  const missingVars: string[] = [];

  if (!process.env.MONGODB_URI) {
    missingVars.push('MONGODB_URI');
  }

  if (!process.env.JWT_SECRET) {
    missingVars.push('JWT_SECRET');
  }

  if (!process.env.ADMIN_PASSWORD) {
    missingVars.push('ADMIN_PASSWORD');
  }

  if (missingVars.length > 0) {
    console.error(
      `[FATAL] Missing required environment variables: ${missingVars.join(', ')}.\n` +
      'Please verify your .env file or environment configuration. Exiting process.'
    );
    process.exit(1);
  }

  return {
    PORT: parseInt(process.env.PORT || '5000', 10),
    MONGODB_URI: process.env.MONGODB_URI as string,
    JWT_SECRET: process.env.JWT_SECRET as string,
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
    CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5173',
    ADMIN_NAME: process.env.ADMIN_NAME || 'Admin',
    ADMIN_EMAIL: (process.env.ADMIN_EMAIL || 'admin@aquatrack.com').toLowerCase().trim(),
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD as string,
    NODE_ENV: process.env.NODE_ENV || 'development'
  };
};

export const env = validateEnv();
