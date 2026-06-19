import {
  RegisterDocumentResponse,
  DocumentStatusResponse,
  VerifyFileResponse,
  RecordSignatureResponse,
  DocumentCustodyResponse,
  FraudScoreResponse,
  NotaryOnboardResponse,
  DocumentSearchResponse,
  Document
} from '../types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/v1';

export class ApiService {
  public static apiBaseUrl = API_URL;

  // Retrieve auth token from localStorage (sandbox environment convenience)
  private static getHeaders(isMultipart = false): HeadersInit {
    const headers: Record<string, string> = {};
    if (!isMultipart) {
      headers['Content-Type'] = 'application/json';
    }
    const token = typeof window !== 'undefined' ? localStorage.getItem('ltn_token') : null;
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  private static async handleResponse<T>(response: Response): Promise<T> {
    const text = await response.text();
    let json: any;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error(`Server returned non-JSON response: ${response.status}`);
    }

    if (!response.ok) {
      const errMsg = json?.error?.message || `API request failed with status ${response.status}`;
      throw new Error(errMsg);
    }

    return json.data as T;
  }

  /**
   * Registers a new document (with file upload).
   */
  public static async registerDocument(
    title: string,
    type: string,
    notaryId: string,
    file: File
  ): Promise<RegisterDocumentResponse> {
    const formData = new FormData();
    formData.append('title', title);
    formData.append('type', type);
    formData.append('notaryId', notaryId);
    formData.append('clientHash', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'); // default dummy hash placeholder
    formData.append('file', file);

    const response = await fetch(`${API_URL}/documents`, {
      method: 'POST',
      headers: this.getHeaders(true),
      body: formData
    });

    return this.handleResponse<RegisterDocumentResponse>(response);
  }

  /**
   * Fetches the current document status metadata.
   */
  public static async getDocumentStatus(documentId: string): Promise<DocumentStatusResponse> {
    const response = await fetch(`${API_URL}/documents/${documentId}/status`, {
      method: 'GET',
      headers: this.getHeaders()
    });
    return this.handleResponse<DocumentStatusResponse>(response);
  }

  /**
   * Verifies a scan copy against on-chain metadata.
   */
  public static async verifyScan(documentId: string, file: File): Promise<VerifyFileResponse> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_URL}/documents/${documentId}/verify`, {
      method: 'POST',
      headers: this.getHeaders(true),
      body: formData
    });

    return this.handleResponse<VerifyFileResponse>(response);
  }

  /**
   * Submits a signature to a document.
   */
  public static async recordSignature(
    documentId: string,
    signerRole: string,
    signatureBytes: string,
    certSerial: string
  ): Promise<RecordSignatureResponse> {
    const response = await fetch(`${API_URL}/documents/${documentId}/signatures`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ signerRole, signatureBytes, certSerial })
    });
    return this.handleResponse<RecordSignatureResponse>(response);
  }

  /**
   * Retrieves full custody timeline.
   */
  public static async getCustodyTrail(documentId: string): Promise<DocumentCustodyResponse> {
    const response = await fetch(`${API_URL}/documents/${documentId}/custody`, {
      method: 'GET',
      headers: this.getHeaders()
    });
    return this.handleResponse<DocumentCustodyResponse>(response);
  }

  /**
   * Searches documents.
   */
  public static async searchDocuments(query: { status?: string; notaryId?: string }): Promise<Document[]> {
    let url = `${API_URL}/documents/search`;
    const params = new URLSearchParams();
    if (query.status) params.append('status', query.status);
    if (query.notaryId) params.append('notaryId', query.notaryId);
    if (params.toString()) {
      url += `?${params.toString()}`;
    }

    const response = await fetch(url, {
      method: 'GET',
      headers: this.getHeaders()
    });

    const searchRes = await this.handleResponse<{ items: Document[] }>(response);
    return searchRes.items;
  }

  /**
   * Retrieves fraud signals score.
   */
  public static async getFraudScore(documentId: string): Promise<FraudScoreResponse> {
    const response = await fetch(`${API_URL}/documents/${documentId}/fraud-score`, {
      method: 'GET',
      headers: this.getHeaders()
    });
    return this.handleResponse<FraudScoreResponse>(response);
  }

  /**
   * Onboards a notary.
   */
  public static async onboardNotary(
    name: string,
    dscCertificateSerial: string,
    publicKeyBase64: string
  ): Promise<NotaryOnboardResponse> {
    const response = await fetch(`${API_URL}/notaries/onboard`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ name, dscCertificateSerial, publicKeyBase64 })
    });
    return this.handleResponse<NotaryOnboardResponse>(response);
  }

  /**
   * Generates a signed verification QR code.
   */
  public static async getQrCode(documentId: string): Promise<{ qrCode: string }> {
    const response = await fetch(`${API_URL}/documents/${documentId}/qr`, {
      method: 'GET',
      headers: this.getHeaders()
    });
    return this.handleResponse<{ qrCode: string }>(response);
  }
}
