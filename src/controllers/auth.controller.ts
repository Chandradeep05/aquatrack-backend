import { Request, Response, NextFunction } from 'express';
import { User } from '../models/User';
import { generateToken } from '../utils/token';
import { sendSuccess, sendError } from '../utils/apiResponse';

export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, email, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return sendError(res, 'An account with this email already exists.', 409);
    }

    // Always create as 'user' role for public registration
    const user = new User({
      name,
      email,
      passwordHash: password, // Mongoose pre-save hook hashes this
      role: 'user'
    });

    await user.save();

    return sendSuccess(
      res,
      {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role
        }
      },
      'User registered successfully',
      201
    );
  } catch (error) {
    next(error);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      // Intentionally generic error message to prevent user enumeration
      return sendError(res, 'Invalid email or password.', 401);
    }

    // Verify password hash
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return sendError(res, 'Invalid email or password.', 401);
    }

    // Issue JWT
    const token = generateToken({
      id: user._id.toString(),
      role: user.role
    });

    return sendSuccess(
      res,
      {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role
        },
        token
      },
      'Login successful',
      200
    );
  } catch (error) {
    next(error);
  }
};

export const getMe = async (req: Request, res: Response) => {
  // Attached by authenticate middleware
  const user = (req as any).user;
  return sendSuccess(
    res,
    {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    },
    'Authenticated user profile retrieved'
  );
};
