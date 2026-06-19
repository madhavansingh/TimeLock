export interface FraudSignals {
  hashMismatch: boolean;
  missingBlockchainTx: boolean;
  missingNotarySignature: boolean;
  expiredVerification: boolean;
}

export class FraudService {
  /**
   * Evaluates rule-based signals and returns a fraud risk score (0-100).
   * 
   * Rules:
   * - Hash mismatch: 100 risk score (Critical tampering)
   * - Missing blockchain tx: 90 risk score (Unanchored document)
   * - Missing notary signature: 80 risk score (Unnotarized contract)
   * - Expired verification: 50 risk score (Verification age limit reached)
   */
  public static calculateRiskScore(signals: FraudSignals): {
    score: number;
    signals: FraudSignals;
  } {
    let score = 0;

    if (signals.hashMismatch) {
      score = 100;
    } else if (signals.missingBlockchainTx) {
      score = 90;
    } else if (signals.missingNotarySignature) {
      score = 80;
    } else if (signals.expiredVerification) {
      score = 50;
    }

    return {
      score,
      signals
    };
  }
}
