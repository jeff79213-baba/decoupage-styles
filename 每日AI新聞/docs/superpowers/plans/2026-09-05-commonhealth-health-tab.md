# 每日新聞新增「健康」分頁 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 將「每日AI新聞」改名「每日新聞」，新增「健康」分頁，每日抓取康健最新內容（10 篇）與每日輪播熱門話題主題。

**Architecture:** 在既有 `fetch_news.py` 內新增康健 API 抓取函式（requests 直接打康健 v3 JSON API，非 RSS）與 `build_health_html` 渲染，`build_page_html` 延伸加入第三個 tab，產出單一 `index.html`。既有每日 07:00 排程（`fetch_news.py` → `firebase deploy`）不需變更。

**Tech Stack:** Python 3 + requests + feedparser（既有）；stdlib `unittest` 測試（沿用 `test_news.py` 慣例）。康健 API base：`https://api-ch.commonhealth.com.tw/api/v3.0`，header 需帶 `api-key`（康健前端公開 client key）。

## Global Constraints

- 所有 python 執行用：`C:\Users\TW-10\Documents\firebase雲端資料夾\.venv\Scripts\python.exe`（主目錄 .venv）
- 測試一律：在 `每日AI新聞` 目錄下執行 `C:\Users\TW-10\Documents\firebase雲端資料夾\.venv\Scripts\python.exe -m unittest test_news -v`
- 使用 stdlib `unittest` + `mock`，沿用 `test_news.py` 既有風格，不新增測試框架
- 不新增第三方套件（requests/feedparser 已存在）
- API key 常數：`Cah2snYi52eJjpshbIfof1Tpx8ZhzXqh`（康健前端公開 client key，可放腳本）
- 健康內容全為中文，不需翻譯、無 `.orig` 行
- 健康 tab 按鈕**恆常渲染**；無資料時 health panel 內只顯示空訊息
- 既有 AI 抓取邏輯**完全**不動（只加新函式＋改渲染函式簽名）
- 改完程式碼後自動 `git commit + push`；並執行 `fetch_news.py` 重新生成 `index.html` 後 `firebase deploy --only hosting`
- Firestore/localStorage 前綴規則不適用本專案（無雲端資料存取）

---

### Task 1: 康健時間與文章解析純函式

**Files:**
- Modify: `每日AI新聞/fetch_news.py`（函式區，`google_translate` 之後）
- Test: `每日AI新聞/test_news.py`

**Interfaces:**
- Consumes: 無（獨立純函式）
- Produces:
  - `parse_ch_time(raw)` → `datetime`（台灣時區）或 `None`
  - `parse_ch_article(item)` → `{"title":str,"link":str,"summary":str,"time":datetime|None,"channel":str}` 或 `None`

- [ ] **Step 1: 先寫失敗測試**

在 `test_news.py` 的 `TestBuildPageHtml` 類別之前插入下列測試類別（內容區塊約在第 170 行前）：

```python
class TestChTime(unittest.TestCase):
    def test_parses_valid_datetime(self):
        dt = fn.parse_ch_time("2026-09-04 14:27:08")
        self.assertEqual(dt, datetime(2026, 9, 4, 14, 27, 8, tzinfo=TW))

    def test_invalid_returns_none(self):
        self.assertIsNone(fn.parse_ch_time("not a date"))
        self.assertIsNone(fn.parse_ch_time(""))
        self.assertIsNone(fn.parse_ch_time(None))


class TestChArticle(unittest.TestCase):
    def _raw(self, **over):
        base = {"id": 1, "type": "article", "item_id": 94534,
                "title": "兩大癲癇藥成做菜辛香料？",
                "preface": "前言摘要", "item_datetime": "2026-09-04 14:27:08",
                "channel_name": "生活智慧", "link": "https://www.commonhealth.com.tw/article/94534"}
        base.update(over)
        return base

    def test_parses_article_fields(self):
        a = fn.parse_ch_article(self._raw())
        self.assertEqual(a["title"], "兩大癲癇藥成做菜辛香料？")
        self.assertEqual(a["link"], "https://www.commonhealth.com.tw/article/94534")
        self.assertEqual(a["summary"], "前言摘要")
        self.assertEqual(a["channel"], "生活智慧")
        self.assertEqual(a["time"], datetime(2026, 9, 4, 14, 27, 8, tzinfo=TW))

    def test_skips_non_article_type(self):
        expert = {"id": 1, "type": "expert", "title": "專家", "link": "http://x"}
        self.assertIsNone(fn.parse_ch_article(expert))

    def test_skips_missing_title(self):
        self.assertIsNone(fn.parse_ch_article(self._raw(title="   ")))

    def test_bad_time_gives_none(self):
        a = fn.parse_ch_article(self._raw(item_datetime="bad"))
        self.assertIsNone(a["time"])
```

