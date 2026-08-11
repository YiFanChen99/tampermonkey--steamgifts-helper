# Tampermonkey: Steamgifts Helper

## Installation

1. Install [Violentmonkey](https://addons.mozilla.org/en-us/firefox/addon/violentmonkey/) (Firefox) or [Tampermonkey](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo) (Chrome) / [Tampermonkey](https://addons.opera.com/en/extensions/details/tampermonkey-beta/) (Opera).
2. Open `https://yifanchen99.github.io/tampermonkey--steamgifts-helper/Script.user.js` or click [here](https://yifanchen99.github.io/tampermonkey--steamgifts-helper/Script.user.js)
3. Click `Install`.

## 開發

原始碼是 TypeScript，`npm run build` 用 esbuild 打包成單一支 `dist/Script.user.js`（不壓縮，因為使用者會在 Tampermonkey 裡直接讀到它）。

```sh
npm install
npm run check      # typecheck + build
```

`dist/` 不進版控。push 到 `main` 後由 `.github/workflows/deploy.yml` 建置並發佈到 GitHub Pages，安裝網址即上方那一個。

metadata block 的唯一來源是 `scripts/metadata.mjs`，build 時產生。省略 `@updateURL`，讓 Tampermonkey 直接用 `@downloadURL` 做更新檢查，所以不需要額外維護 `.meta.js`。

> `Script.user.js`（repo 根目錄）與 `src/*.js` 是舊交付路徑的遺留檔案，已凍結不再更新，僅供尚未更新到新網址的既有安裝使用。

## 實作說明

`src/main.ts` 是進入點，依網址判斷是列表頁（`/giveaways/search`）或單一頁（`/giveaway/`），再呼叫對應的 modifier。

### `src/sheetFetcher.ts` — 取資料

負責從 Google App Script 取得 sheet 內容，並使用快取。

- `getWebAppUrl()`：依 localStorage 的 `ekkoGamesAccount` 決定用哪個帳號的 App Script URL（預設 `pig`，設為 `yf` 則切換）。
- `fetchData()`：實際發出請求，回應直接存進 localStorage 的 `ekkoGames`，並附上 `time` 時戳。
- `getOrFetchData()`：對外的入口。快取未過期就直接沿用，否則重新抓取。回傳 `{ time, games, labelMap }`。

sheet 資料以欄位代號存取（`B` 遊戲名、`G` 日期、`K` 想要程度，見 `src/types.ts`），這一層不對內容做任何加工。

### `src/domModifier.ts` — 比對與改 DOM

把 sheet 資料對應到畫面上的遊戲，並將結果附加上去。

- 標題：補上 期待度 與 更新時間（如果太久）
- 區域限制：（與 sheet 無關）另外抓取各遊戲的區域限制頁面取得數量後標示，並快取結果。

localStorage 用到的 key 列在 `src/main.ts` 開頭的註解。
