import { BaseConnector } from './base.connector';

// -----------------------------------------------------------------------------
// 1. Government Registry Connector
// -----------------------------------------------------------------------------
export class GovernmentRegistryConnector extends BaseConnector {
  constructor(id = 'conn-gov-registry') {
    super(
      id,
      'GOVERNMENT_REGISTRY',
      'REGISTRY',
      '2.0.0',
      {
        operations: ['verifyProperty', 'updatePropertyOwner', 'getDeedDetails'],
        events: ['propertyUpdated', 'ownerChanged'],
        resources: ['properties', 'deeds'],
        authType: 'HMAC',
        retryPolicy: { attempts: 3, backoffMs: 200 },
        timeoutMs: 10000,
      }
    );
  }
}

// -----------------------------------------------------------------------------
// 2. Identity Federation Connector
// -----------------------------------------------------------------------------
export class IdentityFederationConnector extends BaseConnector {
  constructor(id = 'conn-identity-federation') {
    super(
      id,
      'IDENTITY_FEDERATION',
      'IDENTITY',
      '2.0.0',
      {
        operations: ['verifyIdentity', 'getFederatedProfile', 'authenticateUser'],
        events: ['identityLinked', 'identityUnlinked'],
        resources: ['identities', 'profiles'],
        authType: 'HMAC',
        retryPolicy: { attempts: 3, backoffMs: 200 },
        timeoutMs: 5000,
      }
    );
  }
}

// -----------------------------------------------------------------------------
// 3. Digital Locker Connector
// -----------------------------------------------------------------------------
export class DigitalLockerConnector extends BaseConnector {
  constructor(id = 'conn-digital-locker') {
    super(
      id,
      'DIGITAL_LOCKER',
      'STORAGE',
      '2.0.0',
      {
        operations: ['fetchDocument', 'storeDocumentReceipt', 'shareDocumentAccess'],
        events: ['documentPulled', 'documentPushed'],
        resources: ['lockers', 'files'],
        authType: 'HMAC',
        retryPolicy: { attempts: 3, backoffMs: 500 },
        timeoutMs: 15000,
      }
    );
  }
}

// -----------------------------------------------------------------------------
// 4. Electronic Signature Provider (eSign) Connector
// -----------------------------------------------------------------------------
export class ESignConnector extends BaseConnector {
  constructor(id = 'conn-esign-provider') {
    super(
      id,
      'E_SIGN_PROVIDER',
      'IDENTITY',
      '2.0.0',
      {
        operations: ['requestSignature', 'verifyDigitalCertificate', 'signDeedHash'],
        events: ['signatureCompleted', 'signatureDeclined'],
        resources: ['signatures', 'certs'],
        authType: 'HMAC',
        retryPolicy: { attempts: 3, backoffMs: 300 },
        timeoutMs: 12000,
      }
    );
  }
}

// -----------------------------------------------------------------------------
// 5. Court Management System Connector
// -----------------------------------------------------------------------------
export class CourtManagementConnector extends BaseConnector {
  constructor(id = 'conn-court-system') {
    super(
      id,
      'COURT_SYSTEM',
      'COURT',
      '2.0.0',
      {
        operations: ['queryDisputes', 'registerCaseDeed', 'verifyJudgeOrders'],
        events: ['disputeRegistered', 'judgmentSubmitted'],
        resources: ['cases', 'orders'],
        authType: 'HMAC',
        retryPolicy: { attempts: 3, backoffMs: 300 },
        timeoutMs: 8000,
      }
    );
  }
}

// -----------------------------------------------------------------------------
// 6. Banking Platform Connector
// -----------------------------------------------------------------------------
export class BankingPlatformConnector extends BaseConnector {
  constructor(id = 'conn-banking-platform') {
    super(
      id,
      'BANKING_PLATFORM',
      'BANK',
      '2.0.0',
      {
        operations: ['escrowVerify', 'initiateEscrowRefund', 'clearPayment'],
        events: ['escrowCleared', 'escrowRefunded'],
        resources: ['accounts', 'escrows'],
        authType: 'HMAC',
        retryPolicy: { attempts: 3, backoffMs: 500 },
        timeoutMs: 15000,
      }
    );
  }
}

// -----------------------------------------------------------------------------
// 7. Insurance Provider Connector
// -----------------------------------------------------------------------------
export class InsuranceProviderConnector extends BaseConnector {
  constructor(id = 'conn-insurance-provider') {
    super(
      id,
      'INSURANCE_PROVIDER',
      'INSURANCE',
      '2.0.0',
      {
        operations: ['verifyInsurancePolicy', 'linkDeedToPolicy', 'assessPropertyDamage'],
        events: ['policyLinked', 'policyTerminated'],
        resources: ['policies', 'claims'],
        authType: 'HMAC',
        retryPolicy: { attempts: 3, backoffMs: 400 },
        timeoutMs: 10000,
      }
    );
  }
}

// -----------------------------------------------------------------------------
// 8. Notification Provider Connector
// -----------------------------------------------------------------------------
export class NotificationConnector extends BaseConnector {
  constructor(id = 'conn-notification-provider') {
    super(
      id,
      'NOTIFICATION_PROVIDER',
      'NOTIFICATION',
      '2.0.0',
      {
        operations: ['sendSms', 'sendEmail', 'sendPush', 'triggerWebhook'],
        events: ['notificationDelivered', 'notificationFailed'],
        resources: ['messages', 'subscriptions'],
        authType: 'HMAC',
        retryPolicy: { attempts: 3, backoffMs: 100 },
        timeoutMs: 4000,
      }
    );
  }
}

// -----------------------------------------------------------------------------
// 9. Cloud Storage Connector
// -----------------------------------------------------------------------------
export class CloudStorageConnector extends BaseConnector {
  constructor(id = 'conn-cloud-storage') {
    super(
      id,
      'CLOUD_STORAGE',
      'STORAGE',
      '2.0.0',
      {
        operations: ['uploadBlob', 'downloadBlob', 'deleteBlob'],
        events: ['blobUploaded', 'blobDeleted'],
        resources: ['buckets', 'blobs'],
        authType: 'HMAC',
        retryPolicy: { attempts: 3, backoffMs: 300 },
        timeoutMs: 20000,
      }
    );
  }
}

// -----------------------------------------------------------------------------
// 10. Payment Gateway Connector
// -----------------------------------------------------------------------------
export class PaymentGatewayConnector extends BaseConnector {
  constructor(id = 'conn-payment-gateway') {
    super(
      id,
      'PAYMENT_GATEWAY',
      'PAYMENT',
      '2.0.0',
      {
        operations: ['createOrder', 'verifyPaymentSignature', 'refundPayment'],
        events: ['paymentCompleted', 'paymentRefunded'],
        resources: ['orders', 'payments'],
        authType: 'HMAC',
        retryPolicy: { attempts: 3, backoffMs: 200 },
        timeoutMs: 8000,
      }
    );
  }
}
