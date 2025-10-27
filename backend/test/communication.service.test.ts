// @ts-nocheck
/// <reference types="jest" />
import { previewBulkFeesRemindersData, processBulkFeesReminders } from '../src/services/communication/communication.service';

// Mock dependent modules
jest.mock('../src/database/database', () => {
  const original = jest.requireActual('../src/database/database');
  return {
    ...original,
    pool: {
      query: jest.fn(async (text: string, params?: any[]) => {
        // Provide canned responses depending on query text
        if (text.includes('SELECT 1 FROM student_terms')) {
          return { rowCount: 1, rows: [{ student_term_id: 1, year: 2025, term: 1, status_at_term: 'Active' }] };
        }
        if (text.includes('WITH base_students')) {
          // return two sample ranked rows
          return {
            rowCount: 2,
            rows: [
              {
                student_id: 6,
                student_name: 'Alice',
                parent_phone_sms: '256700111111',
                class_name: 'S.2',
                student_status: 'Active',
                amount_paid: 0,
                balance_due: 1500,
                term: 1,
                year: 2025,
                fee_name: 'Tuition',
                total_fees_due: 1500,
                due_date: null
              },
              {
                student_id: 7,
                student_name: 'Bob',
                parent_phone_sms: '256700222222',
                class_name: 'S.1',
                student_status: 'Active',
                amount_paid: 0,
                balance_due: 1200,
                term: 1,
                year: 2025,
                fee_name: 'Tuition',
                total_fees_due: 1200,
                due_date: null
              }
            ]
          };
        }
        // fallback small responses for other debug queries
        if (text.includes('COUNT') || text.includes('array_agg')) {
          return { rowCount: 1, rows: [{ count: '2', statuses: '{Active}', classes: ['S.1'] }] };
        }
        // default empty
        return { rowCount: 0, rows: [] };
      })
    }
  };
});

jest.mock('../src/services/communication/smsCredentials.service', () => ({
  getSmsCredentialsForSchool: jest.fn(async (schoolId: number) => ({ username: 'test', password: 'pass' }))
}));

jest.mock('../src/utils/sms.util', () => ({
  checkBalance: jest.fn(async () => 5000),
  sendSms: jest.fn(async () => true)
}));

jest.mock('../src/services/schools/school.service', () => ({
  findSchoolById: jest.fn(async (id: number) => ({ school_name: 'Test School', accountant_number: '0700123456' }))
}));

jest.mock('../src/services/communication/smsAccount.service', () => ({
  addSmsTransaction: jest.fn(async () => true),
  upsertSmsAccount: jest.fn(async () => true),
  getSmsAccountBalance: jest.fn(async () => 0)
}));

import { pool } from '../src/database/database';

const mockedPoolQuery = (pool.query as jest.MockedFunction<any>);

function highestPlaceholderIndex(sql: string): number {
  const matches = sql.match(/\$(\d+)/g);
  if (!matches) return 0;
  return Math.max(...matches.map(m => Number(m.replace('$', ''))));
}

describe('communication.service SQL builder', () => {
  beforeEach(() => {
    mockedPoolQuery.mockClear();
  });

  test('preview with status+year builds matching placeholders and params', async () => {
    const schoolId = 2;
    const thresholdAmount = 1000;
    const classFilter = undefined;
    const statusFilter = 'Active';
    const year = '2025';

    const res = await previewBulkFeesRemindersData(schoolId, thresholdAmount, classFilter, statusFilter, undefined, year, undefined, 'Defaulter', 'detailed');

    // last call to pool.query should be the main query
  const lastCall = mockedPoolQuery.mock.calls.find((call: any) => typeof call[0] === 'string' && (call[0] as string).includes('WITH base_students'));
    expect(lastCall).toBeDefined();
    const [sqlText, params] = lastCall as [string, any[]];

    // Ensure no token placeholders remain
    expect(sqlText).not.toContain('$Y');
    expect(sqlText).not.toContain('$T');

    const maxIdx = highestPlaceholderIndex(sqlText);
    expect(maxIdx).toBeGreaterThanOrEqual(1);
    expect(params.length).toBeGreaterThanOrEqual(maxIdx);
  });

  test('processBulkFeesReminders with status+year builds matching placeholders and params', async () => {
    const schoolId = 2;
    const thresholdAmount = 1000;
    const classFilter = undefined;
    const statusFilter = 'Active';
    const year = '2025';

    // Call send function (it will try to send SMS using mocks). We allow it to throw
    // 'No students match the specified criteria' in the mocked environment, but still
    // validate the constructed SQL and params used for the main query.
    try {
      await processBulkFeesReminders(schoolId, thresholdAmount, classFilter, statusFilter, undefined, year, undefined, 'Defaulter', 'detailed');
    } catch (err) {
      // expected in some mocked scenarios; continue to inspect SQL
    }

    const lastCall = mockedPoolQuery.mock.calls.find((call: any) => typeof call[0] === 'string' && (call[0] as string).includes('WITH base_students'));
    expect(lastCall).toBeDefined();
    const [sqlText, params] = lastCall as [string, any[]];

    // Ensure no token placeholders remain
    expect(sqlText).not.toContain('$Y');
    expect(sqlText).not.toContain('$T');

    const maxIdx = highestPlaceholderIndex(sqlText);
    expect(params.length).toBeGreaterThanOrEqual(maxIdx);
  });
});
