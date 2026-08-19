# AI Agent 課堂互動學習站 設計文件

日期：2026-08-19
狀態：待審閱

## 專案目標

以現有的「AI AGENT 課程規劃」9 章 TXT 教材為內容基礎，改寫成一個**單檔 HTML 課堂互動學習站**。專為講師在課堂上當簡報使用設計：

- 上課前選好要講的章節 → 課堂上像投影片一頁頁切換
- 只顯示選中的章節，未選的隱藏
- 全互動：視覺化 + 模擬操作 + 問答
- 三種視覺風格可一鍵切換

## 參考對象

比照 `Firebase-GitHub學習站\index.html`（約 1500 行單檔）的技術與互動模式，但內容換成 AI Agent 課程。

### Firebase 學習站的互動元件（沿用）
| 元件 | 功能 | 對應 AI Agent 課程用途 |
|------|------|----------------------|
| `.nav-tabs` + `.module` | Tab 切換模組 | 切換章節 |
| `.bento` / `.bento-card` | Bento Grid 卡片佈局 | 每章內容排版 |
| `.tree` + `toggleTree()` | 資料夾樹狀圖（可展開） | Skill 結構、Firebase 專案結構 |
| `.sim-container` + 逐步按鈕 | 模擬操作（指令逐行顯示） | 安裝指令、部署流程、Skill 建置 |
| `.quiz-q` + `checkQuiz()` | 問答（解析 + 記分） | 每章小測驗 |
| `.flow` / `.flow-step` | 流程圖（可標記 active） | 專案工作流程、部署流程 |
| `.concept` | 概念框 | 重點提示 |
| `.compare-table` | 比較表 | Git vs GitHub、本機 vs 網路 |
| `.info-grid` / `.info-item` | 資訊卡片格 | 術語卡 |
| `.cheat-grid` / `.cheat-item` | 指令速查表 | Cheat Sheet |
| `.progress-bar` + `.progress-fill` | 頂部學習進度條 | 章節完成度 |

## 三大特色（相對於 Firebase 學習站的增強）

### 1. 章節選擇器（簡報核心）
- 進站時顯示「設定面板」：9 個章節的勾選清單 + 「全選/全不選」+「進入課堂」按鈕
- 勾選狀態存 `localStorage`（key 用專案前綴：`ailearn-selected`）
- 課堂模式：底部固定導覽列顯示「◀ 上一頁 / 下一頁 ▶」+ 章節進度「第 N/M 章」+ 章節下拉選單
- 鍵盤左右方向鍵可翻頁
- 右上角「⚙ 設定」按鈕可回到設定面板重新選章

### 2. 三種風格主題切換器
- 右上角三個色塊按鈕（🌿 草綠 / 🌃 科技暗色 / ☀️ 清新教學）
- 用 `data-theme` 屬性切換 CSS 變數群（CSS custom properties）
- 選擇存 `localStorage`（key：`ailearn-theme`）
- 三套變數群：
  - **草綠風**：比照 Firebase 學習站（--primary:#76B947, --bg:#F1F5F2, 白色卡片, Inter 字體）
  - **科技暗色風**：深底 #0F172A / #1E293B，螢光藍 #38BDF8 + 紫 #A78BFA 漸層，淺色文字
  - **清新教學風**：淺藍 #E0F2FE / 白，主色 #0284C7，柔和投影，適合教室投影

### 3. 全互動內容（9 章逐章改寫）
每章都是一個 `.module`，內容以現有 9 章 TXT 教材為基礎改寫成互動元件。

## 章節互動形式規劃

| 章 | 主題 | 主要互動形式 | 內容來源 |
|----|------|------------|---------|
| 0 | 認識 AI Agent | 員工/Agent 對比示意 + 概念卡 + 3 題問答 | 00_認識AI_Agent.txt |
| 1 | 安裝 Node/Git | 安裝流程圖 + 模擬指令（node --version / git --version）+ 3 題問答 | 01_安裝Node與Git.txt |
| 2 | 安裝 opencode | 模擬對話（npm install -g opencode-ai → opencode --version）+ API key 授權點 + 3 題問答 | 02_安裝opencode.txt |
| 3 | 專案工作流程 | 6 步流程圖（可點擊標記 active）+ 劇本對話模擬 + 3 題問答 | 03_專案工作流程.txt |
| 4 | 第一次合作 | 本機 vs 網路對比表 + 成品示意 + 3 題問答 | 04_第一次合作.txt |
| 5 | 認識 Skill | SKILL.md 結構樹（可展開）+ 觸發示範 + 17 個 skill 清單 + 3 題問答 | 05_認識Skill.txt |
| 6 | 動手做 Skill | 逐步建 Skill 模擬 + 可複製範例 SKILL.md + 3 題問答 | 06_動手做Skill.txt |
| 7 | 上傳部署 | 部署流程動畫（gh repo create → push → Pages → firebase deploy）+ 安全檢查清單 + 3 題問答 | 07_上傳部署.txt |
| 8 | 結業專案 | 結業檢查清單互動（逐項勾選）+ 總進度 + 完成訊息 | 08_結業專案.txt |

每章共通要素：
- 每章 3 題問答（`data-answer` 索引 + 解析 + 記分，共用 quiz 邏輯）
- 每章保留教材的比喻與白話說明（小型工廠/時光機/遙控器等，與環境分析一致）
- 每章底部「本節重點」概念卡

## 技術規格

- **單一檔案**：`AI AGENT課程互動站\index.html`，CSS/JS 全部內嵌
- **無框架、無套件、無 build**，雙擊即可在瀏覽器開啟
- 字體：Inter（Google Fonts CDN，草綠風/清新風）+ 系統字體（暗色風）
- 純 HTML5 + CSS3 + Vanilla JavaScript
- localStorage keys（依專案前綴規則）：
  - `ailearn-selected`（選中的章節索引陣列）
  - `ailearn-theme`（主題：green / dark / fresh）
  - `ailearn-progress`（結業章節完成度，第 8 章用）
- 問答記分：每章獨立 score 顯示
- 防 XSS：動態內容一律 `textContent`，不插入使用者輸入

## 檔案位置

```
firebase雲端資料夾\
├── AI AGENT課程規劃\          ← 既有教材（內容來源）
└── AI AGENT課程互動站\
    └── index.html            ← 本專案產出（單檔）
```

## 品質標準

- 9 章全數互動化，每章含視覺化 + 模擬操作 + 3 題問答 + 重點
- 比喻與版本與既有教材一致（不新增矛盾內容）
- 三種主題切換後版面不破版（RWD）
- 章節選擇器：選後翻頁正常、未選章節完全不可見
- 課堂模式鍵盤翻頁正常
- 單檔、離線可用、無外部分支依賴（除 Google Fonts）

## 測試策略

- 本機瀏覽器開啟驗證：Tab 切換、模擬操作、問答、主題切換、章節選擇、鍵盤翻頁
- 內容一致性：抽樣比對教材比喻/版本
- JS 邏輯用 Vitest 對純函式測試（章節篩選、主題套用、問答計分、localStorage 讀寫）
  - `npm install -D vitest` 於專案目錄，測試檔 `index.test.js`
  - 純函式抽到 `index.html` 內 `<script>` 供測試 import（或用 .mjs 檔 + 內嵌載入）
