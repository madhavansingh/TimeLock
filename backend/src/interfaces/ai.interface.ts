/**
 * ai.interface.ts — AI Services Contract
 *
 * Placeholder contract for future AI/ML integrations.
 * These services are OUT OF SCOPE for the hackathon MVP but the interface
 * is defined here so the team knows exactly what the contract looks like
 * when they are implemented in Phase 1 (Closed Pilot).
 *
 * Planned services:
 *   - Document classification (auto-detect "Sale Deed", "Will", "Agreement")
 *   - Anomaly detection (flag unusual metadata patterns)
 *   - OCR-based content extraction (for court officer dashboard search)
 *
 * DO NOT implement business logic here. This is a pure contract definition.
 * DO NOT import or call this interface from any existing service.
 */

// ---------------------------------------------------------------------------
// Value types
// ---------------------------------------------------------------------------

/** Document type classification result */
export interface DocumentClassificationResult {
  /** Predicted document type (e.g. "Sale Deed", "Power of Attorney") */
  predictedType: string;
  /** Confidence score 0.0–1.0 */
  confidence: number;
  /** Alternative classifications if confidence is below threshold */
  alternatives: Array<{ type: string; confidence: number }>;
}

/** Anomaly detection result for fraud heuristics */
export interface AnomalyDetectionResult {
  /** Whether the document metadata exhibits known anomalous patterns */
  isAnomaly: boolean;
  /** Anomaly score 0.0–1.0 */
  score: number;
  /** Human-readable explanation of detected signals */
  signals: string[];
}

/** OCR extraction result */
export interface OcrExtractionResult {
  /** Full extracted text content */
  text: string;
  /** Structured key-value pairs extracted from common legal templates */
  structuredFields: Record<string, string>;
  /** Confidence score for the extraction 0.0–1.0 */
  confidence: number;
}

// ---------------------------------------------------------------------------
// The contract (NOT YET IMPLEMENTED — Phase 1 target)
// ---------------------------------------------------------------------------
export interface IAiService {
  /**
   * Classifies a document into a known legal type.
   * Phase 1 target: helps auto-fill the "type" field on registration.
   *
   * @param fileBuffer - Raw binary content of the file
   * @param filename   - Original filename (hints for MIME detection)
   */
  classifyDocument(fileBuffer: Buffer, filename: string): Promise<DocumentClassificationResult>;

  /**
   * Runs anomaly detection on document metadata to supplement rule-based fraud scoring.
   * Phase 1 target: augments FraudService with ML signals.
   *
   * @param documentId - UUID of the registered document
   */
  detectAnomalies(documentId: string): Promise<AnomalyDetectionResult>;

  /**
   * Extracts text and structured fields from a document using OCR.
   * Phase 1 target: powers court officer keyword search dashboard.
   *
   * @param fileBuffer - Raw binary content of the file
   */
  extractText(fileBuffer: Buffer): Promise<OcrExtractionResult>;
}