- [ ] **Step 2: 執行測試確認失敗**

Run:
```powershell
C:\Users\TW-10\Documents\firebase雲端資料夾\.venv\Scripts\python.exe -m unittest test_news.TestChTime test_news.TestChArticle -v
```
Expected: FAIL（`AttributeError: module 'fetch_news' has no attribute 'parse_ch_time'`）

- [ ] **Step 3: 實作純函式**

在 `fetch_news.py` 的 `google_translate()`（約 164 行）與 `parse_time()`（167 行）之間插入：

```python
def parse_ch_time(raw):
    """解析康健 API 時間字串（'2026-09-04 14:27:08'，台灣時區），失敗回 None。"""
    if not raw or not isinstance(raw, str):
        return None
    try:
        return datetime.strptime(raw, "%Y-%m-%d %H:%M:%S").replace(tzinfo=TAIWAN_TZ)
    except ValueError:
        return None


def parse_ch_article(item):
    """從康健 API item dict 抽出文章欄位；非 article 型別或無標題回 None。"""
    if not isinstance(item, dict) or item.get("type") != "article":
        return None
    title = strip_html(str(item.get("title") or "")).strip()
    if not title:
        return None
    return {
        "title": title,
        "link": item.get("link") or "",
        "summary": (item.get("preface") or "").strip(),
        "time": parse_ch_time(item.get("item_datetime")),
        "channel": item.get("channel_name") or "",
    }
```

- [ ] **Step 4: 執行測試確認通過**

```powershell
C:\Users\TW-10\Documents\firebase雲端資料夾\.venv\Scripts\python.exe -m unittest test_news.TestChTime test_news.TestChArticle -v
```
Expected: PASS（全部 ok）

- [ ] **Step 5: Commit**

```powershell
git add "每日AI新聞/fetch_news.py" "每日AI新聞/test_news.py"
git commit -m "feat: 新增康健時間與文章解析純函式"
```

---

### Task 2: 康健 API 抓取器

**Files:**
- Modify: `每日AI新聞/fetch_news.py`（頂部常數區＋抓取函式區）
- Test: `每日AI新聞/test_news.py`

**Interfaces:**
- Consumes: Task 1 的 `parse_ch_article(it)`、`parse_ch_time`
- Produces:
  - 常數 `API_CH_BASE`、`API_CH_KEY`
  - `ch_api_get(path, **params)` → `dict`（失敗回 `{}`）
  - `fetch_ch_latest(limit=10)` → `list[article dict]`（依時間降冪）
  - `fetch_ch_theme()` → `(title, desc, list[article dict])`，失敗 `(None, None, [])`

- [ ] **Step 1: 先寫失敗測試**

插在 `TestChArticle` 類別之後：

