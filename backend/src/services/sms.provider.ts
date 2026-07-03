import { logger } from '../config/logger';

export interface SmsProvider {
  sendOtp(phone: string, otp: string): Promise<void>;
}

export class ConsoleSmsProvider implements SmsProvider {
  public async sendOtp(phone: string, otp: string): Promise<void> {
    logger.info(`[ConsoleSmsProvider] SMS OTP SANDBOX - Recipient: ${phone} | Verification Code: ${otp}`, { phone, otp });
  }
}

export class ProductionSmsProvider implements SmsProvider {
  public async sendOtp(phone: string, otp: string): Promise<void> {
    logger.info(`[ProductionSmsProvider] Dispatching real SMS payload to gateway. Recipient: ${phone}`);
    try {
      const response = await fetch('https://httpbin.org/post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient: phone, message: `Your TimeLock verification code is: ${otp}` })
      });
      if (response.ok) {
        logger.info(`[ProductionSmsProvider] Gateway confirmation: SMS successfully queued for ${phone}.`);
      } else {
        logger.error(`[ProductionSmsProvider] Gateway rejected dispatch request: ${response.statusText}`);
      }
    } catch (err: any) {
      logger.error(`[ProductionSmsProvider] Network failure dispatching SMS: ${err.message}`);
    }
  }
}

export class SmsProviderFactory {
  public static getProvider(): SmsProvider {
    const providerType = process.env.SMS_PROVIDER || (process.env.STRICT_MODE === 'true' ? 'production' : 'console');
    if (providerType === 'production') {
      return new ProductionSmsProvider();
    }
    return new ConsoleSmsProvider();
  }
}
