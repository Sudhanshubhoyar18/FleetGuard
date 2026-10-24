import type { Request, Response, NextFunction } from 'express';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('ErrorHandler');

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  logger.error(`Unhandled error at ${req.method} ${req.url}: ${err.message}`, {
    stack: err.stack
  });

  const statusCode = err.statusCode || (err.status ? Number(err.status) : 500);

  res.status(statusCode).json({
    error: err.name || 'InternalServerError',
    message: err.message || 'An unexpected server error occurred.',
    ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : {})
  });
}
