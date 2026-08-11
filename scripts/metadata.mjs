/**
 * Single source of truth for the userscript metadata block.
 *
 * `@updateURL` is intentionally omitted: when absent, Tampermonkey falls back to
 * `@downloadURL` for update checks, so there is no second file to keep in sync.
 */

const pagesBaseUrl = 'https://yifanchen99.github.io/tampermonkey--steamgifts-helper';

/** Repeated keys (`match`, `connect`) are expressed as arrays. */
export const metadata = {
    name: 'Ekko Steamgifts Helper',
    namespace: 'https://github.com/YiFanChen99/tampermonkey--steamgifts-helper',
    version: '1.4.0',
    description: 'Fetch games from Google Sheet via App Script',
    author: 'YiFanChen99',
    match: [
        '*://www.steamgifts.com/giveaways/search*',
        '*://www.steamgifts.com/giveaway/*',
    ],
    grant: 'GM_xmlhttpRequest',
    connect: [
        'script.google.com',
        'www.steamgifts.com',
    ],
    icon: `${pagesBaseUrl}/favicon.ico`,
    downloadURL: `${pagesBaseUrl}/Script.user.js`,
};

/**
 * @returns {string} The `// ==UserScript== ... // ==/UserScript==` block.
 */
export function buildBanner() {
    const entries = Object.entries(metadata).flatMap(([key, value]) =>
        (Array.isArray(value) ? value : [value]).map(item => [key, item])
    );
    const keyWidth = Math.max(...entries.map(([key]) => key.length));

    const lines = entries.map(
        ([key, value]) => `// @${key.padEnd(keyWidth)}  ${value}`
    );
    return ['// ==UserScript==', ...lines, '// ==/UserScript==', ''].join('\n');
}
