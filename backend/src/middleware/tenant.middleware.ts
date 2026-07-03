import { Request, Response, NextFunction } from 'express';
import { tenantContextStorage, TenantContext, prisma } from '../config/db';
import { AuthenticatedRequest } from './auth.middleware';

export async function tenantMiddleware(req: Request, res: Response, next: NextFunction) {
  // 1. Resolve tenant ID from multiple sources
  let tenantId: string | undefined;

  // Source A: From authenticated user context
  const authReq = req as AuthenticatedRequest;
  if (authReq.user?.userId) {
    try {
      // Look up user's tenant association in the database
      // Since this is a core middleware, we retrieve it from the database and can cache it in the future
      const userRecord = await prisma.user.findUnique({
        where: { userId: authReq.user.userId },
        select: { tenantId: true, securityClearance: true, residencyCountry: true, residencyState: true, residencyDistrict: true }
      });
      if (userRecord?.tenantId) {
        tenantId = userRecord.tenantId;
        
        // Populate full context if user is authenticated
        const context: TenantContext = {
          tenantId,
          residency: {
            country: userRecord.residencyCountry,
            state: userRecord.residencyState,
            district: userRecord.residencyDistrict
          },
          clearance: userRecord.securityClearance
        };

        return tenantContextStorage.run(context, () => {
          next();
        });
      }
    } catch (err) {
      console.error('Failed to resolve tenant from user session:', err);
    }
  }

  // Source B: From HTTP Header
  if (!tenantId) {
    const headerValue = req.headers['x-tenant-id'];
    if (headerValue && typeof headerValue === 'string') {
      tenantId = headerValue;
    }
  }

  // Source C: From Subdomain
  if (!tenantId && req.subdomains && req.subdomains.length > 0) {
    tenantId = req.subdomains[0];
  }

  // Source D: Fallback to the default sovereign tenant
  if (!tenantId) {
    tenantId = 'sovereign-tenant';
  }

  // Retrieve tenant residency/policies from database if not authenticated
  try {
    const tenantRecord = await prisma.tenant.findUnique({
      where: { tenantId },
      select: { country: true, state: true, district: true }
    });

    const context: TenantContext = {
      tenantId,
      residency: tenantRecord ? {
        country: tenantRecord.country,
        state: tenantRecord.state,
        district: tenantRecord.district
      } : {
        country: 'IN',
        state: 'MH',
        district: 'PUNE'
      },
      clearance: 'PUBLIC' // Default clearance for unauthenticated tenant requests
    };

    tenantContextStorage.run(context, () => {
      next();
    });
  } catch (err) {
    console.error('Failed to resolve tenant record, using defaults:', err);
    // Safe fallback
    const fallbackContext: TenantContext = {
      tenantId,
      residency: { country: 'IN', state: 'MH', district: 'PUNE' },
      clearance: 'PUBLIC'
    };
    tenantContextStorage.run(fallbackContext, () => {
      next();
    });
  }
}
