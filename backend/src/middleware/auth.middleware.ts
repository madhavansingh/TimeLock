import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_for_hackathon';

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    role: string;
  };
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      data: null,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authorization header is missing or malformed.'
      },
      requestId: req.headers['x-request-id'] || 'unknown'
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; role: string };
    (req as AuthenticatedRequest).user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({
      data: null,
      error: {
        code: 'INVALID_TOKEN',
        message: 'The session token provided is invalid or expired.'
      },
      requestId: req.headers['x-request-id'] || 'unknown'
    });
  }
}
