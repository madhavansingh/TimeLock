import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth.middleware';

export function rbacMiddleware(allowedRoles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        data: null,
        error: {
          code: 'UNAUTHORIZED',
          message: 'User authentication context not found.'
        },
        requestId: req.headers['x-request-id'] || 'unknown'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        data: null,
        error: {
          code: 'FORBIDDEN',
          message: `Access denied. Requires one of the following roles: ${allowedRoles.join(', ')}`
        },
        requestId: req.headers['x-request-id'] || 'unknown'
      });
    }

    next();
  };
}
