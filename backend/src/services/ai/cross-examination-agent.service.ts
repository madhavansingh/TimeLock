import { NemotronService } from './nemotron.service';

export interface CrossExaminationQuestion {
  question: string;
  category: 'OWNERSHIP' | 'IDENTITY' | 'SURVEY' | 'COMPLIANCE';
  requiredEvidence: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface CrossExaminationInput {
  documentId: string;
  title: string;
  type: string;
  metadata: {
    surveyNumber?: string | null;
    propertyId?: string | null;
    registrationNumber?: string | null;
    ownerName?: string | null;
  } | null;
  ownershipHistory: any[];
  findings: string[];
  blockers: string[];
}

export interface CrossExaminationResult {
  questions: CrossExaminationQuestion[];
  confidence: number;
}

export class CrossExaminationAgentService {
  private static SYSTEM_PROMPT = `You are the Legal TimeLock Network (LTN) AI Cross-Examination Agent.
Your job is to generate critical, analytical, and logical verification questions to assist notaries in investigating property deeds.
Formulate 5 to 15 questions that target gaps, registry overlaps, missing documents, or ownership anomalies.

You must respond ONLY with a raw JSON object matching the following TypeScript interface:
{
  questions: {
    question: string;
    category: 'OWNERSHIP' | 'IDENTITY' | 'SURVEY' | 'COMPLIANCE';
    requiredEvidence: string;
    priority: 'LOW' | 'MEDIUM' | 'HIGH';
  }[];
  confidence: number; // 0 to 100
}
Ensure no markdown formatting (like \`\`\`json) in your final response. Return ONLY valid parsed JSON.`;

  /**
   * Generates cross-examination questions using NVIDIA Nemotron.
   */
  public static async assess(input: CrossExaminationInput): Promise<CrossExaminationResult> {
    const userPrompt = `Generate compliance cross-examination questions for this deed:
Document ID: ${input.documentId}
Title: ${input.title}
Type: ${input.type}
Metadata:
  - Survey Number: ${input.metadata?.surveyNumber || 'None'}
  - Property ID: ${input.metadata?.propertyId || 'None'}
  - Registration Number: ${input.metadata?.registrationNumber || 'None'}
  - Owner Name: ${input.metadata?.ownerName || 'None'}
Ownership Transfers Logged: ${input.ownershipHistory.length}
Conflict Findings:
${input.findings.map(f => `  - ${f}`).join('\n') || '  - None'}
Evidence Blockers:
${input.blockers.map(b => `  - ${b}`).join('\n') || '  - None'}
`;

    const stateObj = {
      metadata: input.metadata,
      historyCount: input.ownershipHistory.length,
      findingsCount: input.findings.length,
      blockersCount: input.blockers.length
    };

    const cacheKey = NemotronService.generateCacheKey(input.documentId, { agent: 'cross-examination', ...stateObj });

    return await NemotronService.invoke({
      systemPrompt: this.SYSTEM_PROMPT,
      userPrompt,
      cacheKey,
      fallbackGenerator: () => this.generateDeterministicFallback(input)
    });
  }

  /**
   * Deterministic local fallback generator.
   */
  private static generateDeterministicFallback(input: CrossExaminationInput): CrossExaminationResult {
    const questions: CrossExaminationQuestion[] = [];

    // Question 1: Check metadata owner name vs registration executant name
    questions.push({
      question: `Does the registered executant name "${input.metadata?.ownerName || 'N/A'}" exactly match the primary identity details submitted?`,
      category: 'IDENTITY',
      requiredEvidence: 'Aadhaar / Government ID Card',
      priority: 'HIGH'
    });

    // Question 2: Survey Number conflict question
    const surveyConflicts = input.findings.filter(f => f.includes('surveyNumber') || f.includes('Survey Number'));
    if (surveyConflicts.length > 0) {
      questions.push({
        question: `Why is the Survey Number "${input.metadata?.surveyNumber || 'N/A'}" associated with other active land deeds?`,
        category: 'SURVEY',
        requiredEvidence: 'Authorized Survey Extract & Maps',
        priority: 'HIGH'
      });
    }

    // Question 3: Property ID conflict question
    const propConflicts = input.findings.filter(f => f.includes('propertyId') || f.includes('Property ID'));
    if (propConflicts.length > 0) {
      questions.push({
        question: `Provide clearance verification that Property ID "${input.metadata?.propertyId || 'N/A'}" does not overlap with any active registry partitions.`,
        category: 'SURVEY',
        requiredEvidence: 'Registry Khata Certificate & Partition Deed',
        priority: 'HIGH'
      });
    }

    // Question 4: Evidence blockers question
    if (input.blockers.length > 0 && !input.blockers.includes('None')) {
      for (const blocker of input.blockers) {
        questions.push({
          question: `Is the missing document "${blocker}" available for validation? What is the current justification for its omission?`,
          category: 'COMPLIANCE',
          requiredEvidence: blocker,
          priority: 'MEDIUM'
        });
      }
    }

    // Question 5: Ownership Chain consistency
    if (input.ownershipHistory.length === 0) {
      questions.push({
        question: 'What is the historical source of title for this property registration? Prior ownership chain records are empty.',
        category: 'OWNERSHIP',
        requiredEvidence: 'Mother Deed / Prior Sale Deed (30 years history)',
        priority: 'MEDIUM'
      });
    } else {
      questions.push({
        question: `Verify that all ownership transfers (${input.ownershipHistory.length} links) have corresponding stamps and registration taxes cleared.`,
        category: 'OWNERSHIP',
        requiredEvidence: 'Tax Clearance Certificate',
        priority: 'LOW'
      });
    }

    // Ensure we meet the 5 questions minimum requirement
    while (questions.length < 5) {
      const idx = questions.length + 1;
      questions.push({
        question: `Standard Compliance check #${idx}: Ensure all executant signatures are stamped and validated on the primary deed upload.`,
        category: 'COMPLIANCE',
        requiredEvidence: 'Deed Signature Block verification',
        priority: 'LOW'
      });
    }

    return {
      questions: questions.slice(0, 15), // limit to max 15
      confidence: 92
    };
  }
}
