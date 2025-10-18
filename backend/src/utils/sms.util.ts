
import axios from 'axios';
import { config } from '../config';

/**
 * sendSms - send a plain-text SMS via configured gateway
 *
 * Inputs:
 *  - phoneNumber: E.164 or gateway-expected number string
 *  - message: text content
 *
 * Returns: gateway response object
 * Throws: rethrows axios errors after logging
 */
export async function sendSms(phoneNumber: string, message: string): Promise<any> {
  try {
    const smsUrl = config.sms.apiUrl;
    if (!smsUrl) throw new Error('SMS_API_URL not configured');
    const normalized = normalizePhone(phoneNumber);

    const params: Record<string, string> = {
      username: process.env.SMS_USERNAME || config.sms.username || '',
      password: process.env.SMS_PASSWORD || config.sms.password || '',
      message,
      number: normalized,
      sender: process.env.SMS_USERNAME || config.sms.username || ''
    };

    console.log(`Sending SMS to ${phoneNumber} -> normalized ${normalized}`);

    const response = await axios.get(smsUrl, { params });
    return response.data;
  } catch (err: any) {
    console.error('Error sending SMS:', err?.response?.data || err.message || err);
    throw err;
  }
}

/**
 * checkBalance - query provider's balance endpoint using username/password
 * Returns a numeric balance (as returned by provider parsed to number)
 */
export async function checkBalance(username?: string, password?: string): Promise<number> {
  try {
    const smsUrl = config.sms.apiUrl;
    if (!smsUrl) throw new Error('SMS_API_URL not configured');

    const params: Record<string, string> = {
      method: 'Balance',
      username: username || (process.env.SMS_USERNAME || config.sms.username || ''),
      password: password || (process.env.SMS_PASSWORD || config.sms.password || ''),
    };

    const response = await axios.get(smsUrl, { params });
    const data = response.data;

    // Attempt to parse number from response (string or numeric)
    const parsed = Number(String(data).replace(/[^0-9.\-]/g, ''));
    if (Number.isNaN(parsed)) {
      throw new Error(`Unable to parse balance from provider response: ${String(data)}`);
    }
    return parsed;
  } catch (err: any) {
    console.error('Error checking SMS balance:', err?.response?.data || err.message || err);
    throw err;
  }
}

/**
 * Normalize a phone number to Uganda international format without '+' (e.g. 256773913902)
 * Accepts inputs like '0773913902', '773913902', '+256773913902', '256773913902'
 */
export function normalizePhone(input: string): string {
  if (!input) throw new Error('Empty phone number');
  let digits = input.replace(/\D/g, '');

  // Remove leading international 00 prefix
  if (digits.startsWith('00')) digits = digits.replace(/^00/, '');

  // Already has country code
  if (digits.startsWith('256') && digits.length >= 12) return digits;

  // Local mobile with leading 0: 0773913902 -> drop leading 0
  if (digits.startsWith('0') && digits.length === 10) {
    return '256' + digits.slice(1);
  }

  // Local mobile without leading 0: 773913902 (9 digits)
  if (digits.length === 9 && digits.startsWith('7')) {
    return '256' + digits;
  }

  // If digits already length 12 and doesn't start with 256, try to return as-is
  if (digits.length === 12 && digits.startsWith('256')) return digits;

  // Fallback: if digits length is 9 or 10, try to coerce
  if (digits.length === 10 && digits.startsWith('0')) return '256' + digits.slice(1);
  if (digits.length === 9) return '256' + digits;

  throw new Error(`Unable to normalize phone number '${input}' -> digits='${digits}'`);
}
