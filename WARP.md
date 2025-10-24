# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

BigezoLite is a school management system with SMS and subscription management. It's a full-stack application with:
- **Backend**: Node.js/Express/TypeScript API with PostgreSQL database
- **Frontend**: Angular 19 single-page application
- **Key features**: Student management, fee tracking, SMS communications with provider integration, subscription/account status management

## Commands

### Backend (run from `backend/` directory)
- **Install**: `npm ci`
- **Development**: `npm run dev` (uses nodemon)
- **Build**: `npm run build` (compiles TypeScript to `dist/`)
- **Production**: `npm start` (runs compiled `dist/index.js`)
- **Tests**: `npm test` (runs Jest with `--runInBand --detectOpenHandles`)
- **Test single file**: `npm test -- path/to/test.spec.ts`
- **Send test SMS**: `npm run send-test-sms` (runs `scripts/sendTestSms.ts`)

### Frontend (run from `frontend/` directory)
- **Install**: `npm ci`
- **Development**: `npm start` or `ng serve` (serves on http://localhost:4200)
- **Build**: `npm run build` or `ng build`
- **Tests**: `npm test` or `ng test` (Karma/Jasmine)
- **Watch mode**: `npm run watch`
- **Generate component**: `ng generate component component-name`

### Database
- **Connection check**: `node backend/scripts/check-db-connection.js`
- **Schema file**: `backend/src/database/schema.sql` (contains full schema including SMS tables)
- **Migrations**: Located in `backend/src/database/migrations/`

## Architecture

### Backend Structure

**Request Flow**: Client → Express Router → Auth Middleware → Subscription Middleware → Controller → Service → Database

**Key Layers**:
- `src/api/v1/`: Route definitions (e.g., `communication.routes.ts`, `student.routes.ts`)
- `src/middleware/`: Authentication (`auth.middleware.ts`) and subscription checks (`subscription.middleware.ts`)
- `src/services/`: Business logic organized by domain (auth, communication, fees, schools, students, subscription, users)
- `src/database/`: PostgreSQL connection pool (`database.ts`) and schema files
- `src/utils/`: Utilities including SMS operations (`sms.util.ts`) and WebSocket server
- `src/config/`: Environment configuration loading

**Authentication Flow**:
1. `auth.middleware.ts` validates JWT token (HS256, not Firebase RS256 tokens)
2. Extracts `userId` from token
3. Fetches associated `schoolId` from database
4. Attaches both to `req.user` for downstream use
5. All routes enforce data isolation using `schoolId`

**Subscription Enforcement**:
- `subscription.middleware.ts` checks `account_status` (case-insensitive)
- Only 'Suspended' status blocks operations
- 'Dormant' and 'Active' both allow operations

### SMS Architecture

**Multi-school SMS design**: Each school has separate SMS credentials stored in `sms_credentials` table. The system tracks SMS balances per school in `sms_accounts` and logs all transactions in `sms_transactions`.

**Key services**:
- `smsCredentials.service.ts`: Fetches per-school credentials
- `smsAccount.service.ts`: Manages provider balance tracking
- `communication.service.ts`: Orchestrates balance checks and sending
- `sms.util.ts`: Provider API calls (send, checkBalance)

**SMS sending flow**:
1. Fetch school-specific credentials from `sms_credentials`
2. Check provider balance via `checkBalance(username, password)`
3. Calculate required amount: `recipients * COST_PER_SMS` (default 50)
4. Verify sufficient balance
5. Send SMS(s) via provider API
6. Record transaction in `sms_transactions` (debit)
7. Update `sms_accounts.provider_balance_bigint`

**Balance algorithm** (in communication controller):
- Provider returns raw balance
- Multiply by (10/7)
- Round to nearest 10
- Return to frontend

### Frontend Structure

**Architecture**: Angular 19 with standalone components, Material UI, and service-based state management.

**Key directories**:
- `src/app/pages/`: Feature modules (communications, dashboard, student-management, subscription, etc.)
- `src/app/services/`: API client services (auth, communication, fees, school, student, subscription, websocket)
- `src/app/guards/`: Route guards for authentication
- `src/app/interceptors/`: HTTP interceptors (likely for auth headers)
- `src/app/components/`: Shared/reusable components

**Data flow**: Component → Service (HTTP call) → Backend API → Response → Service → Component

### Database Schema

**Core tables**:
- `users`: Individual accounts (email/phone, password_hash, google_id)
- `schools`: Organizations linked to users (school_id, user_id, account_status enum)
- `students`: Student records (isolated by school_id)
- `fees_records`: Fee tracking per student/term
- `sms_credentials`: Per-school SMS provider credentials
- `sms_accounts`: SMS balance tracking per school
- `sms_transactions`: Audit log of SMS debits/credits
- `orders`: Subscription order tracking

**Key enums**:
- `account_status`: 'Dormant', 'Active', 'Suspended'
- `student_status`: 'Active', 'Inactive', 'Expelled', 'Alumni', 'Suspended', 'Sick'
- `fees_status`: 'Paid', 'Defaulter', 'Pending'

**Data isolation**: All student/fee data is scoped by `school_id`. Auth middleware enforces this by attaching `schoolId` to requests.

## Configuration

### Backend Environment Variables (`.env`)

Required in `backend/.env` (see `backend/.env.example`):

**Server**:
- `PORT`: API port (default 3000)
- `JWT_SECRET`: Secret for JWT signing (HS256)

**Database**:
- `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_DATABASE`, `DB_PORT`: PostgreSQL connection

**Firebase** (for push notifications or authentication):
- `FIREBASE_PROJECT_ID`, `FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN`, etc.
- Optional: `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` for admin SDK

**SMS**:
- `SMS_API_URL`: Provider base URL (e.g., `https://www.egosms.co/api/v1/plain/?`)
- `COST_PER_SMS`: Cost per SMS in local currency (default 50)
- Optional fallback: `SMS_USERNAME`, `SMS_PASSWORD` (prefer per-school credentials in DB)

**Other**:
- `ALLOW_REAL_SMS`: Boolean flag for SMS sending (false for testing)

### Frontend Environment

Configuration in `frontend/src/environments/`:
- `environment.ts`: Development config
- `environment.prod.ts`: Production config (if exists)

Likely contains API base URL and Firebase config.

## Important Patterns

### Error Handling
- Service layer throws errors with `statusCode` property
- Controllers catch and map to HTTP responses
- 401: Authentication failure
- 402: Insufficient SMS balance
- 403: Authorization/subscription issue (missing creds, suspended account)
- 404: Resource not found
- 500: Server error

### Phone Number Normalization
`sms.util.ts` `normalizePhone()` converts Uganda numbers to international format without '+':
- Input: '0773913902', '773913902', '+256773913902', '256773913902'
- Output: '256773913902'

### Database Queries
- Use parameterized queries via `query(sql, params)` from `database.ts`
- Always filter by `school_id` for data isolation
- Connection pool is exported as `pool` for transaction support

### JWT Token Types
Backend only accepts HS256 JWTs (app tokens). If RS256 token (Firebase ID token) is sent, middleware returns clear error: "Unexpected token type: received an RS256 (Firebase) token. Clear stored token and sign in using the application login flow."

## Testing

### Backend
- Framework: Jest with ts-jest
- Location: `backend/test/` (currently empty, tests may be co-located with source)
- Run: `npm test` from backend directory
- Config: Likely in `backend/package.json` or `jest.config.js`

### Frontend
- Framework: Jasmine/Karma
- Run: `npm test` from frontend directory
- Generates coverage reports in `frontend/coverage/`

## CI/CD

GitHub Actions workflow (`.github/workflows/nodejs.yml`):
- Triggers on push/PR to `main` branch
- Runs backend tests only (`npm test --silent` in backend directory)
- Uses Node.js 18

## Development Workflow

1. **Setup**: Copy `backend/.env.example` to `backend/.env` and configure
2. **Database**: Run `backend/src/database/schema.sql` to initialize PostgreSQL schema
3. **Backend**: `cd backend && npm ci && npm run dev`
4. **Frontend**: `cd frontend && npm ci && npm start`
5. **Access**: Frontend at http://localhost:4200, backend at http://localhost:3000

## Security Notes

- Never commit `backend/.env` (contains secrets)
- JWT secret must be strong in production
- SMS credentials stored per-school in database (encrypted storage recommended)
- All endpoints require authentication (except `/api/v1/auth/*`)
- Subscription middleware enforces account status on protected routes
- Data isolation via `school_id` prevents cross-school data access

## Known Constraints

- SMS provider: Currently supports egosms.co API format
- Database: PostgreSQL only (uses ENUM types, GENERATED columns)
- Phone format: Designed for Uganda (+256) numbers
- Frontend: Angular 19 (latest version, may have breaking changes from older Angular)
- Backend: Node.js/Express with TypeScript, requires compilation before production deployment