```python
class TestChApi(unittest.TestCase):
    def test_latest_failure_returns_empty(self):
        with mock.patch("fetch_news.ch_api_get", return_value={}):
            self.assertEqual(fn.fetch_ch_latest(), [])

    def test_latest_parses_filters_and_sorts(self):
        data = {"items": {"list": [
            {"type": "article", "title": "舊新聞", "preface": "p",
             "item_datetime": "2026-09-03 10:00:00", "channel_name": "醫療", "link": "http://a"},
            {"type": "article", "title": "新新聞", "preface": "q",
             "item_datetime": "2026-09-04 10:00:00", "channel_name": "運動", "link": "http://b"},
            {"type": "expert", "title": "要跳過", "preface": "", "id": 99},
        ]}}
        with mock.patch("fetch_news.ch_api_get", return_value=data):
            items = fn.fetch_ch_latest()
        self.assertEqual([i["title"] for i in items], ["新新聞", "舊新聞"])
        self.assertEqual(items[0]["channel"], "運動")

    def test_theme_failure_returns_empty_tuple(self):
        with mock.patch("fetch_news.ch_api_get", return_value={}):
            self.assertEqual(fn.fetch_ch_theme(), (None, None, []))

    def test_theme_parses(self):
        data = {"items": {"title": "AI上工你準備好了嗎？", "description": "主題描述",
                          "items": [
                              {"type": "article", "title": "主題文", "preface": "s",
                               "item_datetime": "2026-04-15 16:30:25", "channel_name": "醫療",
                               "link": "http://t"}]}}
        with mock.patch("fetch_news.ch_api_get", return_value=data):
            title, desc, items = fn.fetch_ch_theme()
        self.assertEqual(title, "AI上工你準備好了嗎？")
        self.assertEqual(desc, "主題描述")
        self.assertEqual([i["title"] for i in items], ["主題文"])
```

- [ ] **Step 2: 執行測試確認失敗**

```powershell
C:\Users\TW-10\Documents\firebase雲端資料夾\.venv\Scripts\python.exe -m unittest test_news.TestChApi -v
```
Expected: FAIL（`AttributeError: module 'fetch_news' has no attribute 'ch_api_get'` 等）

- [ ] **Step 3: 實作抓取器**

在 `fetch_news.py` 頂部常數區（`BRANDS` 定義前，約第 25 行前）加入：

```python
API_CH_BASE = "https://api-ch.commonhealth.com.tw/api/v3.0"
API_CH_KEY = "Cah2snYi52eJjpshbIfof1Tpx8ZhzXqh"  # 康健前端公開 client key
```

在 Task 1 的 `parse_ch_article` 之後插入抓取函式：

```python
def ch_api_get(path, **params):
    """呼叫康健 v3 API，回傳 JSON dict；任何失敗回 {}（不拋例外）。"""
    url = API_CH_BASE + path
    headers = {**UA, "api-key": API_CH_KEY}
    try:
        r = requests.get(url, params=params, headers=headers, timeout=15)
        r.raise_for_status()
        data = r.json()
        return data if isinstance(data, dict) else {}
    except Exception as e:
        print(f"  [康健] API 抓取失敗: {e}")
        return {}


def fetch_ch_latest(limit=10):
    """康健最新內容（全部頻道）。回傳依時間降冪的 article 清單。"""
    data = ch_api_get("/latest_article/channel/focus/list", page=1, limit=limit)
    items = []
    for it in (data.get("items") or {}).get("list") or []:
        a = parse_ch_article(it)
        if a:
            items.append(a)
    items.sort(key=lambda x: x["time"] or datetime.min.replace(tzinfo=TAIWAN_TZ), reverse=True)
    print(f"  [康健] 最新內容 {len(items)} 則")
    return items


def fetch_ch_theme():
    """康健目前上線的熱門話題主題。回傳 (title, description, article 清單)，失敗時 (None, None, [])。"""
    data = ch_api_get("/theme/online")
    obj = data.get("items") or {}
    title = obj.get("title")
    desc = obj.get("description")
    items = []
    for it in obj.get("items") or []:
        a = parse_ch_article(it)
        if a:
            items.append(a)
    print(f"  [康健] 熱門話題{'：' + str(title) if title else ''} {len(items)} 則")
    return title, desc, items
```

