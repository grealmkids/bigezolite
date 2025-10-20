
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

        const message = `New subscription order:\nSchool: ${schoolName}\nPhone: ${contactPhone}\nPackage: ${selectedPackage}\nSMS: ${numberOfSms}\nPrice: UGX ${price}`;

        // send SMS to GRealm number (configured in env)
        const to = config.sms.grealmNumber;
        if (to) {
            await sendSms(to, message);
        }

        // attempt to send email if SMTP config present in env
        // Accept either SMTP_USER/SMTP_PASS or EMAIL_USER/EMAIL_PASS and send to EMAIL_TO (preferred)
        const smtpHost = process.env.SMTP_HOST;
        const smtpUser = process.env.SMTP_USER || process.env.EMAIL_USER;
        const smtpPass = process.env.SMTP_PASS || process.env.EMAIL_PASS;
        if (smtpHost && smtpUser && smtpPass) {
            const transporter = nodemailer.createTransport({
                host: smtpHost,
                port: Number(process.env.SMTP_PORT) || 587,
                secure: process.env.SMTP_SECURE === 'true',
                auth: {
                    user: smtpUser,
                    pass: smtpPass
                }
            });

            const toAddress = process.env.EMAIL_TO || process.env.SMTP_TO || smtpUser;
            const fromAddress = process.env.SMTP_FROM || process.env.EMAIL_FROM || smtpUser;

            await transporter.sendMail({
                from: fromAddress,
                to: toAddress,
                subject: `New subscription order: ${schoolName}`,
                text: message
            });
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
