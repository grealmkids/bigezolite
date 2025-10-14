import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import admin from 'firebase-admin';
import { query } from '../../database/database';

// Initialize firebase-admin if not already initialized. Support providing a
// service account JSON via env var FIREBASE_SERVICE_ACCOUNT (stringified JSON).
if (!admin.apps.length) {
  try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const svc = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      admin.initializeApp({ credential: admin.credential.cert(svc as admin.ServiceAccount) });
    } else {
      // Will use application default credentials if available in the environment.
      admin.initializeApp();
    }
  } catch (e) {
    console.warn('Failed to initialize firebase-admin with provided credentials, continuing — verifying tokens may fail if credentials are missing.', e);
    try {
      admin.initializeApp();
    } catch (err) {
      // swallow: verification may still work if not required
    }
  }
}

// POST /api/v1/auth/google
export const googleAuth = async (req: Request, res: Response) => {
  const { idToken } = req.body;
  if (!idToken) return res.status(400).json({ success: false, message: 'idToken is required' });

  try {
    // Decode token WITHOUT verifying to extract email and check local users table first.
    // This prevents us from calling firebase-admin.verifyIdToken for emails that do
    // not exist locally (per PRD change). We'll only verify the token with firebase
    // after confirming a local user exists.
    let decodedUnverified: any;
    try {
      // jwt.decode does not verify signature; it's safe here because we'll verify later
      decodedUnverified = jwt.decode(idToken) as any;
      console.debug('Google auth: decoded (unverified) token preview:', { email: decodedUnverified?.email, aud: decodedUnverified?.aud, name: decodedUnverified?.name, sub: decodedUnverified?.sub });
    } catch (e) {
      decodedUnverified = null;
      console.warn('Google auth: failed to decode ID token (unverified):', String(e));
    }
    const maybeEmail = decodedUnverified?.email;
    if (!maybeEmail) {
      return res.status(400).json({ success: false, message: 'Unable to extract email from ID token.' });
    }

    // Check local users table first (local-first flow). If user doesn't exist, return
    // a clear message so the frontend shows sign-up flow. Do NOT call firebase-admin.
    const localCheckSql = 'SELECT * FROM users WHERE email = $1 LIMIT 1';
    console.debug('Google auth: checking local users table for email:', maybeEmail);
    const localRes = await query(localCheckSql, [maybeEmail]);
    const localUser = localRes.rows[0];
    console.debug('Google auth: local lookup result rows=', localRes.rowCount);
    if (!localUser) {
      console.info('Google auth: no local user for email, returning 404 to client:', maybeEmail);
      return res.status(404).json({ success: false, message: 'Account does not exist. Please sign up.' });
    }

    // Prefer verifying Firebase ID tokens via firebase-admin (these are the
    // tokens produced by client SDKs after sign-inWithPopup/signInWithCredential).
    // In some dev / multi-project setups the ID token 'aud' claim may not match
    // the service account project used by firebase-admin. To support a safe
    // fallback (opt-in via env) we call Google's tokeninfo endpoint to decode
    // and validate the token if firebase-admin reports an audience mismatch.
    let decoded: any;
    try {
      decoded = await admin.auth().verifyIdToken(idToken);
    } catch (err: any) {
      // If the project mismatch occurs and fallback is allowed, attempt tokeninfo.
      // For developer convenience allow the fallback when not in production so local
      // testing across multiple Firebase projects works without changing env vars.
      const allowFallback = process.env.ALLOW_TOKENINFO_FALLBACK === 'true' || process.env.NODE_ENV !== 'production';
      const debug = process.env.DEBUG === 'true';
      const isAudError = err?.errorInfo?.message?.toLowerCase().includes('aud') ||
        err?.message?.toLowerCase().includes('aud');

      if (isAudError && allowFallback) {
        try {
          if (!debug) {
            // Keep logs minimal when fallback is enabled to avoid noisy stack traces
            console.warn('Firebase admin verifyIdToken failed with aud mismatch; using tokeninfo fallback.');
          } else {
            console.error('Firebase admin verifyIdToken error (aud mismatch):', err);
          }
          // Call Google's tokeninfo endpoint to validate the token and read the payload.
          // Use a runtime-safe fetch: prefer global fetch (Node 18+), otherwise try to
          // require 'node-fetch' if available. If neither is present, surface a
          // clear error so the environment can be adjusted.
          const fetchFn = (globalThis as any).fetch ?? (async (...args: any[]) => {
            try {
              // Lazy require to avoid adding a hard dependency; if node-fetch is
              // not installed, this will throw and we'll handle below.
              // eslint-disable-next-line @typescript-eslint/no-var-requires
              const nf = require('node-fetch');
              return nf(...args);
            } catch (e) {
              throw new Error('Fetch is not available in this Node runtime. Upgrade to Node 18+ or install node-fetch.');
            }
          });

          const resp = await fetchFn(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
          if (!resp || !resp.ok) throw new Error(`tokeninfo returned ${resp?.status}`);
          decoded = await resp.json();
          // tokeninfo does not include 'uid' like firebase-admin; leave uid undefined.
        } catch (fallbackErr) {
          console.error('Token verification fallback failed:', fallbackErr);
          throw err; // rethrow original admin error to be handled below
        }
      } else {
        throw err; // not recoverable here
      }
    }

  const email = decoded.email;
  const firebaseUid = decoded.uid;

  if (!email) return res.status(400).json({ success: false, message: 'ID token missing email.' });

  // localUser already fetched above
  let user = localUser;

    if (!user) {
      // Auto-provision local user row for Firebase-authenticated user
      try {
        // Ensure full_name is not null to satisfy DB constraints. Prefer Firebase name,
        // otherwise fall back to the email local-part or a generic placeholder.
        const fallbackName = (decoded && decoded.name) ? decoded.name : (email ? email.split('@')[0] : 'User');
        const insertSql = 'INSERT INTO users (email, full_name, google_id) VALUES ($1, $2, $3) RETURNING *';
        console.debug('Google auth: attempting to auto-provision user:', { email, fallbackName, firebaseUidPresent: !!firebaseUid });
        const insertRes = await query(insertSql, [email, fallbackName, firebaseUid]);
        user = insertRes.rows[0];
        console.info('Google auth: auto-provisioned local user id=', user?.user_id, 'email=', email);
      } catch (e: any) {
        console.error('Google auth: Failed to auto-provision local user for google sign-in. Error:', e?.message || e, e?.stack ? '\n' + e.stack : '');
        return res.status(500).json({ success: false, message: 'Failed to create local user record.' });
      }
    }

    // Generate app JWT (HS256 symmetric token)
    const payloadJwt = { userId: user.user_id };
    const token = jwt.sign(payloadJwt, process.env.JWT_SECRET || 'your_default_secret', { expiresIn: '1h' });

    // Optionally update user's google_id / firebase uid if not set
    if (!user.google_id && firebaseUid) {
      try {
        console.debug('Google auth: saving google_id for user_id=', user.user_id);
        await query('UPDATE users SET google_id = $1 WHERE user_id = $2', [firebaseUid, user.user_id]);
        console.info('Google auth: saved google_id for user_id=', user.user_id);
      } catch (e: any) {
        console.warn('Google auth: Failed to save google_id for user:', e?.message || e);
      }
    }

    return res.json({ success: true, user: { user_id: user.user_id, email: user.email, full_name: user.full_name }, token });
  } catch (error: any) {
    console.error('Google login verification error:', error);
    // Provide clearer, yet safe, messages for common failure modes.
    // - auth/argument-error or aud mismatch => 401 with guidance
    // - anything else => generic 401
    const errMsg = error?.errorInfo?.message || error?.message || 'Failed to verify ID token. Ensure the client sent a valid Firebase ID token.';
    // If it's clearly an audience/argument error, keep 401 but return that explanation
    if (errMsg.toLowerCase().includes('aud')) {
      return res.status(401).json({ success: false, message: `ID token audience mismatch: ${errMsg}` });
    }
    return res.status(401).json({ success: false, message: errMsg });
  }
};

// no-op export to ensure module visibility to the TS language server
export const __auth_controller_module_marker = true;
