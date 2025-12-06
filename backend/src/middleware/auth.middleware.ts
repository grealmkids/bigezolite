
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { query } from '../database/database';

// We are extending the default Express Request object
// to hold our custom payload data after auth.
export interface AuthenticatedRequest extends Request {
  user?: {
    userId: number;
    schoolId?: number;
  };
}

export const authenticateToken = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (token == null) {
    return res.status(401).json({ success: false, message: 'Missing Authorization header' });
  }
  // Quick guard: detect tokens that are signed with RSA (eg. Firebase ID tokens use RS256)
  // and return a clear error. This avoids confusing JsonWebTokenError: invalid algorithm
  // logs when a Firebase ID token is accidentally stored as the app auth token.
  try {
    const parts = token.split('.');
    if (parts.length === 3) {
      const headerJson = Buffer.from(parts[0], 'base64').toString('utf8');
      const header = JSON.parse(headerJson);
      const alg = header?.alg?.toString?.() || '';
      if (alg.toUpperCase().startsWith('RS')) {
        // Rate-limit the warning per client IP to avoid log spam when a misconfigured
        // frontend repeatedly sends Firebase ID tokens where our app tokens are expected.
        try {
          const ip = (req.headers['x-forwarded-for'] as string) || req.ip || req.connection.remoteAddress || 'unknown';
          const now = Date.now();
          // Store timestamps in a module-level map (simple in-memory rate limit)
          // Keyed by IP. We'll keep warnings once per minute per IP.
          if (!(global as any).__rsTokenWarns) (global as any).__rsTokenWarns = new Map<string, number>();
          const warns: Map<string, number> = (global as any).__rsTokenWarns;
          const last = warns.get(ip) || 0;
          if (now - last > 60_000) {
            warns.set(ip, now);
            console.warn('Received RS* token for HS256 endpoint from', ip, '; client likely stored a Firebase ID token as app token.');
          }
        } catch (ex) {
          // best-effort logging; don't block authentication flow
          console.warn('Received RS* token for HS256 endpoint; client likely stored a Firebase ID token as app token.');
        }
        return res.status(401).json({ success: false, message: 'Unexpected token type: received an RS256 (Firebase) token. Clear stored token and sign in using the application login flow.' });
      }
    }
  } catch (e) {
    // ignore parsing errors and proceed to normal verification which will handle bad tokens
  }

  try {
    let payload: any;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET || 'your_default_secret') as { userId: number };
    } catch (jwtErr: any) {
      // Distinguish between invalid token vs algorithm/key mismatches and surface
      // a 401 (Unauthorized) so the client can re-authenticate. Log a concise
      // message for debugging; avoid printing full stacks for routine auth failures.
      console.debug('JWT verification failed:', jwtErr?.message || String(jwtErr));
      return res.status(401).json({ success: false, message: 'Invalid or expired authentication token.' });
    }

    // Attach the user ID from the token to the request
    req.user = { userId: payload.userId };

    // If payload has school_id (e.g. staff token), use it
    if (payload.school_id) {
      req.user.schoolId = payload.school_id;
    }

    // Prioritize schoolId from header (explicit selection)
    const headerSchoolId = req.headers['x-school-id'];
    if (headerSchoolId) {
      req.user.schoolId = parseInt(headerSchoolId as string, 10);
    } else {
      // Fallback to session or DB defaults
      const sess: any = (req as any).session;
      if (sess && typeof sess.schoolId !== 'undefined') {
        req.user.schoolId = sess.schoolId as number;
      } else {
        // Fallback to fetching the user's most recent school_id for data isolation.
        // When a user has multiple schools, we pick the most recently created one.
        const schoolQuery = 'SELECT school_id FROM schools WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1';
        const schoolResult = await query(schoolQuery, [payload.userId]);

        if (schoolResult.rows.length > 0) {
          req.user.schoolId = schoolResult.rows[0].school_id;
        }
      }
    }

    console.log('[auth.middleware] token:', token);
    console.log('[auth.middleware] userId:', payload.userId, 'schoolId:', req.user.schoolId);

    next();
  } catch (err) {
    console.error('Authentication error:', err);
    // Fallback: if anything unexpected happens, return 401 to indicate
    // authentication failure rather than 403 which implies permissions.
    return res.status(401).json({ success: false, message: 'Authentication failed.' });
  }
};

// Backwards-compatible export name used elsewhere in the codebase
export const authMiddleware = authenticateToken;
