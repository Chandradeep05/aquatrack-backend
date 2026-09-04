import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/token';
import { User } from '../models/User';
import { sendError } from '../utils/apiResponse';

export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return sendError(res, 'Authentication required. No token provided.', 401);
    }

    const token = authHeader.split(' ')[1];
    let decoded: { id: string; role: string };

    try {
      decoded = verifyToken(token);
    } catch (err: any) {
      if (err.name === 'TokenExpiredError') {
        return sendError(res, 'Token has expired. Please log in again.', 401);
      }
      return sendError(res, 'Invalid authentication token.', 401);
    }

    const user = await User.findById(decoded.id);
    if (!user) {
      return sendError(res, 'User belonging to this token no longer exists.', 401);
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};
