/**
 * Locale Middleware
 *
 * Resolves the request locale and injects it into `req.locale`.
 * This allows all route handlers to use `req.locale` instead of
 * reading `req.query.locale` directly (which is fragile and scattered).
 *
 * Resolution priority (highest → lowest):
 *  1. `?locale=` query parameter   — explicit per-request override (API calls from Next.js)
 *  2. `x-locale` request header    — set by Next.js middleware from cookie (server-side)
 *  3. `preferred_locale` cookie    — direct browser requests
 *  4. DEFAULT_LOCALE ("vi")        — ultimate fallback
 *
 * The separation of concern here is intentional:
 *  - Next.js middleware owns cookie → header injection for SSR
 *  - Query param remains for direct API access (e.g., sitemap, RSS generators)
 *  - This middleware unifies them all so service code stays locale-agnostic
 */

const SUPPORTED_LOCALES = ['vi', 'en'];
const DEFAULT_LOCALE = 'vi';

/**
 * @param {import('express').Request} req
 * @returns {'vi' | 'en'}
 */
function resolveLocale(req) {
    // 1. Explicit query param wins — used by Next.js page fetches and API direct calls
    const fromQuery = req.query?.locale;
    if (SUPPORTED_LOCALES.includes(fromQuery)) {
        return fromQuery;
    }

    // 2. x-locale header injected by Next.js Edge middleware
    const fromHeader = req.headers?.['x-locale'];
    if (SUPPORTED_LOCALES.includes(fromHeader)) {
        return fromHeader;
    }

    // 3. Direct cookie from browser (e.g., curl, direct API testing)
    const fromCookie = req.cookies?.preferred_locale;
    if (SUPPORTED_LOCALES.includes(fromCookie)) {
        return fromCookie;
    }

    return DEFAULT_LOCALE;
}

/**
 * Express middleware — attaches resolved locale to req.locale.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} _res
 * @param {import('express').NextFunction} next
 */
function localeMiddleware(req, _res, next) {
    req.locale = resolveLocale(req);
    next();
}

module.exports = { localeMiddleware, resolveLocale, SUPPORTED_LOCALES, DEFAULT_LOCALE };
