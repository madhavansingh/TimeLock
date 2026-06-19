# API Endpoints Specification - Legal TimeLock Network (LTN)

This document is the single source of truth for the API contracts between the frontend application, the backend API gateway, and external clients.

---

## 1. Authentication Endpoints

### POST /v1/auth/otp/request
Requests a 6-digit verification code to be sent to a phone number or email address.

* **Authorization**: None (Public)
* **Request Body**:
```json
{
  "identifier": "priya.executant@example.com"
}
```
* **Response Body (200 OK)**:
```json
{
  "data": {
    "message": "Verification OTP sent successfully."
  },
  "error": null,
  "requestId": "req_889fa2bc"
}
```
* **Error Responses**:
  * `400 Bad Request` (Invalid email or phone format):
```json
{
  "data": null,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Identifier must be a valid email or E.164 phone number."
  },
  "requestId": "req_889fa2bc"
}
```

---

### POST /v1/auth/otp/verify
Verifies the 6-digit OTP code and issues a JSON Web Token (JWT).

* **Authorization**: None (Public)
* **Request Body**:
```json
{
  "identifier": "priya.executant@example.com",
  "code": "123456"
}
```
* **Response Body (200 OK)**:
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
  "requestId": "req_2a18fd90"
}
```
* **Error Responses**:
  * `401 Unauthorized` (Invalid or expired OTP):
```json
{
  "data": null,
  "error": {
    "code": "INVALID_OTP",
    "message": "The code provided is incorrect or has expired."
  },
  "requestId": "req_2a18fd90"
}
```

---

## 2. Document Endpoints

### POST /v1/documents
Registers a document, hashes it, uploads it to IPFS, and submits it to the Solana network.

* **Authorization**: Bearer JWT (Citizen role)
* **Request Body**:
```json
{
  "title": "Property Sale Deed - Plot 42",
  "type": "Sale Deed",
  "clientHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "notaryId": "7df83c92-d3a9-4672-9b2f-2d93e110b9ad",
  "requiredSigners": 2
}
```
* **Response Body (201 Created)**:
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
  "requestId": "req_9981cdba"
}
```

---

### GET /v1/documents/:id/status
Retrieves the status, hash, and metadata of a registered document.

* **Authorization**: None (Public verification token-bound)
* **Response Body (200 OK)**:
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
  "requestId": "req_45a1bd90"
}
```

---

### POST /v1/documents/:id/verify
Compares an uploaded document scan against the registered Solana record.

* **Authorization**: None (Public)
* **Request Body**: Multipart form data with a `file` field.
* **Response Body (200 OK - Authentic)**:
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
  "requestId": "req_512ff310"
}
```
* **Response Body (200 OK - Tampered)**:
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
  "requestId": "req_512ff310"
}
```

---

### POST /v1/documents/:id/signatures
Attaches a signature to a document by a notary or executing party.

* **Authorization**: Bearer JWT (Notary or Citizen role)
* **Request Body**:
```json
{
  "signerRole": "NOTARY",
  "signatureBytes": "MEYCIQCN7df83c92d3...",
  "certSerial": "CA-3-889a2bc1"
}
```
* **Response Body (200 OK)**:
```json
{
  "data": {
    "signatureId": "8b9e1102-18bc-4cf2-9fa4-77a83d1cde03",
    "status": "NOTARY_SIGNED"
  },
  "error": null,
  "requestId": "req_77cfba21"
}
```

---

### GET /v1/documents/:id/custody
Retrieves the append-only timeline log of verification events and modifications.

* **Authorization**: Bearer JWT (Institutional roles: Bank, Court, Admin)
* **Response Body (200 OK)**:
```json
{
  "data": {
    "documentId": "a98dfb02-5c91-4cf1-8bc9-93e1189ac3f2",
    "timeline": [
      {
        "eventId": "1b9c2d3e-4f5a-6b7c-8d9e-0f1a2b3c4d5e",
        "documentId": "a98dfb02-5c91-4cf1-8bc9-93e1189ac3f2",
        "eventType": "registration_confirmed",
        "actorUserId": "c7b6f790-281b-4cf7-9fa4-1065e12f689e",
        "actorLabel": "Priya (Citizen)",
        "onchainTxRef": "2G4c9s1vF3y...",
        "occurredAt": "2026-06-19T05:30:00Z"
      },
      {
        "eventId": "2b9c2d3e-4f5a-6b7c-8d9e-0f1a2b3c4d5e",
        "documentId": "a98dfb02-5c91-4cf1-8bc9-93e1189ac3f2",
        "eventType": "notary_signed",
        "actorUserId": "7df83c92-d3a9-4672-9b2f-2d93e110b9ad",
        "actorLabel": "Advocate Rao (Notary)",
        "onchainTxRef": "3A9b2c3d...",
        "occurredAt": "2026-06-19T05:34:00Z"
      }
    ]
  },
  "error": null,
  "requestId": "req_cdb918a2"
}
```

---

### GET /v1/documents/:id/certificate
Generates a downloadable validation certificate package containing document metadata, hash, QR, and Solana Tx signatures.

* **Authorization**: None (Public)
* **Response Body (200 OK)**:
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
  "requestId": "req_88bbcd21"
}
```

---

### GET /v1/documents/search
Queries registered documents based on filters.

* **Authorization**: Bearer JWT (Institutional)
* **Query Parameters**:
  - `status` (optional): `PENDING` | `ONCHAIN_CONFIRMED` | `NOTARY_SIGNED` | `FULLY_EXECUTED` | `DISPUTED` | `REVOKED`
  - `startDate` (optional): ISO string
  - `endDate` (optional): ISO string
  - `notaryId` (optional): UUID
* **Response Body (200 OK)**:
```json
{
  "data": {
    "items": [
      {
        "documentId": "a98dfb02-5c91-4cf1-8bc9-93e1189ac3f2",
        "title": "Property Sale Deed - Plot 42",
        "type": "Sale Deed",
        "contentHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        "status": "NOTARY_SIGNED",
        "createdAt": "2026-06-19T05:30:00Z"
      }
    ],
    "total": 1,
    "page": 1,
    "limit": 10
  },
  "error": null,
  "requestId": "req_0099cd3d"
}
```

---

### GET /v1/documents/:id/fraud-score
Computes the risk score dynamically using rule-based metrics.

* **Authorization**: Bearer JWT (Bank, Court, Admin roles)
* **Response Body (200 OK)**:
```json
{
  "data": {
    "documentId": "a98dfb02-5c91-4cf1-8bc9-93e1189ac3f2",
    "score": 80,
    "signals": {
      "hashMismatch": false,
      "missingBlockchainTx": false,
      "missingNotarySignature": true,
      "expiredVerification": false
    },
    "computedAt": "2026-06-19T11:00:00Z"
  },
  "error": null,
  "requestId": "req_f4a210d8"
}
```

---

## 3. Notary Management Endpoints

### POST /v1/notaries/onboard
Onboards an independent notary, recording their Class 3 DSC certificate hardware credentials.

* **Authorization**: Bearer JWT (Admin role)
* **Request Body**:
```json
{
  "name": "Advocate Rao",
  "dscCertificateSerial": "CA-3-889a2bc1",
  "publicKeyBase64": "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA..."
}
```
* **Response Body (201 Created)**:
```json
{
  "data": {
    "notaryId": "7df83c92-d3a9-4672-9b2f-2d93e110b9ad",
    "message": "Notary onboarded successfully."
  },
  "error": null,
  "requestId": "req_a772fcd3"
}
```
