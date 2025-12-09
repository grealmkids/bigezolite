
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

export const order = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { schoolName, contactPhone, selectedPackage, numberOfSms, price } = req.body;

        // Persist the order for auditing; do not let DB failures block notifications
        try {
            const insertSql = `INSERT INTO orders (school_name, contact_phone, package_type, sms_count, price, status, meta)
                VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING order_id`;
            const meta = JSON.stringify({ createdBy: req.user?.userId || null });
            const insertRes = await pool.query(insertSql, [schoolName, contactPhone, selectedPackage, numberOfSms || null, price || null, 'pending', meta]);
            // optionally capture order id or tracking id
            const orderId = insertRes.rows?.[0]?.order_id;
            // attach tracking id to message
            if (orderId) {
                // it's fine if we don't use this further; helps debugging
                // eslint-disable-next-line no-unused-vars
                const trackingId = `ORD-${orderId}`;
            }
        } catch (dbErr) {
            console.error('Failed to persist order (non-fatal):', dbErr);
        }

        // Format numbers for human-readable notification (commas) but keep raw values in DB
        const nf = new Intl.NumberFormat('en-UG', { maximumFractionDigits: 0 });
        const formattedSms = typeof numberOfSms === 'number' ? nf.format(numberOfSms) : String(numberOfSms || '0');
        const formattedPrice = typeof price === 'number' ? nf.format(price) : String(price || '0');
        const message = `Bigezo App \nNew subscription order:\nSchool: ${schoolName}\nPhone: ${contactPhone}\nPackage: ${selectedPackage}\nSMS: ${formattedSms}\nPrice: UGX ${formattedPrice}`;

        // send SMS to GRealm number (configured in env)
        const to = config.sms.grealmNumber;
        if (to) {
            await sendSms(to, message);
        }

        // attempt to send email if SMTP config present in env
        // Accept either SMTP_USER/SMTP_PASS or EMAIL_USER/EMAIL_PASS and send to EMAIL_TO (preferred)
        const rawSmtpHost = process.env.SMTP_HOST;
        const rawSmtpUser = process.env.SMTP_USER || process.env.EMAIL_USER;
        const rawSmtpPass = process.env.SMTP_PASS || process.env.EMAIL_PASS;

        // helper to remove surrounding quotes and trim
        const clean = (v?: string) => {
            if (!v) return v;
            let s = v.trim();
            if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
                s = s.slice(1, -1);
            }
            return s.trim();
        };

        const smtpHost = clean(rawSmtpHost);
        const smtpUser = clean(rawSmtpUser);
        const smtpPass = clean(rawSmtpPass);

        if (smtpHost && smtpUser && smtpPass) {
            const smtpPort = Number(clean(process.env.SMTP_PORT)) || 587;
            const explicitSecure = String(clean(process.env.SMTP_SECURE || '')).toLowerCase() === 'true';
            const secure = explicitSecure || smtpPort === 465;

            const transporter = nodemailer.createTransport({
                host: smtpHost,
                port: smtpPort,
                secure,
                auth: {
                    user: smtpUser,
                    pass: smtpPass
                }
            });

            const toAddress = clean(process.env.EMAIL_TO) || clean(process.env.SMTP_TO) || smtpUser;
            const fromAddress = clean(process.env.SMTP_FROM) || clean(process.env.EMAIL_FROM) || smtpUser;

            try {
                await transporter.sendMail({
                    from: fromAddress,
                    to: toAddress,
                    subject: `New subscription order${schoolName ? ': ' + schoolName : ''}`,
                    text: message
                });
            } catch (mailErr) {
                // Log but don't fail the whole request
                console.error('Failed to send order email (non-fatal):', mailErr);
            }
        }

        // Try to update order status to 'notified' (best-effort)
        try {
            await pool.query(`UPDATE orders SET status = $1 WHERE order_id = (
                SELECT order_id FROM orders ORDER BY created_at DESC LIMIT 1
            )`, ['notified']);
        } catch (dbUpdErr) {
            console.error('Failed to update order status (non-fatal):', dbUpdErr);
        }

        res.json({ success: true, message: 'Order notified via SMS and email (if configured).' });
    } catch (error) {
        console.error('Order notification failed', error);
        res.status(500).json({ success: false, message: 'Order notification failed', error: String(error) });
    }
};
