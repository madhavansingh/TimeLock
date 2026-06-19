# User Flows - Legal TimeLock Network (LTN)

This document maps out the specific user flows and state transitions for the three core personas: Priya (Citizen Executant), Advocate Rao (Independent Notary), and Anjali (Bank Credit/Risk Officer).

---

## 1. Persona 1: Priya (Citizen Executant) - Document Registration Flow

Priya wants to secure a property sale agreement by registering it on the Legal TimeLock Network without needing to understand blockchain technology.

```mermaid
graph TD
    Start([Start]) --> Login[Request OTP via Phone/Email]
    Login --> EnterOTP[Enter 6-digit OTP]
    EnterOTP --> Session[Receive Session JWT]
    Session --> UploadForm[Navigate to Register Page]
    UploadForm --> FillDetails[Enter Title, Type & Select Notary]
    FillDetails --> FileSelect[Select PDF/Image file]
    FileSelect --> HashCalc[Client-side Hash Computed]
    HashCalc --> Submit[Submit Upload Request]
    Submit --> BEProcess[Backend scans malware, stores file to IPFS & Relays to Solana]
    BEProcess --> Pending[Status: PENDING]
    BEProcess --> Confirmed[Status: ONCHAIN_CONFIRMED]
    Confirmed --> ShowQR[Display Printable QR Code & Document Details]
    ShowQR --> End([End])
```

---

## 2. Persona 2: Advocate Rao (Independent Notary) - Digital Signing Flow

Advocate Rao needs to digitally sign a registered document using his Class 3 DSC USB hardware token.

```mermaid
graph TD
    Start([Start]) --> AuthNotary[Insert DSC Token & Authenticate on Notary Console]
    AuthNotary --> ViewQueue[View Pending Signing Queue]
    ViewQueue --> SelectDoc[Select Document for Review]
    SelectDoc --> ReviewDetails[Compare Hash & Metadata]
    ReviewDetails --> VerifyHash[Confirm Hash matches the physical scan]
    VerifyHash --> SignPrompt[Trigger DSC USB Token PIN prompt]
    SignPrompt --> EnterPIN[Enter Token PIN]
    EnterPIN --> CryptSign[Generate Digital Signature on workstation]
    CryptSign --> SubmitSign[Submit Signature payload to Backend]
    SubmitSign --> OnchainSign[Backend commits signature to Solana PDA]
    OnchainSign --> Complete[Status: NOTARY_SIGNED or FULLY_EXECUTED]
    Complete --> End([End])
```

---

## 3. Persona 3: Anjali (Bank Credit/Risk Officer) - Document Verification Flow

Anjali is processing a loan application and wants to verify the authenticity of a physical deed with a printed QR code.

```mermaid
graph TD
    Start([Start]) --> AuthSession[Authenticate via Credential + MFA]
    AuthSession --> ScanOption{Choose Input Option}
    ScanOption -->|Scan QR| ScanCamera[Scan QR on document using camera]
    ScanOption -->|Enter ID| InputID[Type Document ID manually]
    ScanCamera --> APIFetch[API fetches status, timestamp & notary chain]
    InputID --> APIFetch
    APIFetch --> RehashCheck{Submit copy for re-hash comparison?}
    RehashCheck -->|No| ShowMeta[Display verification metadata & timeline]
    RehashCheck -->|Yes| Rehash[Recompute hash and compare with Solana]
    Rehash --> MatchStatus{Do hashes match?}
    MatchStatus -->|Yes - Match| GreenBadge[Status: AUTHENTIC - Risk Score: LOW]
    MatchStatus -->|No - Mismatch| RedBadge[Status: TAMPERED - Risk Score: 100]
    GreenBadge --> Report[Export Auditable PDF Verification Certificate]
    RedBadge --> AlertOwner[Trigger SMS Tampering Notification & Log Dispute]
    Report --> End([End])
    AlertOwner --> End
```
