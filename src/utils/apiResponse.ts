import { Response } from 'express';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
}

export const sendSuccess = <T>(
  res: Response,
  data?: T,
  message?: string,
  statusCode: number = 200
): Response => {
  const responsePayload: ApiResponse<T> = {
    success: true
  };

  if (data !== undefined) {
    responsePayload.data = data;
  }

  if (message !== undefined) {
    responsePayload.message = message;
  }

  return res.status(statusCode).json(responsePayload);
};

export const sendError = (
  res: Response,
  message: string,
  statusCode: number = 500
): Response => {
  return res.status(statusCode).json({
    success: false,
    message
  });
};
