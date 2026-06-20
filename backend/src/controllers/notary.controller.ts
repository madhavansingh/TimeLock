import { Request, Response, NextFunction } from 'express';
import { NotaryOnboardSchema } from '../shared/validation';
import { prisma } from '../config/db';
import { DbDocumentStatus } from '@prisma/client';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

export class NotaryController {
  /**
   * Register a new notary with their Class 3 DSC certificate details.
   */
  public static async onboardNotary(req: Request, res: Response, next: NextFunction) {
    try {
      const payload = NotaryOnboardSchema.parse(req.body);

      const notary = await prisma.notary.create({
        data: {
          name: payload.name,
          dscCertificateSerial: payload.dscCertificateSerial,
          publicKey: payload.publicKeyBase64,
          certStatus: 'active'
        }
      });

      res.status(201).json({
        data: {
          notaryId: notary.notaryId,
          message: 'Notary onboarded successfully.'
        },
        error: null,
        requestId: req.headers['x-request-id'] || 'unknown'
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Retrieves pending documents queue for the authenticated notary user.
   */
  public static async getPendingQueue(req: Request, res: Response, next: NextFunction) {
    try {
      const authReq = req as AuthenticatedRequest;
      if (!authReq.user) {
        return res.status(401).json({
          data: null,
          error: { code: 'UNAUTHORIZED', message: 'User context not found.' },
          requestId: req.headers['x-request-id'] || 'unknown'
        });
      }

      // Fetch the Notary profile linked to this User
      const userWithNotary = await prisma.user.findUnique({
        where: { userId: authReq.user.userId },
        include: { notary: true }
      });

      if (!userWithNotary || !userWithNotary.notaryId) {
        return res.status(403).json({
          data: null,
          error: {
            code: 'NOTARY_PROFILE_NOT_FOUND',
            message: 'No notary profile associated with this user.'
          },
          requestId: req.headers['x-request-id'] || 'unknown'
        });
      }

      // Find all documents assigned specifically to this notary
      const documents = await prisma.document.findMany({
        where: {
          assignedNotaryId: userWithNotary.notaryId
        },
        include: {
          verificationCase: {
            include: { evidence: true }
          },
          metadata: true,
          signatures: { include: { notary: true } },
          verificationEvents: { orderBy: { occurredAt: 'asc' } }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      res.status(200).json({
        data: documents,
        error: null,
        requestId: req.headers['x-request-id'] || 'unknown'
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Retrieves pending transfers queue for the authenticated notary user.
   */
  public static async getTransfersQueue(req: Request, res: Response, next: NextFunction) {
    try {
      const authReq = req as AuthenticatedRequest;
      if (!authReq.user) {
        return res.status(401).json({
          data: null,
          error: { code: 'UNAUTHORIZED', message: 'User context not found.' },
          requestId: req.headers['x-request-id'] || 'unknown'
        });
      }

      // Fetch the Notary profile linked to this User
      const userWithNotary = await prisma.user.findUnique({
        where: { userId: authReq.user.userId },
        include: { notary: true }
      });

      if (!userWithNotary || !userWithNotary.notaryId) {
        return res.status(403).json({
          data: null,
          error: {
            code: 'NOTARY_PROFILE_NOT_FOUND',
            message: 'No notary profile associated with this user.'
          },
          requestId: req.headers['x-request-id'] || 'unknown'
        });
      }

      // Find all transfers assigned specifically to this notary
      const transfers = await prisma.ownershipTransfer.findMany({
        where: {
          assignedNotaryId: userWithNotary.notaryId
        },
        include: {
          document: {
            include: {
              metadata: true,
              verificationCase: {
                include: { evidence: true }
              }
            }
          }
        },
        orderBy: {
          initiatedAt: 'desc'
        }
      });

      res.status(200).json({
        data: transfers,
        error: null,
        requestId: req.headers['x-request-id'] || 'unknown'
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Retrieves a list of all active registered notaries.
   */
  public static async getActiveNotaries(req: Request, res: Response, next: NextFunction) {
    try {
      const notaries = await prisma.notary.findMany({
        where: {
          certStatus: 'active'
        },
        select: {
          notaryId: true,
          name: true,
          dscCertificateSerial: true,
          certStatus: true
        }
      });

      res.status(200).json({
        data: notaries.map((n) => ({
          id: n.notaryId,
          notaryId: n.notaryId,
          name: n.name,
          dscCertificateSerial: n.dscCertificateSerial,
          status: n.certStatus
        })),
        error: null,
        requestId: req.headers['x-request-id'] || 'unknown'
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Retrieves signed, fully executed, historical cases and VPL proof references.
   */
  public static async getArchive(req: Request, res: Response, next: NextFunction) {
    try {
      const authReq = req as AuthenticatedRequest;
      if (!authReq.user) {
        return res.status(401).json({
          data: null,
          error: { code: 'UNAUTHORIZED', message: 'User context not found.' },
          requestId: req.headers['x-request-id'] || 'unknown'
        });
      }

      // Fetch the Notary profile linked to this User
      const userWithNotary = await prisma.user.findUnique({
        where: { userId: authReq.user.userId },
        select: { notaryId: true }
      });

      if (!userWithNotary || !userWithNotary.notaryId) {
        return res.status(403).json({
          data: null,
          error: {
            code: 'NOTARY_PROFILE_NOT_FOUND',
            message: 'No notary profile associated with this user.'
          },
          requestId: req.headers['x-request-id'] || 'unknown'
        });
      }

      // Query documents assigned to this notary in NOTARY_SIGNED or FULLY_EXECUTED
      const documents = await prisma.document.findMany({
        where: {
          assignedNotaryId: userWithNotary.notaryId,
          status: {
            in: [DbDocumentStatus.NOTARY_SIGNED, DbDocumentStatus.FULLY_EXECUTED]
          }
        },
        include: {
          verificationCase: {
            include: {
              evidence: true
            }
          },
          metadata: true,
          signatures: {
            include: {
              notary: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      res.status(200).json({
        data: documents,
        error: null,
        requestId: req.headers['x-request-id'] || 'unknown'
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Retrieves PostgreSQL-backed notary dashboard metrics.
   */
  public static async getAnalytics(req: Request, res: Response, next: NextFunction) {
    try {
      const authReq = req as AuthenticatedRequest;
      if (!authReq.user) {
        return res.status(401).json({
          data: null,
          error: { code: 'UNAUTHORIZED', message: 'User context not found.' },
          requestId: req.headers['x-request-id'] || 'unknown'
        });
      }

      // Fetch the Notary profile linked to this User
      const userWithNotary = await prisma.user.findUnique({
        where: { userId: authReq.user.userId },
        select: { notaryId: true }
      });

      if (!userWithNotary || !userWithNotary.notaryId) {
        return res.status(403).json({
          data: null,
          error: {
            code: 'NOTARY_PROFILE_NOT_FOUND',
            message: 'No notary profile associated with this user.'
          },
          requestId: req.headers['x-request-id'] || 'unknown'
        });
      }

      const notaryId = userWithNotary.notaryId;

      // 1. Documents Assigned (all statuses assigned to this notary)
      const assignedCount = await prisma.document.count({
        where: { assignedNotaryId: notaryId }
      });

      // 2. Documents Reviewed (started review, ready for sign, signed, fully executed)
      const reviewedCount = await prisma.document.count({
        where: {
          assignedNotaryId: notaryId,
          status: {
            in: [
              DbDocumentStatus.NOTARY_REVIEW_STARTED,
              DbDocumentStatus.READY_FOR_SIGNATURE,
              DbDocumentStatus.NOTARY_SIGNED,
              DbDocumentStatus.FULLY_EXECUTED
            ]
          }
        }
      });

      // 3. Documents Signed (signed or fully executed)
      const signedCount = await prisma.document.count({
        where: {
          assignedNotaryId: notaryId,
          status: {
            in: [DbDocumentStatus.NOTARY_SIGNED, DbDocumentStatus.FULLY_EXECUTED]
          }
        }
      });

      // 4. Active Conflict Cases (unresolved conflict challenges)
      const cases = await prisma.verificationCase.findMany({
        where: { notaryId }
      });
      let activeConflictCases = 0;
      cases.forEach((c) => {
        const challenges = (c.challenges as any) || [];
        const hasUnresolvedConflict = challenges.some(
          (ch: any) => ch.type === 'CONFLICT' && !ch.resolved
        );
        if (hasUnresolvedConflict) {
          activeConflictCases++;
        }
      });

      // 5. Average Trust Score
      const avgTrustScoreResult = await prisma.verificationCase.aggregate({
        where: { notaryId },
        _avg: { trustScore: true }
      });
      const averageTrustScore = Math.round(avgTrustScoreResult._avg.trustScore || 100);

      // 6. Average Review Time (Time between ONCHAIN_CONFIRMED event and NOTARY_SIGNED event)
      const signedDocs = await prisma.document.findMany({
        where: {
          assignedNotaryId: notaryId,
          status: {
            in: [DbDocumentStatus.NOTARY_SIGNED, DbDocumentStatus.FULLY_EXECUTED]
          }
        },
        include: {
          verificationEvents: true
        }
      });

      let totalReviewTimeMs = 0;
      let reviewTimeCount = 0;
      for (const doc of signedDocs) {
        const reviewStart = doc.verificationEvents.find(e => e.eventType === 'NOTARY_REVIEW_STARTED');
        const signedEvent = doc.verificationEvents.find(e => e.eventType === 'NOTARY_SIGNED');
        if (reviewStart && signedEvent) {
          const diff = signedEvent.occurredAt.getTime() - reviewStart.occurredAt.getTime();
          if (diff > 0) {
            totalReviewTimeMs += diff;
            reviewTimeCount++;
          }
        }
      }
      const averageReviewTimeHours = reviewTimeCount > 0
        ? parseFloat((totalReviewTimeMs / (1000 * 60 * 60) / reviewTimeCount).toFixed(2))
        : 0;

      // 7. Trust Score Distribution
      const scoreBuckets = { Excellent: 0, Good: 0, Warning: 0, Critical: 0 };
      cases.forEach(c => {
        if (c.trustScore >= 90) scoreBuckets.Excellent++;
        else if (c.trustScore >= 75) scoreBuckets.Good++;
        else if (c.trustScore >= 50) scoreBuckets.Warning++;
        else scoreBuckets.Critical++;
      });

      // 8. Daily activity metrics over last 7 days
      const dailyActivity: { date: string; registered: number; reviewed: number; signed: number }[] = [];
      const now = new Date();
      for (let i = 6; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(now.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];

        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        const registered = await prisma.document.count({
          where: {
            assignedNotaryId: notaryId,
            createdAt: { gte: startOfDay, lte: endOfDay }
          }
        });

        const reviewed = await prisma.verificationEvent.count({
          where: {
            document: { assignedNotaryId: notaryId },
            eventType: 'NOTARY_REVIEW_STARTED',
            occurredAt: { gte: startOfDay, lte: endOfDay }
          }
        });

        const signed = await prisma.verificationEvent.count({
          where: {
            document: { assignedNotaryId: notaryId },
            eventType: 'NOTARY_SIGNED',
            occurredAt: { gte: startOfDay, lte: endOfDay }
          }
        });

        dailyActivity.push({
          date: dateStr,
          registered,
          reviewed,
          signed
        });
      }

      res.status(200).json({
        data: {
          documentsAssigned: assignedCount,
          documentsReviewed: reviewedCount,
          documentsSigned: signedCount,
          averageReviewTimeHours,
          activeConflictCases,
          averageTrustScore,
          trustScoreDistribution: scoreBuckets,
          dailyActivity
        },
        error: null,
        requestId: req.headers['x-request-id'] || 'unknown'
      });
    } catch (err) {
      next(err);
    }
  }
}
