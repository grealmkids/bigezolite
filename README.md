# bigezolite
 # Bigezo Lite
 
 Bigezo Lite is a lightweight school management and communications platform. The repository contains a full-stack application with a TypeScript/Node.js backend and an Angular frontend. The system supports local authentication, social sign-in (Google via Firebase), phone-based identity mapping, and SMS communications.
 
 This README describes the current architecture, authentication flows, environment configuration, development scripts, how to run the app locally, troubleshooting tips and security guidance.
 
 ---
 
 ## Table of contents
 
 - Project layout
 - High level architecture
 - Authentication flows (local, social, Firebase ID tokens)
 - Environment variables (what to set locally)
 - Backend: scripts, important files and routes
 - Frontend: components, pages and the UI flow
 - Developer commands (build, start, tests)
 - Troubleshooting and common errors
 - Security & secrets guidance
 - Next steps & recommended improvements
 
 ---
 
 ## Project layout
 
 Top-level folders:
 
 - `backend/` - Express + TypeScript API server
   - `src/` - TypeScript source
     - `api/v1/` - route definitions (auth, user, school, student, subscription, communication)
     - `services/` - domain services and controllers (auth controller, user service, school service, etc.)
     - `middleware/` - Express middleware (auth checks, subscription guard)
     - `database/` - Postgres client wrapper and `schema.sql`
     - `config/` - env-based configuration
     - `scripts/` - helper scripts (DB check, firebase credential check)
   - `package.json`, `tsconfig.json`, `jest.config.js`
 
 - `frontend/` - Angular client
   - `src/` - Angular application
     - `app/` - components, pages, services
       - `pages/` - page components (dashboard, register, login, manage-school, students, communications, subscription)
       - `services/` - client-side API wrappers and AuthService
       - `components/` - shared components (loading spinner, modals)
     - `environments/` - `environment.ts` and `environment.prod.ts`
   - `angular.json`, `package.json`, `tsconfig.json`
 
 - `test/` - unit/integration tests (backend)
 
 ---
 
 ## High level architecture
 
 - The backend provides a JSON REST API secured by application JWTs (HS256) issued by the server. The server also accepts Firebase ID tokens (RS256) used for social auth flows.
 - The frontend handles UI routes and uses the `AuthService` to manage authentication state and tokens. Google sign-in uses the Firebase web SDK to acquire an ID token which is then exchanged with the backend.
 - The `SchoolService` and other services fetch and post data to the API. The app supports multiple schools per user; users can create and manage schools.
 - SMS communication uses a pluggable `sms.util.ts` service which currently interfaces with the configured SMS provider.
 
 ---
 
 ## Authentication flows (how it works now)
 
 Overview:
 
 - Local login/register: users register using phone + password. Backend stores hashed passwords (bcrypt) and issues an application JWT on successful login.
 - Social login (Google): the frontend signs the user in with Firebase (Google), gets a Firebase ID token (RS256). The backend uses a "local-first" exchange:
   1. The backend decodes the presented ID token *without verification* to extract user claims (email/phone).
   2. The backend checks the local users table for a matching user (by email or phone).
      - If no local user is found, the backend returns 404 (client should present a signup/registration flow).
   3. If a local user exists, the backend verifies the ID token using `firebase-admin`:
      - `firebase-admin.auth().verifyIdToken(idToken)` is used to validate the token signature (RS256) and audience.
      - If the token's audience (project) mismatches, the backend can optionally fallback to calling Google's `tokeninfo` endpoint for compatibility, but this is logged as a warning.
   4. On valid verification, the backend issues an application JWT (HS256) for subsequent API calls and returns it to the client.
 
 - Middleware behavior: the main auth middleware uses `jsonwebtoken` to verify application HS256 tokens for protected routes. If a token header indicates an RS* algorithm (Firebase ID token accidentally sent where an app token is expected), the middleware explicitly returns a JSON 401 with a helpful message (instead of raising an invalid algorithm exception).
 
 - Local-first rationale: the system avoids creating one-off user accounts purely from social tokens and requires a matching local user record. This prevents orphaned local accounts and gives admins more control.
 
 ---
 
 ## Environment variables
 
 Sensitive settings MUST be kept out of git. Use local `.env` files or your deployment secret store. Example `backend/.env.example` (DO NOT COMMIT real secrets):
 
 ```
 # Postgres
 DB_HOST=localhost
 DB_PORT=5432
 DB_NAME=bigezolite
 DB_USER=bigezo
 DB_PASSWORD=secret
 
 # App JWT
 JWT_SECRET=your_jwt_secret_here
 JWT_EXPIRES_IN=7d
 
 # Firebase admin (one of the options below)
 # Option 1: path to a service account json file
 FIREBASE_SERVICE_ACCOUNT_PATH=/path/to/serviceAccount.json
 
 # Option 2: stringified JSON
 # FIREBASE_SERVICE_ACCOUNT="{...}"
 
 # Option 3: client email + private key (use \n in env to represent newlines)
 # FIREBASE_CLIENT_EMAIL=your-firebase-client-email@your-project.iam.gserviceaccount.com
 # FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n"
 
 # Other
 PORT=3000
 
 ```
 
 Frontend: `frontend/src/environments/environment.ts` contains Firebase web SDK config (apiKey, authDomain, projectId, etc.). Keep production keys safe and follow Firebase best practices.
 
 ---
 
 ## Backend: important files & scripts
 
 - `src/index.ts` - server entrypoint. Initializes config, DB, and firebase-admin (using the environment options described above).
 - `src/api/v1/auth.routes.ts` - routes for `/api/v1/auth` (login, register, google exchange endpoints).
 - `src/middleware/auth.middleware.ts` - verifies application JWTs, detects RS* tokens and returns user-friendly 401s.
 - `src/services/auth/auth.controller.ts` - handles Google token exchange (local-first decode → verify with firebase-admin → issue app JWT).
 - `src/database/database.ts` - Postgres client wrapper used across services.
 - `scripts/check-db-connection.js` - quick script to confirm Postgres credentials and connectivity.
 - `scripts/check-firebase-cred.js` - validates firebase credential env options and checks private key format.
 
 Developer scripts in `backend/package.json`:
 
 - `npm run build` — compile TypeScript to `dist/`
 - `npm start` — run `node dist/index.js`
 - `npm test` — run tests (jest)
 
 ---
 
 ## Frontend: important files & UI flow
 
 - `src/app/app.component.ts` / `.html` / `.scss` — main shell with a sidenav, toolbar and global footer. `AuthService` is injected here to determine if a user is logged in and provides `logout()`.
 - `src/app/pages/dashboard/*` — dashboard page. Behavior updated:
   - If the user has no schools: shows a large centered "Create School Account" CTA.
   - If the user has one or more schools: shows a header with a smaller "Create New School" CTA top-right and lists each school as a large button (clicking navigates to the management page for that school).
 - `src/app/services/auth.service.ts` — handles storing app JWT, login and logout flows.
 - `src/app/services/school.service.ts` — fetches `listMySchools()` and `getMySchool()` used by the dashboard.
 
 Developer scripts in `frontend/package.json`:
 
 - `npm start` — run `ng serve` (development server)
 - `npm run build` — build production bundles
 
 ---
 
 ## How to run locally (quick start)
 
 Prereqs: Node.js (16+), npm, Postgres, Angular CLI (optional, dev only).
 
 1. Backend
 
 - Copy `backend/.env.example` to `backend/.env` and set real values (local DB, JWT secret, and firebase admin credentials). Do NOT commit `backend/.env`.
 - Install deps and build:
 
 ```powershell
 cd backend
 npm install
 npm run build
 ```
 
 - Start server:
 
 ```powershell
 npm start
 ```
 
 The server listens on `PORT` (default 3000). It will connect to Postgres and initialize firebase-admin using one of the supported env configs.
 
 2. Frontend
 
 - Configure Firebase web config in `frontend/src/environments/environment.ts`.
 - Install and run:
 
 ```powershell
 cd frontend
 npm install
 npm start
 ```
 
 - The dev server defaults to port 4200. If 4200 is busy, pass `-- --port 4300`.
 
 Open `http://localhost:4200` (or the chosen port).
 
 ---
 
 ## Troubleshooting
 
 - Backend fails to start: verify `backend/.env` values, Postgres is reachable, and `JWT_SECRET` is set.
 - firebase-admin aud mismatch: ensure the Firebase service account/project matches the frontend Firebase project used for client sign-in (the service account must belong to the same Firebase project that issued the ID tokens).
 - Invalid PEM/private key parsing: when using `FIREBASE_PRIVATE_KEY` in `.env`, newlines must be represented as `\n`. Example: `-----BEGIN PRIVATE KEY-----\nMIIB...\n-----END PRIVATE KEY-----\n`.
 - RS256 tokens causing HS256 verify errors: the auth middleware now detects RS* algs and returns a clear 401 JSON. If you see RS* token warnings, the frontend might be sending a Firebase ID token where an app JWT is expected — ensure the client exchanges ID token for an app JWT or uses the proper header.
 - Port 4200 busy: either kill the process using it or start dev server on another port using `npm start -- --port 4300`.
 
 ---
 
 ## Security guidance
 
 - Never commit `backend/.env`, service account JSON, private keys or production secrets.
 - Keep minimal scopes for service accounts and rotate keys when possible.
 - Use HTTPS in production and enable secure cookie/session settings if you switch to cookies.
 
 ---
 
 ## Next steps & suggestions
 
 - Implement optional admin endpoint to link existing local users to Firebase identities by phone.
 - Consider auto-provisioning for social login if desired (with admin review / email confirmation).
 - Add server-side rate-limiting and brute-force protections on auth endpoints.
 - Improve frontend bundle size by lazy-loading feature modules.
 - Add E2E tests and CI checks for auth flows.
 
 ---
 
 If you want, I can also:
 - Add a CONTRIBUTING.md and a developer quick-start script.
 - Run `npm start` for you and keep the dev server running on a free port.
 - Implement the admin phone-link endpoint.

