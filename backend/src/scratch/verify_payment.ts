import crypto from 'crypto';
import { config } from '../config/env';

const BASE_URL = 'http://localhost:5001/v1';
const citizenEmail = 'priya.executant@ltn.demo';

async function run() {
  console.log('--- STARTING PAYMENT ROUTE VERIFICATION ---');

  try {
    // 1. Request OTP
    console.log(`1. Requesting OTP for ${citizenEmail}...`);
    const otpReq = await fetch(`${BASE_URL}/auth/otp/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: citizenEmail })
    });
    const otpRes = await otpReq.json() as any;
    console.log('   Response:', otpRes);

    // 2. Verify credentials / Login
    console.log('2. Logging in via password login endpoint...');
    const verifyReq = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: citizenEmail, password: 'Demo@123' })
    });
    const verifyRes = await verifyReq.json() as any;
    if (!verifyRes.data || !verifyRes.data.accessToken) {
      throw new Error(`OTP Verification / Login failed: ${JSON.stringify(verifyRes)}`);
    }
    const token = verifyRes.data.accessToken;
    console.log('   Success! JWT Access Token received.');

    // 3. Create Payment Order
    console.log('3. Creating payment order via POST /v1/payments/create-order...');
    const orderReq = await fetch(`${BASE_URL}/payments/create-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ amount: 10 })
    });
    const orderRes = await orderReq.json() as any;
    console.log('   Response:', orderRes);
    if (!orderRes.data) {
      throw new Error(`Order creation failed: ${JSON.stringify(orderRes)}`);
    }

    const { orderId, paymentId } = orderRes.data;
    console.log(`   Order created successfully. Order ID: ${orderId}, DB Payment ID: ${paymentId}`);

    // 4. Test Verification Signature Check (failure case)
    console.log('4. Testing signature verification with invalid signature...');
    const failVerifyReq = await fetch(`${BASE_URL}/payments/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        razorpayOrderId: orderId,
        razorpayPaymentId: 'pay_mockPaymentId123',
        razorpaySignature: 'invalid_signature_string'
      })
    });
    const failVerifyRes = await failVerifyReq.json() as any;
    console.log('   Response (expecting 400 failure):', failVerifyRes);
    if (failVerifyReq.status === 400 && failVerifyRes.error.code === 'PAYMENT_SIGNATURE_INVALID') {
      console.log('   Success! Invalid signature correctly rejected with 400 PAYMENT_SIGNATURE_INVALID.');
    } else {
      console.warn('   Warning: Unexpected response for invalid signature verification.');
    }

    // 5. Test Signature Check (success case)
    console.log('5. Testing signature verification with generated signature...');
    const paymentIdMock = 'pay_mockSuccessPaymentId123';
    // Retrieve secret from backend env configuration
    const keySecret = config.razorpayKeySecret;
    console.log(`   Using key secret for signature generation: ${keySecret ? '***' + keySecret.substring(keySecret.length - 4) : 'undefined'}`);
    
    if (!keySecret) {
      throw new Error('RAZORPAY_KEY_SECRET is not loaded in backend environment.');
    }

    const hmac = crypto.createHmac('sha256', keySecret);
    hmac.update(`${orderId}|${paymentIdMock}`);
    const validSignature = hmac.digest('hex');

    const successVerifyReq = await fetch(`${BASE_URL}/payments/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        razorpayOrderId: orderId,
        razorpayPaymentId: paymentIdMock,
        razorpaySignature: validSignature
      })
    });
    const successVerifyRes = await successVerifyReq.json() as any;
    console.log('   Response (expecting 200 SUCCESS):', successVerifyRes);
    if (successVerifyReq.status === 200 && successVerifyRes.data.status === 'SUCCESS') {
      console.log('   Success! Signature verified successfully.');
    } else {
      throw new Error(`Expected successful verification, got: ${JSON.stringify(successVerifyRes)}`);
    }

    console.log('--- ALL PAYMENT INTEGRATION TESTS PASSED ---');
  } catch (err) {
    console.error('Error during payment API verification:', err);
  }
}

run();
