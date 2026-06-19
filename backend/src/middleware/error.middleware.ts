import { Request, Response, NextFunction } from 'express';

export function errorMiddleware(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) {
  console.error('Unhandled Server Error:', err);

  const status = err.status || 500;
  const code = err.code || 'INTERNAL_SERVER_ERROR';
  const message = err.message || 'An unexpected error occurred on the server.';

  res.status(status).json({
    data: null,
    error: {
      code,
      message,
      details: err.details || undefined
    },
    requestId: req.headers['x-request-id'] || 'unknown'
  });
}
