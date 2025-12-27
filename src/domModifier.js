
/**
 * Format data from Google Sheet to display text.
 */
class HeaderDisplayFormatter {
    static currentYear = new Date().getFullYear();

    static toWant(games) {
        const want = games.map(game => (game.K)).join('/');
        return `${/^(\d|$)/.test(want) ? 'W' : 'W-'}${want}`;
    };
    /**
     * @returns /Y\d{2}/ | ''
     */
    static toUpdateYear(games) {
        const earliest = games.reduce((min, game) => {
            if (!game.G) {
                return min;
            }
            const date = new Date(game.G);
            return (!min || date < min) ? date : min;
        }, null);
        if (!earliest) {
            return 'Y-';
        }
        const year = earliest.getFullYear();
        return year < (this.currentYear - 3) ? `Y${String(year).slice(2)}` : '';
    };
}

class HeaderModifier {
    constructor(sheetData) {
        this.sheetData = sheetData;
    }

    /**
     * @public
     * @returns {number} Count of modified giveaways
     */
    modifyGiveaways() {
        const headers = document.querySelectorAll('.giveaway__heading__name');
        // next should be .giveaway__heading__thin
        let count = 0;
        headers.forEach((header) => {
            if (this.modify(header)) {
                count += 1;
            }
        });
        return count;
    }

    /**
     * @public
     * @returns {boolean} Whether the giveaway was modified
     */
    modifyGiveaway() {
        const header = document.querySelector('.featured__heading__medium');
        // next should be .featured__heading__small
        return this.modify(header);
    }

    /**
     * Match by game name.
     * @private
     * @param {Array} games
     * @param {string} rawName Maybe with extra 'xxx edition'.
     * @returns {Array} Only one game on exact match. Or all partial matches.
     */
    matchGames(games, rawName) {
        const nameWithoutEdition = rawName.replace(/[\s:\-]+\w+\s+edition$/i, '').trim();

        const candidates = games.filter((game) => game.B.includes(nameWithoutEdition));
        if (!candidates.length) {
            return candidates;
        }

        const exactMatches = candidates.filter(game => {
            if (game.B === rawName) { return true; }
            return game.B.split('/').some(part => {
                return part.trim() === rawName;
            });
        });
        if (exactMatches.length) {
            return exactMatches;
        }

        const exactMatchesWithoutEdition = candidates.filter(game => {
            if (game.B === nameWithoutEdition) { return true; }
            return game.B.split('/').some(part => {
                return part.trim() === nameWithoutEdition;
            });
        });
        return exactMatchesWithoutEdition.length ? exactMatchesWithoutEdition : candidates;
    }

    /**
     * Match header name with sheet data and modify DOM
     * @private
     * @param {HTMLElement} headerElement
     * @returns {boolean} Whether modified successfully
     */
    modify(headerElement) {
        if (!headerElement) return false;

        const name = headerElement.innerText.replace(/(\.{3})$/, '');
        const games = this.matchGames(this.sheetData.games, name);

        if (!games.length) {
            return false;
        }

        const want = HeaderDisplayFormatter.toWant(games);
        const year = HeaderDisplayFormatter.toUpdateYear(games);
        const yearMaybe = year ? ` (${year})` : '';

        const pointElement = headerElement.nextElementSibling;
        if (pointElement) {
            // HACK: Use change innerText instead to insert a new node
            pointElement.innerText += ` (${want})${yearMaybe}`;
            return true;
        }
        return false;
    }
}


class Cache {
    /**
     * @private
     */
    key = '';
    /**
     * @private
     */
    duration = 0;
    /**
     * @private
     */
    cache = {};
    /**
     * @private
     */
    saveTimeout = null;

    /**
     * @param {string} key
     * @param {number} duration in ms
     */
    constructor(key, duration) {
        this.key = key;
        this.duration = duration;
        this.load();
        this.clearExpired();
    }

    /**
     * @private
     */
    load() {
        try {
            this.cache = JSON.parse(localStorage.getItem(this.key)) || {};
        } catch (e) {
            this.cache = {};
        }
    }

    /**
     * @private
     */
    save() {
        localStorage.setItem(this.key, JSON.stringify(this.cache));
    }

    /**
     * @private
     */
    saveDebounced() {
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
        }
        this.saveTimeout = setTimeout(() => {
            this.save();
            this.saveTimeout = null;
        }, 30 * 1000);
    }

    /**
     * @private
     */
    clearExpired() {
        const now = Date.now();
        for (const [key, value] of Object.entries(this.cache)) {
            if (!value.time || (now - value.time > this.duration)) {
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
        return undefined;
    }

    set(url, value) {
        this.cache[url] = { value, time: Date.now() };
        this.saveDebounced();
    }
}

class RegionModifier {
    constructor(sheetData) {
        this.sheetData = sheetData;

        const cacheDuration = 24 * 60 * 60 * 1000; // 1D
        this.cache = new Cache('ekkoGamesRegions', cacheDuration);
    }

    /**
     * @public
     * @returns {number} Count of modified giveaways
     */
    async modifyGiveaways() {
        const regions = document.querySelectorAll('.giveaway__column--region-restricted');
        let count = 0;
        for (const region of regions) {
            if (await this.modify(region)) {
                count += 1;
            }
        }
        return count;
    }

    /**
     * @public
     * @returns {boolean} Whether the giveaway was modified
     */
    async modifyGiveaway() {
        const region = document.querySelector('.featured__column--region-restricted');
        return await this.modify(region);
    }

    /**
     * @private
     * @param {HTMLElement} regionElement form `<a href="/giveaway/xxxxx/griftlands/region-restrictions">`
     * @returns {boolean} Whether modified successfully
     */
    async modify(regionElement) {
        if (!regionElement || !regionElement.href) {
            return false;
        }

        await this.fetchRegionCounts(regionElement.href)
            .then(counts => {
                regionElement.appendChild(document.createTextNode(`${counts}`));
                return true;
            })
            .catch(msg => {
                console.error(msg);
                return false;
            });
    }

    /**
     * @private
     * @returns {Promise<number>}
     */
    async fetchRegionCounts(url) {
        const cached = this.cache.get(url);
        if (cached !== undefined) {
            return cached;
        }

        return await new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: url,
                onload: (response) => {
                    if (response.status !== 200) {
                        return reject(`Failed to fetch ${url}: ${response.status}`);
                    }

                    const parser = new DOMParser();
                    const doc = parser.parseFromString(response.responseText, 'text/html');
                    const resultsSelector = '.pagination__results';
                    const text = doc.querySelector(resultsSelector)?.innerText;
                    if (!text) {
                        return reject(`Results text not found in ${url}`);
                    }
                    const count = this.parseRegionCounts(text);
                    this.cache.set(url, count);
                    resolve(count);
                },
                onerror: (error) => {
                    return reject(`Failed to fetch ${url}: ${error.message}`);
                }
            });
        });
    }

    /**
     * @private
     * @param {string} text Region results text
     * @returns {number}
     */
    parseRegionCounts(text) {
        if (text.includes('No results')) {
            return 0;
        }

        const matched = text.match(/(?:\d+) to (?:\d+) of (\d+) result/);
        if (!matched) {
            throw new Error(`Unexpected results text format: ${text}`);
        }
        return parseInt(matched[1], 10);
    }
}
