import { Response } from 'express';
import { ApiResponse } from '@shared/types/api';
import { logger } from '@/services/logger';

export const respondError = <T>(
  response: Response,
  message: string,
  statusCode: number = 500
): Response<ApiResponse<T>> => {
  logger.error(message);

  return response.status(statusCode).json({ success: false, error: message });
};

export const respondSuccess = <T>(response: Response, data?: T): Response<ApiResponse<T>> =>
  response.status(200).json({ success: true, data });
