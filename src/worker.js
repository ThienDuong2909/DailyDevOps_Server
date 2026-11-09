globalThis.__CF_ENV = globalThis.__CF_ENV || {};
const { PassThrough } = require('node:stream');
const config = require('./config');
const { initD1Prisma } = require('./database/prisma');
const { setWaitUntil } = require('./common/runtime/background');
const expressApp = require('./app');
Object.setPrototypeOf(Object.getPrototypeOf(expressApp.request), PassThrough.prototype);
Object.setPrototypeOf(Object.getPrototypeOf(expressApp.response), PassThrough.prototype);
function getExpressApp() {
    return expressApp;
}

/**
 * Dispatch a Fetch API Request to an Express app without opening a TCP socket
 */
async function dispatchToExpress(request) {
    const url = new URL(request.url);
    const reqStream = new PassThrough();

    const headers = {};
    request.headers.forEach((value, key) => {
        headers[key.toLowerCase()] = value;
    });

    const clientIp =
        headers['cf-connecting-ip'] ||
        (headers['x-forwarded-for'] ? headers['x-forwarded-for'].split(',')[0].trim() : '127.0.0.1');

    const fakeSocket = {
        remoteAddress: clientIp,
        remotePort: 443,
        encrypted: url.protocol === 'https:',
        writable: true,
        readable: true,
        destroy() {},
        on() {},
        once() {},
        emit() {},
        removeListener() {},
        setTimeout() {},
        setNoDelay() {},
        setKeepAlive() {},
    };

    Object.assign(reqStream, {
        method: request.method,
        url: url.pathname + url.search,
        originalUrl: url.pathname + url.search,
        headers,
        rawHeaders: Object.entries(headers).flat(),
        httpVersion: '1.1',
        httpVersionMajor: 1,
        httpVersionMinor: 1,
        connection: fakeSocket,
        socket: fakeSocket,
        ip: clientIp,
        ips: [clientIp],
        protocol: url.protocol.replace(':', ''),
        complete: true,
    });

    const contentType = (headers['content-type'] || '').toLowerCase();
    if (request.method === 'GET' || request.method === 'HEAD' || !request.body) {
        reqStream.body = {};
        reqStream._workerParsedBody = true;
        reqStream.push(null);
    } else if (contentType.includes('application/json')) {
        const text = await request.text();
        reqStream._workerParsedBody = true;
        if (!text || !text.trim()) {
            reqStream.body = {};
        } else {
            try {
                reqStream.body = JSON.parse(text);
            } catch {
                reqStream.body = {};
            }
        }
        reqStream.push(null);
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
        const text = await request.text();
        reqStream._workerParsedBody = true;
        reqStream.body = text ? Object.fromEntries(new URLSearchParams(text)) : {};
        reqStream.push(null);
    } else {
        const arrayBuf = await request.arrayBuffer();
        reqStream.push(Buffer.from(arrayBuf));
        reqStream.push(null);
    }

    return new Promise((resolve, reject) => {
        const resChunks = [];
        const resHeaders = new Map();
        const setCookieValues = [];
        const resStream = new PassThrough();

        Object.assign(resStream, {
            statusCode: 200,
            statusMessage: 'OK',
            headersSent: false,
            finished: false,
            locals: {},
            socket: fakeSocket,
            connection: fakeSocket,
            setHeader(name, value) {
                const lower = String(name).toLowerCase();
                if (lower === 'set-cookie') {
                    if (Array.isArray(value)) {
                        setCookieValues.push(...value.map(String));
                    } else {
                        setCookieValues.push(String(value));
                    }
                    resHeaders.set(lower, setCookieValues);
                    return this;
                }
                resHeaders.set(lower, value);
                return this;
            },
            getHeader(name) {
                return resHeaders.get(String(name).toLowerCase());
            },
            getHeaders() {
                return Object.fromEntries(resHeaders.entries());
            },
            getHeaderNames() {
                return Array.from(resHeaders.keys());
            },
            hasHeader(name) {
                return resHeaders.has(String(name).toLowerCase());
            },
            removeHeader(name) {
                const lower = String(name).toLowerCase();
                if (lower === 'set-cookie') {
                    setCookieValues.length = 0;
                }
                resHeaders.delete(lower);
            },
            appendHeader(name, value) {
                const lower = String(name).toLowerCase();
                if (lower === 'set-cookie') {
                    if (Array.isArray(value)) {
                        setCookieValues.push(...value.map(String));
                    } else {
                        setCookieValues.push(String(value));
                    }
                    resHeaders.set(lower, setCookieValues);
                    return this;
                }
                const existing = resHeaders.get(lower);
                if (existing) {
                    const next = Array.isArray(existing) ? [...existing, value] : [existing, value];
                    resHeaders.set(lower, next);
                } else {
                    resHeaders.set(lower, value);
                }
                return this;
            },
            writeHead(statusCode, statusMessage, hdrs) {
                this.statusCode = statusCode;
                let headersObj = hdrs;
                if (typeof statusMessage === 'object' && statusMessage !== null) {
                    headersObj = statusMessage;
                } else if (typeof statusMessage === 'string') {
                    this.statusMessage = statusMessage;
                }
                if (headersObj) {
                    for (const [k, v] of Object.entries(headersObj)) {
                        this.setHeader(k, v);
                    }
                }
                this.headersSent = true;
                return this;
            },
            flushHeaders() {
                this.headersSent = true;
            },
        });

        resStream.write = function (chunk, encoding, cb) {
            this.headersSent = true;
            if (chunk !== undefined && chunk !== null && typeof chunk !== 'function') {
                resChunks.push(
                    Buffer.isBuffer(chunk)
                        ? chunk
                        : Buffer.from(chunk, typeof encoding === 'string' ? encoding : undefined)
                );
            }
            if (typeof encoding === 'function') {
                encoding();
            } else if (typeof cb === 'function') {
                cb();
            }
            return true;
        };

        resStream.end = function (chunk, encoding, cb) {
            this.headersSent = true;
            if (chunk !== undefined && chunk !== null && typeof chunk !== 'function') {
                resChunks.push(
                    Buffer.isBuffer(chunk)
                        ? chunk
                        : Buffer.from(chunk, typeof encoding === 'string' ? encoding : undefined)
                );
            }
            this.finished = true;
            if (typeof chunk === 'function') {
                chunk();
            } else if (typeof encoding === 'function') {
                encoding();
            } else if (typeof cb === 'function') {
                cb();
            }
            try {
                this.emit('finish');
            } catch {
                // Ignore finish listener errors
            }

            const outHeaders = new Headers();
            for (const [k, v] of resHeaders.entries()) {
                if (k === 'set-cookie' || k === 'content-length' || k === 'transfer-encoding') {
                    continue;
                }
                if (Array.isArray(v)) {
                    outHeaders.set(k, v.join(', '));
                } else if (v !== undefined) {
                    outHeaders.set(k, String(v));
                }
            }
            for (const cookieVal of setCookieValues) {
                outHeaders.append('Set-Cookie', cookieVal);
            }

            const bodyBuffer = resChunks.length > 0 ? Buffer.concat(resChunks) : null;
            const status = this.statusCode || 200;
            const isNullBodyStatus = status === 204 || status === 304 || request.method === 'HEAD';

            resolve(
                new Response(isNullBodyStatus ? null : bodyBuffer, {
                    status,
                    headers: outHeaders,
                })
            );
            return this;
        };

        resStream.on('error', reject);

        try {
            getExpressApp().handle(reqStream, resStream, (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(
                        new Response(JSON.stringify({ success: false, error: 'Not Found' }), {
                            status: 404,
                            headers: { 'content-type': 'application/json' },
                        })
                    );
                }
            });
        } catch (err) {
            reject(err);
        }
    });
}

