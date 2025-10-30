Bigezo — SMS and subscription improvements
===============================================

This document records the requested design changes, the implementation plan, and a concrete TODO list for adding per-school SMS credentials, SMS account tracking, cost calculations, a "Check Balance" button, and improved subscription handling.

Summary of the user's request
-----------------------------
- Why the 403 occurred: the backend middleware checks `account_status` strictly against the enum value 'Active'. If the DB value was set to `'active'` (lowercase) or any other casing it will be rejected. I updated the middleware to do a case-insensitive check and to log the fetched `account_status` for debugging.

- You asked for two new tables:
  1. `sms_credentials` (static per school) — stores username/password and optional provider config per school.
  2. `sms_accounts` (dynamic) — tracks SMS balance for each school's account and can be updated by balance checks or sends.

- Add `COST_PER_SMS=50` to environment variables. The app must compute the amount required for bulk sends as: totalRecipients * COST_PER_SMS.

- Change the balance check algorithm (server-side):
  1. Query the SMS provider's check-balance endpoint using the school's credentials and the shared `SMS_API_URL`.
  2. Multiply the returned API balance by (10/7).
  3. Round the result to the nearest 10s (e.g., 70,000 -> 100,000; 20,000 -> 28,570) — see "Rounding notes" below.
  4. Return that computed value to the frontend.

- Before sending a single SMS or a bulk campaign the server must:
  1. Check `account_status` is active (case-insensitive). If Dormant or Suspended, block send and return 403 with a clear message.
  2. Determine the number of recipients (for bulk sends) and compute `requiredAmount = recipients * COST_PER_SMS`.
  3. Check that `computedBalance >= requiredAmount`. If not, return 402 or 400 with an explanatory message.
  4. If sufficient, proceed to send. On successful sends, decrement the `sms_accounts.balance` accordingly and persist a send record.

