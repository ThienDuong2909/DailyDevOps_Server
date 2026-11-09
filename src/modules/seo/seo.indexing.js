const SITE_URL = process.env.SITE_URL || 'https://dailydevops.blog';
const INDEXNOW_KEY = process.env.INDEXNOW_KEY || 'dailydevops_seo_index';

class SeoIndexingService {
    /**
     * Submit URLs to IndexNow (Bing, Yandex, etc.)
     */
    async notifyIndexNow(urls) {
        if (!Array.isArray(urls) || urls.length === 0) return { success: false, reason: 'Empty URLs' };
        try {
            const host = new URL(SITE_URL).host;
            const payload = {
                host,
                key: INDEXNOW_KEY,
                keyLocation: `${SITE_URL}/${INDEXNOW_KEY}.txt`,
                urlList: urls,
            };

            const response = await fetch('https://api.indexnow.org/indexnow', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json; charset=utf-8' },
                body: JSON.stringify(payload),
            });

            console.log(`[IndexNow] Notified ${urls.length} URL(s), response status: ${response.status}`);
            return { success: response.ok, status: response.status };
        } catch (error) {
            console.error('[IndexNow] Notification error:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Submit URL to Google Indexing API
     */
    async notifyGoogle(url, type = 'URL_UPDATED') {
        const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
        const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

        if (!clientEmail || !privateKey) {
            console.log(`[Google Indexing] Service Account not configured in ENV. URL logged: ${url} (${type})`);
            return { success: false, reason: 'Credentials not configured' };
        }

        try {
            const token = await this.getGoogleAccessToken(clientEmail, privateKey);
            if (!token) throw new Error('Failed to obtain Google access token');

            const response = await fetch('https://indexing.googleapis.com/v3/urlNotifications:publish', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ url, type }),
            });

            let data;
            const responseText = await response.text();
            try {
                data = JSON.parse(responseText);
            } catch {
                data = { raw: responseText };
            }

            console.log(`[Google Indexing] Published ${url} (${type}), status: ${response.status}:`, data);
            return { success: response.ok, status: response.status, data };
        } catch (error) {
            console.error(`[Google Indexing] Failed for ${url}:`, error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Helper to obtain Google OAuth token via WebCrypto JWT
     */
    async getGoogleAccessToken(clientEmail, privateKeyPem) {
        try {
            const now = Math.floor(Date.now() / 1000);
            const header = { alg: 'RS256', typ: 'JWT' };
            const claim = {
                iss: clientEmail,
                scope: 'https://www.googleapis.com/auth/indexing',
                aud: 'https://oauth2.googleapis.com/token',
                exp: now + 3600,
                iat: now,
            };

            const encodedHeader = this.base64Url(JSON.stringify(header));
            const encodedClaim = this.base64Url(JSON.stringify(claim));
            const signatureInput = `${encodedHeader}.${encodedClaim}`;

            const pemHeader = '-----BEGIN PRIVATE KEY-----';
            const pemFooter = '-----END PRIVATE KEY-----';
            const pemContents = privateKeyPem
                .replace(pemHeader, '')
                .replace(pemFooter, '')
                .replace(/\\n/g, '')
                .replace(/\s+/g, '');
            const binaryDer = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

            const cryptoKey = await crypto.subtle.importKey(
                'pkcs8',
                binaryDer.buffer,
                { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
                false,
                ['sign']
            );

            const signature = await crypto.subtle.sign(
                'RSASSA-PKCS1-v1_5',
                cryptoKey,
                new TextEncoder().encode(signatureInput)
            );

            const jwt = `${signatureInput}.${this.base64Url(String.fromCharCode(...new Uint8Array(signature)))}`;

            const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                    assertion: jwt,
                }),
            });

            const tokenJson = await tokenRes.json();
            return tokenJson.access_token || null;
        } catch (err) {
            console.error('[Google Indexing] JWT generation error:', err.message);
            return null;
        }
    }

    base64Url(str) {
        return btoa(str).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    }

    /**
     * Notify both Google and IndexNow when a post is published, updated, or removed
     */
    async notifyPost(slug, action = 'PUBLISHED') {
        const postUrl = `${SITE_URL}/${slug}`;
        const type = action === 'DELETED' ? 'URL_DELETED' : 'URL_UPDATED';

        const [googleRes, indexNowRes] = await Promise.allSettled([
            this.notifyGoogle(postUrl, type),
            this.notifyIndexNow([postUrl]),
        ]);

        return {
            url: postUrl,
            google: googleRes.status === 'fulfilled' ? googleRes.value : null,
            indexNow: indexNowRes.status === 'fulfilled' ? indexNowRes.value : null,
        };
    }
}

module.exports = new SeoIndexingService();