let MODULE_CODE_HASHES = {
    posts: 'v1',
    categories: 'v1',
    tags: 'v1',
    comments: 'v1',
    seo: 'v1',
    settings: 'v1',
};
try {
    MODULE_CODE_HASHES = require('./generated-cache-hashes.json');
} catch {
    // Fallback to default module hashes
}

function getApiModuleCodeHash(pathname) {
    if (pathname.startsWith('/api/v1/posts')) return MODULE_CODE_HASHES.posts || 'v1';
    if (pathname.startsWith('/api/v1/categories')) return MODULE_CODE_HASHES.categories || 'v1';
    if (pathname.startsWith('/api/v1/tags')) return MODULE_CODE_HASHES.tags || 'v1';
    if (pathname.startsWith('/api/v1/comments')) return MODULE_CODE_HASHES.comments || 'v1';
    if (pathname.startsWith('/api/v1/seo')) return MODULE_CODE_HASHES.seo || 'v1';
    if (pathname.startsWith('/api/v1/settings')) return MODULE_CODE_HASHES.settings || 'v1';
    return 'v1';
}

let cachedVersion = 'v1';
let cachedVersionFetchedAt = 0;
const VERSION_TTL_MS = 15_000;

async function getEdgeCacheVersion(db) {
    const now = Date.now();
    if (now - cachedVersionFetchedAt < VERSION_TTL_MS) {
        return cachedVersion;
    }
    try {
        const row = await db
            .prepare("SELECT value FROM system_settings WHERE key = 'edge_cache_version' LIMIT 1")
            .first();
        if (row && row.value) {
            cachedVersion = String(row.value);
        }
        cachedVersionFetchedAt = now;
    } catch {
        // Fallback to in-memory version
    }
    return cachedVersion;
}

