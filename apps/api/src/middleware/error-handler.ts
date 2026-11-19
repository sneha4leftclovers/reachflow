import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { ApiErrorResponse } from '@reachflow/shared';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: Array<{ field?: string; message: string }>
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  const requestId = req.id;

  if (err instanceof AppError) {
    const errorResponse: ApiErrorResponse = {
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
      meta: { requestId },
    };
    return res.status(err.statusCode).json(errorResponse);
  }

  if (err instanceof ZodError) {
    const errorResponse: ApiErrorResponse = {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Input validation failed',
        details: err.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      },
      meta: { requestId },
    };
    return res.status(400).json(errorResponse);
  }

  // Handle malformed JSON request bodies
  if (err instanceof SyntaxError && 'body' in err) {
    const errorResponse: ApiErrorResponse = {
      success: false,
      error: {
        code: 'BAD_REQUEST',
        message: 'Invalid JSON payload format',
      },
      meta: { requestId },
    };
    return res.status(400).json(errorResponse);
  }

  console.error(`[${requestId}] Unhandled Error:`, err);

  const errorResponse: ApiErrorResponse = {
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected internal server error occurred',
    },
    meta: { requestId },
  };
  return res.status(500).json(errorResponse);
}
