# API Lock - Legal TimeLock Network (LTN)

This document freezes all REST API endpoints for the Legal TimeLock Network (LTN) hackathon MVP. Frontend and Backend developers must adhere strictly to these schemas.

---

## 1. Authentication Endpoints

### POST `/v1/auth/otp/request`
Requests a mock OTP verification code.

* **Headers**: `Content-Type: application/json`
* **Request**:
```json
{
  "identifier": "priya.executant@example.com"
}
```
* **Response (200 OK)**:
```json
{
  "data": {
    "message": "Verification OTP sent successfully."
  },
  "error": null,
  "requestId": "req_889f"
}
```
* **Error Response (400 Bad Request)**:
```json
{
  "data": null,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Identifier must be a valid email or phone number."
  },
  "requestId": "req_889f"
}
```

---

### POST `/v1/auth/otp/verify`
Validates the OTP code and issues a JWT token.

* **Headers**: `Content-Type: application/json`
* **Request**:
```json
{
  "identifier": "priya.executant@example.com",
  "code": "123456"
}
```
* **Response (200 OK)**:
```json
{
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsIn...",
    "user": {
      "userId": "c7b6f790-281b-4cf7-9fa4-1065e12f689e",
      "role": "CITIZEN"
    }
  },
  "error": null,
  "requestId": "req_2a18"
}
```
* **Error Response (401 Unauthorized)**:
```json
{
  "data": null,
  "error": {
    "code": "INVALID_OTP",
    "message": "The code provided is incorrect or has expired."
  },
  "requestId": "req_2a18"
}
```

---

## 2. Document Endpoints

### POST `/v1/documents`
Registers a document scan, hashes it, simulates IPFS upload, and anchors it on Solana.

* **Headers**: 
  * `Authorization: Bearer <JWT_TOKEN>`
  * `Content-Type: multipart/form-data`
* **Request (Multipart Form Data)**:
  * `file`: (Binary file attachment)
  * `title`: "Property Sale Deed - Plot 42"
  * `type`: "Sale Deed"
  * `notaryId`: "7df83c92-d3a9-4672-9b2f-2d93e110b9ad"
  * `requiredSigners`: 2
* **Response (201 Created)**:
```json
{
  "data": {
    "documentId": "a98dfb02-5c91-4cf1-8bc9-93e1189ac3f2",
    "hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "cid": "QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco",
    "status": "ONCHAIN_CONFIRMED",
    "onchainTxSignature": "2G4c9s1vF3y..."
  },
  "error": null,
  "requestId": "req_9981"
}
```

---

### GET `/v1/documents/:id/status`
Retrieves status, hash, and signature details of a document.

* **Headers**: None (Public)
* **Response (200 OK)**:
```json
{
  "data": {
    "documentId": "a98dfb02-5c91-4cf1-8bc9-93e1189ac3f2",
    "status": "ONCHAIN_CONFIRMED",
    "contentHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "onchainTxSignature": "2G4c9s1vF3y...",
    "timestamp": "2026-06-19T05:30:00Z",
    "notarySummary": null,
    "signers": {
      "required": 2,
      "completed": 0
    }
  },
  "error": null,
  "requestId": "req_45a1"
}
```

---

### POST `/v1/documents/:id/verify`
Compares an uploaded file copy against the registered Solana record.

* **Headers**: `Content-Type: multipart/form-data`
* **Request (Multipart Form Data)**:
  * `file`: (Binary file attachment)
* **Response (200 OK - Authentic)**:
```json
{
  "data": {
    "documentId": "a98dfb02-5c91-4cf1-8bc9-93e1189ac3f2",
    "result": "authentic",
    "expectedHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "submittedHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "detectedAt": "2026-06-19T05:35:12Z",
    "riskScore": 0
  },
  "error": null,
  "requestId": "req_512f"
}
```
* **Response (200 OK - Tampered)**:
```json
{
  "data": {
    "documentId": "a98dfb02-5c91-4cf1-8bc9-93e1189ac3f2",
    "result": "modified",
    "expectedHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "submittedHash": "f8a183d2cdfae12019aa91bcdfe9a1288cfa990098ba427189ccfae112dabc09",
    "detectedAt": "2026-06-19T05:35:12Z",
    "riskScore": 100
  },
  "error": null,
  "requestId": "req_512f"
}
```

---

### POST `/v1/documents/:id/signatures`
Attaches notary sign-off credentials.

* **Headers**: `Authorization: Bearer <JWT_TOKEN>`
* **Request**:
```json
{
  "signerRole": "NOTARY",
  "signatureBytes": "MEYCIQCN7df83c92d3...",
  "certSerial": "CA-3-889a2bc1"
}
```
* **Response (200 OK)**:
```json
{
  "data": {
    "signatureId": "8b9e1102-18bc-4cf2-9fa4-77a83d1cde03",
    "status": "NOTARY_SIGNED"
  },
  "error": null,
  "requestId": "req_77cf"
}
```

---

### GET `/v1/documents/:id/custody`
Retrieves timeline events.

* **Headers**: `Authorization: Bearer <JWT_TOKEN>`
* **Response (200 OK)**:
```json
{
  "data": {
    "documentId": "a98dfb02-5c91-4cf1-8bc9-93e1189ac3f2",
    "timeline": [
      {
        "eventId": "1b9c2d3e-4f5a-6b7c-8d9e-0f1a2b3c4d5e",
        "documentId": "a98dfb02-5c91-4cf1-8bc9-93e1189ac3f2",
        "eventType": "registration_confirmed",
        "actorLabel": "Citizen Executant",
        "occurredAt": "2026-06-19T05:30:00Z"
      }
    ]
  },
  "error": null,
  "requestId": "req_cdb9"
}
```

---

### GET `/v1/documents/:id/certificate`
Downloads a printable PDF verification certificate.

* **Headers**: None (Public)
* **Response (200 OK)**:
```json
{
  "data": {
    "documentId": "a98dfb02-5c91-4cf1-8bc9-93e1189ac3f2",
    "timestamp": "2026-06-19T05:30:00Z",
    "onchainTxSignature": "2G4c9s1vF3y...",
    "status": "NOTARY_SIGNED",
    "qrCodeUrl": "data:image/png;base64,iVBORw0KGgoAAAANS...",
    "pdfBase64": "JVBERi0xLjQKJ..."
  },
  "error": null,
  "requestId": "req_88bb"
}
```
