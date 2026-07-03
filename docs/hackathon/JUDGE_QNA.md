# Judging Q&A Preparation - Legal TimeLock Network (LTN)

This document prepares the team to answer key technical and product questions from judges.

---

## 1. Core Technical Objections

### Q1: Why use a blockchain? Why not a normal database?
> **Answer**: A normal database, even under administrative control, is editable. The platform operator could backdate a registry record or modify a file hash to assist in fraud. By anchoring the document fingerprint on a public ledger, we remove the operator's ability to silently alter the registry. Immutability is enforced cryptographically, not administratively.

### Q2: Why choose Solana?
> **Answer**: Speed and cost. Solana offers sub-second finality (UX confirmation takes under 2 seconds) and transaction fees that are less than a fraction of a cent ($0.0002). For a high-volume registry of paper documents, Ethereum or Bitcoin transaction fees ($2 to $15) would render B2C registrations economically unfeasible.

### Q3: Why not DocuSign or Aadhaar e-Sign?
> **Answer**: DocuSign and Aadhaar e-Sign solve **who signed it**, not **what was signed and when**. If a PDF is altered after execution, Aadhaar signatures do not automatically prevent the updated pages from being printed or presented as authentic. LTN binds the *entire file content* to an immutable timestamp. It acts as a verification layer *alongside* electronic signatures.

---

## 2. Market & Legal Context

### Q4: How is this innovative?
> **Answer**: We bridge physical paper agreements with blockchain security. 90% of property agreements and affidavits in India are still executed on physical stamp paper or scanned as images. We do not try to replace paper; instead, we generate a verification QR stamp that is printed onto the physical sheet, creating a bridge back to a digital, tamper-proof blockchain audit trail.

### Q5: How would Courts use this?
> **Answer**: In India, electronic evidence requires a certificate under Section 65B of the Indian Evidence Act. LTN automates this process by generating a downloadable validation report containing the blockchain transaction signatures, the registry timestamp, and the notary's Class 3 DSC certificate serial. This provides courts with clear, third-party confirmation of file integrity.

### Q6: How would Banks use this?
> **Answer**: Banks verifying mortgage deeds or loan applications can scan the QR code printed on the document. The system instantly returns the status, notary details, and risk score. By uploading a scanned copy of the deed, the bank can confirm that the contract terms have not been altered after disbursal.

---

## 3. Scalability & Privacy

### Q7: How can this scale to millions of documents?
> **Answer**: We use an off-chain/on-chain hybrid model. We never store document binaries, filenames, or user data on-chain. Only the 32-byte SHA-256 hash and the timestamp are recorded, keeping Solana rent and transaction fees minimal.

### Q8: How is citizen privacy protected? (DPDP Act compliance)
> **Answer**: Data minimization. Since only hashes are anchored on the blockchain, and document hashes are mathematically one-way (irreversible), no citizen details or PII are exposed on the public ledger. Furthermore, document binaries are encrypted before being pinned to IPFS, ensuring unauthorized parties cannot read the agreements.
