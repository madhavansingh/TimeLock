import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { BlockchainService } from '../services/blockchain.service';
import { AppError } from '../config/errors';

export class AuthorityController {
  /**
   * Retrieves all registered authority records.
   */
  public static async list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const list = await BlockchainService.getAuthorities();
      res.status(200).json({
        data: list,
        error: null,
        requestId: req.headers['x-request-id'] || 'unknown'
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Registers a new authority.
   */
  public static async register(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      // Only admins can register authorities
      if (req.user!.role !== 'ADMIN') {
        throw new AppError('Only registry administrators can manage authority registrations.', 403, 'UNAUTHORIZED');
      }

      const { authorityKey, role, details } = req.body;
      if (!authorityKey || !role || !details) {
        return res.status(400).json({
          data: null,
          error: { code: 'BAD_REQUEST', message: 'authorityKey, role, and details are required.' },
          requestId: req.headers['x-request-id'] || 'unknown'
        });
      }

      await BlockchainService.registerAuthority(authorityKey, role, details);

      res.status(201).json({
        data: { message: 'Authority successfully registered on-chain.' },
        error: null,
        requestId: req.headers['x-request-id'] || 'unknown'
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Revokes an active authority.
   */
  public static async revoke(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      // Only admins can revoke authorities
      if (req.user!.role !== 'ADMIN') {
        throw new AppError('Only registry administrators can manage authority registrations.', 403, 'UNAUTHORIZED');
      }

      const { id } = req.params; // authorityKey
      if (!id) {
        return res.status(400).json({
          data: null,
          error: { code: 'BAD_REQUEST', message: 'Authority Key ID is required.' },
          requestId: req.headers['x-request-id'] || 'unknown'
        });
      }

      await BlockchainService.revokeAuthority(id);

      res.status(200).json({
        data: { message: 'Authority status updated to REVOKED on-chain.' },
        error: null,
        requestId: req.headers['x-request-id'] || 'unknown'
      });
    } catch (err) {
      next(err);
    }
  }
}