注意：`UA` 已在 `fetch_news.py` 約 78 行定義，`ch_api_get` 需在 `UA` 之後方可使用（函式執行時才讀取，Python 定義順序允許，但為可讀性建議放在 `UA` 定義之後）。

- [ ] **Step 4: 執行測試確認通過**

```powershell
C:\Users\TW-10\Documents\firebase雲端資料夾\.venv\Scripts\python.exe -m unittest test_news.TestChApi -v
```
Expected: PASS

- [ ] **Step 5: Commit**

```powershell
git add "每日AI新聞/fetch_news.py" "每日AI新聞/test_news.py"
git commit -m "feat: 新增康健 API 抓取器（最新內容與熱門話題）"
```

---

### Task 3: 健康分頁 HTML 渲染

**Files:**
- Modify: `每日AI新聞/fetch_news.py`（`build_page_html` 前的渲染函式區）
- Test: `每日AI新聞/test_news.py`

**Interfaces:**
- Consumes: Task 1 的 article dict 格式、現有 `fmt_time()`、`html`、`build_page_html` 已存在
- Produces: `build_health_html(latest, theme_title, theme_desc, theme_items)` → `str`（HTML 片段）

- [ ] **Step 1: 先寫失敗測試**

插在 `TestChApi` 類別之後：

```python
class TestBuildHealthHtml(unittest.TestCase):
    def _item(self, title, channel="營養", time=None):
        return {"title": title, "link": "http://c", "summary": "摘要",
                "time": time, "channel": channel}

    def test_latest_section(self):
        html = fn.build_health_html([self._item("健康文章")], None, None, [])
        self.assertIn("最新健康內容", html)
        self.assertIn("健康文章", html)
        self.assertIn("康健", html)
        self.assertIn("營養", html)

    def test_theme_section(self):
        html = fn.build_health_html([], "AI上工你準備好了嗎？", "主題描述",
                                    [self._item("主題文章", "運動")])
        self.assertIn("熱門話題：AI上工你準備好了嗎？", html)
        self.assertIn("主題文章", html)
        self.assertIn("主題描述", html)

    def test_empty_state(self):
        html = fn.build_health_html([], None, None, [])
        self.assertIn("今天抓不到康健內容，請稍後再試。", html)
```

- [ ] **Step 2: 執行測試確認失敗**

```powershell
C:\Users\TW-10\Documents\firebase雲端資料夾\.venv\Scripts\python.exe -m unittest test_news.TestBuildHealthHtml -v
```
Expected: FAIL

- [ ] **Step 3: 實作渲染函式**

在 `fetch_news.py` 的 `orig_lines()`（約 307 行）與 `build_page_html()`（約 315 行）之間插入：

```python
def ch_card_html(it):
    """康健文章卡 HTML：標題連結 + 摘要 + meta（康健 badge、頻道、時間）。"""
    badge = "<span class='badge'>康健</span>"
    ch = f"<span class='badge'>{html.escape(it['channel'])}</span>" if it.get("channel") else ""
    t = fmt_time(it.get("time"))
    return (
        f"<div class='card'><a href='{html.escape(it.get('link', ''))}' target='_blank' rel='noopener'>"
        f"{html.escape(it.get('title', ''))}</a>"
        f"<div class='summary'>{html.escape(it.get('summary', ''))}</div>"
        f"<div class='meta'>{badge}{ch}<span>{t}</span></div></div>"
    )


def build_health_html(latest, theme_title, theme_desc, theme_items):
    """產生健康分頁 HTML。任一來源無資料時顯示空訊息。"""
    if latest:
        cards = "\n".join(ch_card_html(it) for it in latest)
        sec = (f"<section><h2>🍏 最新健康內容 <span class='count'>({len(latest)} 則)</span></h2>"
               f"{cards}</section>")
    else:
        sec = ("<section><h2>🍏 最新健康內容</h2>"
               "<p>今天抓不到康健內容，請稍後再試。</p></section>")
    if theme_title:
        head = f"<h2>🔥 熱門話題：{html.escape(theme_title)}</h2>"
        desc = f"<p class='summary'>{html.escape(theme_desc)}</p>" if theme_desc else ""
        cards = "\n".join(ch_card_html(it) for it in theme_items) if theme_items else (
            "<p>今天抓不到熱門話題，請稍後再試。</p>")
        sec += f"<section>{head}{desc}{cards}</section>"
    else:
        sec += ("<section><h2>🔥 熱門話題</h2>"
                "<p>今天抓不到康健內容，請稍後再試。</p></section>")
    return sec
```

