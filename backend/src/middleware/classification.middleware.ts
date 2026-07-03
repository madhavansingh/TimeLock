import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth.middleware';
import { PolicyService } from '../services/policy.service';
import { basePrisma, tenantContextStorage } from '../config/db';

export async function classificationMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const correlationId = (req.headers['x-correlation-id'] as string) || (req.headers['x-request-id'] as string);
  const requestId = req.headers['x-request-id'] as string;
  
  // 1. Resolve subject attributes from the authenticated user session
  const subject = {
    userId: req.user?.userId,
    role: req.user?.role || 'ANONYMOUS',
    securityClearance: 'PUBLIC', // Default fallback
    department: 'CITIZEN'
  };

  const context = tenantContextStorage.getStore();
  const tenantId = context?.tenantId || 'sovereign-tenant';

  if (req.user?.userId) {
    try {
      const userRecord = await basePrisma.user.findUnique({
        where: { userId: req.user.userId },
        select: { securityClearance: true, role: true }
      });
      if (userRecord) {
        subject.securityClearance = userRecord.securityClearance;
        subject.department = userRecord.role === 'NOTARY' ? 'NOTARY' : 'REGISTRY';
      }
    } catch (err) {
      console.error('Failed to look up user clearance for PDP:', err);
    }
  }

  // 2. Resolve resource attributes from the request
  let resource = {
    id: 'system',
    type: 'system',
    classification: 'PUBLIC',
    ownerId: undefined,
    isLocked: false
  };

  // Check if a documentId parameter is present in the route path or body
  const documentId = req.params.documentId || req.params.id || req.body.documentId;
  
  if (documentId && typeof documentId === 'string' && documentId.length > 10) {
    try {
      const docRecord = await basePrisma.document.findUnique({
        where: { documentId },
        select: { documentId: true, classification: true, ownerUserId: true, status: true }
      });

      if (docRecord) {
        resource = {
          id: docRecord.documentId,
          type: 'document',
          classification: docRecord.classification,
          ownerId: docRecord.ownerUserId as any,
          isLocked: docRecord.status === 'DISPUTED' || docRecord.status === 'REVOKED'
        };
      }
    } catch (err) {
      console.error('Failed to look up resource classification for PDP:', err);
    }
  } else if (req.body.classification) {
    // For creations or uploads, evaluate the target classification requested
    resource = {
      id: 'new-resource',
      type: 'document',
      classification: req.body.classification,
      ownerId: req.user?.userId as any,
      isLocked: false
    };
  }

  // 3. Resolve the action being performed
  let action = 'read';
  if (req.method === 'POST') {
    action = 'document:write';
  } else if (req.method === 'PUT' || req.method === 'PATCH') {
    action = 'document:write';
  } else if (req.method === 'DELETE') {
    action = 'document:delete';
  } else if (req.path.includes('/sign')) {
    action = 'document:sign';
  } else if (req.path.includes('/transfer')) {
    action = 'document:transfer';
  } else {
    action = 'document:read';
  }

  // 4. Invoke the Policy Decision Point (PDP)
  try {
    const decision = await PolicyService.evaluate(
      subject,
      resource,
      action,
      tenantId,
      correlationId,
      requestId
    );

    // 5. Enforce the decision (PEP)
    if (decision.decision === 'DENY') {
      return res.status(403).json({
        data: null,
        error: {
          code: 'ACCESS_DENIED',
          message: decision.reason,
          details: {
            decisionId: decision.evaluationId,
            requiredClearance: resource.classification,
            evaluationTimeMs: decision.evaluationTimeMs,
            supportReference: decision.supportReference
          }
        },
        requestId: requestId || 'unknown'
      });
    }

    // Access allowed, proceed to the next handler
    next();
  } catch (err) {
    console.error('PDP evaluation failed, defaulting to DENY for security:', err);
    return res.status(403).json({
      data: null,
      error: {
        code: 'PDP_FAILURE',
        message: 'Security policy evaluation failed. Access blocked by default-deny rule.',
        details: {}
      },
      requestId: requestId || 'unknown'
    });
  }
}
