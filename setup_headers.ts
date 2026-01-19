import { google } from 'googleapis';
import * as path from 'path';
import * as fs from 'fs';

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
    let auth: any;
    try {
        if (fs.existsSync(KEY_FILE_PATH)) {
            const keyFileContent = fs.readFileSync(KEY_FILE_PATH, 'utf-8');
            const credentials = JSON.parse(keyFileContent);
            if (credentials.private_key) {
                credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
            }
            auth = new google.auth.GoogleAuth({
                credentials,
                scopes: SCOPES,
            });
        }
    } catch (error) {
        console.error('Failed to load credentials:', error);
        return;
    }

    const sheets = google.sheets({ version: 'v4', auth });

    // Headers to add
    const headers = ['日付', 'User ID', '名前', '出勤', '現場到着', '退勤'];

    try {
        // Get sheet name (defaulting to first sheet)
        const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
        const sheetTitle = meta.data.sheets?.[0]?.properties?.title || 'Sheet1';

        // Update the first row (A1:F1)
        await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `${sheetTitle}!A1:F1`,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
                values: [headers],
            },
        });

        console.log(`Successfully added headers to ${sheetTitle}!`);
        console.log('Headers:', headers.join(', '));

    } catch (error: any) {
        console.error('Failed to add headers:', error.response?.data || error);
    }
}

main();
