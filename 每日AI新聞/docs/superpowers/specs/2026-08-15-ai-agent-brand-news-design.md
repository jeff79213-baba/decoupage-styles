# 新增「AI Agent 品牌新聞」欄 — 設計文件

- 日期：2026-08-15
- 專案：每日AI新聞（每日 AI 新聞）
- 涉及檔案：`fetch_news.py`、`index.html`（由腳本重新生成）

## 目標

新增一個獨立欄位，專注於「主流 AI agent」品牌的即時新聞，供使用者快速閱讀。

## 品牌關鍵字清單

| 品牌 | 關鍵字 |
|---|---|
| Gemini | Gemini |
| ChatGPT / OpenAI | ChatGPT、OpenAI、GPT-4o、o3 |
| Claude / Anthropic | Claude、Anthropic |
| Copilot | Copilot、Microsoft AI |
| Grok / xAI | Grok、xAI |
| 其他 | Perplexity、Manus、DeepSeek、豆包、Kimi、文心一言 |

- 比對規則：不區分大小寫，命中標題或摘要任一即算。

## 資料來源（三路合併）

1. **Google News RSS 搜尋**（新增）
   - 中文查詢：`https://news.google.com/rss/search?q=<關鍵字組合>&hl=zh-TW&gl=TW&ceid=TW:zh-Hant`
   - 英文查詢：`https://news.google.com/rss/search?q=<關鍵字組合>&hl=en-US&gl=US&ceid=US:en`
   - 查詢以 OR 組合品牌關鍵字，抓取後再做一次關鍵字比對確保相關。
2. **數位時代 RSS**（新增）
   - `https://rss.bnextmedia.com.tw/feed/bnext`（中文，免翻譯）
3. **過濾現有 4 來源**
   - iThome / 科技新報 / TechCrunch AI / MIT Technology Review，標題或摘要含品牌關鍵字者。

## 處理邏輯

- 三路結果合併、依網址去重、按時間（台灣時間）降冪排序。
- 每則新聞顯示來源徽章（Google News / 數位時代 / iThome / 科技新報 / TechCrunch / MIT…）。
- 英文來源經 Google 翻譯成繁體中文（沿用現有機制）。
- 時間窗沿用 `HOURS_WINDOW = 30` 小時、每來源上限沿用 `MAX_PER_FEED`。

## 頁面呈現

- 在頁面最上方新增 `<section>`：「🤖 AI Agent 品牌新聞（N 則）」，單一混合清單、按時間排序。
- 若無結果，顯示「今天沒有抓到品牌 AI 新聞」。
- 現有 4 個來源欄位維持不變。
- 頁頭更新時間說明列加入新來源標示。

## 成功標準

- 執行 `python fetch_news.py` 後 `index.html` 最上方出現品牌新聞欄。
- 欄內新聞皆與清單中任一品牌相關。
- 現有欄位內容不受影響。

## 非目標

- 不新增分頁 tab。
- 不新增官方部落格 RSS。
- 不把 AICPB 納入（無新聞 RSS）。
