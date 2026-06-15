"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv = __importStar(require("dotenv"));
dotenv.config();
const express_1 = __importDefault(require("express"));
// @ts-ignore
const lineClient_1 = require("../src/lineClient"); // Import from src
const config = {
    channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN || '',
    channelSecret: process.env.CHANNEL_SECRET || '',
};
console.log('Channel Config:', {
    accessTokenLength: config.channelAccessToken.length,
    channelSecretLength: config.channelSecret.length
});
const app = (0, express_1.default)();
// Vercel handles the port, so we don't strictly need app.listen in serverless context, 
// but it's good for local dev.
const port = process.env.PORT || 3000;
// Parse body as string first for debugging signature issues
app.use('/callback', express_1.default.raw({ type: '*/*' }));
// @ts-ignore
app.post('/callback', (req, res) => {
    // Signature validation manual step
    const signature = req.headers['x-line-signature'];
    const body = req.body.toString();
    console.log('Received Webhook:', { signature, bodyLength: body.length });
    // Use line middleware manually or check signature
    try {
        // if (!line.validateSignature(body, config.channelSecret, signature)) {
        //   throw new line.SignatureValidationFailed('signature validation failed');
        // }
        const events = JSON.parse(body).events;
        // @ts-ignore
        Promise.all(events.map(lineClient_1.handleEvent))
            .then((result) => res.json(result))
            .catch((err) => {
            console.error(err);
            res.status(500).end();
        });
    }
    catch (err) {
        console.error('Signature validation error:', err);
        res.status(401).send('Signature validation failed');
    }
});
// Export the app for Vercel
exports.default = app;
if (require.main === module) {
    app.listen(port, () => {
        console.log(`Server is running on port ${port}`);
    });
}
