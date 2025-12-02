
import { Request, Response } from 'express';
import * as userService from './user.service';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import admin from 'firebase-admin';
import { query } from '../../database/database';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { sendSms } from '../../utils/sms.util';
import { config } from '../../config';

export const register = async (req: Request, res: Response) => {
  try {
    const { email, password, fullName, phoneNumber } = req.body;

    // Require the four mandatory fields
    if (!email || !password || !fullName || !phoneNumber) {
      return res.status(400).json({ message: 'fullName, email, phoneNumber and password are required' });
    }

    // Check for existing local user first
    const existingUser = await userService.findUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({ message: 'User already exists' });
    }

    // Create local DB user only (manual sign-up). Do NOT call Firebase here.
    const user = await userService.createUser(email, password, fullName, phoneNumber);

    // Notify G-Realm studio about new registration via SMS (non-blocking)
    try {
      const grealm = config.sms.grealmNumber || process.env.GREALMNUMBER;
      if (grealm) {
        const msg = `New Bigezo sign-up: ${fullName} (${email}) Phone:${phoneNumber}`;
        // sendSms will pick up SMS_API_URL / SMS_USERNAME / SMS_PASSWORD from config/env when no creds passed
        await sendSms(grealm, msg);
        console.info('[users.register] Notified G-Realm via SMS');
      } else {
        console.debug('[users.register] GREALMNUMBER not configured; skipping SMS notify');
      }
    } catch (smsErr: any) {
      console.error('[users.register] failed to send notification SMS:', smsErr?.message || smsErr);
      // Do not fail registration if SMS fails
    }

    const { password_hash, ...userWithoutPassword } = user;
    return res.status(201).json(userWithoutPassword);
  } catch (error: any) {
    console.error(error);
    if (error.code === '23505') {
      if (error.constraint === 'users_phone_number_key') {
        return res.status(409).json({ message: 'Phone number already in use' });
      } else if (error.constraint === 'users_email_key') {
        return res.status(409).json({ message: 'Email already in use' });
      }
    }
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    // Accept either email or phoneNumber as the "username" for login
    const { email, phoneNumber, password } = req.body;

    let user: any = null;
    if (email) {
      user = await userService.findUserByEmail(email);
    } else if (phoneNumber) {
      user = await userService.findUserByPhone(phoneNumber);
    } else {
      return res.status(400).json({ message: 'Provide email or phoneNumber and password' });
    }
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });

    const payload = { userId: user.user_id };
    const token = jwt.sign(payload, process.env.JWT_SECRET || 'your_default_secret', { expiresIn: '1h' });

    // Fetch school to get account_status
    const school = await userService.findSchoolByUserId(user.user_id);
    const account_status = school ? school.account_status : null;

    res.json({ token, account_status });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// GET /api/v1/users/me
export const me = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user || !req.user.userId) return res.status(401).json({ message: 'Not authenticated' });
    const sql = 'SELECT user_id, email, full_name FROM users WHERE user_id = $1 LIMIT 1';
    const result = await query(sql, [req.user.userId]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'User not found' });
    const user = result.rows[0];
    const isAdmin = typeof process.env.ADMIN_ACCOUNT === 'string' && process.env.ADMIN_ACCOUNT.trim().toLowerCase() === (user.email || '').toLowerCase();
    return res.json({ user_id: user.user_id, email: user.email, full_name: user.full_name, isAdmin });
  } catch (err: any) {
    console.error('GET /users/me error:', err?.message || err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
