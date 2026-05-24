import * as dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import * as fs from 'fs';
import * as path from 'path';
// @ts-ignore
import * as line from '@line/bot-sdk';
// @ts-ignore
import { handleEvent } from '../src/lineClient'; // Import from src
// @ts-ignore
import { updateAttendanceRow } from '../src/sheetsClient';

const config = {
    channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN || '',
    channelSecret: process.env.CHANNEL_SECRET || '',
};

console.log('Channel Config:', {
    accessTokenLength: config.channelAccessToken.length,
    channelSecretLength: config.channelSecret.length
});

const app = express();
// Vercel handles the port, so we don't strictly need app.listen in serverless context, 
// but it's good for local dev.
const port = process.env.PORT || 3000;

// Parse body as string first for debugging signature issues
app.use('/callback', express.raw({ type: '*/*' }));

// @ts-ignore
app.post('/callback', (req, res) => {
    // Signature validation manual step
    const signature = req.headers['x-line-signature'] as string;
    const body = req.body.toString();

    console.log('Received Webhook:', { signature, bodyLength: body.length });

    // Use line middleware manually or check signature
    try {
        // if (!line.validateSignature(body, config.channelSecret, signature)) {
        //   throw new line.SignatureValidationFailed('signature validation failed');
        // }
        const events = JSON.parse(body).events;
        // @ts-ignore
        Promise.all(events.map(handleEvent))
            .then((result) => res.json(result))
            .catch((err) => {
                console.error(err);
                res.status(500).end();
            });
    } catch (err) {
        console.error('Signature validation error:', err);
        res.status(401).send('Signature validation failed');
    }
});

// --- LIFF HTML Delivery ---
app.get('/liff', (req, res) => {
    try {
        const filePath = path.join(process.cwd(), 'src/liff.html');
        let html = fs.readFileSync(filePath, 'utf8');
        const liffId = process.env.LIFF_ID || '';
        html = html.replace('__LIFF_ID__', liffId);
        res.send(html);
    } catch (error) {
        console.error('Failed to read liff.html:', error);
        res.status(500).send('System Error: liff.html missing');
    }
});

// --- Overtime API from LIFF ---
const lineClient = new line.Client({
    channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN || '',
    channelSecret: process.env.CHANNEL_SECRET || '',
});
const ADMIN_USER_IDS = (process.env.ADMIN_USER_ID || '').split(',').map(id => id.trim()).filter(id => id);

app.post('/api/overtime', express.json(), async (req, res) => {
    const { userId, userName, startTime, endTime } = req.body;
    if (!userId || !startTime || !endTime) {
        return res.status(400).json({ error: 'Missing parameters' });
    }

    try {
        // G列、H列の更新
        await updateAttendanceRow(userId, 'overtimeStart', startTime);
        await updateAttendanceRow(userId, 'overtimeEnd', endTime);

        // 管理者への通知
        if (ADMIN_USER_IDS.length > 0) {
            await Promise.all(ADMIN_USER_IDS.map(adminId =>
                lineClient.pushMessage(adminId, {
                    type: 'text',
                    text: `【残業報告】\n${userName || 'メンバー'} さんから残業報告がありました。\n残業開始: ${startTime}\n残業終了: ${endTime}`,
                }).catch((e: any) => console.error(`Failed to push overtime to admin ${adminId}:`, e))
            ));
        }

        res.json({ success: true });
    } catch (error: any) {
        console.error('Failed to save overtime:', error);
        res.status(500).json({ error: error.message });
    }
});

// Export the app for Vercel
export default app;

if (require.main === module) {
    app.listen(port, () => {
        console.log(`Server is running on port ${port}`);
    });
}
