/*
  Example template: auth.controller.example.ts

  This is a safe, scaffolded version of the Google auth controller so the
  implementation can be recreated later from the repository. It does NOT
  perform real Firebase verification or write secrets. Replace the file
  `backend/src/services/auth/auth.controller.ts` with the real implementation
  when restoring from a backup.

  To re-create the real file locally:
    cp backend/src/services/auth/auth.controller.example.ts backend/src/services/auth/auth.controller.ts
    # then edit the real file to provide real JWT secret and firebase creds

*/

import { Request, Response } from 'express';

// Minimal example googleAuth handler that follows the same contract
export const googleAuth = async (req: Request, res: Response) => {
  const { idToken } = req.body;
  if (!idToken) return res.status(400).json({ success: false, message: 'idToken is required' });

  // In the real controller we'd decode/verify the ID token and lookup the
  // user in the database. This example simulates a not-found user response
  // so clients will show the sign-up flow.
  return res.status(404).json({ success: false, message: 'Account does not exist. Please sign up.' });
};

export const __auth_controller_module_marker = true;
