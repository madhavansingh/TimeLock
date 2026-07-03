import crypto from 'crypto';
import { EnterpriseSecurityService } from './security.service';

export interface PlatformEvent {
  eventId: string;
  eventName: string;
  version: number;
  producer: string;
  consumer: string;
  schemaVersion: number;
  timestamp: Date;
  correlationId: string;
  traceId: string;
  payloadHash: string;
  replayId: string;
  retentionPolicyDays: number;
  payload: any;
}

export interface EventDescriptor {
  eventName: string;
  version: number;
  producer: string;
  consumer: string;
  schemaVersion: number;
  retentionPolicyDays: number;
}

export class EventCatalog {
  private static events = new Map<string, EventDescriptor>();

  static {
    // Register first-class platform events
    this.register({
      eventName: 'DOCUMENT_REGISTERED',
      version: 1,
      producer: 'REGISTRY_ENGINE',
      consumer: 'LAND_REGISTRY_MESH,BANKING_FABRIC',
      schemaVersion: 1,
      retentionPolicyDays: 365,
    });
    
    this.register({
      eventName: 'DOCUMENT_REJECTED',
      version: 1,
      producer: 'AVE_ENGINE',
      consumer: 'NOTARY_DESK,CITIZEN_PORTAL',
      schemaVersion: 1,
      retentionPolicyDays: 90,
    });

    this.register({
      eventName: 'EVIDENCE_UPLOADED',
      version: 1,
      producer: 'UPLOAD_PIPELINE',
      consumer: 'DIGITAL_TWIN_ENGINE',
      schemaVersion: 1,
      retentionPolicyDays: 180,
    });

    this.register({
      eventName: 'EVIDENCE_VERIFIED',
      version: 1,
      producer: 'NOTARY_DESK',
      consumer: 'AVE_ENGINE,DIGITAL_TWIN_ENGINE',
      schemaVersion: 1,
      retentionPolicyDays: 365,
    });

    this.register({
      eventName: 'DIGITAL_TWIN_UPDATED',
      version: 1,
      producer: 'DIGITAL_TWIN_ENGINE',
      consumer: 'OBSERVABILITY_POC,SOLANA_FABRIC',
      schemaVersion: 1,
      retentionPolicyDays: 730,
    });

    this.register({
      eventName: 'OWNERSHIP_TRANSFER_INITIATED',
      version: 1,
      producer: 'REGISTRY_PORTAL',
      consumer: 'WORKFLOW_ORCHESTRATOR,BANKING_FABRIC',
      schemaVersion: 1,
      retentionPolicyDays: 365,
    });

    this.register({
      eventName: 'OWNERSHIP_TRANSFER_COMPLETED',
      version: 1,
      producer: 'WORKFLOW_ORCHESTRATOR',
      consumer: 'GOV_LAND_REGISTRY,BANKING_FABRIC,DIGITAL_TWIN_ENGINE',
      schemaVersion: 1,
      retentionPolicyDays: 3650, // 10 years retention
    });

    this.register({
      eventName: 'BLOCKCHAIN_ANCHORED',
      version: 1,
      producer: 'SOLANA_FABRIC',
      consumer: 'REGISTRY_ENGINE,VERIFICATION_PROOF_LEDGER',
      schemaVersion: 1,
      retentionPolicyDays: 3650,
    });

    this.register({
      eventName: 'SECURITY_INCIDENT_CREATED',
      version: 1,
      producer: 'GATEWAY_SOC',
      consumer: 'ADMIN_CONSOLE,OBSERVABILITY_POC',
      schemaVersion: 1,
      retentionPolicyDays: 730,
    });
  }

  private static register(descriptor: EventDescriptor): void {
    this.events.set(descriptor.eventName, descriptor);
  }

  /**
   * Discovers event metadata from the catalog.
   */
  public static get(eventName: string): EventDescriptor | undefined {
    return this.events.get(eventName);
  }

  /**
   * Formulates a versioned, immutable, and cryptographically hashed PlatformEvent.
   */
  public static createEvent(
    eventName: string,
    payload: any,
    correlationId?: string,
    traceId?: string
  ): PlatformEvent {
    const descriptor = this.events.get(eventName);
    if (!descriptor) {
      throw new Error(`[EventCatalog] Event "${eventName}" is not defined in the catalog.`);
    }

    const eventId = crypto.randomUUID();
    const timestamp = new Date();
    const payloadHash = EnterpriseSecurityService.computeHash(payload);
    
    // Generate a unique replay ID based on event and hash to prevent duplicate replays
    const replayId = crypto
      .createHash('md5')
      .update(`${eventName}:${eventId}:${payloadHash}`)
      .digest('hex');

    return {
      eventId,
      eventName,
      version: descriptor.version,
      producer: descriptor.producer,
      consumer: descriptor.consumer,
      schemaVersion: descriptor.schemaVersion,
      timestamp,
      correlationId: correlationId || 'corr-' + crypto.randomUUID(),
      traceId: traceId || 'trace-' + crypto.randomUUID(),
      payloadHash,
      replayId,
      retentionPolicyDays: descriptor.retentionPolicyDays,
      payload,
    };
  }
}
