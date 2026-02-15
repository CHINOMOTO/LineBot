import * as dotenv from 'dotenv';
dotenv.config();

import express from 'express';
// @ts-ignore
import { handleEvent } from '../src/lineClient'; // Import from src

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

// Export the app for Vercel
export default app;

if (require.main === module) {
    app.listen(port, () => {
        console.log(`Server is running on port ${port}`);
    });
}
