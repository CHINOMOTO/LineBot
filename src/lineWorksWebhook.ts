import * as crypto from 'crypto';
import {
    sendLineWorksMessageToUser,
    sendLineWorksMessageToChannel,
    sendLineWorksMessage,
    getLineWorksUserName
} from './lineWorksClient';
import { appendAttendanceRow, updateAttendanceRow, getTodayAttendance } from './sheetsClient';

/**
 * LINE WORKS BotのBot Secretを使い、Webhookの署名を検証する
 */
function verifySignature(rawBody: string, signature: string): boolean {
    const botSecret = process.env.LINEWORKS_BOT_SECRET || '';
    if (!botSecret) {
        console.warn('LINEWORKS_BOT_SECRET is not set. Skipping signature verification.');
        return true; // 開発中は署名スキップ
    }
    const hmac = crypto.createHmac('sha256', botSecret);
    hmac.update(rawBody);
    const computed = hmac.digest('base64');
    return computed === signature;
}

/**
 * LINE WORKS Webhookのメインハンドラ
 */
export async function handleLineWorksWebhook(
    event: any,
    rawBody: string,
    signature: string
): Promise<void> {
    // 署名検証
    if (!verifySignature(rawBody, signature)) {
        console.error('LINE WORKS webhook signature verification failed.');
        return;
    }

    // メッセージイベント以外は無視
    if (event.type !== 'message') {
        console.log(`Ignoring LINE WORKS event type: ${event.type}`);
        return;
    }

    // テキスト以外は無視
    if (!event.content || event.content.type !== 'text') {
        return;
    }

    const userId: string = event.source?.userId;
    const channelId: string | undefined = event.source?.channelId;

    if (!userId) {
        console.error('userId not found in LINE WORKS webhook event');
        return;
    }

    const text: string = (event.content.text || '').trim();

    // 返信用ヘルパー（channelIdがあればチャンネルへ、なければユーザーへ直接返信）
    const reply = async (message: string) => {
        if (channelId) {
            await sendLineWorksMessageToChannel(channelId, message);
        } else {
            await sendLineWorksMessageToUser(userId, message);
        }
    };

    const now = new Date();
    const timeString = now.toLocaleString('ja-JP', {
        timeZone: 'Asia/Tokyo',
        hour: '2-digit',
        minute: '2-digit'
    });

    try {
        // --- ID確認 ---
        if (text === 'ID') {
            await reply(`あなたのUser IDは:\n${userId}`);
            return;
        }

        // --- 勤怠コマンド以外は無視 ---
        if (!['出勤', '現場到着', '退勤'].includes(text)) {
            return;
        }

        // ユーザー名取得
        const userName = await getLineWorksUserName(userId);

        // --- 出勤 ---
        if (text === '出勤') {
            const existing = await getTodayAttendance(userId);
            if (existing && existing.clockIn) {
                await reply(`本日は既に出勤済みです (${existing.clockIn})。\nもし間違いであればスプレッドシートを修正してください。`);
                return;
            }
            await appendAttendanceRow(userId, userName, timeString);
            // 管理者への通知
            await sendLineWorksMessage(`【出勤報告】\n${userName} さんが出勤しました。\n時刻: ${timeString}`);
            await reply(`${userName}さん、\n出勤を受け付けました (${timeString})`);
            return;
        }

        // --- 現場到着 ---
        if (text === '現場到着') {
            const attendance = await getTodayAttendance(userId);
            if (!attendance || !attendance.clockIn) {
                await reply('まずは「出勤」してください。');
                return;
            }
            if (attendance.clockOut) {
                await reply('本日の業務は既に終了（退勤済み）しています。');
                return;
            }
            if (attendance.arrival) {
                await reply(`現場到着は既に記録済みです (${attendance.arrival})。`);
                return;
            }
            await updateAttendanceRow(userId, 'arrival', timeString);
            await sendLineWorksMessage(`【現場到着】\n${userName} さんが現場に到着しました。\n時刻: ${timeString}`);
            await reply(`現場到着を記録しました (${timeString})。`);
            return;
        }

        // --- 退勤 ---
        if (text === '退勤') {
            const attendance = await getTodayAttendance(userId);
            if (!attendance || !attendance.clockIn) {
                await reply('本日の出勤データが見つかりません。まずは「出勤」してください。');
                return;
            }
            if (attendance.clockOut) {
                await reply(`本日は既に退勤済みです (${attendance.clockOut})。\nお疲れ様でした！`);
                return;
            }
            await updateAttendanceRow(userId, 'clockOut', timeString);
            await sendLineWorksMessage(`【退勤報告】\n${userName} さんが退勤しました。\n時刻: ${timeString}\nお疲れ様でした。`);

            const liffUrl = `https://liff.line.me/${process.env.LIFF_ID || ''}`;
            await reply(
                `${userName}さん、\n退勤を記録しました (${timeString})。\n\n残業があった場合は、以下のリンクから報告してください:\n${liffUrl}`
            );
            return;
        }

    } catch (e: any) {
        console.error('Error processing LINE WORKS webhook:', e);
        await reply(`エラーが発生しました。\n詳細: ${e.message}`);
    }
}
