# 每日 AI 新聞 — 單頁雙標籤（AI 新聞 / AI Agent）設計文件

- 日期：2026-08-15
- 專案：每日AI新聞（每日 AI 新聞）
- 涉及檔案：`fetch_news.py`、`index.html`（由腳本重新生成）

## 目標

單一頁面以「AI 新聞 / AI Agent」雙標籤切換。AI Agent 標籤下專注於「主流 AI agent」品牌的即時新聞，每則新聞掛品牌標籤徽章。

## 頁面結構

- 單一 `index.html`，頂部兩個 tab：**「AI 新聞」**（預設）｜**「AI Agent」**。
- 純 JS 切換顯示區塊（`display` 切換），不換頁。
- 資料由 `fetch_news.py` 產生時內嵌。

## 「AI 新聞」tab

- 維持現狀：iThome / 科技新報 / TechCrunch AI / MIT Technology Review 四欄。
- 不作任何變動。

## 「AI Agent」tab

### 品牌關鍵字清單

| 品牌 | 關鍵字 |
|---|---|
| Gemini | Gemini |
| ChatGPT / OpenAI | ChatGPT、OpenAI、GPT-4o、o3 |
| Claude / Anthropic | Claude、Anthropic |
| Copilot | Copilot、Microsoft AI |
| Grok / xAI | Grok、xAI |
| 其他 | Perplexity、Manus、DeepSeek、豆包、Kimi、文心一言 |

- 比對規則：不區分大小寫，命中標題或摘要任一即算；一則可對應多個品牌。

### 資料來源（三路合併）

1. **Google News RSS 搜尋**（新增）
   - 中文查詢：`https://news.google.com/rss/search?q=<關鍵字組合>&hl=zh-TW&gl=TW&ceid=TW:zh-Hant`
   - 英文查詢：`https://news.google.com/rss/search?q=<關鍵字組合>&hl=en-US&gl=US&ceid=US:en`
   - 查詢以 OR 組合品牌關鍵字，抓取後再做一次品牌關鍵字比對確保相關。
2. **數位時代 RSS**（新增）
   - `https://rss.bnextmedia.com.tw/feed/bnext`（中文，免翻譯）
3. **過濾現有 4 來源**
   - iThome / 科技新報 / TechCrunch AI / MIT，標題或摘要含品牌關鍵字者。

### 處理邏輯

- 三路結果合併、依網址去重、按時間（台灣時間）降冪排序。
- 每則新聞顯示**品牌標籤徽章**（可多個）＋**來源徽章**（Google News / 數位時代 / iThome / 科技新報 / TechCrunch / MIT…）＋時間。
- 英文來源經 Google 翻譯成繁體中文（沿用現有機制）。
- 時間窗沿用 `HOURS_WINDOW = 30` 小時；Google News 每語言上限 `MAX_PER_FEED`，數位時代/現有來源沿用既有上限。
- 品牌標籤為純展示徽章，不提供點擊過濾（YAGNI）。

## 頁面呈現

- 頂部 tab 列：「AI 新聞」｜「AI Agent」。
- AI Agent tab 內為單一混合清單、按時間排序，卡片含品牌標籤徽章、來源徽章、時間。
- 若無結果，顯示「今天沒有抓到品牌 AI 新聞」。
- 頁頭更新時間說明列更新來源標示（含 Google News、數位時代）。

## 成功標準

- 執行 `python fetch_news.py` 後 `index.html` 有雙 tab 切換。
- AI Agent tab 內新聞皆與清單中任一品牌相關，且掛有品牌標籤。
- AI 新聞 tab 內容與原本相同，不受影響。

## 非目標

- 不新增獨立頁面。
- 不新增官方部落格 RSS。
- 不把 AICPB 納入（無新聞 RSS）。
- 品牌標籤不做點擊過濾。
