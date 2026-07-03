import { prisma } from '../../config/db';
import { logger } from '../../config/logger';

export class IdentityFederationService {
  /**
   * Links a pluggable federated identity (Aadhaar, BankID, Corporate SSO, Digital Certificate) to an LTN user.
   */
  public static async linkIdentity(
    userId: string,
    provider: string,
    externalId: string,
    metadata: any = {}
  ): Promise<any> {
    logger.info(`[IdentityFederation] Linking identity for user "${userId}" (Provider: ${provider}, External ID: ${externalId})`);

    try {
      // Create or update federated identity mapping
      const federated = await prisma.federatedIdentity.upsert({
        where: {
          provider_externalId: { provider, externalId }
        },
        update: {
          userId,
          metadata: metadata as any,
          verifiedAt: new Date(),
        },
        create: {
          userId,
          provider,
          externalId,
          metadata: metadata as any,
          verifiedAt: new Date(),
        }
      });

      return federated;
    } catch (err: any) {
      logger.error(`[IdentityFederation] Failed to link identity: ${err.message}`);
      throw err;
    }
  }

  /**
   * Verifies if a federated identity is active, linked, and verified.
   */
  public static async verifyFederatedIdentity(provider: string, externalId: string): Promise<{ isVerified: boolean; userId?: string }> {
    try {
      const federated = await prisma.federatedIdentity.findUnique({
        where: {
          provider_externalId: { provider, externalId }
        }
      });

      if (!federated || !federated.verifiedAt) {
        return { isVerified: false };
      }

      return { isVerified: true, userId: federated.userId };
    } catch (err: any) {
      logger.error(`[IdentityFederation] Error verifying identity: ${err.message}`);
      return { isVerified: false };
    }
  }

  /**
   * Retrieves all federated identities linked to a local LTN user.
   */
  public static async getFederatedIdentities(userId: string): Promise<any[]> {
    return prisma.federatedIdentity.findMany({
      where: { userId }
    });
  }
}
