import type { SheetData, SheetGame } from './types';

/**
 * Format data from Google Sheet to display text.
 */
class HeaderDisplayFormatter {
    static currentYear = new Date().getFullYear();

    static toWant(games: SheetGame[]): string {
        const want = games.map(game => (game.K)).join('/');
        return `${/^(\d|$)/.test(want) ? 'W' : 'W-'}${want}`;
    }

    /**
     * @returns /Y\d{2}/ | ''
     */
    static toUpdateYear(games: SheetGame[]): string {
        const earliest = games.reduce<Date | null>((min, game) => {
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
    }
}

/**
 * A `SheetGame` with its name pre-normalized for comparison.
 */
interface PreparedGame extends SheetGame {
    name: string;
    subNames: string[];
}

export class HeaderModifier {
    /**
     * Precomputed `sheetData.games`
     */
    private readonly games: PreparedGame[];

    constructor(sheetData: SheetData) {
        this.games = sheetData.games.map(game => ({
            ...game,
            name: HeaderModifier.normalize(game.B),
            subNames: game.B
                .split('/')
                .map(part => HeaderModifier.normalize(part))
                .filter(Boolean),
        }));
    }

    /**
     * Normalize a name for comparison: case, trademark symbols, whitespace.
     */
    private static normalize(name: string): string {
        return name
            .replace(/[™®©]/g, '')
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase();
    }

    /**
     * @returns Count of modified giveaways
     */
    modifyGiveaways(): number {
        const headers = document.querySelectorAll<HTMLElement>('.giveaway__heading__name');
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
     * @returns Whether the giveaway was modified
     */
    modifyGiveaway(): boolean {
        const header = document.querySelector<HTMLElement>('.featured__heading__medium');
        // next should be .featured__heading__small
        return this.modify(header);
    }

    /**
     * Match by game name.
     * @param rawName Maybe with extra 'xxx edition'.
     * @returns Only one game on exact match. Or all partial matches.
     */
    private matchGames(games: PreparedGame[], rawName: string): PreparedGame[] {
        const name = HeaderModifier.normalize(rawName);
        const nameWithoutEdition = HeaderModifier.normalize(
            rawName.replace(/[\s:\-]+\w+\s+edition$/i, '')
        );

        const candidates = games.filter((game) => game.name.includes(nameWithoutEdition));
        if (!candidates.length) {
            return candidates;
        }

        const exactMatches = candidates.filter(game => {
            if (game.name === name) { return true; }
            return game.subNames.includes(name);
        });
        if (exactMatches.length) {
            return exactMatches;
        }

        const exactMatchesWithoutEdition = candidates.filter(game => {
            if (game.name === nameWithoutEdition) { return true; }
            return game.subNames.includes(nameWithoutEdition);
        });
        return exactMatchesWithoutEdition.length ? exactMatchesWithoutEdition : candidates;
    }

    /**
     * Match header name with sheet data and modify DOM
     * @returns Whether modified successfully
     */
    private modify(headerElement: HTMLElement | null): boolean {
        if (!headerElement) return false;

        const name = headerElement.innerText.replace(/(\.{3})$/, '');
        const games = this.matchGames(this.games, name);

        if (!games.length) {
            return false;
        }

        const want = HeaderDisplayFormatter.toWant(games);
        const year = HeaderDisplayFormatter.toUpdateYear(games);
        const yearMaybe = year ? ` (${year})` : '';

        const pointElement = headerElement.nextElementSibling;
        if (pointElement instanceof HTMLElement) {
            // HACK: Use change innerText instead to insert a new node
            pointElement.innerText += ` (${want})${yearMaybe}`;
            return true;
        }
        return false;
    }
}


interface CacheEntry<T> {
    value: T;
    time: number;
}

class Cache<T> {
    private readonly key: string;
    /** in ms */
    private readonly duration: number;
    private cache: Record<string, CacheEntry<T>> = {};
    private saveTimeout: ReturnType<typeof setTimeout> | null = null;

    constructor(key: string, duration: number) {
        this.key = key;
        this.duration = duration;
        this.load();
        this.clearExpired();
    }

    private load(): void {
        try {
            const raw = localStorage.getItem(this.key);
            this.cache = raw ? (JSON.parse(raw) as Record<string, CacheEntry<T>>) : {};
        } catch (e) {
            this.cache = {};
        }
    }

    private save(): void {
        localStorage.setItem(this.key, JSON.stringify(this.cache));
    }

    private saveDebounced(): void {
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
        }
        this.saveTimeout = setTimeout(() => {
            this.save();
            this.saveTimeout = null;
        }, 30 * 1000);
    }

    private clearExpired(): void {
        const now = Date.now();
        for (const [key, value] of Object.entries(this.cache)) {
            if (!value.time || (now - value.time > this.duration)) {
                delete this.cache[key];
                this.saveDebounced();
            }
        }
    }

    get(url: string): T | undefined {
        const now = Date.now();
        const entry = this.cache[url];
        if (entry && now - entry.time <= this.duration) {
            return entry.value;
        }
        return undefined;
    }

    set(url: string, value: T): void {
        this.cache[url] = { value, time: Date.now() };
        this.saveDebounced();
    }
}

export class RegionModifier {
    private readonly cache: Cache<number>;

    constructor() {
        const cacheDuration = 24 * 60 * 60 * 1000; // 1D
        this.cache = new Cache('ekkoGamesRegions', cacheDuration);
    }

    /**
     * @returns Count of modified giveaways
     */
    async modifyGiveaways(): Promise<number> {
        const regions = document.querySelectorAll<HTMLAnchorElement>('.giveaway__column--region-restricted');
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
    async modifyGiveaway(): Promise<boolean> {
        const region = document.querySelector<HTMLAnchorElement>('.featured__column--region-restricted');
        return await this.modify(region);
    }

    /**
     * @param regionElement form `<a href="/giveaway/xxxxx/griftlands/region-restrictions">`
     * @returns Whether modified successfully
     */
    private async modify(regionElement: HTMLAnchorElement | null): Promise<boolean> {
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

    private async fetchRegionCounts(url: string): Promise<number> {
        const cached = this.cache.get(url);
        if (cached !== undefined) {
            return cached;
        }

        return await new Promise<number>((resolve, reject) => {
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
                    const text = doc.querySelector<HTMLElement>(resultsSelector)?.innerText;
                    if (!text) {
                        return reject(`Results text not found in ${url}`);
                    }
                    // Keep parse failures inside the promise: an escaping throw would
                    // leave it forever pending, hanging every `await` down the line.
                    let count: number;
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
                },
            });
        });
    }

    /**
     * @param text Region results text
     */
    private parseRegionCounts(text: string): number {
        if (text.includes('No results')) {
            return 0;
        }

        const matched = text.match(/(?:\d+) to (?:\d+) of (\d+) result/);
        if (!matched) {
            throw new Error(`Unexpected results text format: ${text}`);
        }
        return parseInt(matched[1]!, 10);
    }
}
