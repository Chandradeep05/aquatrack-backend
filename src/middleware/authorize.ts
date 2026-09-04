import { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/apiResponse';
import { UserRole } from '../models/User';

export const authorize = (roles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return sendError(res, 'Authentication required.', 401);
    }

    if (!roles.includes(req.user.role)) {
      return sendError(res, 'You are not authorized to perform this action.', 403);
    }

    next();
  };
};
