import { Request, Response, NextFunction } from 'express';
import { SchemaRegistryService } from '../services/integration/schema-registry.service';
import { EnterpriseSecurityService } from '../services/integration/security.service';
import { prisma } from '../config/db';
import { logger } from '../config/logger';

export class EnterpriseApiGateway {
  private static processedIdempotencyKeys = new Map<string, { status: 'PENDING' | 'SUCCESS'; response?: any; timestamp: number }>();
  private static rateLimits = new Map<string, { count: number; windowStart: number }>();
  private static maxRequestsPerMin = 100;

  /**
   * Main API Gateway interceptor middleware.
   */
  public static async intercept(req: Request, res: Response, next: NextFunction): Promise<void> {
    const method = req.method;
    const path = req.path;
    const headers = req.headers;
    const reqId = (headers['x-request-id'] as string) || crypto.randomUUID();
    const correlationId = (headers['x-correlation-id'] as string) || reqId;

    // 1. Rate Limiting Check
    const clientIp = req.ip || 'unknown-ip';
    const rateLimit = EnterpriseApiGateway.checkRateLimit(clientIp);
    if (!rateLimit.allowed) {
      res.status(429).json({
        error: 'API Gateway: Rate Limit Exceeded',
        message: 'Too many requests. Please try again later.',
        correlationId
      });
      return;
    }

    // 2. API Version & Deprecation Headers
    const versionHeader = headers['x-api-version'] || '1';
    if (versionHeader === '1' || versionHeader === '1.0') {
      // Version 1 is marked as deprecated under our enterprise governance policies
      res.setHeader('Deprecation', 'true');
      res.setHeader('Sunset', new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toUTCString()); // Deprecated in 30 days
      res.setHeader('Link', '<http://localhost:3000/docs/v2>; rel="successor-version"');
    }

    // 3. Schema Validation check for POST/PUT requests
    if (method === 'POST' || method === 'PUT') {
      const endpointName = path.split('/').pop()?.toUpperCase() || '';
      const schemaName = `GATEWAY_INCOMING_${endpointName}`;
      
      const schemaCheck = await SchemaRegistryService.validatePayload(schemaName, req.body);
      if (!schemaCheck.isValid) {
        res.status(400).json({
          error: 'API Gateway: Payload Schema Validation Mismatch',
          reason: schemaCheck.reason,
          correlationId
        });
        return;
      }

      // 4. Idempotency Key Duplicate Detection
      const idempotencyKey = headers['x-idempotency-key'] as string;
      if (idempotencyKey) {
        const cached = EnterpriseApiGateway.processedIdempotencyKeys.get(idempotencyKey);
        
        if (cached) {
          if (cached.status === 'PENDING') {
            res.status(409).json({
              error: 'API Gateway: Conflict',
              message: 'A duplicate request with this idempotency key is currently being processed.',
              correlationId
            });
            return;
          } else {
            // Return cached response for idempotent consumers
            logger.info(`[ApiGateway] Idempotent request resolved from cache: "${idempotencyKey}"`, { correlationId });
            res.setHeader('X-Cache-Lookup', 'HIT');
            res.status(200).json(cached.response);
            return;
          }
        }

        // Lock the key as pending
        EnterpriseApiGateway.processedIdempotencyKeys.set(idempotencyKey, {
          status: 'PENDING',
          timestamp: Date.now()
        });

        // Intercept response to cache it on completion
        const originalJson = res.json;
        res.json = function(body: any) {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            EnterpriseApiGateway.processedIdempotencyKeys.set(idempotencyKey, {
              status: 'SUCCESS',
              response: body,
              timestamp: Date.now()
            });
          } else {
            EnterpriseApiGateway.processedIdempotencyKeys.delete(idempotencyKey);
          }
          return originalJson.call(this, body);
        };
      }

      // 5. Mutual Request Signature Verification (Zero Trust)
      const signature = headers['x-signature'] as string;
      const timestamp = Number(headers['x-timestamp']);
      const nonce = headers['x-nonce'] as string;

      if (signature && timestamp && nonce) {
        const verify = EnterpriseSecurityService.verifyPayload(
          method,
          path,
          timestamp,
          nonce,
          signature,
          req.body,
          headers['x-operator-id'] as string
        );

        if (!verify.isValid) {
          if (idempotencyKey) EnterpriseApiGateway.processedIdempotencyKeys.delete(idempotencyKey);
          res.status(401).json({
            error: 'API Gateway: Cryptographic Verification Failed',
            reason: verify.reason,
            correlationId
          });
          return;
        }
      }
    }

    next();
  }

  /**
   * Checks client IP rate-limits.
   */
  private static checkRateLimit(ip: string): { allowed: boolean } {
    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minute window
    
    let limit = this.rateLimits.get(ip);
    if (!limit || (now - limit.windowStart) > windowMs) {
      limit = { count: 0, windowStart: now };
    }

    limit.count++;
    this.rateLimits.set(ip, limit);

    return { allowed: limit.count <= this.maxRequestsPerMin };
  }

  /**
   * Periodic garbage collection of expired idempotency keys to prevent memory growth.
   */
  static {
    setInterval(() => {
      const now = Date.now();
      const ttl = 24 * 60 * 60 * 1000; // 24 hours
      for (const [key, val] of this.processedIdempotencyKeys.entries()) {
        if ((now - val.timestamp) > ttl) {
          this.processedIdempotencyKeys.delete(key);
        }
      }
    }, 60 * 60 * 1000);
  }
}
