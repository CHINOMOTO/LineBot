import * as line from '@line/bot-sdk';
import { appendAttendanceRow, updateAttendanceRow, getTodayAttendance } from './sheetsClient';

const config = {
    channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN || '',
    channelSecret: process.env.CHANNEL_SECRET || '',
};

const client = new line.Client(config);
const ADMIN_USER_ID = process.env.ADMIN_USER_ID || '';

// Helper to get user display name (Simplified: just fetch from LINE)
async function getUserName(userId: string): Promise<string> {
    try {
        const profile = await client.getProfile(userId);
        return profile.displayName;
    } catch (e) {
        console.error('Failed to get LINE profile:', e);
        return 'ゲスト';
    }
}

export const handleEvent = async (event: line.WebhookEvent) => {
    if (event.type !== 'message' || event.message.type !== 'text') {
        return Promise.resolve(null);
    }

    const userId = event.source.userId;
    if (!userId) {
        return Promise.resolve(null);
    }

    const text = event.message.text.trim();
    const replyToken = event.replyToken;

    try {
        // --- 名前変更 ---
        if (text.startsWith('名前変更')) {
            return client.replyMessage(replyToken, {
                type: 'text',
                text: '申し訳ありません。「名前変更」機能はスプレッドシート移行に伴い一時停止中です。\nスプレッドシートの「名前」列を直接修正してください。',
            });
        }

        // --- ID確認 ---
        if (text === 'ID') {
            return client.replyMessage(replyToken, {
                type: 'text',
                text: `あなたのUser IDは: ${userId}`,
            });
        }

        // --- 共通処理: ユーザー特定と名前取得 ---
        if (!['出勤', '現場到着', '退勤'].includes(text)) {
            return Promise.resolve(null);
        }

        // 名前を取得 (DBを使わずLINEから直接取得)
        const userName = await getUserName(userId);
        const now = new Date();
        const timeString = now.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit' });

        // --- 出勤 ---
        if (text === '出勤') {
            // 本日既にデータがあるかチェック (Sheetsから取得)
            const existingAttendance = await getTodayAttendance(userId);
            if (existingAttendance && existingAttendance.clockIn) {
                return client.replyMessage(replyToken, {
                    type: 'text',
                    text: `本日は既に出勤済みです (${existingAttendance.clockIn})。\nもし間違いであれば管理者に連絡するか、スプレッドシートを修正してください。`,
                });
            }

            // Sheetsに追記
            await appendAttendanceRow(userId, userName, timeString);

            // 管理者通知
            if (ADMIN_USER_ID) {
                await client.pushMessage(ADMIN_USER_ID, {
                    type: 'text',
                    text: `【出勤報告】\n${userName} さんが出勤しました。\n時刻: ${timeString}`,
                });
            }

            return client.replyMessage(replyToken, {
                type: 'text',
                text: `${userName}さん、\n出勤を受け付けました (${timeString})`,
            });
        }

        // --- 現場到着 ---
        if (text === '現場到着') {
            // Sheetsから取得
            const attendance = await getTodayAttendance(userId);
            if (!attendance || !attendance.clockIn) {
                return client.replyMessage(replyToken, {
                    type: 'text',
                    text: 'まずは「出勤」としてください。',
                });
            }

            // 既に退勤済みならエラー
            if (attendance.clockOut) {
                return client.replyMessage(replyToken, {
                    type: 'text',
                    text: '本日の業務は既に終了（退勤済み）しています。',
                });
            }

            // 既に到着済みならエラー
            if (attendance.arrival) {
                return client.replyMessage(replyToken, {
                    type: 'text',
                    text: `現場到着は既に記録済みです (${attendance.arrival})。`,
                });
            }

            // Sheets更新
            await updateAttendanceRow(userId, 'arrival', timeString);

            if (ADMIN_USER_ID) {
                await client.pushMessage(ADMIN_USER_ID, {
                    type: 'text',
                    text: `【現場到着】\n${userName} さんが現場に到着しました。\n時刻: ${timeString}`,
                });
            }

            return client.replyMessage(replyToken, {
                type: 'text',
                text: `現場到着を記録しました (${timeString})。`,
            });
        }

        // --- 退勤 ---
        if (text === '退勤') {
            // Sheetsから取得
            const attendance = await getTodayAttendance(userId);
            if (!attendance || !attendance.clockIn) {
                return client.replyMessage(replyToken, {
                    type: 'text',
                    text: '本日の出勤データが見つかりません。まずは「出勤」してください。',
                });
            }

            // 既に退勤済みならエラー
            if (attendance.clockOut) {
                return client.replyMessage(replyToken, {
                    type: 'text',
                    text: `本日は既に退勤済みです (${attendance.clockOut})。\nお疲れ様でした！`,
                });
            }

            // Sheets更新
            await updateAttendanceRow(userId, 'clockOut', timeString);

            if (ADMIN_USER_ID) {
                await client.pushMessage(ADMIN_USER_ID, {
                    type: 'text',
                    text: `【退勤報告】\n${userName} さんが退勤しました。\n時刻: ${timeString}\nお疲れ様でした。`,
                });
            }

            return client.replyMessage(replyToken, {
                type: 'text',
                text: `${userName}さん、\n退勤を記録しました (${timeString})`,
            });
        }

    } catch (e: any) {
        console.error('Error processing event:', e);
        return client.replyMessage(replyToken, {
            type: 'text',
            text: `システムエラーが発生しました。\n詳細: ${e.message}`,
        });
    }

    return Promise.resolve(null);
};
