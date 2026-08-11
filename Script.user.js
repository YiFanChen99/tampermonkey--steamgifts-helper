// ==UserScript==
// @name         Ekko Steamgifts Helper
// @namespace    https://github.com/YiFanChen99/tampermonkey--steamgifts-helper
// @version      1.4.0
// @description  Fetch games from Google Sheet via App Script
// @author       YiFanChen99
// @match        *://www.steamgifts.com/giveaways/search*
// @match        *://www.steamgifts.com/giveaway/*
// @grant        GM_xmlhttpRequest
// @connect      script.google.com
// @connect      www.steamgifts.com
// @icon         https://yifanchen99.github.io/tampermonkey--steamgifts-helper/favicon.ico
// @downloadURL  https://yifanchen99.github.io/tampermonkey--steamgifts-helper/Script.user.js
// ==/UserScript==

"use strict";
(() => {
  // src/domModifier.ts
  var HeaderDisplayFormatter = class {
    static toWant(games) {
      const want = games.map((game) => game.K).join("/");
      return `${/^(\d|$)/.test(want) ? "W" : "W-"}${want}`;
    }
    /**
     * @returns /Y\d{2}/ | ''
     */
    static toUpdateYear(games) {
      const earliest = games.reduce((min, game) => {
        if (!game.G) {
          return min;
        }
        const date = new Date(game.G);
        return !min || date < min ? date : min;
      }, null);
      if (!earliest) {
        return "Y-";
      }
      const year = earliest.getFullYear();
      return year < this.currentYear - 3 ? `Y${String(year).slice(2)}` : "";
    }
  };
  HeaderDisplayFormatter.currentYear = (/* @__PURE__ */ new Date()).getFullYear();
  var HeaderModifier = class _HeaderModifier {
    constructor(sheetData) {
      this.games = sheetData.games.map((game) => ({
        ...game,
        name: _HeaderModifier.normalize(game.B),
        subNames: game.B.split("/").map((part) => _HeaderModifier.normalize(part)).filter(Boolean)
      }));
    }
    /**
     * Normalize a name for comparison: case, trademark symbols, whitespace.
     */
    static normalize(name) {
      return name.replace(/[™®©]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
    }
    /**
     * @returns Count of modified giveaways
     */
    modifyGiveaways() {
      const headers = document.querySelectorAll(".giveaway__heading__name");
      let count = 0;
      headers.forEach((header) => {
        if (this.modify(header)) {
          count += 1;
        }
      });
      return count;
    }
    /**
     * @returns Whether the giveaway was modified
     */
    modifyGiveaway() {
      const header = document.querySelector(".featured__heading__medium");
      return this.modify(header);
    }
    /**
     * Match by game name.
     * @param rawName Maybe with extra 'xxx edition'.
     * @returns Only one game on exact match. Or all partial matches.
     */
    matchGames(games, rawName) {
      const name = _HeaderModifier.normalize(rawName);
      const nameWithoutEdition = _HeaderModifier.normalize(
        rawName.replace(/[\s:\-]+\w+\s+edition$/i, "")
      );
      const candidates = games.filter((game) => game.name.includes(nameWithoutEdition));
      if (!candidates.length) {
        return candidates;
      }
      const exactMatches = candidates.filter((game) => {
        if (game.name === name) {
          return true;
        }
        return game.subNames.includes(name);
      });
      if (exactMatches.length) {
        return exactMatches;
      }
      const exactMatchesWithoutEdition = candidates.filter((game) => {
        if (game.name === nameWithoutEdition) {
          return true;
        }
        return game.subNames.includes(nameWithoutEdition);
      });
      return exactMatchesWithoutEdition.length ? exactMatchesWithoutEdition : candidates;
    }
    /**
     * Match header name with sheet data and modify DOM
     * @returns Whether modified successfully
     */
    modify(headerElement) {
      if (!headerElement) return false;
      const name = headerElement.innerText.replace(/(\.{3})$/, "");
      const games = this.matchGames(this.games, name);
      if (!games.length) {
        return false;
      }
      const want = HeaderDisplayFormatter.toWant(games);
      const year = HeaderDisplayFormatter.toUpdateYear(games);
      const yearMaybe = year ? ` (${year})` : "";
      const pointElement = headerElement.nextElementSibling;
      if (pointElement instanceof HTMLElement) {
        pointElement.innerText += ` (${want})${yearMaybe}`;
        return true;
      }
      return false;
    }
  };
  var Cache = class {
    constructor(key, duration) {
      this.cache = {};
      this.saveTimeout = null;
      this.key = key;
      this.duration = duration;
      this.load();
      this.clearExpired();
    }
    load() {
      try {
        const raw = localStorage.getItem(this.key);
        this.cache = raw ? JSON.parse(raw) : {};
      } catch (e) {
        this.cache = {};
      }
    }
    save() {
      localStorage.setItem(this.key, JSON.stringify(this.cache));
    }
    saveDebounced() {
      if (this.saveTimeout) {
        clearTimeout(this.saveTimeout);
      }
      this.saveTimeout = setTimeout(() => {
        this.save();
        this.saveTimeout = null;
      }, 30 * 1e3);
    }
    clearExpired() {
      const now = Date.now();
      for (const [key, value] of Object.entries(this.cache)) {
        if (!value.time || now - value.time > this.duration) {
          delete this.cache[key];
          this.saveDebounced();
        }
      }
    }
    get(url) {
      const now = Date.now();
      const entry = this.cache[url];
      if (entry && now - entry.time <= this.duration) {
        return entry.value;
      }
      return void 0;
    }
    set(url, value) {
      this.cache[url] = { value, time: Date.now() };
      this.saveDebounced();
    }
  };
  var RegionModifier = class {
    constructor() {
      const cacheDuration = 24 * 60 * 60 * 1e3;
      this.cache = new Cache("ekkoGamesRegions", cacheDuration);
    }
    /**
     * @returns Count of modified giveaways
     */
    async modifyGiveaways() {
      const regions = document.querySelectorAll(".giveaway__column--region-restricted");
      let count = 0;
      for (const region of regions) {
        if (await this.modify(region)) {
          count += 1;
        }
      }
      return count;
    }
    /**
     * @returns Whether the giveaway was modified
     */
    async modifyGiveaway() {
      const region = document.querySelector(".featured__column--region-restricted");
      return await this.modify(region);
    }
    /**
     * @param regionElement form `<a href="/giveaway/xxxxx/griftlands/region-restrictions">`
     * @returns Whether modified successfully
     */
    async modify(regionElement) {
      if (!regionElement || !regionElement.href) {
        return false;
      }
      try {
        const counts = await this.fetchRegionCounts(regionElement.href);
        regionElement.appendChild(document.createTextNode(`${counts}`));
        return true;
      } catch (msg) {
        console.error(msg);
        return false;
      }
    }
    async fetchRegionCounts(url) {
      const cached = this.cache.get(url);
      if (cached !== void 0) {
        return cached;
      }
      return await new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
          method: "GET",
          url,
          onload: (response) => {
            if (response.status !== 200) {
              return reject(`Failed to fetch ${url}: ${response.status}`);
            }
            const parser = new DOMParser();
            const doc = parser.parseFromString(response.responseText, "text/html");
            const resultsSelector = ".pagination__results";
            const text = doc.querySelector(resultsSelector)?.innerText;
            if (!text) {
              return reject(`Results text not found in ${url}`);
            }
            let count;
            try {
              count = this.parseRegionCounts(text);
            } catch (error) {
              return reject(error);
            }
            this.cache.set(url, count);
            resolve(count);
          },
          onerror: (error) => {
            return reject(`Failed to fetch ${url}: ${error.error}`);
          }
        });
      });
    }
    /**
     * @param text Region results text
     */
    parseRegionCounts(text) {
      if (text.includes("No results")) {
        return 0;
      }
      const matched = text.match(/(?:\d+) to (?:\d+) of (\d+) result/);
      if (!matched) {
        throw new Error(`Unexpected results text format: ${text}`);
      }
      return parseInt(matched[1], 10);
    }
  };

  // src/sheetFetcher.ts
  var updateDurationMs = 24 * 60 * 60 * 1e3;
  var webAppUrlPig = "https://script.google.com/macros/s/AKfycbwZWh1RFJmNCUaaVQyEzMXZRPDF8NlXtPwxyqKp_Wx2uiNqjnoh_yO7k334QdeNRyQR/exec";
  var webAppUrlYf = "https://script.google.com/macros/s/AKfycbxZ9fqXLb-h-M5D9g6Swy-B7tA4JOcIOphqI1cxNs3d8mA72OrUu1eFZJj5bKNVY-W-/exec";
  function getWebAppUrl() {
    const account = localStorage.getItem("ekkoGamesAccount");
    if (account === "yf") {
      return webAppUrlYf;
    }
    return webAppUrlPig;
  }
  async function fetchData() {
    console.log("Steamgifts-helper: fetchData starting ...");
    return new Promise((resolve) => {
      GM_xmlhttpRequest({
        method: "GET",
        url: getWebAppUrl(),
        onload: function(response) {
          const resp = JSON.parse(response.responseText);
          const data = { ...resp, time: Date.now() };
          localStorage.setItem("ekkoGames", JSON.stringify(data));
          resolve(data);
        }
      });
    });
  }
  async function getOrFetchData() {
    const old = localStorage.getItem("ekkoGames");
    if (old) {
      const record = JSON.parse(old);
      const diffMs = Date.now() - record.time;
      if (diffMs > updateDurationMs) {
        return await fetchData();
      } else {
        return record;
      }
    } else {
      return await fetchData();
    }
  }

  // src/main.ts
  async function main() {
    const sheetData = await getOrFetchData();
    console.log("Steamgifts-helper: updated");
    const pathname = window.location.pathname;
    let isGiveawaysPage;
    if (pathname.startsWith("/giveaways/search")) {
      isGiveawaysPage = true;
    } else if (pathname.startsWith("/giveaway/")) {
      isGiveawaysPage = false;
    } else {
      console.warn(`Steamgifts-helper: No modification applied. (Unknown page: ${pathname})`);
      return;
    }
    const headerModifier = new HeaderModifier(sheetData);
    const regionModifier = new RegionModifier();
    if (isGiveawaysPage) {
      const count = headerModifier.modifyGiveaways();
      console.log(`Steamgifts-helper: \`giveaways\` ${count} headers modified`);
      const regionCount = await regionModifier.modifyGiveaways();
      console.log(`Steamgifts-helper: \`giveaways\` ${regionCount} region tags modified`);
    } else {
      const done = headerModifier.modifyGiveaway();
      console.log(`Steamgifts-helper: \`giveaway\` ${done ? "headers modified" : "No headers modification applied."}`);
      const regionDone = await regionModifier.modifyGiveaway();
      console.log(`Steamgifts-helper: \`giveaway\` ${regionDone ? "region tags modified" : "No region tags modification applied."}`);
    }
  }
  void main();
})();
