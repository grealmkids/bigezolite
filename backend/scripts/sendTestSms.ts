// @ts-nocheck -- script uses Node globals and is run directly with ts-node
// Ensure environment variables from backend/.env are loaded when running this script directly
import 'dotenv/config';
import { sendSms, normalizePhone } from '../src/utils/sms.util';
async function run() {
  const allow = process.env.ALLOW_REAL_SMS === 'true';
  if (!allow) {
    console.log('Real SMS disabled. Set ALLOW_REAL_SMS=true in the environment to enable sending.');
    return;
  }

  const raw = '0773913902';
  const normalized = normalizePhone(raw);
  console.log(`Normalized ${raw} -> ${normalized}`);

  try {
    const res = await sendSms(normalized, 'Test SMS from bigezo backend (integration test)');
    console.log('SMS gateway response:', res);
  } catch (err) {
    console.error('Failed to send SMS:', err);
  }
}

run();
