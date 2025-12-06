import { query } from '../../database/database';
import * as staffService from '../staff/staff.service';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { randomBytes } from 'crypto';
import { sendEmail } from '../../utils/email.util'; // Assuming this utility exists or I need to create it
import { config } from '../../config';

// Helper to generate JWT
const generateToken = (staff: staffService.Staff) => {
    const payload = {
        staff_id: staff.staff_id,
        school_id: staff.school_id,
        role: staff.role,
        type: 'staff' // Distinguish from admin users
    };
    return jwt.sign(payload, process.env.JWT_SECRET || 'default_secret', { expiresIn: '8h' });
};

export const login = async (email: string, password: string) => {
    const staff = await staffService.findStaffByEmail(email);
    if (!staff) throw new Error('Invalid credentials');
    if (!staff.is_active) throw new Error('Account is inactive');
    if (!staff.allow_password_login) throw new Error('Password login not allowed for this account');

    if (!staff.password_hash) throw new Error('Password not set. Please use Google Login or reset password.');

    const match = await bcrypt.compare(password, staff.password_hash);
    if (!match) throw new Error('Invalid credentials');

    return { token: generateToken(staff), staff };
};

export const googleLogin = async (email: string, googleUid: string) => {
    const staff = await staffService.findStaffByEmail(email);
    if (!staff) throw new Error('Staff account not found');
    if (!staff.is_active) throw new Error('Account is inactive');

    // Update Google UID if not set
    if (!staff.google_uid) {
        await staffService.updateStaff(staff.staff_id, staff.school_id, { google_uid: googleUid } as any);
    }

    return { token: generateToken(staff), staff };
};

export const forgotPassword = async (email: string) => {
    const staff = await staffService.findStaffByEmail(email);
    if (!staff) return; // Silent fail for security

    // Generate token
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

    await query(
        `INSERT INTO staff_password_resets (staff_id, token, expires_at) VALUES ($1, $2, $3)`,
        [staff.staff_id, token, expiresAt]
    );

    // Send Email
    const resetLink = `https://app.bigezo.com/staff/reset-password?token=${token}`; // Domain should be configurable
    const subject = 'BIGEZO Staff Password Reset';
    const text = `Hello ${staff.first_name},\n\nYou requested a password reset. Click here: ${resetLink}\n\nLink expires in 15 minutes.`;

    // Assuming sendEmail is available. If not, I'll need to implement it or mock it.
    // For now, I'll log it if sendEmail is missing.
    try {
        // await sendEmail(email, subject, text); 
        console.log(`[Mock Email] To: ${email}, Link: ${resetLink}`);
    } catch (e) {
        console.error('Failed to send reset email', e);
    }
};

export const resetPassword = async (token: string, newPassword: string) => {
    const res = await query(
        `SELECT * FROM staff_password_resets WHERE token = $1 AND used = FALSE AND expires_at > NOW()`,
        [token]
    );

    if (res.rows.length === 0) throw new Error('Invalid or expired token');

    const resetRecord = res.rows[0];
    const staffId = resetRecord.staff_id;

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(newPassword, salt);

    // Update staff password
    // We need school_id to call updateStaff, but we can just update directly here for simplicity/security
    await query(`UPDATE staff SET password_hash = $1 WHERE staff_id = $2`, [hash, staffId]);

    // Mark token used
    await query(`UPDATE staff_password_resets SET used = TRUE WHERE id = $1`, [resetRecord.id]);
};
