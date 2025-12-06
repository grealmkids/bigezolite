import { Request, Response } from 'express';
import * as staffAuthService from './staff-auth.service';

export const login = async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ message: 'Email and password required' });

        const result = await staffAuthService.login(email, password);
        return res.json(result);
    } catch (error: any) {
        console.error('Staff Login Error:', error.message);
        return res.status(401).json({ message: error.message || 'Login failed' });
    }
};

export const googleLogin = async (req: Request, res: Response) => {
    try {
        const { email, googleUid } = req.body; // In real app, verify ID token here
        if (!email || !googleUid) return res.status(400).json({ message: 'Email and Google UID required' });

        const result = await staffAuthService.googleLogin(email, googleUid);
        return res.json(result);
    } catch (error: any) {
        console.error('Staff Google Login Error:', error.message);
        return res.status(401).json({ message: error.message || 'Login failed' });
    }
};

export const forgotPassword = async (req: Request, res: Response) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ message: 'Email required' });

        await staffAuthService.forgotPassword(email);
        return res.json({ message: 'If the email exists, a reset link has been sent.' });
    } catch (error: any) {
        console.error('Forgot Password Error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

export const resetPassword = async (req: Request, res: Response) => {
    try {
        const { token, newPassword } = req.body;
        if (!token || !newPassword) return res.status(400).json({ message: 'Token and new password required' });

        await staffAuthService.resetPassword(token, newPassword);
        return res.json({ message: 'Password reset successfully' });
    } catch (error: any) {
        console.error('Reset Password Error:', error.message);
        return res.status(400).json({ message: error.message || 'Reset failed' });
    }
};
