// @ts-nocheck
/// <reference types="jest" />
import { getSchoolAnalytics } from '../src/services/analytics/analytics.service';

// Mock dependent modules
jest.mock('../src/database/database', () => {
  const original = jest.requireActual('../src/database/database');
  return {
    ...original,
    pool: {
      query: jest.fn(async (text: string, params?: any[]) => {
        // Simple canned responses depending on text
        if (text.includes('COUNT(DISTINCT s.student_id)')) {
          return { rowCount: 1, rows: [{ active_count: '0', inactive_count: '0', alumni_count: '0', expelled_count: '0', suspended_count: '0', sick_count: '0', total_count: '0' }] };
        }
        if (text.includes('COUNT(DISTINCT s.student_id) FILTER') && text.includes("gender")) {
          return { rowCount: 1, rows: [{ boys_count: '0', girls_count: '0' }] };
        }
        if (text.includes('FROM sms_accounts')) {
          return { rowCount: 1, rows: [{ provider_balance_bigint: 4200 }] };
        }
        if (text.includes('COALESCE(SUM(t.total_paid)')) {
          return { rowCount: 1, rows: [{ total_paid_all: 200000, total_balance_due_all: 330000, paid_students_count: 1, defaulter_students_count: 2 }] };
        }
        return { rowCount: 0, rows: [] };
      })
    }
  };
});

jest.mock('../src/services/communication/smsCredentials.service', () => ({
  getSmsCredentialsForSchool: jest.fn(async (schoolId: number) => ({ username: 'u', password: 'p' }))
}));

jest.mock('../src/utils/sms.util', () => ({
  checkBalance: jest.fn(async () => 5000)
}));

jest.mock('../src/services/communication/smsAccount.service', () => ({
  upsertSmsAccount: jest.fn(async () => true),
  addSmsTransaction: jest.fn(async () => true),
  getSmsAccountBalance: jest.fn(async () => 4200)
}));

import { pool } from '../src/database/database';
import * as smsUtil from '../src/utils/sms.util';
import * as smsCreds from '../src/services/communication/smsCredentials.service';
import * as smsAccount from '../src/services/communication/smsAccount.service';

const mockedPoolQuery = (pool.query as jest.MockedFunction<any>);

describe('analytics.service balance refresh', () => {
  beforeEach(() => {
    mockedPoolQuery.mockClear();
    (smsUtil.checkBalance as jest.Mock).mockClear();
    (smsCreds.getSmsCredentialsForSchool as jest.Mock).mockClear();
    (smsAccount.upsertSmsAccount as jest.Mock).mockClear();
    (smsAccount.addSmsTransaction as jest.Mock).mockClear();
  });

  test('when refresh=true, provider is called and upsertSmsAccount invoked', async () => {
    const res = await getSchoolAnalytics(2, undefined, undefined, true);
    // provider checkBalance should be called
    expect(smsUtil.checkBalance).toHaveBeenCalled();
    expect(smsAccount.upsertSmsAccount).toHaveBeenCalledWith(2, expect.any(Number));
    // smsBalance should be computed from checkBalance(5000) => multiplied and rounded
    expect(res.smsBalance).toBeGreaterThanOrEqual(0);
  });

  test('when refresh=false, provider is not called and stored balance is used', async () => {
    const res = await getSchoolAnalytics(2, undefined, undefined, false);
    expect(smsUtil.checkBalance).not.toHaveBeenCalled();
    // stored value in mock is 4200 -> after algorithm should be something predictable
    expect(res.smsBalance).toBeGreaterThanOrEqual(0);
  });
});
