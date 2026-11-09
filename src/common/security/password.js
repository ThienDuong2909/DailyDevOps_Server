const crypto = require('node:crypto');
const { argon2id } = require('@noble/hashes/argon2.js');

const PBKDF2_ITERATIONS = 100000;
const KEY_LEN = 32;

function toBase64NoPad(buf) {
    return Buffer.from(buf).toString('base64').replace(/=+$/, '');
}

function fromBase64NoPad(str) {
    const padLen = (4 - (str.length % 4)) % 4;
    return Buffer.from(str + '='.repeat(padLen), 'base64');
}

/**
 * Hash a password or token using WebCrypto-compatible PBKDF2-SHA256
 * Format: $pbkdf2-sha256$i=100000$<salt_b64>$<hash_b64>
 */
async function hashPassword(plain) {
    const salt = crypto.randomBytes(16);
    const derived = await new Promise((resolve, reject) => {
        crypto.pbkdf2(plain, salt, PBKDF2_ITERATIONS, KEY_LEN, 'sha256', (err, key) => {
            if (err) reject(err);
            else resolve(key);
        });
    });

    return `$pbkdf2-sha256$i=${PBKDF2_ITERATIONS}$${toBase64NoPad(salt)}$${toBase64NoPad(derived)}`;
}

/**
 * Verify a password or token against either:
 * - $pbkdf2-sha256$i=...$<salt>$<hash>
 * - $argon2id$v=19$m=...,t=...,p=...$<salt>$<hash>
 */
async function verifyHash(storedHash, plain) {
    if (!storedHash || !plain) {
        return false;
    }

    if (storedHash.startsWith('$pbkdf2-sha256$')) {
        const parts = storedHash.split('$');
        // ['', 'pbkdf2-sha256', 'i=100000', saltB64, hashB64]
        if (parts.length !== 5) return false;
        const iterMatch = parts[2].match(/^i=(\d+)$/);
        const iterations = iterMatch ? Number(iterMatch[1]) : PBKDF2_ITERATIONS;
        const salt = fromBase64NoPad(parts[3]);
        const expected = fromBase64NoPad(parts[4]);

        const derived = await new Promise((resolve, reject) => {
            crypto.pbkdf2(plain, salt, iterations, expected.length, 'sha256', (err, key) => {
                if (err) reject(err);
                else resolve(key);
            });
        });

        return (
            derived.length === expected.length &&
            crypto.timingSafeEqual(derived, expected)
        );
    }

    if (storedHash.startsWith('$argon2id$')) {
        const parts = storedHash.split('$');
        // ['', 'argon2id', 'v=19', 'm=65536,t=3,p=4', saltB64, hashB64]
        if (parts.length !== 6) return false;
        const paramPairs = parts[3].split(',').map((kv) => {
            const [k, v] = kv.split('=');
            return [k, Number(v)];
        });
        const params = Object.fromEntries(paramPairs);
        const salt = fromBase64NoPad(parts[4]);
        const expected = fromBase64NoPad(parts[5]);

        const computed = Buffer.from(
            argon2id(plain, salt, {
                m: params.m || 65536,
                t: params.t || 3,
                p: params.p || 4,
                dkLen: expected.length,
            })
        );

        return (
            computed.length === expected.length &&
            crypto.timingSafeEqual(computed, expected)
        );
    }

    return false;
}

module.exports = {
    hashPassword,
    verifyHash,
};
