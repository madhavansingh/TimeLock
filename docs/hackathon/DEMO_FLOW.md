# Hackathon Live Demo Script - Legal TimeLock Network (LTN)

This document contains the exact step-by-step demo script optimized to fit within a **3-minute hackathon presentation**. It ensures all key trust milestones are demonstrated without system lag or confusion.

---

## Demo Timing & Sequence

| Time | Step | Action | Visual Element | Narration Keypoint |
|---|---|---|---|---|
| **0:00 - 0:30** | **Step 1: Onboard & Login** | Presenter logs in as Citizen Priya. Enters `123456` (Simulated OTP). | Simple clean login page. OTP loads instantly. | "We start by logging in. No crypto wallet or blockchain jargon. Simple OTP." |
| **0:30 - 1:00** | **Step 2: Upload & Hash** | Uploads `deed.pdf`. System generates the SHA-256 fingerprint in-browser. | Progress bar fills. Hash shows up in green. | "Priya uploads the sale deed. The document fingerprint is generated in-browser." |
| **1:00 - 1:30** | **Step 3: Anchor on Solana** | Clicks "Anchor". Relayer wallet commits the hash to Solana Devnet. | "Anchored on Solana" badge. Devnet Explorer link appears. | "The fingerprint is committed to Solana Devnet. It is now permanent and unbackdatable." |
| **1:30 - 2:00** | **Step 4: Notary Sign-off** | Switch tab. Log in as Notary Rao. Open queue, click "DSC Sign" on Priya's document. | Success modal showing signature added to Solana PDA. | "Advocate Rao signs the hash using his DSC credentials. The signature is bound to the hash." |
| **2:00 - 2:30** | **Step 5: Verify Scan** | Clicks "Inspect Status" to load the verification page. Scan QR or select file. | Green badge: **"Document Verified: Authentic - Risk Score: 0/100"**. | "Scanning the QR code shows a low risk score. The document is authentic and unaltered." |
| **2:30 - 2:50** | **Step 6: Tamper Test** | Uploads `deed_tampered.pdf` (where a clause was changed). | Red badge: **"Integrity Check Failed: Modified - Risk: 100/100"**. | "We changed one number in this contract. The hash changed. Tampering detected instantly." |
| **2:50 - 3:00** | **Step 7: Download PDF** | Click "Download Verification Certificate". | Clean certificate PDF opens showing signatures & QR. | "A court-ready audit report is generated. Verification completed in 2 seconds." |

---

## Pre-Demo Safety Checklist (Execute 30m before pitch)
1. **Devnet Connection Check**: Ensure Solana Devnet RPC node is responding. If Devnet is lagging, toggle the relayer's config to **Localnet** (`http://127.0.0.1:8899`) and start `solana-test-validator` locally.
2. **Prepared Files**:
   * Have `deed.pdf` ready on the desktop.
   * Have `deed_tampered.pdf` (the modified copy) ready on the desktop.
3. **Database Seed**: Run the db reset script to ensure a clean queue before the judges step up:
   * `npx prisma db seed` (pre-populates Notary Advocate Rao credentials).
4. **Session LocalStorage**: Clean localStorage cache so login flows run fresh.
