const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');

// 1. Patch iconv-lite for workerd + esbuild browser field compatibility
const iconvIndex = path.join(rootDir, 'node_modules/iconv-lite/lib/index.js');
if (fs.existsSync(iconvIndex)) {
    let s = fs.readFileSync(iconvIndex, 'utf8');
    s = s.replace(
        'require("./streams")(iconv);',
        'var streamsExt = require("./streams"); if (typeof streamsExt === "function") streamsExt(iconv);'
    );
    s = s.replace(
        'require("./extend-node")(iconv);',
        'var nodeExt = require("./extend-node"); if (typeof nodeExt === "function") nodeExt(iconv);'
    );
    fs.writeFileSync(iconvIndex, s);
}

// 2. Patch joi-browser.min.js so email() works without built-in TLD table
const joiBrowser = path.join(rootDir, 'node_modules/joi/dist/joi-browser.min.js');
if (fs.existsSync(joiBrowser)) {
    let s = fs.readFileSync(joiBrowser, 'utf8');
    s = s.replaceAll(
        's(m.tlds,"Built-in TLD list disabled"),Object.assign({},e,m.tlds)',
        'Object.assign({},e,{tlds:!1})'
    );
    fs.writeFileSync(joiBrowser, s);
}

// 3. Compute granular per-module code hashes so small backend code changes
// only invalidate the specific module's API Edge Cache (and never flush unrelated modules or static assets)
function collectFiles(targetPath, acc = []) {
    const fullPath = path.join(rootDir, targetPath);
    if (!fs.existsSync(fullPath)) return acc;
    const stat = fs.statSync(fullPath);
    if (stat.isFile()) {
        acc.push(fullPath);
    } else if (stat.isDirectory()) {
        for (const entry of fs.readdirSync(fullPath).sort()) {
            collectFiles(path.join(targetPath, entry), acc);
        }
    }
    return acc;
}

function hashPaths(relativePaths) {
    const hash = crypto.createHash('sha256');
    const files = [];
    for (const rel of relativePaths) {
        collectFiles(rel, files);
    }
    for (const file of files) {
        hash.update(path.relative(rootDir, file).replace(/\\/g, '/'));
        hash.update(fs.readFileSync(file));
    }
    return hash.digest('hex').slice(0, 8);
}

const moduleHashes = {
    posts: hashPaths(['src/modules/posts']),
    categories: hashPaths(['src/modules/categories']),
    tags: hashPaths(['src/modules/tags']),
    comments: hashPaths(['src/modules/comments']),
    seo: hashPaths(['src/modules/seo']),
    settings: hashPaths(['src/modules/settings']),
};

const hashesPath = path.join(rootDir, 'src/generated-cache-hashes.json');
fs.writeFileSync(hashesPath, JSON.stringify(moduleHashes, null, 2) + '\n', 'utf8');

console.log('Cloudflare Workers build patches & granular module cache hashes applied:', moduleHashes);
