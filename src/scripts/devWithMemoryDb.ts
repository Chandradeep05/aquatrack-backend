import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import app from '../app';
import { env } from '../config/env';
import { User } from '../models/User';

const startInMemoryServer = async () => {
  console.log('[Dev-Mem] Starting in-memory MongoDB server...');
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  console.log(`[Dev-Mem] In-memory MongoDB running at: ${uri}`);

  await mongoose.connect(uri);

  // Auto-seed admin user
  const admin = new User({
    name: env.ADMIN_NAME || 'Admin',
    email: env.ADMIN_EMAIL || 'admin@aquatrack.com',
    passwordHash: env.ADMIN_PASSWORD || 'AdminPassword123!',
    role: 'admin'
  });
  await admin.save();
  console.log(`[Dev-Mem] Default Admin account seeded: ${admin.email} / ${env.ADMIN_PASSWORD || 'AdminPassword123!'}`);

  const server = app.listen(env.PORT, () => {
    console.log(`[Dev-Mem] AquaTrack Backend running on http://localhost:${env.PORT}`);
    console.log(`[Dev-Mem] Frontend client configured for: ${env.CLIENT_URL}`);
    console.log(`[Dev-Mem] Health check: http://localhost:${env.PORT}/api/health`);
  });

  const cleanup = async () => {
    console.log('\n[Dev-Mem] Shutting down...');
    server.close();
    await mongoose.disconnect();
    await mongod.stop();
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
};

startInMemoryServer().catch((err) => {
  console.error('[Dev-Mem] Error starting in-memory dev server:', err);
  process.exit(1);
});
