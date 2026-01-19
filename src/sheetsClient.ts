import { google } from 'googleapis';
import * as path from 'path';
import * as fs from 'fs';

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

// Service Account Key File Path
const KEY_FILE_PATH = path.join(__dirname, '../service_account.json');

// Spreadsheet ID (Needs to be set in .env or passed)
const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID || '';

// Load credentials manually
let auth: any;
try {
    let credentials;
    // Prio 1: Load from Environment Variable (Cloud)
    if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
        credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
    }
    // Prio 2: Load from File (Local)
    else if (fs.existsSync(KEY_FILE_PATH)) {
        const keyFileContent = fs.readFileSync(KEY_FILE_PATH, 'utf-8');
        credentials = JSON.parse(keyFileContent);
    }

    if (credentials) {
        // Critical Fix: Replace literal \n with actual newlines
        // And use credentials object directly with GoogleAuth
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
}

const sheets = google.sheets({ version: 'v4', auth });

/**
 * Gets the title of the first sheet in the spreadsheet.
 */
async function getFirstSheetTitle(): Promise<string | null> {
    if (!SPREADSHEET_ID) return null;
    try {
        const meta = await sheets.spreadsheets.get({
            spreadsheetId: SPREADSHEET_ID,
        });
        const sheetsList = meta.data.sheets;
        if (sheetsList && sheetsList.length > 0 && sheetsList[0].properties) {
            return sheetsList[0].properties.title || 'Sheet1';
        }
    } catch (error: any) {
        console.error('Failed to get spreadsheet metadata:', error.response ? error.response.data : error);
    }
    return 'Sheet1'; // Default fallback
}

/**
 * Appends a new attendance row to the spreadsheet.
 * Format: [Date, User ID, Name, Clock-In, Arrival, Clock-Out]
 */
export async function appendAttendanceRow(
    userId: string,
    userName: string,
    clockInTime: string
) {
    if (!SPREADSHEET_ID) {
        console.error('GOOGLE_SPREADSHEET_ID is not set.');
        return;
    }

    const today = new Date().toLocaleDateString('ja-JP');

    // Auto-detect the sheet name
    const sheetTitle = await getFirstSheetTitle();

    try {
        await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: `${sheetTitle}!A:F`,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
                values: [[today, userId, userName, clockInTime, '', '']],
            },
        });
        console.log(`Appended clock-in to spreadsheet [${sheetTitle}].`);
    } catch (error: any) {
        // Detailed error logging
        console.error('Failed to append to spreadsheet:',
            error.response ? JSON.stringify(error.response.data, null, 2) : error
        );
    }
}

/**
 * Updates an existing row for Arrival or Clock-Out.
 */
export async function updateAttendanceRow(
    userId: string,
    type: 'arrival' | 'clockOut',
    timeString: string
) {
    if (!SPREADSHEET_ID) {
        return;
    }

    const today = new Date().toLocaleDateString('ja-JP');
    const sheetTitle = await getFirstSheetTitle();

    try {
        // 1. Read existing data to find the row index
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `${sheetTitle}!A:F`,
        });

        const rows = response.data.values;
        if (!rows || rows.length === 0) {
            console.log('No data found in spreadsheet.');
            return;
        }

        // Find the last row that matches today's date and user ID
        let targetRowIndex = -1;
        for (let i = rows.length - 1; i >= 0; i--) {
            const row = rows[i];
            // row[0] is Date, row[1] is User ID
            if (row[0] === today && row[1] === userId) {
                targetRowIndex = i + 1; // Sheets API is 1-indexed
                break;
            }
        }

        if (targetRowIndex === -1) {
            console.log(`Target row for update not found for user ${userId} on ${today}.`);
            return;
        }

        // 2. Update the specific cell
        // Arrival is column E (index 4), Clock-Out is column F (index 5)
        // A=0, B=1, C=2, D=3(ClockIn), E=4(Arrival), F=5(ClockOut)
        const columnLetter = type === 'arrival' ? 'E' : 'F';
        const range = `${sheetTitle}!${columnLetter}${targetRowIndex}`;

        await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: range,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
                values: [[timeString]],
            },
        });

        console.log(`Updated ${type} in spreadsheet [${sheetTitle}] at row ${targetRowIndex}.`);

    } catch (error: any) {
        console.error(`Failed to update ${type} in spreadsheet:`,
            error.response ? JSON.stringify(error.response.data, null, 2) : error
        );
    }
}

/**
 * Gets today's attendance record for a user.
 * Returns an object with clockIn, arrival, clockOut times if found, or null.
 */
export async function getTodayAttendance(userId: string) {
    if (!SPREADSHEET_ID) return null;

    const today = new Date().toLocaleDateString('ja-JP');
    const sheetTitle = await getFirstSheetTitle();

    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `${sheetTitle}!A:F`,
        });

        const rows = response.data.values;
        if (!rows || rows.length === 0) return null;

        // Search in reverse to find the latest record for today
        for (let i = rows.length - 1; i >= 0; i--) {
            const row = rows[i];
            // Row format: [Date, UserId, Name, ClockIn, Arrival, ClockOut]
            if (row[0] === today && row[1] === userId) {
                return {
                    clockIn: row[3] || null,
                    arrival: row[4] || null,
                    clockOut: row[5] || null
                };
            }
        }
    } catch (error: any) {
        console.error('Failed to get attendance:', error.response ? error.response.data : error);
    }
    return null;
}
