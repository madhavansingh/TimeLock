import { prisma } from '../config/db';

export interface GeopoliticalResidency {
  country: string;
  state: string;
  district: string;
  region: string;
  availabilityZone: string;
  storageZone: string;
  backupRegion: string;
  disasterRecoveryRegion: string;
  regulatoryJurisdiction: string;
}

export class ResidencyService {
  /**
   * Resolves the complete multi-dimensional residency metadata envelope based on target location.
   */
  static resolveResidency(
    country: string,
    state: string,
    district: string
  ): GeopoliticalResidency {
    // Normalization of input boundaries
    const c = country.toUpperCase();
    const s = state.toUpperCase();
    const d = district.toUpperCase();

    // Map geopolitical administrative areas to localized storage zones and regulations
    let storageZone = 'zone-west-1';
    let backupRegion = 'zone-south-1';
    let disasterRecoveryRegion = 'zone-east-1';
    let region = 'ap-west-1';
    let availabilityZone = 'ap-west-1a';
    let regulatoryJurisdiction = `${c}-${s}-${d}`;

    if (c === 'IN') {
      if (s === 'MH') {
        // Maharashtra state routing
        region = 'in-west-1';
        availabilityZone = 'in-west-1a';
        storageZone = 'sovereign-mh-pune-s3';
        backupRegion = 'sovereign-mh-mumbai-s3';
        disasterRecoveryRegion = 'sovereign-in-bangalore-s3';
        regulatoryJurisdiction = 'IN-DPDP-MH';
      } else if (s === 'KA') {
        // Karnataka state routing
        region = 'in-south-1';
        availabilityZone = 'in-south-1a';
        storageZone = 'sovereign-ka-bangalore-s3';
        backupRegion = 'sovereign-ka-mysore-s3';
        disasterRecoveryRegion = 'sovereign-in-mumbai-s3';
        regulatoryJurisdiction = 'IN-DPDP-KA';
      }
    } else if (c === 'EU') {
      // European Union general routing under GDPR
      region = 'eu-central-1';
      availabilityZone = 'eu-central-1a';
      storageZone = 'sovereign-eu-frankfurt-s3';
      backupRegion = 'sovereign-eu-paris-s3';
      disasterRecoveryRegion = 'sovereign-eu-dublin-s3';
      regulatoryJurisdiction = 'EU-GDPR';
    }

    return {
      country: c,
      state: s,
      district: d,
      region,
      availabilityZone,
      storageZone,
      backupRegion,
      disasterRecoveryRegion,
      regulatoryJurisdiction
    };
  }

  /**
   * Validates if a document's residency metadata matches the tenant's sovereignty rules.
   * Prevents illegal cross-border storage and compliance violations.
   */
  static validateResidency(
    documentResidency: GeopoliticalResidency,
    tenantResidency: { country: string; state?: string; district?: string }
  ): { isValid: boolean; reason?: string } {
    // Rule 1: Country-level sovereignty constraint
    if (documentResidency.country !== tenantResidency.country) {
      return {
        isValid: false,
        reason: `Sovereignty violation. Document country (${documentResidency.country}) must match Tenant country (${tenantResidency.country}).`
      };
    }

    // Rule 2: State-level data localization constraint (if enforced by the tenant)
    if (tenantResidency.state && documentResidency.state !== tenantResidency.state) {
      return {
        isValid: false,
        reason: `State-level localization violation. Document state (${documentResidency.state}) must match Tenant state (${tenantResidency.state}).`
      };
    }

    // Rule 3: District-level residency constraint (if enforced by the tenant)
    if (tenantResidency.district && documentResidency.district !== tenantResidency.district) {
      return {
        isValid: false,
        reason: `District-level residency violation. Document district (${documentResidency.district}) must match Tenant district (${tenantResidency.district}).`
      };
    }

    return { isValid: true };
  }

  /**
   * Returns the physical, certified S3 or IPFS gateway endpoint for a storage zone.
   * Ensures data transit occurs exclusively through secure, sovereign channels.
   */
  static getStorageEndpoint(zone: string): string {
    const endpoints: Record<string, string> = {
      'sovereign-mh-pune-s3': 'https://s3.pune.gov.cloud.gov.in',
      'sovereign-mh-mumbai-s3': 'https://s3.mumbai.gov.cloud.gov.in',
      'sovereign-ka-bangalore-s3': 'https://s3.bangalore.gov.cloud.gov.in',
      'sovereign-ka-mysore-s3': 'https://s3.mysore.gov.cloud.gov.in',
      'sovereign-eu-frankfurt-s3': 'https://s3.frankfurt.sovereign.eu',
      'sovereign-eu-paris-s3': 'https://s3.paris.sovereign.eu',
      'sovereign-eu-dublin-s3': 'https://s3.dublin.sovereign.eu',
      'zone-west-1': 'https://s3.zone-west.local'
    };

    return endpoints[zone] || 'https://s3.sovereign-default.local';
  }
}
