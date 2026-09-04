import app from './app';
import { env } from './config/env';
import { connectDB } from './config/db';

const startServer = async () => {
  // Connect to MongoDB
  await connectDB();

  // Start HTTP Server
  const server = app.listen(env.PORT, () => {
    console.log(`[Server] AquaTrack Backend running in ${env.NODE_ENV} mode on port ${env.PORT}`);
    console.log(`[Server] Health check available at http://localhost:${env.PORT}/api/health`);
  });

  // Graceful shutdown handling
  const shutdown = () => {
    console.log('[Server] Gracefully shutting down...');
    server.close(() => {
      console.log('[Server] Closed remaining connections.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
};

startServer();
