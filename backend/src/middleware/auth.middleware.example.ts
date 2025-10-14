/*
  Example template: auth.middleware.example.ts

  Purpose: a safe, non-secret, placeholder version of the auth middleware you
  can commit to the repository so you (or a teammate) can recreate the real
  `auth.middleware.ts` file later by copying this file into place.

  To re-create the real file locally:
    cp backend/src/middleware/auth.middleware.example.ts backend/src/middleware/auth.middleware.ts
    # then edit the real file if you need to re-enable any application-specific logic

  This template intentionally avoids runtime secrets. The live environment
  should use `backend/.env` (which is in .gitignore) for secrets like JWT_SECRET.
*/

import { Request, Response, NextFunction } from 'express';

// Minimal example authenticated request interface
export interface AuthenticatedRequest extends Request {
  user?: { userId?: number; schoolId?: number };
}

export const authenticateToken = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  // Placeholder behaviour: check for an Authorization header and return 401 JSON
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ success: false, message: 'Missing Authorization header' });

  // In the real implementation the token would be verified using a JWT secret
  // and additional DB lookups performed. This template simply attaches a
  // dummy user for local development when copied into place.
  req.user = { userId: 1 };
  next();
};

export const authMiddleware = authenticateToken;
