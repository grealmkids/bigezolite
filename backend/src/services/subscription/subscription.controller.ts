
import { Response } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import * as subscriptionService from '../../services/subscription/subscription.service';
import nodemailer from 'nodemailer';
import { config } from '../../config';
import { sendSms } from '../../utils/sms.util';
import { pool } from '../../database/database';

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


// Helper to generate branded HTML email (Admin Version)
const generateOrderEmailHtml = (data: {
    title: string;
    schoolName: string;
    contactPhone: string;
    packageType: string;
    smsCount: string;
    price: string;
    timestamp: string;
    trackingId?: string;
}): string => {
    const trackingRow = data.trackingId ? `
    <tr>
        <td class="label">Tracking ID:</td>
        <td class="value" style="color: #003366; font-weight: bold;">${data.trackingId}</td>
    </tr>` : '';

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
            .label { font-weight: bold; color: #555; width: 130px; }
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
                <div class="title">${data.title}</div>
                <table class="details-table">
                    ${trackingRow}
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

// Client Confirmation Email Template
const generateClientEmailHtml = (data: {
    trackingId: string;
    schoolName: string;
    packageType: string;
    smsCount: string;
    price: string;
    timestamp: string;
    supportPhone: string;
    supportEmail: string;
}): string => {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body { font-family: 'Trebuchet MS', sans-serif; background-color: #f4f4f4; margin: 0; padding: 20px; }
            .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
            .header { background-color: #003366; color: #ffffff; padding: 20px; text-align: center; }
            .header h1 { margin: 0; font-size: 24px; }
            .content { padding: 30px; }
            .text-block { color: #444; font-size: 16px; line-height: 1.6; margin-bottom: 20px; }
            .highlight-box { background-color: #fff8e1; border-left: 5px solid #FF8C00; padding: 15px; margin-bottom: 20px; }
            .tracking-label { font-size: 14px; color: #888; text-transform: uppercase; letter-spacing: 1px; }
            .tracking-id { font-size: 24px; font-weight: bold; color: #003366; margin-top: 5px; }
            .details-list { list-style: none; padding: 0; margin: 0; }
            .details-list li { padding: 8px 0; border-bottom: 1px solid #f0f0f0; color: #555; }
            .footer { background-color: #f9f9f9; padding: 15px; text-align: center; font-size: 12px; color: #888; border-top: 1px solid #eee; }
            .contact-info { font-weight: bold; color: #003366; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Order Received</h1>
            </div>
            <div class="content">
                <div class="text-block">
                    Dear <strong>${data.schoolName}</strong>,
                    <br>We have received your subscription order.
                </div>

                <div class="highlight-box">
                    <div class="tracking-label">Order Tracking ID</div>
                    <div class="tracking-id">${data.trackingId}</div>
                </div>

                <div class="text-block">
                    <ul class="details-list">
                        <li><strong>Package:</strong> ${data.packageType}</li>
                        <li><strong>SMS Bundle:</strong> ${data.smsCount}</li>
                        <li><strong>Amount:</strong> UGX ${data.price}</li>
                        <li><strong>Date:</strong> ${data.timestamp}</li>
                    </ul>
                </div>

                <div class="text-block">
                    Our team is processing your request. If you need assistance, please contact us:
                    <br>Phone: <span class="contact-info">${data.supportPhone}</span>
                    <br>Email: <span class="contact-info">${data.supportEmail}</span>
                </div>
            </div>
            <div class="footer">
                &copy; ${new Date().getFullYear()} Bigezo App. Thank you for choosing us.
            </div>
        </div>
    </body>
    </html>
    `;
};

export const order = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { schoolName, contactPhone, selectedPackage, numberOfSms, price } = req.body;
        const userId = req.user?.userId;

        // Fetch User Email for Client Notification
        let clientEmail = '';
        if (userId) {
            try {
                const userRes = await pool.query('SELECT email FROM users WHERE user_id = $1', [userId]);
                clientEmail = userRes.rows[0]?.email || '';
            } catch (e) {
                console.error('Failed to fetch user email', e);
            }
        }

        // Support Details from ENV
        const supportPhone = process.env.APP_ORDERS || '0773913902';
        const supportEmail = process.env.APP_ORDERS_EMAIL || 'sales@bigezo.com';

        let orderId: number | null = null;
        let trackingId: string | null = null;

        // Insert Order
        try {
            const insertSql = `INSERT INTO orders (school_name, contact_phone, package_type, sms_count, price, status, meta)
                VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING order_id`;
            const meta = JSON.stringify({ createdBy: userId || null });
            const insertRes = await pool.query(insertSql, [schoolName, contactPhone, selectedPackage, numberOfSms || null, price || null, 'pending', meta]);
            orderId = insertRes.rows?.[0]?.order_id;

            // Generate & Update Tracking ID
            if (orderId) {
                trackingId = `ORD-${orderId}`; // Simple, unique ID based on PK
                // You could add random suffix for security if needed: `ORD-${orderId}-${Math.floor(Math.random()*1000)}`
                await pool.query('UPDATE orders SET tracking_id = $1 WHERE order_id = $2', [trackingId, orderId]);
            }
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

        const adminMessage = `Bigezo App \nNew subscription order:\nID: ${trackingId || 'N/A'}\nSchool: ${schoolName}\nPhone: ${contactPhone}\nPackage: ${selectedPackage}\nSMS: ${formattedSms}\nPrice: UGX ${formattedPrice}\nDate: ${timestamp}`;
        const clientSmsMessage = `Bigezo App: Order Received. ID: ${trackingId || 'N/A'}. We are processing your ${selectedPackage} subscription. Call ${supportPhone} for help.`;

        // SMS Notifications
        // 1. To Admin (GRealm number)
        const adminPhone = config.sms.grealmNumber;
        if (adminPhone) await sendSms(adminPhone, adminMessage);

        // 2. To Client (contactPhone)
        if (contactPhone) await sendSms(contactPhone, clientSmsMessage);

        // Email Notifications
        const rawSmtpHost = process.env.SMTP_HOST;
        const rawSmtpUser = process.env.SMTP_USER || process.env.EMAIL_USER;
        const rawSmtpPass = process.env.SMTP_PASS || process.env.EMAIL_PASS;

        // Use APP_ORDERS_EMAIL as the main support email, fallback to ADMIN_ACCOUNT
        const adminEmail = process.env.APP_ORDERS_EMAIL || process.env.ADMIN_ACCOUNT || process.env.EMAIL_TO || rawSmtpUser;

        if (rawSmtpHost && rawSmtpUser && rawSmtpPass) {
            const clean = (v?: string) => v ? v.replace(/^['"]|['"]$/g, '').trim() : '';
            const port = Number(clean(process.env.SMTP_PORT)) || 587;
            const isSecure = String(clean(process.env.SMTP_SECURE || '')).toLowerCase() === 'true' || port === 465;

            const transporter = nodemailer.createTransport({
                host: clean(rawSmtpHost),
                port: port,
                secure: isSecure,
                // Removed pool: true as it can cause timeouts on some setups
                connectionTimeout: 60000, // 60s
                greetingTimeout: 30000, // 30s
                socketTimeout: 60000, // 60s
                auth: { user: clean(rawSmtpUser), pass: clean(rawSmtpPass) }
            });
            const sender = clean(process.env.SMTP_FROM || process.env.EMAIL_FROM || rawSmtpUser);

            // 1. Send Admin Email (Now targets APP_ORDERS_EMAIL)
            if (adminEmail) {
                const adminHtml = generateOrderEmailHtml({
                    title: 'New Subscription Order',
                    schoolName, contactPhone, packageType: selectedPackage,
                    smsCount: formattedSms, price: formattedPrice, timestamp,
                    trackingId: trackingId || undefined
                });
                transporter.sendMail({ from: sender, to: clean(adminEmail), subject: `New Order: ${schoolName}`, html: adminHtml }).catch(e => console.error('Admin Email Fail:', e));
            }

            // 2. Send Client Email
            if (clientEmail) {
                const clientHtml = generateClientEmailHtml({
                    trackingId: trackingId || 'Pending',
                    schoolName, packageType: selectedPackage,
                    smsCount: formattedSms, price: formattedPrice, timestamp,
                    supportPhone, supportEmail
                });
                transporter.sendMail({ from: sender, to: clientEmail, subject: `Order Receipt: ${trackingId}`, html: clientHtml }).catch(e => console.error('Client Email Fail:', e));
            }
        }

        // Update status for debugging (Best Effort)
        if (orderId) {
            await pool.query("UPDATE orders SET status = 'notified' WHERE order_id = $1", [orderId]).catch(() => { });
        }

        res.json({ success: true, message: 'Order submitted. Tracking ID: ' + (trackingId || 'Pending') });
    } catch (error) {
        console.error('Order notification failed', error);
        res.status(500).json({ success: false, message: 'Order notification failed', error: String(error) });
    }
};
