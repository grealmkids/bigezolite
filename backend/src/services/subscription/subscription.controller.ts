
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

export const order = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { schoolName, contactPhone, selectedPackage, numberOfSms, price } = req.body;

        const message = `New subscription order:\nSchool: ${schoolName}\nPhone: ${contactPhone}\nPackage: ${selectedPackage}\nSMS: ${numberOfSms}\nPrice: UGX ${price}`;

        // send SMS to GRealm number (configured in env)
        const to = config.sms.grealmNumber;
        if (to) {
            await sendSms(to, message);
        }

        // attempt to send email if SMTP config present in env (common vars: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS)
        if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
            const transporter = nodemailer.createTransport({
                host: process.env.SMTP_HOST,
                port: Number(process.env.SMTP_PORT) || 587,
                secure: process.env.SMTP_SECURE === 'true',
                auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASS
                }
            });

            await transporter.sendMail({
                from: process.env.SMTP_FROM || process.env.SMTP_USER,
                to: process.env.SMTP_TO || process.env.SMTP_USER,
                subject: `New subscription order: ${schoolName}`,
                text: message
            });
        }

        res.json({ success: true, message: 'Order notified via SMS and email (if configured).' });
    } catch (error) {
        console.error('Order notification failed', error);
        res.status(500).json({ success: false, message: 'Order notification failed', error: String(error) });
    }
};
