# CNC 程式碼錯誤偵測與錯誤面板設計

日期：2026-08-09
狀態：已與使用者確認（討論中確認，未實作）

## 目標

程式輸入後即時偵測「會讓控制器無法執行」的錯誤，並在左側導覽欄顯示錯誤列表。依 G-code 規則（FANUC + 三菱通用），涵蓋四類：格式與非法碼、換刀與補正、結構與變數、運動與安全。

## 名詞定義

| 詞 | 定義 |
|---|---|
| 錯誤 (error) | 會導致控制器無法執行/忽略該行程式，必須修正 |
| 警告 (warning) | 有風險但控制器仍可執行，建議確認 |
| 提示 (info) | 可優化的地方，不影響執行 |
| 段 (block) | 以 `N1(...)` 開頭的刀具段，含 toolNo/hNo/dNo/gCodes/mCodes/variables |

## 資料結構

### 偵測結果

```js
// codeChecker.js 輸出，每筆一個問題
{ line: 1,        // 1-indexed 行號
  column: 1,      // 1-indexed 欄位（該行內位置）
  type: 'error' | 'warning' | 'info',
  code: 'E-FMT-001',   // 規則代號，見規則表
  message: '括號未閉合' // 顯示訊息（繁體中文） }
```

### store 新增 state

- `selectedNav` 已存在（'tools' | 'variables' | 'coordinates'），新增 `'errors'`
- `errors: []` — active 檔的錯誤清單（getter 計算或 setter 更新）
- `errorsFor(fileId)` — 依檔案緩存的錯誤（切檔不重算）

## 架構

### 1. `src/utils/codeChecker.js`（新增，純函式）

- 簽名：`checkNC({ text, blocks, tools, variables }) → Problem[]`
- 不依賴 Vue，可獨立單元測試（Vitest）
- 規則分四組（見規則表），每組回傳 `{ line, column, type, code, message }`

### 2. `src/stores/editor.js`（修改）

- `rawText` 變更時 debounce 300ms 呼叫 `checkNC`，結果存 `errors`
- getter：`errors` 回傳 active 檔的錯誤（依 `activeFileId` 切換）
- `setNav('errors')` 生效（沿用現有機制）

### 3. `src/components/ErrorList.vue`（新增）

- 顯示 active 檔錯誤列表：嚴重度圖示（error ⛔ 紅／warning ⚠ 橘／info ℹ 灰）、行號、message
- 每列可點擊 → `emit('navigate', lineIndex)` → 跳到該行（重用 LeftNav 既有 emit）
- 無錯誤時顯示「未偵測到錯誤」

### 4. `src/components/LeftNav.vue`（修改）

- sections 新增 `{ key: 'errors', label: '錯誤' }`
- 分頁標籤帶計數徽章（僅 errors，顯示錯誤+警告總數）
- nav-content 加入 `<ErrorList @navigate="emit('navigate', $event)" />`

### 5. `src/components/EditorPanel.vue`（修改）

- 錯誤行在 gutter 加標記（沿用既有 BookmarkDot 做法，新增 ErrorDot 紅色小點，`position: absolute` 於 lineNumber 後）
- 錯誤清單變化時呼叫 applyErrors（比照 applyBookmarks）

## 規則表

### A. 格式與非法碼（錯誤為主）

| code | 檢查 | 判定 |
|---|---|---|
| E-FMT-001 | 括號 `(` 無對應 `)` | error |
| E-FMT-002 | 括號 `)` 無對應 `(` | error |
| E-FMT-003 | N 段號重複 | error |
| E-FMT-004 | N 段號非遞增（後段 ≤ 前段） | warning || E-FMT-005 | 未知 G 碼（不在內建清單） | error |
| E-FMT-006 | 未知 M 碼（不在內建清單） | error |
| E-FMT-007 | 行首出現非法字元（不在 N/G/M/T/H/D/X/Y/Z/S/F/#/WHILE/END/GOTO/(/)/%） | error |
| E-FMT-008 | 座標 X/Y/Z 後緊接非數字字元（如 `X,` 或 `X` 後無值） | error |
| E-FMT-009 | G 碼多位數字（如 G100，超出控制器範圍） | warning |

### B. 換刀與補正

| code | 檢查 | 判定 |
|---|---|---|
| E-TOOL-001 | 換刀 `M6` 出現但無 `T(\d+)` 搭配 | error |
| E-TOOL-002 | 段內 `T(\d+)M6` 的刀號與該段 N 標題刀具不相符 | warning |
| E-TOOL-003 | `H` 號與段內刀號不符 | warning |
| E-TOOL-004 | `D` 號與段內刀號不符 | warning |
| E-TOOL-005 | 使用未定義刀具（`T(\d+)M6` 但無對應 N 段標題） | error |
| E-TOOL-006 | 出現 `D` 但同段/前段無 `G41`/`G42` | warning |
| E-TOOL-007 | 出現 `H` 但無 `G43` | info |

### C. 結構與變數