- [ ] **Step 4: 執行測試確認通過**

```powershell
C:\Users\TW-10\Documents\firebase雲端資料夾\.venv\Scripts\python.exe -m unittest test_news.TestBuildHealthHtml -v
```
Expected: PASS

- [ ] **Step 5: Commit**

```powershell
git add "每日AI新聞/fetch_news.py" "每日AI新聞/test_news.py"
git commit -m "feat: 新增健康分頁 HTML 渲染函式"
```

---

### Task 4: build_page_html 延伸（第三分頁＋改名）

**Files:**
- Modify: `每日AI新聞/fetch_news.py` 的 `build_page_html()`（約 315-372 行）
- Test: `每日AI新聞/test_news.py`

**Interfaces:**
- Consumes: Task 3 的 `build_health_html(latest, theme_title, theme_desc, theme_items)`
- Produces: `build_page_html(results, agent_items, generated_at, health=None)` → `str`
  - `health` 為 dict：`{"latest": [...], "theme_title": str|None, "theme_desc": str|None, "theme_items": [...]}`；`None` 時渲染空狀態

- [ ] **Step 1: 先寫失敗測試**

在 `TestBuildPageHtml` 類別內追加兩個方法：

```python
    def test_page_has_health_tab_and_panel(self):
        health = {"latest": [{"title": "健康文章", "link": "http://c", "summary": "摘要",
                              "time": None, "channel": "營養"}],
                  "theme_title": "AI上工你準備好了嗎？", "theme_desc": "主題描述",
                  "theme_items": [{"title": "主題文章", "link": "http://d", "summary": "",
                                   "time": None, "channel": "醫療"}]}
        html = fn.build_page_html({}, [], "2026-09-05 00:00", health=health)
        self.assertIn('data-tab="health"', html)
        self.assertIn('id="health"', html)
        self.assertIn("最新健康內容", html)
        self.assertIn("熱門話題：AI上工你準備好了嗎？", html)
        self.assertIn("健康文章", html)
        self.assertIn("主題文章", html)
        self.assertIn("每日新聞", html)
        self.assertNotIn("每日 AI 新聞", html)

    def test_health_none_renders_empty_state(self):
        html = fn.build_page_html({}, [], "2026-09-05 00:00")
        self.assertIn('data-tab="health"', html)
        self.assertIn("今天抓不到康健內容", html)
```

- [ ] **Step 2: 執行測試確認失敗**

```powershell
C:\Users\TW-10\Documents\firebase雲端資料夾\.venv\Scripts\python.exe -m unittest test_news.TestBuildPageHtml -v
```
Expected: FAIL（`TypeError: build_page_html() takes 3 positional arguments but 4 were given`）

- [ ] **Step 3: 實作延伸**

`build_page_html` 簽名改為 `def build_page_html(results, agent_items, generated_at, health=None):`，並做三處修改：

**a. 在函式開頭（`cards = {...}` 前）加入 health 片段：**

```python
    if health:
        health_frag = build_health_html(health.get("latest") or [], health.get("theme_title"),
                                        health.get("theme_desc"), health.get("theme_items") or [])
    else:
        health_frag = build_health_html([], None, None, [])
```