async function bumpEdgeCacheVersion(db) {
    const nextVersion = `v${Date.now()}`;
    cachedVersion = nextVersion;
    cachedVersionFetchedAt = Date.now();
    try {
        await db
            .prepare(
                "INSERT INTO system_settings (id, key, value, \"group\", updatedAt) VALUES ('edge_cache_version', 'edge_cache_version', ?1, 'system', datetime('now')) ON CONFLICT(key) DO UPDATE SET value = ?1, updatedAt = datetime('now')"
            )
            .bind(nextVersion)
            .run();
    } catch {
        // Ignore DB error if table is locked
    }
    return nextVersion;
}

function isCacheablePublicApiGet(pathname) {
    if (
        pathname === '/api/v1/posts/published' ||
        pathname.startsWith('/api/v1/posts/slug/') ||
        pathname === '/api/v1/posts/search' ||
        pathname === '/api/v1/posts/autocomplete' ||
        pathname === '/api/v1/categories' ||
        pathname === '/api/v1/tags' ||
        pathname === '/api/v1/seo/sitemap-data' ||
        pathname.startsWith('/api/v1/seo/post-meta/') ||
        pathname === '/api/v1/settings/public' ||
        pathname.startsWith('/api/v1/comments/post/')
    ) {
        return true;
    }
    if (/^\/api\/v1\/posts\/[^/]+\/related$/.test(pathname)) {
        return true;
    }
    return false;
}

function isContentMutationRequest(method, pathname) {
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
        return false;
    }
    if (pathname.endsWith('/view')) {
        return false;
    }
    return (
        pathname.startsWith('/api/v1/posts') ||
        pathname.startsWith('/api/v1/categories') ||
        pathname.startsWith('/api/v1/tags') ||
        pathname.startsWith('/api/v1/comments') ||
        pathname.startsWith('/api/v1/seo') ||
        pathname.startsWith('/api/v1/settings')
    );
}

function resolveRequestLocale(request, url) {
    const qLocale = url.searchParams.get('locale');
    if (qLocale === 'en' || qLocale === 'vi') return qLocale;
    const hLocale = request.headers.get('x-locale');
    if (hLocale === 'en' || hLocale === 'vi') return hLocale;
    const cookie = request.headers.get('cookie') || '';
    const match = cookie.match(/(?:^|;\s*)preferred_locale=(en|vi)/);
    return match ? match[1] : 'vi';
}

