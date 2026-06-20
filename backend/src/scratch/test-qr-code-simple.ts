import '../config/env';
import { QrService } from '../services/qr.service';

async function testQr() {
  console.log("=== Simplified QR Code Generation Test ===");
  const testDocId = "test-doc-12345";
  
  // 1. Generate URL
  const verificationUrl = QrService.generateVerificationUrl(testDocId);
  console.log("Generated Verification URL:", verificationUrl);
  
  if (verificationUrl === `http://10.131.235.84:3000/verify?id=${testDocId}`) {
    console.log("SUCCESS: QR Code verification URL correctly uses process.env.FRONTEND_URL.");
  } else {
    console.error("FAIL: Verification URL is incorrect:", verificationUrl);
  }
}

testQr().catch(err => {
  console.error("Error during test:", err);
});