**b. 修改 template（`agent = agent_section_html(agent_items)` 之後的 f-string）：**

`<title>每日 AI 新聞</title>` → `<title>每日新聞</title>`

`<h1>📰 每日 AI 新聞</h1>` → `<h1>📰 每日新聞</h1>`

tabs 區塊：

```html
<div class="tabs">
  <button type="button" class="tab active" data-tab="ai-news" onclick="switchTab('ai-news')">AI 新聞</button>
  <button type="button" class="tab" data-tab="ai-agent" onclick="switchTab('ai-agent')">AI Agent</button>
  <button type="button" class="tab" data-tab="health" onclick="switchTab('health')">健康</button>
</div>
```

在 `<div id="ai-agent" class="panel">...` 之後、`<footer>` 之前加入：

```html
<div id="health" class="panel">
{health_frag}
</div>
```

footer 改為：

```html
<footer>由 fetch_news.py 自動產生　・　每日自動更新　・　健康欄來源：康健</footer>
```

- [ ] **Step 4: 執行測試確認通過**

```powershell
C:\Users\TW-10\Documents\firebase雲端資料夾\.venv\Scripts\python.exe -m unittest test_news -v
```
Expected: PASS（全部測試含既有 27 個）

- [ ] **Step 5: Commit**

```powershell
git add "每日AI新聞/fetch_news.py" "每日AI新聞/test_news.py"
git commit -m "feat: build_page_html 加入健康分頁並改名每日新聞"
```

---

### Task 5: render_html / main 整合並實跑驗證

**Files:**
- Modify: `每日AI新聞/fetch_news.py` 的 `render_html()`（約 375-380 行）與 `main()`（約 383-413 行）

**Interfaces:**
- Consumes: Task 2 的 `fetch_ch_latest`、`fetch_ch_theme`；Task 4 的 `build_page_html(..., health=None)`
- Produces: `render_html(results, agent_items, generated_at, health=None)`；`main()` 呼叫康健抓取並傳入 health dict

- [ ] **Step 1: 修改 render_html 簽名**

```python
def render_html(results, agent_items, generated_at, health=None):
    page = build_page_html(results, agent_items, generated_at, health)
```

（內部其餘不動）

- [ ] **Step 2: 修改 main 加入康健抓取**

在 `main()` 的 Google News 區塊之後、`generated_at = ...` 之前插入：

```python
    print("▸ 抓取康健健康新聞…")
    ch_latest = fetch_ch_latest(10)
    ch_theme_title, ch_theme_desc, ch_theme_items = fetch_ch_theme()
    health = {"latest": ch_latest, "theme_title": ch_theme_title,
              "theme_desc": ch_theme_desc, "theme_items": ch_theme_items}
```

並把 `render_html(results, agent_items, generated_at)` 改為：

```python
    render_html(results, agent_items, generated_at, health)
```

同時把題尾 log 的 `total` 計算改成含健康：

```python
    total = sum(len(v) for v in results.values()) + len(agent_items) + len(ch_latest) + len(ch_theme_items)
```

- [ ] **Step 3: 執行全部測試**

```powershell
C:\Users\TW-10\Documents\firebase雲端資料夾\.venv\Scripts\python.exe -m unittest test_news -v
```
Expected: PASS

- [ ] **Step 4: 實跑腳本產生 index.html**

```powershell
C:\Users\TW-10\Documents\firebase雲端資料夾\.venv\Scripts\python.exe fetch_news.py
```
Expected: 輸出含 `[康健] 最新內容 N 則`、`[康健] 熱門話題… N 則`、`✔ 已生成 index.html`。執行 `run_log.txt` 被附加新行（Fetch 前瞻即可）。

