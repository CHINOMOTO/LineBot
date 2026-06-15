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
Object.defineProperty(exports, "__esModule", { value: true });
const googleapis_1 = require("googleapis");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
const KEY_FILE_PATH = path.join(__dirname, 'service_account.json');
require('dotenv').config(); // Load .env file
const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID || '';
async function main() {
    if (!SPREADSHEET_ID) {
        console.error('GOOGLE_SPREADSHEET_ID is missing.');
        return;
    }
    // Load auth (copying logic from sheetsClient.ts)
    let auth;
    try {
        if (fs.existsSync(KEY_FILE_PATH)) {
            const keyFileContent = fs.readFileSync(KEY_FILE_PATH, 'utf-8');
            const credentials = JSON.parse(keyFileContent);
            if (credentials.private_key) {
                credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
            }
            auth = new googleapis_1.google.auth.GoogleAuth({
                credentials,
                scopes: SCOPES,
            });
        }
    }
    catch (error) {
        console.error('Failed to load credentials:', error);
        return;
    }
    const sheets = googleapis_1.google.sheets({ version: 'v4', auth });
    // Headers to add
    const headers = ['日付', 'User ID', '名前', '出勤', '現場到着', '退勤', '残業開始', '残業終了'];
    try {
        // Get sheet name (defaulting to first sheet)
        const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
        const sheetTitle = meta.data.sheets?.[0]?.properties?.title || 'Sheet1';
        // Update the first row (A1:H1)
        await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `${sheetTitle}!A1:H1`,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
                values: [headers],
            },
        });
        console.log(`Successfully added headers to ${sheetTitle}!`);
        console.log('Headers:', headers.join(', '));
    }
    catch (error) {
        console.error('Failed to add headers:', error.response?.data || error);
    }
}
main();
