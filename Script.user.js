// ==UserScript==
// @name         Steamgifts-helper
// @namespace    https://github.com/YiFanChen99/tampermonkey--steamgifts-helper
// @version      1.3.5
// @description  Fetch games from Google Sheet via App Script
// @author       YiFanChen99
// @match        *://www.steamgifts.com/giveaways/search*
// @match        *://www.steamgifts.com/giveaway/*
// @grant        GM_xmlhttpRequest
// @connect      script.google.com
// @connect      www.steamgifts.com
// @icon         https://raw.githubusercontent.com/YiFanChen99/tampermonkey--steamgifts-helper/main/favicon.ico
// @downloadURL  https://raw.githubusercontent.com/YiFanChen99/tampermonkey--steamgifts-helper/main/Script.user.js
// @updateURL    https://raw.githubusercontent.com/YiFanChen99/tampermonkey--steamgifts-helper/main/Script.meta.js
// @require      https://raw.githubusercontent.com/YiFanChen99/tampermonkey--steamgifts-helper/main/src/sheetFetcher.js
// @require      https://raw.githubusercontent.com/YiFanChen99/tampermonkey--steamgifts-helper/main/src/domModifier.js
// ==/UserScript==

/**
 * User localstorage keys:
 *  ekkoGames: { games: Array, labelMap, time }
 *  ekkoGamesAccount?: 'yf'
 *  ekkoGamesRegions: Record<string, { value, time }>
 */

'use strict';

const sheetData = await getOrFetchData();
console.log('Steamgifts-helper: updated');


let isGiveawaysPage;
if (window.location.pathname.startsWith('/giveaways/search')) {
    isGiveawaysPage = true;
} else if (window.location.pathname.startsWith('/giveaway/')) {
    isGiveawaysPage = false;
} else {
    console.warn(`Steamgifts-helper: No modification applied. (Unknown page: ${window.location.pathname})`);
    return;
}

const headerModifier = new HeaderModifier(sheetData);
const regionModifier = new RegionModifier(sheetData);
if (isGiveawaysPage) {
    const count = headerModifier.modifyGiveaways();
    console.log(`Steamgifts-helper: \`giveaways\` ${count} headers modified`);
    const regionCount = await regionModifier.modifyGiveaways();
    console.log(`Steamgifts-helper: \`giveaways\` ${regionCount} region tags modified`);
} else {
    const done = headerModifier.modifyGiveaway();
    console.log(`Steamgifts-helper: \`giveaway\` ${done ? 'headers modified' : 'No headers modification applied.'}`);
    const regionDone = await regionModifier.modifyGiveaway();
    console.log(`Steamgifts-helper: \`giveaway\` ${regionDone ? 'region tags modified' : 'No region tags modification applied.'}`);
}
