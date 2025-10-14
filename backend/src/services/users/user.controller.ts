
import { Request, Response } from 'express';
import * as userService from './user.service';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import admin from 'firebase-admin';
import { query } from '../../database/database';

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

    const { password_hash, ...userWithoutPassword } = user;
    return res.status(201).json(userWithoutPassword);
  } catch (error) {
    console.error(error);
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

    res.json({ token });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
