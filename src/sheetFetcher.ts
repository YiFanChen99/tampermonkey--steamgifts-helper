import type { SheetData } from './types';

const updateDurationMs = 24 * 60 * 60 * 1000; // 24 hours

const webAppUrlPig = 'https://script.google.com/macros/s/AKfycbwZWh1RFJmNCUaaVQyEzMXZRPDF8NlXtPwxyqKp_Wx2uiNqjnoh_yO7k334QdeNRyQR/exec';
const webAppUrlYf = 'https://script.google.com/macros/s/AKfycbxZ9fqXLb-h-M5D9g6Swy-B7tA4JOcIOphqI1cxNs3d8mA72OrUu1eFZJj5bKNVY-W-/exec';

function getWebAppUrl(): string {
    const account = localStorage.getItem('ekkoGamesAccount');
    if (account === 'yf') {
        return webAppUrlYf;
    }
    return webAppUrlPig; // default
}

async function fetchData(): Promise<SheetData> {
    console.log('Steamgifts-helper: fetchData starting ...');
    return new Promise(resolve => {
        GM_xmlhttpRequest({
            method: 'GET',
            url: getWebAppUrl(),
            onload: function (response) {
                const resp = JSON.parse(response.responseText) as Omit<SheetData, 'time'>;
                const data: SheetData = { ...resp, time: Date.now() };
                localStorage.setItem('ekkoGames', JSON.stringify(data));
                resolve(data);
            },
        });
    });
}

export async function getOrFetchData(): Promise<SheetData> {
    const old = localStorage.getItem('ekkoGames');
    if (old) {
        const record = JSON.parse(old) as SheetData;
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
