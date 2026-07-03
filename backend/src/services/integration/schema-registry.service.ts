import { prisma } from '../../config/db';

export class SchemaRegistryService {
  private static schemaCache = new Map<string, any>();

  /**
   * Seeds the Schema Registry database with standard enterprise schemas.
   */
  public static async seedRegistry(): Promise<void> {
    const defaultSchemas = [
      {
        schemaName: 'GOVERNMENT_REGISTRY_VERIFYPROPERTY_REQ',
        version: 1,
        schemaDefinition: {
          type: 'object',
          properties: { propertyId: { type: 'string' } },
          required: ['propertyId']
        }
      },
      {
        schemaName: 'GOVERNMENT_REGISTRY_VERIFYPROPERTY_RES',
        version: 1,
        schemaDefinition: {
          type: 'object',
          properties: {
            isValid: { type: 'boolean' },
            ownerName: { type: 'string' },
            registryStatus: { type: 'string' }
          },
          required: ['isValid', 'ownerName']
        }
      },
      {
        schemaName: 'BANKING_PLATFORM_CLEARPAYMENT_REQ',
        version: 1,
        schemaDefinition: {
          type: 'object',
          properties: {
            paymentId: { type: 'string' },
            amount: { type: 'number' }
          },
          required: ['paymentId', 'amount']
        }
      },
      {
        schemaName: 'BANKING_PLATFORM_CLEARPAYMENT_RES',
        version: 1,
        schemaDefinition: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            reference: { type: 'string' }
          },
          required: ['success', 'reference']
        }
      },
      {
        schemaName: 'E_SIGN_PROVIDER_SIGNHASH_REQ',
        version: 1,
        schemaDefinition: {
          type: 'object',
          properties: {
            hash: { type: 'string' },
            signerId: { type: 'string' }
          },
          required: ['hash', 'signerId']
        }
      },
      {
        schemaName: 'E_SIGN_PROVIDER_SIGNHASH_RES',
        version: 1,
        schemaDefinition: {
          type: 'object',
          properties: {
            signature: { type: 'string' },
            signedAt: { type: 'string' }
          },
          required: ['signature', 'signedAt']
        }
      },
      {
        schemaName: 'DOCUMENT_REGISTERED_V1',
        version: 1,
        schemaDefinition: {
          type: 'object',
          properties: {
            documentId: { type: 'string' },
            title: { type: 'string' },
            ownerId: { type: 'string' },
            contentHash: { type: 'string' }
          },
          required: ['documentId', 'title', 'ownerId', 'contentHash']
        }
      },
      {
        schemaName: 'OWNERSHIP_TRANSFER_COMPLETED_V1',
        version: 1,
        schemaDefinition: {
          type: 'object',
          properties: {
            transferId: { type: 'string' },
            documentId: { type: 'string' },
            previousOwnerHash: { type: 'string' },
            newOwnerHash: { type: 'string' }
          },
          required: ['transferId', 'documentId', 'previousOwnerHash', 'newOwnerHash']
        }
      }
    ];

    try {
      for (const item of defaultSchemas) {
        await prisma.schemaRegistryEntry.upsert({
          where: {
            schemaName_version: {
              schemaName: item.schemaName,
              version: item.version
            }
          },
          update: {
            schemaDefinition: item.schemaDefinition as any,
            isActive: true
          },
          create: {
            schemaName: item.schemaName,
            version: item.version,
            schemaDefinition: item.schemaDefinition as any,
            isActive: true
          }
        });
        
        const cacheKey = `${item.schemaName}_v${item.version}`;
        this.schemaCache.set(cacheKey, item.schemaDefinition);
      }
      console.log(`[SchemaRegistry] Successfully seeded ${defaultSchemas.length} canonical schemas.`);
    } catch (err) {
      console.error('[SchemaRegistry] Failed to seed canonical schemas:', err);
    }
  }

  /**
   * Validates a payload against a registered versioned schema.
   */
  public static async validatePayload(
    schemaName: string,
    payload: any,
    version = 1
  ): Promise<{ isValid: boolean; reason?: string }> {
    if (!payload) {
      return { isValid: false, reason: 'Payload cannot be null or undefined' };
    }

    const cacheKey = `${schemaName}_v${version}`;
    let schema = this.schemaCache.get(cacheKey);

    if (!schema) {
      try {
        const entry = await prisma.schemaRegistryEntry.findUnique({
          where: {
            schemaName_version: { schemaName, version }
          }
        });

        if (!entry || !entry.isActive) {
          // If no schema is registered, we default to passing the validation to ensure backward compatibility
          return { isValid: true };
        }

        schema = entry.schemaDefinition;
        this.schemaCache.set(cacheKey, schema);
      } catch (err) {
        console.error(`[SchemaRegistry] Error loading schema ${schemaName}:`, err);
        return { isValid: true }; // soft failover
      }
    }

    // Defensive Canonical Schema check
    if (schema.type === 'object' && schema.properties) {
      // Validate required fields
      if (Array.isArray(schema.required)) {
        for (const req of schema.required) {
          if (payload[req] === undefined || payload[req] === null) {
            return { isValid: false, reason: `Missing required canonical field: "${req}"` };
          }
        }
      }

      // Validate types
      for (const [key, prop] of Object.entries(schema.properties)) {
        const typedProp = prop as any;
        const val = payload[key];
        if (val !== undefined && val !== null) {
          const actualType = typeof val;
          let expectedType = typedProp.type;
          
          if (expectedType === 'integer') expectedType = 'number';
          
          if (actualType !== expectedType) {
            return { 
              isValid: false, 
              reason: `Type mismatch on field "${key}". Expected: ${typedProp.type}, Got: ${actualType}` 
            };
          }
        }
      }
    }

    return { isValid: true };
  }
}
