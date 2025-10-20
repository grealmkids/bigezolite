
# Bigezo Lite V1.5 - Work Done and Pending Tasks

This document outlines the work that has been completed and the pending tasks for the Bigezo Lite V1.5 project.

## Work Done

### Backend

*   **Authentication:**
    *   Google authentication is implemented (`/api/v1/auth/google`).
    *   Token-based authentication middleware is in place.
*   **School Management:**
    *   CRUD operations for schools are implemented (`/api/v1/schools`).
    *   Endpoints to get user's schools are available.
*   **Student Management:**
    *   CRUD operations for students are implemented (`/api/v1/students`).
    *   Endpoint to get a list of students for a school (with search).
*   **Fees Management:**
    *   CRUD operations for fee records are implemented, nested under students (`/api/v1/students/:studentId/fees`).
    *   Endpoint to update a fee record is available (`/api/v1/fees/:feeRecordId`).
*   **Communication (SMS):**
    *   Endpoints for sending single and bulk SMS are implemented (`/api/v1/communications/single-sms`, `/api/v1/communications/bulk-sms`).
    *   Endpoint to get SMS credit balance.
    *   Endpoints to set and get SMS credentials.
    *   Subscription check middleware is used to protect communication routes.
*   **Subscription:**
    *   Endpoints to initiate payment and get payment status are implemented (`/api/v1/subscription/initiate-payment`, `/api/v1/subscription/payment-status/:orderTrackingId`).

### Frontend

*   The frontend has pages and services for all the backend features.
*   It's an Angular application with components for login, registration, school management, student management, communication, and subscription.
*   Modals for fees management, school edit, SMS student, and student are implemented.

## Pending Work

*   **Two-Factor Authentication (2FA):** The PRD mentions 2FA for the school Admin/Bursar role, but it is not yet implemented in the backend.
*   **Dynamic Class Categorization:** The PRD mentions dynamic class categorization based on school type. A `class-categorization.service.ts` exists in the frontend, but the logic needs to be fully implemented and integrated with the backend.
*   **Asynchronous Search:** The PRD mentions asynchronous search for students. The `getStudents` endpoint in the backend supports search, but the frontend implementation needs to be verified.
*   **Student List UI Actions:** The PRD specifies "FEES Button" and "SMS Button" on each student row. Modals for these actions exist, but their integration needs to be verified.
*   **General Bulk SMS Module:** The PRD mentions a "General Bulk SMS Module" for non-fees related announcements. The backend has a `/bulk-sms` endpoint, but the frontend implementation needs to be checked.
*   **PWA Implementation:** The PRD requires the app to be a PWA. The necessary configuration files exist, but the PWA functionality needs to be fully tested.
*   **UI/UX:** The PRD has specific requirements for aesthetics (Google UI style, Poppins font, color palette). The frontend implementation needs to be reviewed to ensure these are applied correctly.
*   **Payment Gateway Integration:** The PRD specifies Pesapal for payment processing. The backend has subscription endpoints, but the actual integration with Pesapal needs to be implemented and tested.

## Recent SMS / Admin work (detailed)

These are the recent changes made during the last session(s). Keep this section as the starting point next time.

Completed
- Backend
    - Added three new database tables (migration already added): `sms_credentials`, `sms_accounts`, `sms_transactions` to support per-school SMS credentials, provider balance persistence and transaction history.
    - Implemented provider helper methods in `backend/src/utils/sms.util.ts`:
        - `sendSms(phone, message)` — sends a message via the provider.
        - `checkBalance(username, password)` — queries provider balance endpoint.
    - Created services:
        - `smsCredentials.service.ts` — `getSmsCredentialsForSchool`, `upsertSmsCredentials`.
        - `smsAccount.service.ts` — `upsertSmsAccount`, `getSmsAccountBalance`, `addSmsTransaction`.
    - Updated `communication.service.ts` and `communication.controller.ts` to:
        - Enforce per-school credentials for sending and balance checks (no fallback to global env creds).
        - Debit accounts and record transactions when SMS are sent.
        - Implement GET `/api/v1/communications/credits` which checks provider balance, persists raw provider balance, multiplies by (10/7) and rounds down to the previous 10 before returning.
        - Implement POST `/api/v1/communications/credentials` to save per-school credentials and GET `/api/v1/communications/credentials` to read them back.
    - Added unit tests for the controller and CI workflow (.github/workflows/nodejs.yml).

