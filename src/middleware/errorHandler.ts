import { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/apiResponse';

export const errorHandler = (
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  console.error('[Error Details]', err);

  // Mongoose invalid ObjectId (CastError)
  if (err.name === 'CastError') {
    return sendError(res, 'Resource not found with the specified identifier', 404);
  }

  // Duplicate key error (e.g. unique email)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    return sendError(res, `Duplicate value entered for ${field}. Value already exists.`, 409);
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((val: any) => val.message);
    return sendError(res, messages.join(', '), 400);
  }

  // JSON parsing error
  if (err instanceof SyntaxError && 'body' in err) {
    return sendError(res, 'Malformed JSON in request body', 400);
  }

  // Default server error
  const statusCode = err.statusCode || 500;
  const message =
    process.env.NODE_ENV === 'production' && statusCode === 500
      ? 'Internal Server Error'
      : err.message || 'Internal Server Error';
  return sendError(res, message, statusCode);
};
