import { NemotronService } from './nemotron.service';
import { HashService } from '../hash.service';
import { logger } from '../../config/logger';

export interface LegalityResult {
  isLegalDocument: boolean;
  classifiedType: string;
  confidence: number;
  reasoning: string;
}

export class DocumentLegalityAgentService {
  private static SYSTEM_PROMPT = `You are the Legal TimeLock Network (LTN) Document Legality Agent.
Your job is to inspect an uploaded file's metadata and extracted text to determine if it is a valid land-related legal document or government-issued identity proof.

Valid legal land records and documents include:
- Sale Deed
- Gift Deed
- Lease Agreement
- Mortgage Deed
- Affidavit
- Court Order
- Encumbrance Certificate
- Mutation Record
- Power of Attorney
- Tax Receipt
- Government Registry Document
- Identity Proof (Aadhaar, Passport, PAN Card, etc.)

Invalid documents include:
- Resume / CV
- Commercial Invoice / Purchase Order
- Movie / Video / Audio file markers
- Screenshot of code or UI
- College Assignment / Essay
- Random Image / Wallpaper
- Certificates unrelated to land registration (e.g., degree certificates, workshop certificates, sports certificates)

You must respond ONLY with a raw JSON object matching the following TypeScript interface:
{
  isLegalDocument: boolean;
  classifiedType: string; // The type of document identified (or "UNKNOWN")
  confidence: number; // 0 to 100
  reasoning: string; // Detailed explainable reasoning of why the document is accepted or rejected. Be specific and reference the document details or text.
}
Ensure no markdown formatting (like \`\`\`json) in your final response. Return ONLY valid parsed JSON.`;

  /**
   * Evaluates if a file is a legal land document or identity proof using NVIDIA Nemotron.
   */
  public static async evaluate(
    title: string,
    declaredType: string,
    filename: string,
    fileBuffer: Buffer
  ): Promise<LegalityResult> {
    logger.info(`[DocumentLegalityAgent] Inspecting file: ${filename} (Declared: ${declaredType})`);

    const extractedText = this.extractReadableText(fileBuffer);
    const serverHash = HashService.generateSHA256(fileBuffer);

    const userPrompt = `Evaluate the following uploaded document metadata and text content:
File Name: ${filename}
User-Declared Title: ${title}
User-Declared Type: ${declaredType}
File Size: ${fileBuffer.length} bytes

Extracted Text Snippet (first 3000 characters):
----------------------------------------
${extractedText || 'No readable text extracted.'}
----------------------------------------`;

    const cacheKey = NemotronService.generateCacheKey(serverHash, { agent: 'legality', title, declaredType, filename });

    return await NemotronService.invoke({
      systemPrompt: this.SYSTEM_PROMPT,
      userPrompt,
      cacheKey,
      fallbackGenerator: () => this.generateMockFallback(title, declaredType, filename, extractedText)
    });
  }