export default {
    async fetch(request, env, ctx) {
        try {
            globalThis.__CF_D1_BINDING = env.DB;
            globalThis.__CF_R2_BINDING = env.MEDIA_BUCKET || null;
            initD1Prisma(env.DB);
            config.refreshConfigFromEnv(env);
            setWaitUntil(ctx && typeof ctx.waitUntil === 'function' ? ctx.waitUntil.bind(ctx) : null);

            const url = new URL(request.url);
            const edgeCache = typeof caches !== 'undefined' && caches.default ? caches.default : null;

            // 0. Fast-path internal cache-version endpoint for Frontend Worker
            if (request.method === 'GET' && url.pathname === '/api/v1/cache-version') {
                const version = await getEdgeCacheVersion(env.DB);
                return new Response(JSON.stringify({ success: true, version }), {
                    status: 200,
                    headers: {
                        'content-type': 'application/json',
                        'cache-control': 'no-store',
                    },
                });
            }

            // 1. Fast-path R2 + Edge Cache for Media Objects (1 year immutable cache)
            if (request.method === 'GET' && url.pathname === '/api/v1/media/object') {
                const key = url.searchParams.get('key');
                if (key && env.MEDIA_BUCKET) {
                    const mediaCacheKey = new Request(`https://cache.dailydevops.blog/media?key=${encodeURIComponent(key)}`, {
                        method: 'GET',
                    });
                    if (edgeCache) {
                        const cachedMedia = await edgeCache.match(mediaCacheKey);
                        if (cachedMedia) {
                            const hitHeaders = new Headers(cachedMedia.headers);
                            hitHeaders.set('X-Edge-Cache', 'HIT');
                            return new Response(cachedMedia.body, {
                                status: cachedMedia.status,
                                headers: hitHeaders,
                            });
                        }
                    }

                    const r2Obj = await env.MEDIA_BUCKET.get(key);
                    if (!r2Obj) {
                        return new Response(JSON.stringify({ success: false, error: 'Media object not found' }), {
                            status: 404,
                            headers: { 'content-type': 'application/json' },
                        });
                    }

                    const mediaHeaders = new Headers({
                        'Content-Type': r2Obj.httpMetadata?.contentType || 'application/octet-stream',
                        'Cache-Control': 'public, max-age=31536000, s-maxage=31536000, immutable',
                        'CDN-Cache-Control': 'public, max-age=31536000, immutable',
                        'Cross-Origin-Resource-Policy': 'cross-origin',
                        'Access-Control-Allow-Origin': '*',
                        'Content-Length': String(r2Obj.size),
                        'X-Edge-Cache': 'MISS',
                    });

                    const arrayBuf = await r2Obj.arrayBuffer();
                    const response = new Response(arrayBuf, { status: 200, headers: mediaHeaders });
                    if (edgeCache && ctx && typeof ctx.waitUntil === 'function') {
                        ctx.waitUntil(edgeCache.put(mediaCacheKey, response.clone()));
                    }
                    return response;
                }
            }

            // 2. Edge Cache for Public Blog Read API endpoints
            const hasAuthHeader = Boolean(request.headers.get('authorization'));
            if (request.method === 'GET' && !hasAuthHeader && edgeCache && isCacheablePublicApiGet(url.pathname)) {
                const version = await getEdgeCacheVersion(env.DB);
                const moduleHash = getApiModuleCodeHash(url.pathname);
                const locale = resolveRequestLocale(request, url);
                const originHeader = request.headers.get('origin') || '';
                const cacheUrl = new URL(url.toString());
                cacheUrl.hostname = 'cache.dailydevops.blog';
                cacheUrl.searchParams.set('__cv', `${version}_${moduleHash}`);
                cacheUrl.searchParams.set('__loc', locale);

                const cacheKey = new Request(cacheUrl.toString(), { method: 'GET' });
                const cached = await edgeCache.match(cacheKey);
                if (cached) {
                    const hitHeaders = new Headers(cached.headers);
                    hitHeaders.set('X-Edge-Cache', 'HIT');
                    hitHeaders.set('X-Cache-Version', version);
                    hitHeaders.set('X-Module-Hash', moduleHash);
                    if (originHeader) {
                        hitHeaders.set('Access-Control-Allow-Origin', originHeader);
                        hitHeaders.set('Access-Control-Allow-Credentials', 'true');
                    }
                    return new Response(cached.body, {
                        status: cached.status,
                        headers: hitHeaders,
                    });
                }

                const freshResponse = await dispatchToExpress(request);
                if (freshResponse.status === 200) {
                    const missHeaders = new Headers(freshResponse.headers);
                    missHeaders.set('Cache-Control', 'public, max-age=120, s-maxage=86400, stale-while-revalidate=604800');
                    missHeaders.set('CDN-Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
                    missHeaders.set('X-Edge-Cache', 'MISS');
                    missHeaders.set('X-Cache-Version', version);
                    missHeaders.set('X-Module-Hash', moduleHash);
                    missHeaders.delete('set-cookie');

                    const cachableResponse = new Response(freshResponse.body, {
                        status: 200,
                        headers: missHeaders,
                    });

                    if (ctx && typeof ctx.waitUntil === 'function') {
                        ctx.waitUntil(edgeCache.put(cacheKey, cachableResponse.clone()));
                    }
                    return cachableResponse;
                }

                return freshResponse;
            }

            // 3. Normal Express dispatch + auto-bump cache version on content mutations
            const response = await dispatchToExpress(request);
            if (response.status >= 200 && response.status < 400 && isContentMutationRequest(request.method, url.pathname)) {
                if (ctx && typeof ctx.waitUntil === 'function') {
                    ctx.waitUntil(bumpEdgeCacheVersion(env.DB));
                } else {
                    await bumpEdgeCacheVersion(env.DB);
                }
            }

            return response;
        } catch (err) {
            return new Response(
                JSON.stringify({
                    success: false,
                    error: err?.message || String(err),
                    stack: err?.stack,
                }),
                {
                    status: 500,
                    headers: { 'content-type': 'application/json' },
                }
            );
        }
    },

    async scheduled(_event, env, ctx) {
        globalThis.__CF_D1_BINDING = env.DB;
        globalThis.__CF_R2_BINDING = env.MEDIA_BUCKET || null;
        initD1Prisma(env.DB);
        config.refreshConfigFromEnv(env);
        setWaitUntil(ctx && typeof ctx.waitUntil === 'function' ? ctx.waitUntil.bind(ctx) : null);

        const postsService = require('./modules/posts/posts.service');
        const thumbnailGenerationService = require('./modules/posts/posts.thumbnail-generation.service');
        const tasks = Promise.allSettled([
            postsService.processScheduledPublications(),
            thumbnailGenerationService.runOnce(),
        ]);

        if (ctx && typeof ctx.waitUntil === 'function') {
            ctx.waitUntil(tasks);
        } else {
            await tasks;
        }
    },
};
