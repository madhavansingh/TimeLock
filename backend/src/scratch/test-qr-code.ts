import '../config/env';
import { QrService } from '../services/qr.service';
import jsQR from 'jsqr';
import { PNG } from 'pngjs';

async function testQr() {
  console.log("=== QR Code Generation Test ===");
  const testDocId = "test-doc-12345";
  
  // 1. Generate URL
  const verificationUrl = QrService.generateVerificationUrl(testDocId);
  console.log("Generated Verification URL:", verificationUrl);
  
  // 2. Generate QR Code Data URL
  const qrDataUrl = await QrService.generateQrCodeDataUrl(testDocId);
  console.log("QR Code Data URL Length:", qrDataUrl.length);

  // 3. Decode QR Code to verify its payload
  const base64Data = qrDataUrl.replace(/^data:image\/png;base64,/, "");
  const buffer = Buffer.from(base64Data, 'base64');
  
  const png = PNG.sync.read(buffer);
  const code = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
  
  if (code) {
    console.log("Decoded QR Payload:", code.data);
    if (code.data === `http://10.131.235.84:3000/verify?id=${testDocId}`) {
      console.log("SUCCESS: QR Code payload correctly uses the configured IP address.");
    } else {
      console.error("FAIL: QR Code payload is incorrect:", code.data);
    }
  } else {
    console.error("FAIL: Could not decode QR code image.");
  }
}

testQr().catch(err => {
  console.error("Error during test:", err);
});
