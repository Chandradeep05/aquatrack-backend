import mongoose from 'mongoose';
import { env } from '../config/env';
import { User } from '../models/User';

const seedAdmin = async () => {
  try {
    console.log('[Seed] Connecting to MongoDB...');
    await mongoose.connect(env.MONGODB_URI);

    const existingUser = await User.findOne({ email: env.ADMIN_EMAIL });

    if (existingUser) {
      if (existingUser.role !== 'admin') {
        console.error(
          `[Security Alert] A standard user account already exists with email ${env.ADMIN_EMAIL}. ` +
          'Refusing to promote arbitrary existing account to admin.'
        );
        process.exit(1);
      }
      console.log(`[Seed] Admin user ${env.ADMIN_EMAIL} is already active.`);
    } else {
      const admin = new User({
        name: env.ADMIN_NAME,
        email: env.ADMIN_EMAIL,
        passwordHash: env.ADMIN_PASSWORD,
        role: 'admin'
      });
      await admin.save();
      console.log(`[Seed] Admin user ${env.ADMIN_EMAIL} created successfully.`);
    }

    await mongoose.disconnect();
    console.log('[Seed] Completed successfully.');
    process.exit(0);
  } catch (error: any) {
    console.error('[Seed Error] Failed to seed admin user:', error.message);
    process.exit(1);
  }
};

seedAdmin();
