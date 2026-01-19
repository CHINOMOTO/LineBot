import * as dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import * as line from '@line/bot-sdk';
import { handleEvent } from './lineClient';

const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN || '',
  channelSecret: process.env.CHANNEL_SECRET || '',
};

console.log('Channel Config:', {
  accessTokenLength: config.channelAccessToken.length,
  channelSecretLength: config.channelSecret.length
});

const app = express();
const port = process.env.PORT || 3000;

// Parse body as string first for debugging signature issues
app.use('/callback', express.raw({ type: '*/*' }));

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

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
