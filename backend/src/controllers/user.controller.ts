import { Response, NextFunction } from 'express';
import { prisma } from '../config/db';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { GetUserParamsSchema, UpdateUserSchema, ListUsersQuerySchema } from '../validation/user.validation';
import crypto from 'crypto';
import { logger } from '../config/logger';

export class UserController {
  /**
   * Fetches user profile by ID.
   * Access: Owner user or ADMIN.
   */
  public static async getUserById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = GetUserParamsSchema.parse(req.params);

      // Authorization check: User can only access their own record, unless they are ADMIN
      if (req.user?.userId !== id && req.user?.role !== 'ADMIN') {
        return res.status(403).json({
          data: null,
          error: {
            code: 'FORBIDDEN',
            message: 'Access denied. You do not have permission to view this user profile.'
          },
          requestId: req.headers['x-request-id'] || 'unknown'
        });
      }

      const user = await prisma.user.findUnique({
        where: { userId: id }
      });

      if (!user) {
        return res.status(404).json({
          data: null,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User profile not found.'
          },
          requestId: req.headers['x-request-id'] || 'unknown'
        });
      }

      res.status(200).json({
        data: {
          user: {
            userId: user.userId,
            role: user.role,
            emailHash: user.emailHash,
            phoneHash: user.phoneHash
          }
        },
        error: null,
        requestId: req.headers['x-request-id'] || 'unknown'
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Updates user profile attributes (email, phone, or role).
   * Access: Owner user or ADMIN. Role upgrades are strictly ADMIN-only.
   */
  public static async updateUser(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = GetUserParamsSchema.parse(req.params);
      const payload = UpdateUserSchema.parse(req.body);

      // Authorization check: User can only modify their own record, unless they are ADMIN
      if (req.user?.userId !== id && req.user?.role !== 'ADMIN') {
        return res.status(403).json({
          data: null,
          error: {
            code: 'FORBIDDEN',
            message: 'Access denied. You do not have permission to update this user profile.'
          },
          requestId: req.headers['x-request-id'] || 'unknown'
        });
      }

      // Role upgrade check: Only ADMIN can modify roles
      if (payload.role !== undefined && req.user?.role !== 'ADMIN') {
        return res.status(403).json({
          data: null,
          error: {
            code: 'FORBIDDEN',
            message: 'Access denied. Only administrators can modify user roles.'
          },
          requestId: req.headers['x-request-id'] || 'unknown'
        });
      }

      // Prepare data for update
      const updateData: any = {};
      
      if (payload.role !== undefined) {
        updateData.role = payload.role;
      }
      
      if (payload.email !== undefined) {
        updateData.emailHash = crypto.createHash('sha256').update(payload.email).digest('hex');
      }
      
      if (payload.phone !== undefined) {
        updateData.phoneHash = crypto.createHash('sha256').update(payload.phone).digest('hex');
      }

      // Verify that there is something to update
      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({
          data: null,
          error: {
            code: 'BAD_REQUEST',
            message: 'No valid update parameters provided.'
          },
          requestId: req.headers['x-request-id'] || 'unknown'
        });
      }

      // Update in database
      const updatedUser = await prisma.user.update({
        where: { userId: id },
        data: updateData
      });

      logger.info(`[USER] User ID ${id} updated profile details.`);

      res.status(200).json({
        data: {
          user: {
            userId: updatedUser.userId,
            role: updatedUser.role,
            emailHash: updatedUser.emailHash,
            phoneHash: updatedUser.phoneHash
          }
        },
        error: null,
        requestId: req.headers['x-request-id'] || 'unknown'
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Lists all registered users with pagination & role filtering.
   * Access: ADMIN only.
   */
  public static async listUsers(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      // Router level check, but adding an extra check here for absolute security
      if (req.user?.role !== 'ADMIN') {
        return res.status(403).json({
          data: null,
          error: {
            code: 'FORBIDDEN',
            message: 'Access denied. Requires administrative privileges.'
          },
          requestId: req.headers['x-request-id'] || 'unknown'
        });
      }

      const query = ListUsersQuerySchema.parse(req.query);

      // Build prisma filter
      const where: any = {};
      if (query.role) {
        where.role = query.role;
      }

      // Fetch users and total count in parallel
      const [users, totalCount] = await Promise.all([
        prisma.user.findMany({
          where,
          skip: query.skip,
          take: query.limit,
          orderBy: { userId: 'asc' }
        }),
        prisma.user.count({ where })
      ]);

      const formattedUsers = users.map((u) => ({
        userId: u.userId,
        role: u.role,
        emailHash: u.emailHash,
        phoneHash: u.phoneHash
      }));

      res.status(200).json({
        data: {
          users: formattedUsers,
          pagination: {
            total: totalCount,
            limit: query.limit,
            skip: query.skip
          }
        },
        error: null,
        requestId: req.headers['x-request-id'] || 'unknown'
      });
    } catch (err) {
      next(err);
    }
  }
}
