import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { basePrisma, tenantContextStorage, TenantContext } from '../config/db';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_for_hackathon';

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    role: string;
  };
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
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
    const userExists = await basePrisma.user.findUnique({
      where: { userId: decoded.userId }
    });
    
    if (!userExists) {
      return res.status(401).json({
        data: null,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'The user account associated with this session no longer exists.'
        },
        requestId: req.headers['x-request-id'] || 'unknown'
      });
    }

    (req as AuthenticatedRequest).user = decoded;

    // Propagate the user's specific tenant context downstream
    const context: TenantContext = {
      tenantId: userExists.tenantId || 'sovereign-tenant',
      residency: {
        country: userExists.residencyCountry,
        state: userExists.residencyState,
        district: userExists.residencyDistrict
      },
      clearance: userExists.securityClearance
    };

    tenantContextStorage.run(context, () => {
      next();
    });
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

export async function optionalAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; role: string };
    const userExists = await basePrisma.user.findUnique({
      where: { userId: decoded.userId }
    });
    
    if (userExists) {
      (req as AuthenticatedRequest).user = decoded;
      
      const context: TenantContext = {
        tenantId: userExists.tenantId || 'sovereign-tenant',
        residency: {
          country: userExists.residencyCountry,
          state: userExists.residencyState,
          district: userExists.residencyDistrict
        },
        clearance: userExists.securityClearance
      };

      return tenantContextStorage.run(context, () => {
        next();
      });
    }
  } catch (err) {
    // Treat invalid or expired token as anonymous
  }
  
  (req as AuthenticatedRequest).user = undefined;
  next();
}

