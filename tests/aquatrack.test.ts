import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../src/app';
import { User } from '../src/models/User';
import { IntakeLog } from '../src/models/IntakeLog';
import { AppSettings } from '../src/models/AppSettings';

let mongoServer: MongoMemoryServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create({ instance: { launchTimeout: 60000 } });
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});

beforeEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

describe('AquaTrack End-to-End API Test Suite', () => {
  const createTestUser = async (role = 'user', email = 'test@example.com') => {
    const user = new User({
      name: 'Test User',
      email,
      passwordHash: 'Password123!',
      role
    });
    await user.save();
    return user;
  };

  const loginHelper = async (email = 'test@example.com', password = 'Password123!') => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email, password });
    return res.body.data.token;
  };

  describe('1. Health Check', () => {
    it('should return operational status', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('healthy');
    });
  });

  describe('2. Authentication & Registration', () => {
    it('should register a new user successfully', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Alice Springs',
          email: 'alice@example.com',
          password: 'SecretPassword123!'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe('alice@example.com');
      expect(res.body.data.user.role).toBe('user');
      expect(res.body.data.user.passwordHash).toBeUndefined();
    });

    it('should reject registration with duplicate email (409 Conflict)', async () => {
      await createTestUser('user', 'alice@example.com');

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Alice Springs',
          email: 'alice@example.com',
          password: 'AnotherPassword123!'
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/already exists/i);
    });

    it('should ignore any role supplied in public registration and enforce role="user"', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Sneaky User',
          email: 'sneaky@example.com',
          password: 'Password123!',
          role: 'admin'
        });

      expect(res.status).toBe(201);
      expect(res.body.data.user.role).toBe('user');
    });

    it('should reject invalid email format (400 Bad Request)', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Alice',
          email: 'not-an-email',
          password: 'Password123!'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject passwords shorter than 6 characters (400 Bad Request)', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Alice',
          email: 'alice@example.com',
          password: '123'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('3. Login Flow', () => {
    it('should log in successfully and return user with token', async () => {
      await createTestUser('user', 'user@example.com');

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'user@example.com',
          password: 'Password123!'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.user.email).toBe('user@example.com');
    });

    it('should reject incorrect password without leaking info (401 Unauthorized)', async () => {
      await createTestUser('user', 'user@example.com');

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'user@example.com',
          password: 'WrongPassword'
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Invalid email or password.');
    });

    it('should reject non-existent email with same generic message (401 Unauthorized)', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'Password123!'
        });

      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Invalid email or password.');
    });
  });

  describe('4. Session Restore (GET /api/auth/me)', () => {
    it('should return user profile with valid Bearer token', async () => {
      await createTestUser('user', 'me@example.com');
      const token = await loginHelper('me@example.com');

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer ' + token);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe('me@example.com');
    });

    it('should reject request without token (401 Unauthorized)', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should reject request with invalid token (401 Unauthorized)', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid.jwt.token');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe('5. Water Intake APIs', () => {
    let token: string;
    let userId: string;

    beforeEach(async () => {
      const user = await createTestUser('user', 'hydrated@example.com');
      userId = user._id.toString();
      token = await loginHelper('hydrated@example.com');
    });

    it('should log valid water intake (201 Created)', async () => {
      const res = await request(app)
        .post('/api/intake')
        .set('Authorization', 'Bearer ' + token)
        .send({ amount: 500 });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.entry.amount).toBe(500);
    });

    it('should reject intake of 0 ml (400 Bad Request)', async () => {
      const res = await request(app)
        .post('/api/intake')
        .set('Authorization', 'Bearer ' + token)
        .send({ amount: 0 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Water intake amount must be greater than 0.');
    });

    it('should reject negative intake amounts (400 Bad Request)', async () => {
      const res = await request(app)
        .post('/api/intake')
        .set('Authorization', 'Bearer ' + token)
        .send({ amount: -250 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Water intake amount must be greater than 0.');
    });

    it('should reject non-numeric intake amounts (400 Bad Request)', async () => {
      const res = await request(app)
        .post('/api/intake')
        .set('Authorization', 'Bearer ' + token)
        .send({ amount: 'five hundred' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject excessive intake amounts over 10,000 ml (400 Bad Request)', async () => {
      const res = await request(app)
        .post('/api/intake')
        .set('Authorization', 'Bearer ' + token)
        .send({ amount: 999999 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/cannot exceed 10,000 ml/i);
    });

    it('should reject invalid consumedAt timestamp (400 Bad Request)', async () => {
      const res = await request(app)
        .post('/api/intake')
        .set('Authorization', 'Bearer ' + token)
        .send({ amount: 500, consumedAt: 'invalid-date-string' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should return today summary with fallback 2000 ml goal', async () => {
      await request(app)
        .post('/api/intake')
        .set('Authorization', 'Bearer ' + token)
        .send({ amount: 500 });

      await request(app)
        .post('/api/intake')
        .set('Authorization', 'Bearer ' + token)
        .send({ amount: 1000 });

      const res = await request(app)
        .get('/api/intake/today')
        .set('Authorization', 'Bearer ' + token);

      expect(res.status).toBe(200);
      expect(res.body.data.totalIntakeMl).toBe(1500);
      expect(res.body.data.dailyGoalMl).toBe(2000);
      expect(res.body.data.progressPercentage).toBe(75);
      expect(res.body.data.remainingMl).toBe(500);
      expect(res.body.data.entries).toHaveLength(2);
    });

    it('should return history grouped by date', async () => {
      await request(app)
        .post('/api/intake')
        .set('Authorization', 'Bearer ' + token)
        .send({ amount: 2000 });

      const res = await request(app)
        .get('/api/intake/history')
        .set('Authorization', 'Bearer ' + token);

      expect(res.status).toBe(200);
      expect(res.body.data.history).toHaveLength(1);
      expect(res.body.data.history[0].totalIntakeMl).toBe(2000);
      expect(res.body.data.history[0].status).toBe('Goal achieved');
    });
  });

  describe('6. Ownership Check on Intake Deletion', () => {
    it('should prevent User A from deleting User B intake entry (403 Forbidden)', async () => {
      const userA = await createTestUser('user', 'usera@example.com');
      const userB = await createTestUser('user', 'userb@example.com');

      const entry = new IntakeLog({
        userId: userA._id,
        amount: 500
      });
      await entry.save();

      const tokenB = await loginHelper('userb@example.com');

      const res = await request(app)
        .delete('/api/intake/' + entry._id)
        .set('Authorization', 'Bearer ' + tokenB);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/not authorized/i);
    });

    it('should allow user to delete their own entry (200 OK)', async () => {
      const user = await createTestUser('user', 'owner@example.com');
      const token = await loginHelper('owner@example.com');

      const entry = new IntakeLog({
        userId: user._id,
        amount: 300
      });
      await entry.save();

      const res = await request(app)
        .delete('/api/intake/' + entry._id)
        .set('Authorization', 'Bearer ' + token);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const check = await IntakeLog.findById(entry._id);
      expect(check).toBeNull();
    });

    it('should return 404 when deleting non-existent entry', async () => {
      const user = await createTestUser('user', 'user@example.com');
      const token = await loginHelper('user@example.com');
      const fakeId = new mongoose.Types.ObjectId();

      const res = await request(app)
        .delete('/api/intake/' + fakeId)
        .set('Authorization', 'Bearer ' + token);

      expect(res.status).toBe(404);
    });
  });

  describe('7. RBAC & Admin User Management', () => {
    it('should block non-admin users from accessing GET /api/users (403 Forbidden)', async () => {
      await createTestUser('user', 'regular@example.com');
      const token = await loginHelper('regular@example.com');

      const res = await request(app)
        .get('/api/users')
        .set('Authorization', 'Bearer ' + token);

      expect(res.status).toBe(403);
      expect(res.body.message).toBe('You are not authorized to perform this action.');
    });

    it('should allow admin to access GET /api/users and view all users and metrics', async () => {
      await createTestUser('admin', 'admin@example.com');
      await createTestUser('user', 'u1@example.com');
      const adminToken = await loginHelper('admin@example.com');

      const res = await request(app)
        .get('/api/users')
        .set('Authorization', 'Bearer ' + adminToken);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.metrics.totalUsers).toBe(2);
      expect(res.body.data.users).toHaveLength(2);
    });

    it('should block admin from deleting their own account (400 Bad Request)', async () => {
      const admin = await createTestUser('admin', 'admin@example.com');
      const adminToken = await loginHelper('admin@example.com');

      const res = await request(app)
        .delete('/api/users/' + admin._id)
        .set('Authorization', 'Bearer ' + adminToken);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Admins cannot delete their own account.');
    });

    it('should cascade delete all associated intake logs when admin deletes a user', async () => {
      const admin = await createTestUser('admin', 'admin@example.com');
      const targetUser = await createTestUser('user', 'target@example.com');
      const adminToken = await loginHelper('admin@example.com');

      await IntakeLog.create({ userId: targetUser._id, amount: 250 });
      await IntakeLog.create({ userId: targetUser._id, amount: 500 });

      const countBefore = await IntakeLog.countDocuments({ userId: targetUser._id });
      expect(countBefore).toBe(2);

      const res = await request(app)
        .delete('/api/users/' + targetUser._id)
        .set('Authorization', 'Bearer ' + adminToken);

      expect(res.status).toBe(200);
      expect(res.body.data.cascadeDeletedLogsCount).toBe(2);

      const countAfter = await IntakeLog.countDocuments({ userId: targetUser._id });
      expect(countAfter).toBe(0);

      const userCheck = await User.findById(targetUser._id);
      expect(userCheck).toBeNull();
    });
  });

  describe('8. Daily Goal Settings', () => {
    it('should return default 2000 ml goal when unconfigured', async () => {
      await createTestUser('user', 'user@example.com');
      const token = await loginHelper('user@example.com');

      const res = await request(app)
        .get('/api/settings/daily-goal')
        .set('Authorization', 'Bearer ' + token);

      expect(res.status).toBe(200);
      expect(res.body.data.dailyGoalMl).toBe(2000);
    });

    it('should block regular user from updating daily goal (403 Forbidden)', async () => {
      await createTestUser('user', 'user@example.com');
      const token = await loginHelper('user@example.com');

      const res = await request(app)
        .put('/api/settings/daily-goal')
        .set('Authorization', 'Bearer ' + token)
        .send({ dailyGoalMl: 2500 });

      expect(res.status).toBe(403);
    });

    it('should allow admin to update daily goal (200 OK)', async () => {
      await createTestUser('admin', 'admin@example.com');
      const token = await loginHelper('admin@example.com');

      const res = await request(app)
        .put('/api/settings/daily-goal')
        .set('Authorization', 'Bearer ' + token)
        .send({ dailyGoalMl: 2500 });

      expect(res.status).toBe(200);
      expect(res.body.data.dailyGoalMl).toBe(2500);

      const check = await AppSettings.findOne();
      expect(check?.dailyGoalMl).toBe(2500);
    });
  });
});
