import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const existingId = req.headers['x-request-id'] as string;
  const requestId = existingId || crypto.randomUUID();
  req.id = requestId;
  res.setHeader('x-request-id', requestId);
  next();
}
