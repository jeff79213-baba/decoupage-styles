# 每日新聞 — 新增「健康」分頁（康健來源）設計文件

- 日期：2026-09-05
- 專案：每日AI新聞（改名為「每日新聞」）
- 涉及檔案：`fetch_news.py`、`index.html`（由腳本重新生成）、`test_news.py`、`README.md`

## 背景與目標

現有頁面只有 AI 新聞與 AI Agent 兩個分頁。使用者希望增加一個「健康」分頁，內容來源為康健（https://www.commonhealth.com.tw/），每天更新**最新內容**與**熱門話題**，並將網站正式改名為「每日新聞」。

康健網站是 Nuxt SPA，無 RSS（`/rss` 404），但有公開 JSON API：`https://api-ch.commonhealth.com.tw`（`api-key` 為前端公開 client key）。

## 需求確認（已與使用者確認）

| 項目 | 決定 |
|------|------|
| 熱門話題 | 康健首頁「熱門話題」主題區塊（每日輪播，每天 00:00 換檔），主題內文章全部顯示 |
| 最新內容 | 只顯示「全部」清單（不拆子頻道分頁），依時間降冪 |
| 文章數量 | 最新內容 10 篇；熱門話題主題內文章全列（通常 3~5 篇） |
| 網站命名 | 「每日AI新聞」→「每日新聞」 |
| 實作方式 | 整合進現有 `fetch_news.py`（方法 A），單一 `index.html`，既有每日排程自動生效 |

## 資料來源

康健 v3 API（需 header：`User-Agent`（沿用 UA）+ `api-key: Cah2snYi52eJjpshbIfof1Tpx8ZhzXqh`）：

| 用途 | 端點 | 參數 |
|------|------|------|
| 最新內容 | `GET /api/v3.0/latest_article/channel/focus/list` | `page=1`、`limit=10` |
| 熱門話題 | `GET /api/v3.0/theme/online` | 無（回傳目前上線主題＋內文清單） |

回應為 JSON，文章 item 取欄位：

```
{
  "id": 42780,
  "type": "article",            // 只保留 type == "article"
  "item_id": 94534,
  "title": "兩大癲癇藥…",
  "preface": "前言摘要…",
  "link": "https://www.commonhealth.com.tw/article/94534",
  "item_datetime": "2026-09-04 14:27:08",   // 台灣時區字串
  "channel_name": "生活智慧",                // 頻道名稱，當卡片標籤
  "page_view": 5352
}
```

theme 回應結構：`items` 含 `id / block_title`（熱門話題）、`title`（主題標題）、`description`、`items[]`（文章）。

## 核心行為（fetch_news.py）

### 新增純函式與抓取器

1. **`API_CH_BASE = "https://api-ch.commonhealth.com.tw/api/v3.0"`**、**`API_CH_KEY = "Cah2snYi52eJjpshbIfof1Tpx8ZhzXqh"`** 常數，放腳本頂部（與 `FEEDS` 等設定同區）。

2. **`parse_ch_time(raw)`** — 將 `"2026-09-04 14:27:08"` 解析為台灣時區 `datetime`；格式不符回 `None`。

3. **`parse_ch_article(item)`** — 從 API item dict 抽出 `{title, link, summary(=preface), time, channel}`；非 article 型別回 `None`。

4. **`fetch_ch_latest(limit=10)`** — 打最新內容端點，過濾+解析+依時間降冪，回傳 item 清單；失敗回傳 `[]` 並印 log。

5. **`fetch_ch_theme()`** — 打熱門話題端點，回傳 `(title, description, items)`；失敗回傳 `(None, None, [])` 並印 log。

6. **`ch_api_get(path, **params)`** — 共用 requests 呼叫：掛 UA + `api-key` header，timeout 15s，回傳 JSON dict；例外吞掉回 `{}`。

> 時間解析、欄位抽取為純函式，方便單元測試；網路呼叫集中在 `ch_api_get`。

### 頁面生成（build_page_html 延伸）

- 新增 `build_health_html(latest, theme)`：
  - 最新內容區塊：`<h2>🍏 最新健康內容 (N 則)</h2>`，逐篇 `.card`：標題連結、`.summary`（preface）、`.meta`（`康健` badge ＋ 頻道 badge ＋ 時間）。
  - 熱門話題區塊：`<h2>🔥 熱門話題：{主題標題}</h2>`，若 `description` 存在則顯示一列 `.summary`；主題文章全列 `.card`（同一格式）。
  - 任一來源無資料時該區塊顯示「今天抓不到康健內容，請稍後再試。」
- tabs 增加第三顆：`<button class="tab" data-tab="health" onclick="switchTab('health')">健康</button>`，panel `id="health"`。既有 `switchTab()` 不需改動。
- `<title>` 與 `<h1>` 改為「每日新聞」。
- 頁尾來源說明加入「健康欄來源：康健」。

### 主流程（main）

抓完 AI 來源後：

```python
print("▸ 抓取康健健康新聞…")
ch_latest = fetch_ch_latest(10)
ch_theme_title, ch_theme_desc, ch_theme_items = fetch_ch_theme()
```

`render_html()` 簽名延伸為 `render_html(results, agent_items, generated_at, health=None)`，`health` 為 `{"latest": [...], "theme_title": str, "theme_desc": str, "theme_items": [...]}`。`build_page_html` 同步延伸。

## 錯誤處理

- 任一康健端點失敗 → 該區塊顯示空訊息，AI 兩個分頁不受影響。
- 網路異常、JSON 格式異常、欄位缺失 → 在 `ch_api_get` / `parse_ch_article` 內防呆，不回傳例外進渲染。
- 現有 AI 抓取邏輯完全不改。

## 測試（test_news.py）

沿用現有 stdlib `unittest` + `mock` 慣例：

- `parse_ch_time`：正常字串產出正確 datetime；壞格式回 `None`。
- `parse_ch_article`：article 型別抽出正確欄位（含 channel）；非 article（如 expert）回 `None`。
- 渲染：`build_page_html`（傳入 health dict）產生的 HTML 包含 `data-tab="health"`、`最新健康內容`、`熱門話題`、`康健` badge、文章標題。
- 健康 tab 按鈕**恆常渲染**（為網站固定分頁）；health 為 `None` 或資料為空時，health panel 內僅顯示空訊息。既有測試（未傳 health）只 assert 既有字串存在、不 assert 卡片內容，因此維持綠燈。
- 空資料：`fetch_ch_latest`/`fetch_ch_theme` 回 `[]` 時，健康區塊顯示空訊息。
- 不寫網路測試；`ch_api_get` 失敗路徑用 mock 驗證回傳 `[]`/`(None,None,[])`，或併入渲染測試。

## 成功標準

- 執行 `python fetch_news.py` 產生 `index.html`，含三個分頁且健康分頁顯示最新 10 篇與熱門話題主題。
- `python -m unittest test_news -v` 全綠。
- 線上頁面（https://daily-ai-news-sk.web.app）更新後標題為「每日新聞」，健康分頁正常；既有 AI 兩分頁維持原樣。

## 非目標

- 不拆健康子分類分頁（醫療/癌症/運動…），只顯示「全部」清單。
- 不做熱門文章瀏覽數排行（只做首頁主題輪播）。
- 不新增後端 / Cloud Functions。
- 不把康健 API 改為前端即時呼叫（維持腳本生成靜態檔架構）。
- 不引入翻譯（健康內容全為中文）。