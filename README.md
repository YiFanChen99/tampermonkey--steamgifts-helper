# Tampermonkey: Steamgifts Helper

## Installation

1. Install [Violentmonkey](https://addons.mozilla.org/en-us/firefox/addon/violentmonkey/) (Firefox) or [Tampermonkey](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo) (Chrome) / [Tampermonkey](https://addons.opera.com/en/extensions/details/tampermonkey-beta/) (Opera).
2. Open `https://github.com/YiFanChen99/tampermonkey--steamgifts-helper/raw/main/Script.user.js` or click [here](https://github.com/YiFanChen99/tampermonkey--steamgifts-helper/raw/main/Script.user.js)
3. Click `Install`.

## 實作說明

`Script.user.js` 是進入點，透過 `@require` 載入 `src/` 底下兩隻檔案後，依網址判斷是列表頁（`/giveaways/search`）或單一頁（`/giveaway/`），再呼叫對應的 modifier。

### `src/sheetFetcher.js` — 取資料

負責從 Google App Script 取得 sheet 內容，並使用快取。

- `getWebAppUrl()`：依 localStorage 的 `ekkoGamesAccount` 決定用哪個帳號的 App Script URL（預設 `pig`，設為 `yf` 則切換）。
- `fetchData()`：實際發出請求，回應直接存進 localStorage 的 `ekkoGames`，並附上 `time` 時戳。
- `getOrFetchData()`：對外的入口。快取未過期就直接沿用，否則重新抓取。回傳 `{ time, games, labelMap }`。

sheet 資料以欄位代號存取（`B` 遊戲名、`G` 日期、`K` 想要程度），這一層不對內容做任何加工。

### `src/domModifier.js` — 比對與改 DOM

把 sheet 資料對應到畫面上的遊戲，並將結果附加上去。

- 標題：補上 期待度 與 更新時間（如果太久）
- 區域限制：（與 sheet 無關）另外抓取各遊戲的區域限制頁面取得數量後標示，並快取結果。

localStorage 用到的 key 列在 `Script.user.js` 開頭的註解。
