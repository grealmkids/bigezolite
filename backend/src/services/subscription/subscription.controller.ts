
import { Response } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import * as subscriptionService from '../../services/subscription/subscription.service';

export const initiatePayment = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const schoolId = req.user?.schoolId;
        const { packageType } = req.body;

        if (!schoolId) {
            return res.status(403).json({ message: 'Forbidden: User is not associated with a school.' });
        }

        const response = await subscriptionService.initiatePayment(schoolId, packageType);
        res.json(response);

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

export const getPaymentStatus = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { orderTrackingId } = req.params;
        const status = await subscriptionService.getPaymentStatus(orderTrackingId);
        res.json(status);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

import nodemailer from 'nodemailer';
import { config } from '../../config';
import { sendSms } from '../../utils/sms.util';
import { pool } from '../../database/database';

// Helper to generate branded HTML email
const generateOrderEmailHtml = (data: {
    schoolName: string;
    contactPhone: string;
    packageType: string;
    smsCount: string;
    price: string;
    timestamp: string;
}): string => {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body { font-family: 'Trebuchet MS', sans-serif; background-color: #f4f4f4; margin: 0; padding: 20px; }
            .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
            .header { background-color: #003366; color: #ffffff; padding: 20px; text-align: center; } /* Dark Blue */
            .header h1 { margin: 0; font-size: 24px; }
            .content { padding: 30px; }
            .title { color: #FF8C00; font-size: 18px; font-weight: bold; margin-bottom: 20px; border-bottom: 2px solid #4CAF50; padding-bottom: 10px; } /* Orange & Green */
            .details-table { width: 100%; border-collapse: collapse; }
            .details-table td { padding: 12px; border-bottom: 1px solid #eeeeee; }
            .label { font-weight: bold; color: #555; width: 120px; }
            .value { color: #333; font-size: 16px; }
            .footer { background-color: #f9f9f9; padding: 15px; text-align: center; font-size: 12px; color: #888; border-top: 1px solid #eee; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Bigezo App</h1>
            </div>
            <div class="content">
                <div class="title">New Subscription Order</div>
                <table class="details-table">
                    <tr>
                        <td class="label">School:</td>
                        <td class="value">${data.schoolName}</td>
                    </tr>
                    <tr>
                        <td class="label">Phone:</td>
                        <td class="value">${data.contactPhone}</td>
                    </tr>
                    <tr>
                        <td class="label">Package:</td>
                        <td class="value">${data.packageType}</td>
                    </tr>
                    <tr>
                        <td class="label">SMS:</td>
                        <td class="value">${data.smsCount}</td>
                    </tr>
                    <tr>
                        <td class="label">Price:</td>
                        <td class="value">UGX ${data.price}</td>
                    </tr>
                    <tr>
                        <td class="label">Date:</td>
                        <td class="value">${data.timestamp}</td>
                    </tr>
                </table>
            </div>
            <div class="footer">
                &copy; ${new Date().getFullYear()} Bigezo App. All rights reserved.
            </div>
        </div>
    </body>
    </html>
    `;
};

export const order = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { schoolName, contactPhone, selectedPackage, numberOfSms, price } = req.body;

        // Persist the order for auditing
        try {
            const insertSql = `INSERT INTO orders (school_name, contact_phone, package_type, sms_count, price, status, meta)
                VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING order_id`;
            const meta = JSON.stringify({ createdBy: req.user?.userId || null });
            await pool.query(insertSql, [schoolName, contactPhone, selectedPackage, numberOfSms || null, price || null, 'pending', meta]);
        } catch (dbErr) {
            console.error('Failed to persist order (non-fatal):', dbErr);
        }

        // Format data
        const nf = new Intl.NumberFormat('en-UG', { maximumFractionDigits: 0 });
        const formattedSms = typeof numberOfSms === 'number' ? nf.format(numberOfSms) : String(numberOfSms || '0');
        const formattedPrice = typeof price === 'number' ? nf.format(price) : String(price || '0');

        // Timestamp
        const now = new Date();
        const timestamp = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + ', ' +
            now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

        const message = `Bigezo App \nNew subscription order:\nSchool: ${schoolName}\nPhone: ${contactPhone}\nPackage: ${selectedPackage}\nSMS: ${formattedSms}\nPrice: UGX ${formattedPrice}\nDate: ${timestamp}`;

        // send SMS to GRealm number
        const to = config.sms.grealmNumber;
        if (to) {
            await sendSms(to, message);
        }

        // Email Notification
        const rawSmtpHost = process.env.SMTP_HOST;
        const rawSmtpUser = process.env.SMTP_USER || process.env.EMAIL_USER;
        const rawSmtpPass = process.env.SMTP_PASS || process.env.EMAIL_PASS;
        const adminEmail = process.env.ADMIN_ACCOUNT || process.env.EMAIL_TO || rawSmtpUser; // Fallback chain

        if (rawSmtpHost && rawSmtpUser && rawSmtpPass && adminEmail) {
            const clean = (v?: string) => v ? v.replace(/^['"]|['"]$/g, '').trim() : '';
            const smtpHost = clean(rawSmtpHost);
            const smtpUser = clean(rawSmtpUser);
            const smtpPass = clean(rawSmtpPass);
            const smtpPort = Number(clean(process.env.SMTP_PORT)) || 587;
            const secure = String(clean(process.env.SMTP_SECURE || '')).toLowerCase() === 'true' || smtpPort === 465;

            const transporter = nodemailer.createTransport({
                host: smtpHost,
                port: smtpPort,
                secure,
                auth: { user: smtpUser, pass: smtpPass }
            });

            const htmlContent = generateOrderEmailHtml({
                schoolName,
                contactPhone,
                packageType: selectedPackage,
                smsCount: formattedSms,
                price: formattedPrice,
                timestamp
            });

            try {
                await transporter.sendMail({
                    from: clean(process.env.SMTP_FROM || process.env.EMAIL_FROM || smtpUser),
                    to: clean(adminEmail),
                    subject: `New Subscription Order: ${schoolName}`,
                    text: message, // fallback
                    html: htmlContent
                });
                console.log(`Order email sent to ${adminEmail}`);
            } catch (mailErr) {
                console.error('Failed to send order email (non-fatal):', mailErr);
            }
        } else {
            console.warn('Skipping email: Missing SMTP config or ADMIN_ACCOUNT');
        }

        // Try to update order status to 'notified'
        try {
            await pool.query(`UPDATE orders SET status = $1 WHERE order_id = (
                SELECT order_id FROM orders ORDER BY created_at DESC LIMIT 1
            )`, ['notified']);
        } catch (dbUpdErr) { /* ignore */ }

        res.json({ success: true, message: 'Order notified successfully.' });
    } catch (error) {
        console.error('Order notification failed', error);
        res.status(500).json({ success: false, message: 'Order notification failed', error: String(error) });
    }
};