Proposed schema additions (Postgres)
-----------------------------------
-- sms_credentials: stores provider login for each school
CREATE TABLE sms_credentials (
  id SERIAL PRIMARY KEY,
  school_id INTEGER NOT NULL REFERENCES schools(school_id) ON DELETE CASCADE,
  provider VARCHAR(128) NOT NULL DEFAULT 'egosms',
  username TEXT NOT NULL,
  password TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- sms_accounts: dynamic balance tracking per school
CREATE TABLE sms_accounts (
  id SERIAL PRIMARY KEY,
  school_id INTEGER NOT NULL REFERENCES schools(school_id) ON DELETE CASCADE,
  provider_balance_bigint BIGINT DEFAULT 0,
  last_checked TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Optional: sms_transactions to log each send or balance change
CREATE TABLE sms_transactions (
  id SERIAL PRIMARY KEY,
  school_id INTEGER NOT NULL REFERENCES schools(school_id) ON DELETE CASCADE,
  type VARCHAR(32) NOT NULL, -- 'debit'|'credit'|'check'
  amount_bigint BIGINT NOT NULL,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

Environment variables
---------------------
- Keep `SMS_API_URL` in `.env` (shared base URL):
  SMS_API_URL=https://www.egosms.co/api/v1/plain/?
- Add `COST_PER_SMS`:
  COST_PER_SMS=50

Implementation notes for the check-balance algorithm
--------------------------------------------------
- The sample Java code appends `method=Balance&username=...&password=...` to the base URL and performs a GET. The provider response is assumed to be a number/string representing the balance (e.g., "70000").
- Algorithm to compute the final balance returned to frontend:
  1. parsed = parseFloat(apiResponse) // ensure numeric
  2. multiplied = parsed * (10/7)
  3. roundedToNearest10 = Math.round(multiplied / 10) * 10
  4. return roundedToNearest10

Note: The example mapping in your message (70,000 -> 100,000) corresponds to 70000 * (10/7) = 100000 exactly. For 20,000: 20000*(10/7)=28571.428... rounded to nearest 10 => 28570 (you mentioned 28,570 — I use standard rounding to nearest 10). If you prefer different rounding (ceil/floor), indicate which.

API changes & endpoints
-----------------------
1. GET /api/v1/communications/credits
	- Behavior: uses `sms_credentials` for the current school (if present) to call provider balance API, runs the algorithm (10/7 and round to tens), stores the raw provider value into `sms_accounts.provider_balance_bigint` and `sms_accounts.last_checked`, then returns the computed value to frontend.

2. POST /api/v1/communications/single-sms
	- Behavior: check subscription and account status; check `sms_accounts` (or call provider if not present) for balance; if enough, send one SMS and record transaction (debit) and decrement `sms_accounts`.

3. POST /api/v1/communications/bulk-sms
	- Behavior: same checks, compute recipient count from students table (by filter), compute requiredAmount = count * COST_PER_SMS, compare to computed balance, proceed if ok, decrement account and log transaction.

Frontend changes
----------------
- Add a "Check Balance" button to the sidebar UI. When clicked:
  - Call GET /api/v1/communications/credits
  - Show the returned computed value in a toast/snackbar or a small modal.

Server-side checks before sending
-------------------------------
- Account status comparison must be case-insensitive (update applied to `subscription.middleware.ts`).
- The middleware will log the fetched `account_status` to the server console for debugging.

Detailed TODO list (safe small steps)
------------------------------------
1. Database migrations (SQL files):
	- Create `sms_credentials`, `sms_accounts`, `sms_transactions` tables.

2. Config & env:
	- Add `COST_PER_SMS` to `.env` and load in `backend/src/config/index.ts`.

3. Data access layer:
	- Implement `SmsCredentialsService` to read credentials for a school.
	- Implement `SmsAccountService` to read/write provider balance and last_checked.

4. Provider client:
	- Extend `backend/src/utils/sms.util.ts` with `checkBalance(username, password)` that calls `SMS_API_URL` with `method=Balance` and returns parsed numeric balance.

5. Controller/service changes:
	- Update `communication.service.ts` to call `checkBalance` when GET /credits is invoked, apply the multiply-and-round algorithm, persist provider raw balance into `sms_accounts`, and return computed value.
	- Update sendSingleSms/processSingleSms to check balance and `COST_PER_SMS` before sending and debit `sms_accounts` after a successful send.

6. Frontend:
	- Add "Check Balance" button to sidebar and endpoint call.
	- Display returned balance in a toast or small modal.

7. Tests & logging:
	- Add unit tests for rounding algorithm and for services that parse provider responses.
	- Add audit logging for debit/credit transactions in `sms_transactions`.

8. Rollout plan and backwards compatibility:
	- New DB tables are additive. Keep `.env` SMS_API_URL as the shared base.
	- For schools without `sms_credentials`, fallback to env username/password (if supported). Document the fallback path.

Questions / decisions to confirm
------------------------------
1. Rounding behavior: I used standard rounding to nearest 10. If you prefer always ceiling to the next 10, say so.
2. Fallback credentials: do you want the app to use a global env username/password when `sms_credentials` is missing, or to reject the call? I recommend allowing fallback for smooth migration.

Implementation changes already made in this branch (safe, small edits):
- `backend/src/middleware/subscription.middleware.ts` updated to check `account_status` case-insensitively and log the fetched value. This fixes the immediate 403 caused by casing mismatch (e.g., 'Active' vs 'active').
- `backend/src/services/communication/communication.controller.ts` was updated earlier to return provider details in `details` field when available.

Next immediate actions I can take (choose one):
- Implement DB migrations and services for `sms_credentials` and `sms_accounts` (I can add SQL migration files and service classes).
- Implement `checkBalance` in `backend/src/utils/sms.util.ts` and wire GET /api/v1/communications/credits to call it and apply the (10/7) algorithm.
- Add the frontend "Check Balance" button in the sidebar and wire it to the GET /credits endpoint.

If you confirm the rounding choice and fallback behavior, I'll proceed to implement the DB tables and the check-balance integration next.