| code | 檢查 | 判定 |
|---|---|---|
| E-STR-001 | `WHILE[..]DO1` 無對應 `END1` | error |
| E-STR-002 | `END1` 無對應 `WHILE[..]DO1` | error |
| E-STR-003 | DO 編號不匹配（DO1 vs END1 以外的數字） | error |
| E-STR-004 | `GOTO` 目標段號不存在 | error |
| E-STR-005 | 使用 `#變數` 前未定義（前面無 `#N=...`） | error |
| E-STR-006 | 迴圈變數 `#100` 使用前未賦值（無 `#100=...`） | error |
| E-STR-007 | `G#100` 動態座標系，但 `#100` 非座標系號範圍（54~59 或 300+） | warning |

### D. 運動與安全

| code | 檢查 | 判定 |
|---|---|---|
| E-MOT-001 | 同段同時含 `G0`/`G00` 與 `G1`/`G01` | error |
| E-MOT-002 | 同段同時含 `G41` 與 `G42` | error |
| E-MOT-003 | `M30`/`M02` 前無 `G28`（回原點） | warning |
| E-MOT-004 | 使用 `G54`~`G59` 但程式前段未出現該座標系設定 | warning |
| E-MOT-005 | 有 `Z` 進給（G1 含 Z）但前面無 `M3`/`M4`（主軸未轉） | warning |
| E-MOT-006 | 段內同時定義 `#100` 又在同一 WHILE 內未修改 → 無限迴圈 | info |

## 內建合法 G/M 碼清單

第一版內建 FANUC + 三菱通用碼：

- **G 碼**：G0,G1,G2,G3,G4,G10,G17,G18,G19,G20,G21,G28,G30,G40,G41,G42,G43,G44,G49,G50,G54,G55,G56,G57,G58,G59,G68,G69,G73,G74,G76,G80,G81,G82,G83,G84,G85,G86,G87,G88,G89,G90,G91,G92,G93,G94,G95,G98,G99
- **M 碼**：M0,M1,M2,M3,M4,M5,M6,M7,M8,M9,M30,M98,M99

不在清單內 → E-FMT-005/006。此清單為規則檔一部分，集中在 `codeChecker.js` 頂部常數，日後可擴充。

## 互動細節

1. **即時偵測**：`rawText` 變更後 300ms debounce 重新計算，存該檔錯誤。切檔時直接顯示該檔已算好的結果，不閃動。
2. **點擊跳轉**：ErrorList 每列 click → `navigate` emit（lineIndex = line - 1）→ 既有 `handleNavigate` 已處理跳行與滾動。
3. **gutter 標記**：錯誤行顯示紅點（ErrorDot），警告行顯示橘點，提示不顯示。多個問題同一行合併一顆（依最高嚴重度顏色）。
4. **計數徽章**：LeftNav「錯誤」分頁標籤顯示 `錯誤 N`（N = error + warning 數）。
5. **並排模式**：只偵測 active 檔；ErrorList 顯示的內容隨 active 檔切換。
6. **分切畫面**：同一檔分兩格時，錯誤標記兩格都顯示（沿用 view/view2 同步邏輯）。

## 測試策略

- **單元測試（Vitest）**：`codeChecker.test.js` 針對每條規則寫測試：
  - 每條規則至少一個「觸發案例」+ 一個「不觸發案例」
  - 用真實 A/B/C/D.NC 樣本（經 `parseNC` 真實路徑）跑一次，確認無誤報（重點：WHILE/END1、T0M6、G#100、M01、G00/G01 前導零、G99、括號註解含碼、N 號亂序這些合法模式不得報錯）
- **元件測試**：無（沿用現行 store 測試方式）
- **E2E**：涉及多角色/金流才需要，此功能不需 Playwright。用現有 CDP 方式驗證：
  - drop 一支 NC → LeftNav「錯誤」分頁出現、數量正確
  - 點錯誤列 → 編輯器跳到該行
  - 編輯器錯誤行有紅點
- **手動驗證**：A.NC（含 WHILE/T0M6 等合法模式）不應有誤報；故意插入錯誤（缺 END1、括號不閉合、未知 G 碼）確認偵測到

## 不做的事（YAGNI）

- 不修改程式內容（不自動修復）
- 不做規則設定 UI（第一版內建清單，日後要改走 codeChecker.js 常數）
- 不做跨檔交叉檢查（GOTO 只查本檔）
- 不做「傳輸模擬」或 USB/序列埠連線

## 驗收標準

1. 拖入 A/B/C/D.NC 任一支，LeftNav「錯誤」分頁顯示，錯誤數合理（A.NC 合法模式無誤報）
2. 在編輯器插入明顯錯誤（刪除 END1／未閉括號／未知 G 碼如 G6）→ 3 秒內錯誤面板更新、錯誤行出現紅點
3. 點錯誤列 → 跳轉到該行
4. 切換分頁/並排點不同檔 → 錯誤面板隨 active 檔切換
5. `npm test` 全部通過、`vite build` 成功、安裝版 file:// 可執行