  /**
   * Deterministic local fallback generator based on metadata and text heuristics.
   */
  private static generateMockFallback(
    title: string,
    declaredType: string,
    filename: string,
    text: string
  ): LegalityResult {
    const textLower = text.toLowerCase();
    const nameLower = filename.toLowerCase();
    const titleLower = title.toLowerCase();

    // Rejection flags
    const isResume = nameLower.includes('resume') || nameLower.includes('cv') || textLower.includes('work experience') || textLower.includes('education') || textLower.includes('curriculum vitae');
    const isInvoice = nameLower.includes('invoice') || nameLower.includes('bill') || textLower.includes('invoice number') || textLower.includes('purchase order') || textLower.includes('po num');
    const isMovie = nameLower.endsWith('.mp4') || nameLower.endsWith('.mkv') || nameLower.endsWith('.avi') || nameLower.endsWith('.mov');
    const isScreenshot = nameLower.includes('screenshot') || nameLower.includes('screen shot') || textLower.includes('png') || textLower.includes('jpeg');
    const isAssignment = nameLower.includes('assignment') || nameLower.includes('homework') || titleLower.includes('assignment') || textLower.includes('coursework');

    if (isResume) {
      return {
        isLegalDocument: false,
        classifiedType: 'RESUME_CV',
        confidence: 95,
        reasoning: 'The document contains curriculum vitae or resume structural patterns (work experience, education details, skills profile) and is not related to property deed registration.'
      };
    }

    if (isInvoice) {
      return {
        isLegalDocument: false,
        classifiedType: 'COMMERCIAL_INVOICE',
        confidence: 90,
        reasoning: 'The document is identified as a commercial invoice or purchase receipt, which lacks the legal status and registry credentials of a property title deed or municipal land record.'
      };
    }

    if (isMovie) {
      return {
        isLegalDocument: false,
        classifiedType: 'MEDIA_FILE',
        confidence: 99,
        reasoning: 'The uploaded file extension indicates a media recording (video/audio) rather than a legal document representation.'
      };
    }

    if (isScreenshot) {
      return {
        isLegalDocument: false,
        classifiedType: 'IMAGE_SCREENSHOT',
        confidence: 85,
        reasoning: 'The file name or structure suggests a standard system screenshot rather than a scanned land registry certificate or signed covenant.'
      };
    }

    if (isAssignment) {
      return {
        isLegalDocument: false,
        classifiedType: 'ACADEMIC_ASSIGNMENT',
        confidence: 90,
        reasoning: 'The title or text matches academic coursework or student assignments, which do not hold legal weight in land registries.'
      };
    }

    // Accept patterns matching legal registry terms
    const hasLegalLandTerms = 
      textLower.includes('deed') || 
      textLower.includes('agreement') || 
      textLower.includes('lease') || 
      textLower.includes('mortgage') || 
      textLower.includes('affidavit') || 
      textLower.includes('court') || 
      textLower.includes('encumbrance') || 
      textLower.includes('mutation') || 
      textLower.includes('power of attorney') || 
      textLower.includes('khata') || 
      textLower.includes('survey') || 
      textLower.includes('owner') ||
      textLower.includes('aadhaar') ||
      textLower.includes('passport');

    if (hasLegalLandTerms || declaredType !== 'UNKNOWN') {
      return {
        isLegalDocument: true,
        classifiedType: declaredType !== 'UNKNOWN' ? declaredType : 'LEGAL_DEED',
        confidence: 85,
        reasoning: 'The document contains legal/governmental terminology, structural clauses, or identifiers related to title ownership, covenants, or identity validation.'
      };
    }

    // Default to unknown but let it pass if no negative indicators,
    // or reject if completely empty/junk
    if (text.trim().length < 20 && filename.endsWith('.txt')) {
      return {
        isLegalDocument: false,
        classifiedType: 'JUNK_FILE',
        confidence: 95,
        reasoning: 'The file contains insufficient or blank text content to be verified as a valid legal deed or municipal record.'
      };
    }

    return {
      isLegalDocument: true,
      classifiedType: 'LEGAL_DEED',
      confidence: 70,
      reasoning: 'The file structure matches a general document format. No explicit disqualifying patterns (resume, invoice, media, screenshot) were identified.'
    };
  }

  /**
   * Helper to extract readable ASCII/printable text streams from raw file buffers.
   * Enables structural content matching in PDFs and plain text files.
   */
  public static extractReadableText(buffer: Buffer): string {
    // Read the buffer as binary string to find text streams
    const rawContent = buffer.toString('binary');
    // Regex for matching sequences of readable characters (space to tilde) of length 4 to 100
    const regex = /[\x20-\x7E\s]{4,100}/g;
    const matches = rawContent.match(regex);
    if (!matches || matches.length === 0) {
      // Fallback: try standard UTF-8 string conversion
      const utf8 = buffer.toString('utf-8');
      if (utf8 && utf8.trim().length > 0) {
        return utf8.replace(/\s+/g, ' ').slice(0, 3000);
      }
      return '';
    }

    // Filter out typical PDF keywords and format tokens to keep actual document content
    const cleanText = matches
      .map(str => str.trim())
      .filter(str => {
        const lowered = str.toLowerCase();
        return !lowered.includes('/type') &&
               !lowered.includes('/page') &&
               !lowered.includes('/font') &&
               !lowered.includes('/length') &&
               !lowered.includes('/filter') &&
               !lowered.includes('stream') &&
               !lowered.includes('endstream') &&
               !lowered.includes('obj') &&
               !lowered.includes('endobj');
      })
      .join(' ')
      .replace(/\s+/g, ' ');

    return cleanText.slice(0, 3000);
  }
}