This repository contains the backend and frontend for the BigezoLite project.

This README documents how to safely recreate local runtime files, set up
environment variables (without committing secrets), and run the helper scripts
that validate DB and Firebase credentials.

---

## Important local files (do NOT commit)

- `backend/.env` — local environment with secrets (ignored by git). Use
  `backend/.env.example` as the template.
- `backend/src/middleware/auth.middleware.ts` — runtime middleware (an example
  template `backend/src/middleware/auth.middleware.example.ts` is tracked).
- `backend/src/services/auth/auth.controller.ts` — runtime Google auth
  controller (an example template `backend/src/services/auth/auth.controller.example.ts` is tracked).

If you need to recreate the real runtime files, copy the examples into place:

```powershell
# from repo root
cp backend\src\middleware\auth.middleware.example.ts backend\src\middleware\auth.middleware.ts
cp backend\src\services\auth\auth.controller.example.ts backend\src\services\auth\auth.controller.ts
cp backend\.env.example backend\.env
```

Fill `backend/.env` with real values (DB credentials, `JWT_SECRET`, Firebase
service account info) and never commit it.

## Firebase service account (recommended)

Preferred options (in order):

1. Set `GOOGLE_APPLICATION_CREDENTIALS` to the path of a downloaded service
   account JSON (recommended for local dev).