- Frontend
    - Added admin form in `ManageSchoolComponent` to set SMS provider credentials (username, password, provider).
    - Added `CommunicationService.setSmsCredentials()` and `CommunicationService.getSmsCredentials()`.
    - Manage School updates:
        - The credentials form is now visible only to the account matching `ADMIN_ACCOUNT` provided in the backend env (frontend reads `GET /api/v1/users/me` which returns isAdmin flag).
        - The credentials form will prefill with saved credentials (if present).
        - Added a `Check Balance` button which calls the backend balance endpoint and shows the returned interpreted balance as a snackbar.

    UI Changes (this session)
    - Added a modern hero section to the Dashboard (inspired by Oracle cloud pages) that preserves Bigezo branding and clearly states the product value for Ugandan schools. File changes:
        - `frontend/src/app/pages/dashboard/dashboard.component.html`
        - `frontend/src/app/pages/dashboard/dashboard.component.scss`
    - Subscription page changes:
        - Added an inline purchase confirmation form that appears when a package's "Purchase" button is clicked. The form is prefilled with the selected school's name, contact phone, selected package and number of SMS. Payment instructions (Airtel/MTN codes) are displayed and the Order button currently logs the order (Pesapal integration left for later).
        - Files changed:
            - `frontend/src/app/pages/subscription/subscription.component.html`
            - `frontend/src/app/pages/subscription/subscription.component.ts`
            - `frontend/src/app/pages/subscription/subscription.component.scss`
        - Replaced several alert() calls with MatSnackBar toasts for better UX.

Why these changes
- The system now requires schools to register their own provider credentials so no single global credential is used for all schools. This simplifies auditing and isolates billing.

Pending / follow-ups (next actions you may want to take)
1. Add ADMIN_ACCOUNT to your backend `.env` so the admin UI is gated appropriately. Example:
     ADMIN_ACCOUNT=grealmkids@gmail.com
2. Migrate/seed existing schools that had SMS credit in `schools.sms_credits` into the new `sms_accounts` rows if you want historical consistency.
3. Optional: mask or encrypt stored SMS passwords (currently stored plaintext per earlier decision).
4. Optional UX improvements:
     - Add a "Show password" toggle in the Manage School credentials form.
     - Provide a "Test credentials" action that calls provider `checkBalance` with the provided credentials and returns provider raw response for diagnostics.
     - Add form-level validation and success/failure UI states (spinner, disable while saving).
5. Add server-side rate limiting and better error mapping for provider failures.
6. Add automated migration scripts and a small migration runner for production deployments.

Files to inspect next time (quick jump list)
- Backend:
    - `backend/src/services/communication/communication.controller.ts`
    - `backend/src/services/communication/communication.service.ts`
    - `backend/src/services/communication/smsCredentials.service.ts`
    - `backend/src/services/communication/smsAccount.service.ts`
    - `backend/src/utils/sms.util.ts`
    - `backend/src/database/migrations/001_add_sms_tables.sql`
- Frontend:
    - `frontend/src/app/pages/manage-school/manage-school.component.ts`
    - `frontend/src/app/services/communication.service.ts`
    - `frontend/src/app/components/sms-student-modal/*` (toast and send flow)

Quick start commands (local dev)
```pwsh
# backend
cd backend
npm ci
npm run dev

# frontend
cd ../frontend
npm ci
npm start
```

If you'd like, I can also add a short migration helper (SQL or Node script) to transfer legacy `schools.sms_credits` values into `sms_accounts` so the balance view is consistent during rollout.
