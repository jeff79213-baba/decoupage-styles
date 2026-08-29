# 每日 AI 新聞 — 英文新聞「中英對照」顯示設計文件

- 日期：2026-08-29
- 專案：每日AI新聞（每日 AI 新聞）
- 涉及檔案：`fetch_news.py`、`index.html`（由腳本重新生成）

## 背景與目標

目前頁面上英文來源（TechCrunch AI、MIT Technology Review、英文 Google News）的新聞會由 `fetch_news.py` 在生成時翻譯成中文，但翻譯結果**取代**了英文原文；且部分英文（尤其是 AI Agent 標籤頁的 Google News 結果）翻譯失敗後直接以英文殘留，閱讀吃力。

目標：**不新增翻譯按鈕**，改為在生成時直接把英文新聞輸出為「中英對照」——中文為主、英文原文小字在下方——於「AI 新聞」與「AI Agent」兩個標籤頁同時生效。

## 核心行為（fetch_news.py）

### 1. 英文偵測

新增純函式 `is_english(text)`：

- 只統計字母類字元，分別計算「拉丁字母數」與「中日韓字元（CJK）數」。
- `拉丁比例 = 拉丁字母數 / (拉丁字母數 + CJK 數)`
- 比例 > `0.5` 才判定為英文。
- 空字串或全無字母 → 回傳 `False`。

**判定範例：**

| 文字 | 拉丁比例 | 判定 |
|---|---|---|
| `Neocloud Lambda secures $1B in debt...` | ≈ 100% | 英文 ✔ |
| `ChatGPT續宰AI流量龍頭 泰國全球排名第26` | ≈ 0.47 | 中文（不翻譯）|
| `OpenAI提出網路集體防禦行動...` | ≈ 0.38 | 中文（不翻譯）|

> 目的：避免把「中英混雜但實為中文」的標題誤判為英文而翻譯變形。

### 2. 中英對照流程

對每一則 item 的 `title` 與 `summary` 分別處理：

1. 若 `is_english(文字)` 為真：
   - 記錄 `orig = 原文`
   - `trans = google_translate(原文)`（沿用現有 `google_translate()`，目的地 zh-TW）
   - 若 `trans` 與 `orig` 不同（翻譯成功）→ 主文字用 `trans`，並將 `orig` 存入 item 的 `orig` 欄位
   - 若翻譯失敗（`trans` 等於 `orig`）→ 主文字維持英文，不寫入 `orig`（避免重複顯示兩行英文）
2. 若為中文 → 直接使用，不動。

**item 結構延伸：** 英文新聞的 item 會多出可選欄位，例如：

```
{
  "title": "中文翻譯標題",
  "orig": {
    "title": "Neocloud Lambda secures $1B in debt to buy more chips",
    "summary": "...英文摘要..."
  },
  "summary": "中文翻譯摘要",
  ...
}
```

> 原「依 feed 的 lang 決定是否翻譯」的邏輯（`fetch_feed`、`fetch_google_news` 中 `lang == "en"` 的區塊）可保留其翻譯動作，但需補上 `orig` 保留而非覆蓋；同時對中文 feed 也套用 `is_english` 偵測，涵蓋「中文 feed 中偶爾出現的英文標題」。

## 頁面呈現

### 標題

- 中文翻譯為主：沿用現有 `.card a` 樣式（粗體黑字、點擊開連結）
- 下方灰字小字英文原文：新增樣式 `.orig`（英文原文本身非連結）

### 摘要

- 中文翻譯在上（沿用 `.summary`）
- 下方灰字小字英文原文（`.orig`）

### 樣式

CSS 新增：

```css
.orig{color:var(--muted);font-size:12px;margin-top:2px;line-height:1.4}
```

### 排版結構範例

```html
<div class='card'>
  <a href='...'>Neocloud Lambda 透過舉債取得 10 億美元購買更多晶片</a>
  <div class='orig'>Neocloud Lambda secures $1B in debt to buy more chips</div>
  <div class='summary'>…中文翻譯摘要…</div>
  <div class='orig'>…英文摘要原文…</div>
  <div class='meta'><span class='badge'>翻譯</span><span>08/29 04:24</span></div>
</div>
```

### 其他

- 英文來源的「翻譯」徽章保留。
- 中文來源（iThome 等）完全維持現狀，無 `.orig` 行。

## 翻譯失敗的處理

- 免費 Google 翻譯端點偶爾會失敗：若翻譯結果與原文相同，視為失敗，直接顯示英文原文單行（不產生重複的英文小字行）。
- 不重試、不加入前端補翻譯機制（YAGNI）。

## 測試

- 新增 `test_news.py` 單元測試（或擴充現有）：
  - `is_english()`：英文判定通過；純中文、中英混雜中文判定不通過；空字串回傳 `False`。
  - 生成流程含 `orig` 項目：渲染後 HTML 出現 `.orig` 行；翻譯失敗項目不出現 `.orig` 行。
- 手動執行 `fetch_news.py` 驗證結果頁：
  - AI 新聞頁英文來源為中英對照。
  - AI Agent 頁英文新聞為中英對照、中文新聞維持原樣。

## 成功標準

- 執行 `python fetch_news.py` 後，`index.html` 中所有英文標題/摘要皆顯示「中文為主、英文小字在下」。
- 「ChatGPT續宰AI流量龍頭」這類中英混雜中文標題未被誤翻譯。
- 中文來源新聞完全不被影響。
- 手動再跑一次並 `firebase deploy --only hosting` 讓線上頁面生效。

## 非目標

- 不做前端即時翻譯按鈕（使用者已放棄此方案）。
- 不使用付費翻譯 API、不新增後端 / Cloud Functions。
- 不儲存翻譯結果快取於 localStorage。