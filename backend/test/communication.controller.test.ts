import { getSmsCreditBalance } from '../src/services/communication/communication.controller';
import { Request, Response } from 'express';

jest.mock('../src/services/communication/smsCredentials.service', () => ({
  getSmsCredentialsForSchool: jest.fn(),
}));

jest.mock('../src/utils/sms.util', () => ({
  checkBalance: jest.fn(),
}));

jest.mock('../src/services/communication/smsAccount.service', () => ({
  upsertSmsAccount: jest.fn(),
  addSmsTransaction: jest.fn(),
}));

const { getSmsCredentialsForSchool } = require('../src/services/communication/smsCredentials.service');
const { checkBalance } = require('../src/utils/sms.util');
const { upsertSmsAccount, addSmsTransaction } = require('../src/services/communication/smsAccount.service');

describe('getSmsCreditBalance controller', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn(() => ({ json: jsonMock }));
    res = { status: statusMock, json: jsonMock } as any;
    req = { user: { schoolId: 123 } } as any;
    jest.clearAllMocks();
  });

  it('returns 403 when credentials missing', async () => {
    getSmsCredentialsForSchool.mockResolvedValue(null);
    await getSmsCreditBalance(req as any, res as any);
    expect(statusMock).toHaveBeenCalledWith(403);
    expect(jsonMock).toHaveBeenCalledWith({ message: 'Subscribe or Contact Support' });
  });

  it('returns rounded down balance when provider responds', async () => {
    getSmsCredentialsForSchool.mockResolvedValue({ username: 'u', password: 'p' });
    checkBalance.mockResolvedValue(70000);
    await getSmsCreditBalance(req as any, res as any);
    // 70000 * (10/7) = 100000 -> floor to nearest 10 = 100000
    expect(upsertSmsAccount).toHaveBeenCalledWith(123, 70000);
    expect(addSmsTransaction).toHaveBeenCalledWith(123, 'check', 70000, { raw: 70000 });
    expect(jsonMock).toHaveBeenCalledWith(100000);
  });
});