2. Set `FIREBASE_SERVICE_ACCOUNT_PATH` in `backend/.env` to the JSON path.
3. Set `FIREBASE_SERVICE_ACCOUNT` to the minified JSON string in the env
   (less ideal, avoid committing).

See `backend/.env.example` for placeholders and the helper script that checks
for proper formatting.

## Helper scripts

From the repository root you can run these scripts to validate your local
setup (they load `backend/.env` if present):

- Validate Postgres connectivity:

```powershell
node .\backend\scripts\check-db-connection.js
```

- Validate Firebase credential presence/format:

```powershell
node .\backend\scripts\check-firebase-cred.js
```

## Build & run (backend)

```powershell
cd backend
npm run build
npm start
```

The backend reads `backend/.env` by default. If you prefer to specify a
different path, set `DOTENV_CONFIG_PATH` before `npm start`.

## Committing and secrets

- `backend/.env` is ignored by `.gitignore`. If you ever accidentally commit a
  secret, rotate it immediately (delete/recreate the service account key, or
  change the DB password / API key).
- `backend/.env.example` and the `*.example.ts` files are tracked and safe to
  commit. They provide a mirror-image template so you can recreate removed
  runtime files easily.

## Notes

- The repo contains runtime helpers and safer initialization code for
  `firebase-admin`. If you run into audience (`aud`) mismatch errors when
  verifying Firebase ID tokens, ensure the service account belongs to the
  same Firebase project that issues the tokens.

---

If you want, I can add convenient npm scripts (`check-db`, `check-firebase`) to
`backend/package.json` and open a pull request instead of committing directly.
# bigezolite

This repository contains the backend and frontend for the Bigezo Lite project.

- backend: Node.js + TypeScript API
- frontend: Angular application

See README files in each subfolder for project-specific instructions.
