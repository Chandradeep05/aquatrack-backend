import { Router } from 'express';
import {
  getAllUsers,
  getUserIntakeHistory,
  deleteUser
} from '../controllers/users.controller';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';

const router = Router();

// All user management routes require admin role
router.use(authenticate, authorize(['admin']));

router.get('/', getAllUsers);
router.get('/:id/intake', getUserIntakeHistory);
router.delete('/:id', deleteUser);

export default router;
