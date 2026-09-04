import { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/apiResponse';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const validateRegister = (req: Request, res: Response, next: NextFunction) => {
  const { name, email, password } = req.body;

  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    return sendError(res, 'Name is required and must be at least 2 characters long.', 400);
  }

  if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
    return sendError(res, 'Please provide a valid email address.', 400);
  }

  if (!password || typeof password !== 'string' || password.length < 6) {
    return sendError(res, 'Password must be at least 6 characters long.', 400);
  }

  if (req.body.role) {
    delete req.body.role;
  }

  req.body.name = name.trim();
  req.body.email = email.trim().toLowerCase();
  next();
};

export const validateLogin = (req: Request, res: Response, next: NextFunction) => {
  const { email, password } = req.body;

  if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
    return sendError(res, 'Please provide a valid email address.', 400);
  }

  if (!password || typeof password !== 'string') {
    return sendError(res, 'Password is required.', 400);
  }

  req.body.email = email.trim().toLowerCase();
  next();
};

export const validateIntake = (req: Request, res: Response, next: NextFunction) => {
  const { amount, consumedAt } = req.body;

  if (
    amount === undefined ||
    amount === null ||
    typeof amount !== 'number' ||
    !Number.isFinite(amount) ||
    amount <= 0
  ) {
    return sendError(res, 'Water intake amount must be greater than 0.', 400);
  }

  if (amount > 10000) {
    return sendError(res, 'Water intake amount cannot exceed 10,000 ml per entry.', 400);
  }

  if (consumedAt !== undefined && consumedAt !== null) {
    const parsedDate = new Date(consumedAt);
    if (isNaN(parsedDate.getTime())) {
      return sendError(res, 'Invalid consumedAt timestamp provided.', 400);
    }
    const now = new Date();
    const maxFuture = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const minPast = new Date();
    minPast.setFullYear(now.getFullYear() - 1);
    if (parsedDate > maxFuture || parsedDate < minPast) {
      return sendError(res, 'Consumption date must be within the past year and not in the future.', 400);
    }
  }

  next();
};

export const validateDailyGoal = (req: Request, res: Response, next: NextFunction) => {
  const { dailyGoalMl } = req.body;

  if (
    dailyGoalMl === undefined ||
    dailyGoalMl === null ||
    typeof dailyGoalMl !== 'number' ||
    !Number.isFinite(dailyGoalMl) ||
    dailyGoalMl <= 0
  ) {
    return sendError(res, 'Daily goal must be a positive number greater than 0 ml.', 400);
  }

  if (dailyGoalMl < 100 || dailyGoalMl > 20000) {
    return sendError(res, 'Daily goal must be between 100 ml and 20,000 ml.', 400);
  }

  next();
};
