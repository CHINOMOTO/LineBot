import * as jwt from 'jsonwebtoken';

/**
 * LINE WORKS API v2.0 サービスアカウント認証用のアクセストークンを取得する
 */
async function getAccessToken(): Promise<string> {
    const clientId = process.env.LINEWORKS_CLIENT_ID;
    const clientSecret = process.env.LINEWORKS_CLIENT_SECRET;
    const serviceAccount = process.env.LINEWORKS_SERVICE_ACCOUNT;
    const privateKeyRaw = process.env.LINEWORKS_PRIVATE_KEY;

    if (!clientId || !clientSecret || !serviceAccount || !privateKeyRaw) {
        throw new Error('Missing LINE WORKS API credentials in environment variables.');
    }

    // 環境変数に改行コード文字がある場合の置換
    const privateKey = privateKeyRaw.replace(/\\n/g, '\n');

    // JWT（Assertion）の作成
    const iat = Math.floor(Date.now() / 1000);
    const exp = iat + 3600; // 1時間有効

    const payload = {
        iss: clientId,
        sub: serviceAccount,
        iat: iat,
        exp: exp
    };

    const token = jwt.sign(payload, privateKey, { algorithm: 'RS256' });

    // アクセストークンリクエスト
    const params = new URLSearchParams();
    params.append('grant_type', 'urn:ietf:params:oauth:grant-type:jwt-bearer');
    params.append('assertion', token);
    params.append('client_id', clientId);
    params.append('client_secret', clientSecret);
    params.append('scope', 'bot');

    const res = await fetch('https://auth.worksmobile.com/oauth2/v2.0/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params
    });

    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`LINE WORKS token request failed: ${res.status} ${errText}`);
    }

    const data = await res.json() as any;
    return data.access_token;
}

/**
 * 登録された管理者のLINE WORKSアカウントへ通知を送信する
 */
export async function sendLineWorksMessage(messageText: string): Promise<void> {
    const botId = process.env.LINEWORKS_BOT_ID;
    const adminUserIdsRaw = process.env.LINEWORKS_ADMIN_USER_IDS;

    // 設定がない場合はスキップ
    if (!botId || !adminUserIdsRaw) {
        return;
    }

    const adminUserIds = adminUserIdsRaw.split(',').map(id => id.trim()).filter(id => id);
    if (adminUserIds.length === 0) {
        return;
    }

    try {
        const token = await getAccessToken();

        for (const userId of adminUserIds) {
            // メールアドレス等の場合はURLエンコードが必要
            const encodedUserId = encodeURIComponent(userId);
            const url = `https://www.worksapis.com/v1.0/bots/${botId}/users/${encodedUserId}/messages`;

            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json; charset=UTF-8'
                },
                body: JSON.stringify({
                    content: {
                        type: 'text',
                        text: messageText
                    }
                })
            });

            if (!res.ok) {
                const errText = await res.text();
                console.error(`Failed to send LINE WORKS message to ${userId}:`, errText);
            } else {
                console.log(`Successfully sent LINE WORKS message to ${userId}`);
            }
        }
    } catch (error) {
        console.error('Error sending LINE WORKS notification:', error);
    }
}