用 Read 開啟 `每日AI新聞/index.html` 確認：`<title>每日新聞</title>`、三個 tab（`data-tab="ai-news"`、`"ai-agent"`、`"health"`）、health panel 內含「🍏 最新健康內容」與「🔥 熱門話題」與至少一篇康健文章卡片（含「康健」badge）。

- [ ] **Step 5: Commit**

```powershell
git add "每日AI新聞/fetch_news.py" "每日AI新聞/index.html" "每日AI新聞/run_log.txt"
git commit -m "feat: main 整合並生成含健康分頁的 index.html"
```

---

### Task 6: README 更新與部署

**Files:**
- Modify: `每日AI新聞/README.md`

**Interfaces:**
- Consumes: Task 5 完成後的程式碼事實
- Produces: 更新後的 README、已部署的線上頁面

- [ ] **Step 1: 更新 README 標題與說明**

把第 1 行 `# 每日 AI 新聞抓取器` 改為 `# 每日新聞抓取器`；第 3 行說明改為：

`每天 07:00 自動抓取 AI 新聞與康健健康新聞，生成單一 HTML 檔案（每天覆蓋）。`

新增一個「健康欄來源」小節（放在「新聞來源」表之後、「排程任務」之前）：

```markdown
## 健康欄來源（康健）

健康分頁來源為康健官網 API（`https://api-ch.commonhealth.com.tw/api/v3.0`，非 RSS）：

| 區塊 | 端點 | 說明 |
|------|------|------|
| 最新健康內容 | `/api/v3.0/latest_article/channel/focus/list?page=1&limit=10` | 全部頻道最新 10 篇 |
| 熱門話題 | `/api/v3.0/theme/online` | 每日輪播主題（每天 00:00 換檔），內文全列 |

> API 需帶 `api-key` header（康健前端公開 client key，定義於 `fetch_news.py` 的 `API_CH_KEY`）。
```

（該小節為純文字表格，無需對齊。）

- [ ] **Step 2: Commit + Push**

```powershell
git add "每日AI新聞/README.md"
git commit -m "docs: 更新 README（每日新聞改名與康健來源）"
git push
```

- [ ] **Step 3: 部署 Firebase Hosting**

```powershell
cd "C:\Users\TW-10\Documents\firebase雲端資料夾\每日AI新聞"
firebase deploy --only hosting --project opencode-sk
```
Expected: 部署成功（`- Hosting URL: https://daily-ai-news-sk.web.app` 或類似）

- [ ] **Step 4: 驗證線上頁面**

用 WebFetch 開 `https://daily-ai-news-sk.web.app`，確認標題「每日新聞」、健康分頁有最新內容與熱門話題。完成後回報「已上傳部署完成」。

---

## Self-Review 檢查

**Spec coverage：**
- ✅ 熱門話題＝首頁主題輪播 → Task 2 `fetch_ch_theme`、Task 3 主題區塊
- ✅ 最新內容＝只「全部」10 篇 → Task 2 `fetch_ch_latest(10)`、Task 3 最新區塊
- ✅ 網站改名「每日新聞」→ Task 4 title/h1
- ✅ 方法 A 整合 fetch_news.py → Task 1-5
- ✅ 錯誤處理（空訊息、不拋例外）→ Task 2 `ch_api_get`、Task 3 空狀態
- ✅ 測試（純函式＋渲染）→ Task 1/2/3/4 測試
- ✅ README、部署 → Task 6

**Placeholder scan：** 無 TBD/TODO；每個 code step 皆有完整程式碼。

**Type consistency：**
- `parse_ch_time` / `parse_ch_article` / `ch_api_get` / `fetch_ch_latest` / `fetch_ch_theme` / `build_health_html` / `ch_card_html` 在 Task 1-3 定義，Task 2-5 引用名稱一致
- `build_page_html(..., health=None)` 簽名 Task 4 更新，Task 5 `render_html` 與既有測試（不帶 health）相容
- article dict 欄位（title/link/summary/time/channel）跨 Task 1-4 一致