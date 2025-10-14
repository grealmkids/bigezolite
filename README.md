# bigezolite

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
