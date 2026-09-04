import { Router } from 'express';
import {
  logIntake,
  getTodayIntake,
  getIntakeHistory,
  deleteIntake
} from '../controllers/intake.controller';
import { authenticate } from '../middleware/authenticate';
import { validateIntake } from '../middleware/validate';

const router = Router();

// All intake endpoints require an authenticated user
router.use(authenticate);

router.post('/', validateIntake, logIntake);
router.get('/today', getTodayIntake);
router.get('/history', getIntakeHistory);
router.delete('/:id', deleteIntake);

export default router;
