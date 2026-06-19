# 3-Minute Hackathon Pitch Script - Legal TimeLock Network (LTN)

This script is structured to be delivered within a strict **3-minute presentation limit**. 

---

## 1. Slide Structure & Narration

### Slide 1: The Problem (0:00 - 0:30)
* **Visual**: Image of a physical property stamp paper. Bold text: "Backdating & Alteration Fraud."
* **Narration**: 
  > "Every day in India, high-value legal documents—property sale deeds, loan agreements, and affidavits—are signed on physical stamp paper. But physical stamp paper doesn't prove *when* the contract terms were finalized. Anyone can buy stamp paper today, write the terms next year, and claim it was executed months ago. Backdating, clause tampering, and notary stamp forgeries cost banks and citizens crores in litigations annually."

### Slide 2: The Trust Gap (0:30 - 0:50)
* **Visual**: A comparison chart showing: Stamp Paper (only timestamps purchase) vs. Aadhaar Sign (only timestamps signature) vs. LTN (timestamps the exact document content).
* **Narration**:
  > "Existing solutions don't close this gap. e-Stamping only timestamps when the paper was bought. Digital signatures only confirm *who* signed it. There is no independent, third-party record of *what* was signed and *when* it was finalized. That is the Trust Gap we are closing."

### Slide 3: The Solution (0:50 - 1:15)
* **Visual**: Screenshot of the LTN Citizen portal generating a QR code.
* **Narration**:
  > "Meet the Legal TimeLock Network. We bridge physical legal workflows with blockchain security. A citizen scans a signed agreement, and our portal calculates its SHA-256 fingerprint and anchors it on the Solana blockchain. We generate a verification QR code printed on the document. Scanning this QR instantly proves document integrity, timestamp, and signature validity to any bank or court."

### Slide 4: Simplified Architecture (1:15 - 1:40)
* **Visual**: Simple flow diagram: Next.js Frontend -> Express Backend -> Solana Devnet (Anchor Program) & PostgreSQL DB.
* **Narration**:
  > "Our architecture is lightweight. The frontend computes document hashes in the browser to maintain absolute privacy. The backend relays this hash to our Solana Anchor program. Solana acts as our immutable trust anchor, providing sub-second confirmation and transaction fees under a fraction of a cent. PII data stays encrypted off-chain, making us fully DPDP compliant."

### Slide 5: Live Demo (1:40 - 2:30)
* **Action**: (Switch screens and run through the 10-step demo script).
* **Narration**:
  > "Let's see this in action. Citizen Priya uploads a sale deed. The hash is generated. Clicks Anchor. It is now on-chain. We log in as Notary Rao, insert his Class 3 DSC token, and digitally sign it. If a bank officer uploads this deed, it shows 'Authentic'. But if we alter even a single number in this PDF and re-upload it—boom—tampering is detected instantly, showing a 100 risk score."

### Slide 6: Business Model & Future Scope (2:30 - 3:00)
* **Visual**: Bold text: "B2B2C Verification. RBI/Court Admissibility."
* **Narration**:
  > "LTN operates on a per-transaction verification model for banks and NBFCs. In the future, we aim to automate Section 65B Evidence Act certificates for judiciary use. With the Legal TimeLock Network, every legal document can prove, in under two seconds, exactly when it was created and that it hasn't been altered. Thank you."
