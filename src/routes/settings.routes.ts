import { Router } from 'express';
import { getDailyGoal, updateDailyGoal } from '../controllers/settings.controller';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { validateDailyGoal } from '../middleware/validate';

const router = Router();

// Authenticated users can read daily goal; only admins can modify
router.get('/daily-goal', authenticate, getDailyGoal);
router.put(
  '/daily-goal',
  authenticate,
  authorize(['admin']),
  validateDailyGoal,
  updateDailyGoal
);

export default router;
