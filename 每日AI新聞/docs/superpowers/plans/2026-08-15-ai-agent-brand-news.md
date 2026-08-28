# 每日 AI 新聞 — 單頁雙標籤（AI 新聞 / AI Agent）實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 將 `fetch_news.py` 產出的單一 `index.html` 改為雙 tab（AI 新聞 / AI Agent），AI Agent tab 顯示主流 AI agent 品牌新聞並掛品牌標籤徽章。

**Architecture:** 在現有抓取腳本中新增品牌關鍵字匹配與合併邏輯（純函式、可單測），新增 Google News RSS 搜尋與數位時代 RSS 兩個來源，最後重寫 `render_html` 為雙 tab 頁面。資料模型統一為 item dict：`{"title", "link", "summary", "time", "source", "brands"}`。

**Tech Stack:** Python 3 + `requests` + `feedparser`（既有）；測試用 stdlib `unittest`（pytest 未安裝）。

## Global Constraints

- 執行環境一律用 `C:\Users\TW-10\Documents\firebase雲端資料夾\.venv\Scripts\python.exe`。
- 測試只用 stdlib `unittest`，不新增依賴。
- 沿用既有常數：`HOURS_WINDOW = 30`、`MAX_PER_FEED = 6`、`TAIWAN_TZ`。
- 品牌匹配：不區分大小寫，命中標題或摘要任一即算；一則可對應多個品牌。
- 「AI 新聞」tab 內容與現狀完全相同，不得更動既有 4 來源欄位。
- 英文來源沿用 `google_translate()` 翻譯機制。
- commit 訊息風格：`每日AI新聞: <中文描述>`。
- 設計文件：`每日AI新聞/docs/superpowers/specs/2026-08-15-ai-agent-brand-news-design.md`

---

### Task 1: 品牌匹配與合併（純函式）

**Files:**
- Create: `每日AI新聞/test_news.py`
- Modify: `每日AI新聞/fetch_news.py`（新增 `BRANDS`、`match_brands`、`merge_agent_items`）

**Interfaces:**
- Consumes: 既有 `strip_html`、`TAIWAN_TZ`（皆已在 fetch_news.py 定義）
- Produces:
  - `BRANDS`: `list[tuple[str, tuple[str, ...]]]` — 品牌名 → 關鍵字 tuple
  - `match_brands(title: str, summary: str = "") -> list[str]`
  - `merge_agent_items(items: list[dict]) -> list[dict]` — 去重（依 link）+ 依 time 降冪排序 + 略過無 brands 者

- [ ] **Step 1: 寫失敗測試**

Create `每日AI新聞/test_news.py`:

```python
# -*- coding: utf-8 -*-
"""每日 AI 新聞 — 純函式單元測試（stdlib unittest）
執行：python -m unittest test_news -v
"""
import sys
import os
import unittest
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import fetch_news as fn

TW = timezone(timedelta(hours=8))


class TestMatchBrands(unittest.TestCase):
    def test_gemini(self):
        self.assertEqual(fn.match_brands("Gemini 新功能上線", ""), ["Gemini"])

    def test_chatgpt_openai(self):
        self.assertEqual(fn.match_brands("ChatGPT 推出新版本", ""), ["ChatGPT"])

    def test_case_insensitive(self):
        self.assertEqual(fn.match_brands("GEMINI 大更新", ""), ["Gemini"])

    def test_claude(self):
        self.assertEqual(fn.match_brands("Claude 3.7", ""), ["Claude"])

    def test_multiple_brands(self):
        got = set(fn.match_brands("Gemini vs ChatGPT", ""))
        self.assertEqual(got, {"Gemini", "ChatGPT"})

    def test_match_in_summary(self):
        self.assertEqual(fn.match_brands("某標題", "Anthropic 發表新模型"), ["Claude"])

    def test_no_match(self):
        self.assertEqual(fn.match_brands("台積電先進製程", ""), [])

    def test_other_brands(self):
        self.assertEqual(fn.match_brands("DeepSeek 發布新模型", ""), ["其他"])


class TestMergeAgentItems(unittest.TestCase):
    def item(self, title, link, time, brands, source="S"):
        return {"title": title, "link": link, "summary": "", "time": time,
                "brands": brands, "source": source}

    def test_dedupe_by_link(self):
        a = self.item("A", "http://x", None, ["Gemini"])
        b = self.item("B", "http://x", None, ["Claude"])
        self.assertEqual(len(fn.merge_agent_items([a, b])), 1)

    def test_sort_by_time_desc(self):
        old = self.item("old", "http://1", datetime(2026, 8, 14, 10, 0, tzinfo=TW), ["Gemini"])
        new = self.item("new", "http://2", datetime(2026, 8, 15, 10, 0, tzinfo=TW), ["ChatGPT"])
        out = fn.merge_agent_items([old, new])
        self.assertEqual([i["title"] for i in out], ["new", "old"])

    def test_skips_non_brand_items(self):
        it = self.item("台積電", "http://1", None, [])
        self.assertEqual(fn.merge_agent_items([it]), [])


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: 執行確認測試失敗**

Run (workdir `每日AI新聞`):
```powershell
& "C:\Users\TW-10\Documents\firebase雲端資料夾\.venv\Scripts\python.exe" -m unittest test_news -v
```
Expected: FAIL — `AttributeError: module 'fetch_news' has no attribute 'match_brands'`

- [ ] **Step 3: 實作最小程式碼**

在 `fetch_news.py` 中，`MAX_PER_FEED = 6` 之後新增：

```python
BRANDS = [
    ("Gemini", ("gemini",)),
    ("ChatGPT", ("chatgpt", "openai", "gpt")),
    ("Claude", ("claude", "anthropic")),
    ("Copilot", ("copilot", "microsoft ai")),
    ("Grok", ("grok", "xai")),
    ("其他", ("perplexity", "manus", "deepseek", "doubao", "kimi", "文心一言", "豆包", "通義", "qwen")),
]
```

在 `summarize()` 之後新增：

```python
def match_brands(title, summary=""):
    """回傳標題/摘要中命中的品牌名稱清單（依 BRANDS 順序）。"""
    text = f"{title} {summary}"
    matched = []
    for label, kws in BRANDS:
        if any(re.search(re.escape(kw), text, re.IGNORECASE) for kw in kws):
            matched.append(label)
    return matched
```

在 `fetch_feed()` 之後新增：

```python
def merge_agent_items(items):
    """依 link 去重、只保留有品牌者、依時間降冪排序。"""
    seen = set()
    out = []
    for it in items:
        if not it.get("brands"):
            continue
        link = it.get("link", "")
        if link in seen:
            continue
        seen.add(link)
        out.append(it)
    out.sort(key=lambda x: x["time"] or datetime.min.replace(tzinfo=TAIWAN_TZ), reverse=True)
    return out
```

- [ ] **Step 4: 執行確認測試通過**

Run (workdir `每日AI新聞`):
```powershell
& "C:\Users\TW-10\Documents\firebase雲端資料夾\.venv\Scripts\python.exe" -m unittest test_news -v
```
Expected: `Ran 8 tests ... OK`

- [ ] **Step 5: Commit**

```bash
git add "每日AI新聞/fetch_news.py" "每日AI新聞/test_news.py"
git commit -m "每日AI新聞: 新增品牌匹配與品牌新聞合併純函式（含測試）"
```

---

### Task 2: Google News 搜尋 + 數位時代來源

**Files:**
- Modify: `每日AI新聞/test_news.py`（新增 `TestAgentQuery`）
- Modify: `每日AI新聞/fetch_news.py`

**Interfaces:**
- Consumes: Task 1 的 `BRANDS`、`match_brands`、`merge_agent_items`；既有 `strip_html`、`summarize`、`parse_time`、`google_translate`、`UA`、`TAIWAN_TZ`、`HOURS_WINDOW`、`MAX_PER_FEED`
- Produces:
  - `AGENT_FEEDS: list[dict]` — 額外給 AI Agent 欄的中文來源
  - `agent_query() -> str` — Google News 查詢字串
  - `fetch_google_news() -> list[dict]` — 中文+英文兩路搜尋結果（已含 brands）
  - 修改 `fetch_feed()`：item 增加 `"source"`、`"brands"` 欄位
  - 修改 `main()`：彙整 agent_pool 並產出 `agent_items`，傳給 render_html（Task 3 才會改簽名，此處先以新參數呼叫）

- [ ] **Step 1: 寫失敗測試（agent_query）**

在 `test_news.py` 的 `if __name__ == "__main__":` 之前新增：

```python
class TestAgentQuery(unittest.TestCase):
    def test_contains_brand_keywords(self):
        q = fn.agent_query()
        self.assertIn("Gemini", q)
        self.assertIn("ChatGPT", q)
        self.assertIn("Claude", q)
        self.assertIn(" OR ", q)
```

- [ ] **Step 2: 執行確認測試失敗**

Run (workdir `每日AI新聞`):
```powershell
& "C:\Users\TW-10\Documents\firebase雲端資料夾\.venv\Scripts\python.exe" -m unittest test_news -v
```
Expected: FAIL — `AttributeError: module 'fetch_news' has no attribute 'agent_query'`

- [ ] **Step 3: 實作 agent_query 與來源常數**

在 `fetch_news.py` 的 `FEEDS` 之後新增：

```python
AGENT_FEEDS = [
    {"name": "數位時代", "lang": "zh", "url": "https://rss.bnextmedia.com.tw/feed/bnext"},
]
```

在 import 區塊新增 `from urllib.parse import urlencode`（放在 `import re` 之後）。

在 `match_brands()` 之後新增：

```python
def agent_query():
    kws = [kw for _, kws in BRANDS for kw in kws]
    return " OR ".join(f'"{kw}"' for kw in kws)
```

- [ ] **Step 4: 執行確認測試通過**

Run (workdir `每日AI新聞`):
```powershell
& "C:\Users\TW-10\Documents\firebase雲端資料夾\.venv\Scripts\python.exe" -m unittest test_news -v
```
Expected: `Ran 9 tests ... OK`

- [ ] **Step 5: 實作 fetch_google_news**

在 `merge_agent_items()` 之後新增：

```python
def fetch_google_news():
    """用品牌關鍵字查 Google News RSS（中文 + 英文），回傳已配對品牌的 item 清單。"""
    configs = [
        {"hl": "zh-TW", "gl": "TW", "ceid": "TW:zh-Hant", "lang": "zh"},
        {"hl": "en-US", "gl": "US", "ceid": "US:en", "lang": "en"},
    ]
    all_items = []
    q = agent_query()
    for cfg in configs:
        url = "https://news.google.com/rss/search?" + urlencode(
            {"q": q, "hl": cfg["hl"], "gl": cfg["gl"], "ceid": cfg["ceid"]}
        )
        try:
            d = feedparser.parse(url, request_headers=UA)
        except Exception as e:
            print(f"  [Google News {cfg['hl']}] 抓取失敗: {e}")
            continue
        if not d.entries:
            print(f"  [Google News {cfg['hl']}] 0 則")
            continue
        now = datetime.now(TAIWAN_TZ)
        cutoff = now - timedelta(hours=HOURS_WINDOW)
        items = []
        for entry in d.entries[:30]:
            title = strip_html(entry.get("title", "")).strip()
            if not title:
                continue
            link = entry.get("link", "")
            summary = summarize(entry.get("summary") or entry.get("description") or "")
            published = parse_time(entry)
            if published and published < cutoff:
                continue
            brands = match_brands(title, summary)
            if not brands:
                continue
            items.append({"title": title, "link": link, "summary": summary, "time": published,
                          "source": "Google News", "brands": brands})
        items.sort(key=lambda x: x["time"] or datetime.min.replace(tzinfo=TAIWAN_TZ), reverse=True)
        items = items[:MAX_PER_FEED]
        if cfg["lang"] == "en":
            print(f"  [Google News {cfg['hl']}] {len(items)} 則（翻譯中…）")
            for it in items:
                it["title"] = google_translate(it["title"]) or it["title"]
                if it["summary"]:
                    it["summary"] = google_translate(it["summary"]) or it["summary"]
                time.sleep(0.6)
        else:
            print(f"  [Google News {cfg['hl']}] {len(items)} 則")
        all_items.extend(items)
    return all_items
```

- [ ] **Step 6: 修改 fetch_feed 增加 source/brands**

將 `fetch_feed()` 內：

```python
        items.append({"title": title, "link": link, "summary": summary, "time": published})
```

改為：

```python
        items.append({"title": title, "link": link, "summary": summary, "time": published,
                      "source": name, "brands": match_brands(title, summary)})
```

- [ ] **Step 7: 修改 main() 彙整 agent_items**

將 `main()` 內：

```python
    results = {}
    for feed in FEEDS:
        print(f"▸ 抓取 {feed['name']}…")
        results[feed["name"]] = fetch_feed(feed)
    generated_at = datetime.now(TAIWAN_TZ).strftime("%Y-%m-%d %H:%M")
    render_html(results, generated_at)
```

改為：

```python
    results = {}
    agent_pool = []
    for feed in FEEDS:
        print(f"▸ 抓取 {feed['name']}…")
        items = fetch_feed(feed)
        results[feed["name"]] = items
        agent_pool.extend(items)
    for feed in AGENT_FEEDS:
        print(f"▸ 抓取 {feed['name']}…")
        agent_pool.extend(fetch_feed(feed))
    print("▸ 抓取 Google News 品牌新聞…")
    agent_pool.extend(fetch_google_news())
    agent_items = merge_agent_items(agent_pool)
    generated_at = datetime.now(TAIWAN_TZ).strftime("%Y-%m-%d %H:%M")
    render_html(results, agent_items, generated_at)
```

（`render_html` 的新簽名在 Task 3 實作，此處先呼叫。）

- [ ] **Step 8: 跑全部測試確認通過**

Run (workdir `每日AI新聞`):
```powershell
& "C:\Users\TW-10\Documents\firebase雲端資料夾\.venv\Scripts\python.exe" -m unittest test_news -v
```
Expected: `Ran 9 tests ... OK`（fetch_google_news 為網路函式，端到端驗證在 Task 4）

- [ ] **Step 9: Commit**

```bash
git add "每日AI新聞/fetch_news.py" "每日AI新聞/test_news.py"
git commit -m "每日AI新聞: 新增 Google News 品牌搜尋與數位時代來源，彙整 AI Agent 新聞"
```

---

### Task 3: 雙 tab 頁面渲染

**Files:**
- Modify: `每日AI新聞/test_news.py`（新增 `TestBuildPageHtml`）
- Modify: `每日AI新聞/fetch_news.py`（重寫 `render_html`，新增 `build_page_html`、`agent_section_html`）

**Interfaces:**
- Consumes: Task 2 的 `agent_items`；既有 `FEEDS`、`html`、`fmt_time`、`OUT_FILE`
- Produces:
  - `build_page_html(results: dict, agent_items: list[dict], generated_at: str) -> str` — 回傳完整 HTML 字串（可測試）
  - `agent_section_html(items: list[dict]) -> str`
  - `render_html(results, agent_items, generated_at)` — 呼叫 build_page_html 並寫入 `OUT_FILE`

- [ ] **Step 1: 寫失敗測試（build_page_html）**

在 `test_news.py` 的 `if __name__ == "__main__":` 之前新增：

```python
class TestBuildPageHtml(unittest.TestCase):
    def test_page_has_tabs_and_agent_badges(self):
        results = {
            "iThome": [{"title": "一般新聞", "link": "http://a", "summary": "", "time": None,
                        "source": "iThome", "brands": []}],
        }
        agent = [{"title": "Gemini 更新", "link": "http://b", "summary": "", "time": None,
                  "brands": ["Gemini"], "source": "Google News"}]
        html = fn.build_page_html(results, agent, "2026-08-15 00:00")
        self.assertIn('data-tab="ai-news"', html)
        self.assertIn('data-tab="ai-agent"', html)
        self.assertIn("switchTab('ai-news')", html)
        self.assertIn("brand-tag", html)
        self.assertIn("Gemini", html)
        self.assertIn("Google News", html)
        self.assertIn("一般新聞", html)

    def test_empty_agent_message(self):
        html = fn.build_page_html({}, [], "2026-08-15 00:00")
        self.assertIn("今天沒有抓到品牌 AI 新聞", html)
```

- [ ] **Step 2: 執行確認測試失敗**

Run (workdir `每日AI新聞`):
```powershell
& "C:\Users\TW-10\Documents\firebase雲端資料夾\.venv\Scripts\python.exe" -m unittest test_news -v
```
Expected: FAIL — `AttributeError: module 'fetch_news' has no attribute 'build_page_html'`

- [ ] **Step 3: 重寫渲染邏輯**

將 `fetch_news.py` 中整個 `render_html()` 函式（從 `def render_html(results, generated_at):` 到其結束）替換為以下內容。

先新增模組層級 CSS 常數（放在 `AGENT_FEEDS` 之後）：

```python
CSS = """
    :root{--bg:#f4f6fb;--card:#fff;--ink:#1f2430;--muted:#6b7280;--line:#e5e7eb;
          --accent:#2563eb;--tag:#eef2ff;--tag-ink:#4338ca;}
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:"Microsoft JhengHei","PingFang TC",system-ui,sans-serif;background:var(--bg);
         color:var(--ink);line-height:1.6;padding:32px 16px}
    .wrap{max-width:860px;margin:0 auto}
    header{margin-bottom:28px}
    h1{font-size:26px;letter-spacing:.5px}
    .date{color:var(--muted);font-size:14px;margin-top:6px}
    section{margin-bottom:34px}
    h2{font-size:18px;color:var(--accent);margin-bottom:12px;padding-bottom:8px;border-bottom:2px solid var(--line)}
    .card{background:var(--card);border:1px solid var(--line);border-radius:12px;
          padding:16px 18px;margin-bottom:12px;transition:box-shadow .15s}
    .card:hover{box-shadow:0 4px 14px rgba(31,36,48,.08)}
    .card a{text-decoration:none;color:var(--ink);font-weight:600;font-size:16px}
    .card a:hover{color:var(--accent)}
    .summary{color:var(--muted);font-size:14px;margin-top:6px}
    .meta{display:flex;gap:10px;align-items:center;margin-top:8px;font-size:12px;color:var(--muted)}
    .badge{background:var(--tag);color:var(--tag-ink);padding:2px 8px;border-radius:99px;font-size:11px}
    .count{font-size:13px;color:var(--muted)}
    .tabs{display:flex;gap:10px;margin-bottom:24px}
    .tab{background:var(--card);border:1px solid var(--line);border-radius:99px;padding:8px 22px;font-size:15px;cursor:pointer;color:var(--muted);font-family:inherit;transition:all .15s}
    .tab:hover{border-color:var(--accent);color:var(--accent)}
    .tab.active{background:var(--accent);border-color:var(--accent);color:#fff;font-weight:600}
    .panel{display:none}
    .panel.active{display:block}
    .tags{margin-bottom:6px}
    .brand-tag{background:#ecfdf5;color:#047857;padding:2px 9px;border-radius:99px;font-size:11px;margin-right:6px;display:inline-block}
    footer{color:var(--muted);font-size:12px;text-align:center;margin-top:40px}
    """
```

接著新增三個函式：

```python
def agent_section_html(items):
    if not items:
        return "<p>今天沒有抓到品牌 AI 新聞，請稍後再試。</p>"
    sec = [f"<h2>🤖 AI Agent 品牌新聞 <span class='count'>({len(items)} 則)</span></h2>"]
    for it in items:
        tags = "".join(f"<span class='brand-tag'>{html.escape(b)}</span>" for b in it.get("brands", []))
        badge = f"<span class='badge'>{html.escape(it.get('source', ''))}</span>"
        t = fmt_time(it["time"])
        sec.append(
            f"<div class='card'><div class='tags'>{tags}</div>"
            f"<a href='{html.escape(it['link'])}' target='_blank' rel='noopener'>{html.escape(it['title'])}</a>"
            f"<div class='summary'>{html.escape(it['summary'])}</div>"
            f"<div class='meta'>{badge}<span>{t}</span></div></div>"
        )
    return "\n".join(sec)


def build_page_html(results, agent_items, generated_at):
    cards = {f["name"]: f for f in FEEDS}
    general = []
    for name in [f["name"] for f in FEEDS]:
        items = results.get(name, [])
        if not items:
            continue
        sec = [f"<section><h2>{name} <span class='count'>({len(items)} 則)</span></h2>"]
        for it in items:
            badge = "<span class='badge'>翻譯</span>" if cards[name]["lang"] == "en" else ""
            t = fmt_time(it["time"])
            sec.append(
                f"<div class='card'><a href='{html.escape(it['link'])}' target='_blank' rel='noopener'>"
                f"{html.escape(it['title'])}</a>"
                f"<div class='summary'>{html.escape(it['summary'])}</div>"
                f"<div class='meta'>{badge}<span>{t}</span></div></div>"
            )
        sec.append("</section>")
        general.append("\n".join(sec))
    if not general:
        general = ["<p>今天沒有抓到新聞，請稍後再試。</p>"]
    agent = agent_section_html(agent_items)
    page = f"""<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>每日 AI 新聞</title>
<style>{CSS}</style>
</head>
<body>
<div class="wrap">
<header>
  <h1>📰 每日 AI 新聞</h1>
  <div class="date">更新時間：{generated_at}　｜　AI Agent 欄來源：Google News、數位時代 + 品牌關鍵字搜尋</div>
</header>
<div class="tabs">
  <button type="button" class="tab active" data-tab="ai-news" onclick="switchTab('ai-news')">AI 新聞</button>
  <button type="button" class="tab" data-tab="ai-agent" onclick="switchTab('ai-agent')">AI Agent</button>
</div>
<div id="ai-news" class="panel active">
{''.join(general)}
</div>
<div id="ai-agent" class="panel">
<section>{agent}</section>
</div>
<footer>由 fetch_news.py 自動產生　・　每日自動更新</footer>
</div>
<script>
function switchTab(id){{
  document.querySelectorAll('.tab').forEach(function(b){{b.classList.toggle('active', b.dataset.tab===id);}});
  document.querySelectorAll('.panel').forEach(function(p){{p.classList.toggle('active', p.id===id);}});
}}
</script>
</body>
</html>"""
    return page


def render_html(results, agent_items, generated_at):
    page = build_page_html(results, agent_items, generated_at)
    with open(OUT_FILE, "w", encoding="utf-8") as f:
        f.write(page)
    total = sum(len(v) for v in results.values()) + len(agent_items)
    print(f"✔ 已生成 {OUT_FILE}（共 {total} 則）")
```

- [ ] **Step 4: 跑全部測試確認通過**

Run (workdir `每日AI新聞`):
```powershell
& "C:\Users\TW-10\Documents\firebase雲端資料夾\.venv\Scripts\python.exe" -m unittest test_news -v
```
Expected: `Ran 11 tests ... OK`

- [ ] **Step 5: Commit**

```bash
git add "每日AI新聞/fetch_news.py" "每日AI新聞/test_news.py"
git commit -m "每日AI新聞: 頁面改為雙 tab，AI Agent 新聞掛品牌標籤"
```

---

### Task 4: 端到端驗證與部署

**Files:**
- Verify: `每日AI新聞/index.html`
- Modify: 無（若需除錯才改）

- [ ] **Step 1: 跑全部單元測試**

Run (workdir `每日AI新聞`):
```powershell
& "C:\Users\TW-10\Documents\firebase雲端資料夾\.venv\Scripts\python.exe" -m unittest test_news -v
```
Expected: `Ran 11 tests ... OK`

- [ ] **Step 2: 執行抓取腳本**

Run (workdir `每日AI新聞`):
```powershell
& "C:\Users\TW-10\Documents\firebase雲端資料夾\.venv\Scripts\python.exe" fetch_news.py
```
Expected: 依序抓取 iThome / 科技新報 / TechCrunch AI / MIT / 數位時代 / Google News，最後 `✔ 已生成 index.html`。若某來源失敗，屬正常（網路/反爬），其餘來源仍需成功。

- [ ] **Step 3: 檢查輸出 HTML**

檢查 `每日AI新聞/index.html` 是否包含：
- `data-tab="ai-news"` 與 `data-tab="ai-agent"` 兩個 tab 按鈕
- `id="ai-agent"` 的 panel 內有 `<h2>🤖 AI Agent 品牌新聞` 與至少一則含 `brand-tag` 的新聞
- 「AI 新聞」tab 內 iThome / 科技新報 / TechCrunch / MIT 四欄仍在

```powershell
Select-String -Path "index.html" -Pattern 'data-tab="ai-news"','data-tab="ai-agent"','brand-tag','AI Agent 品牌新聞' | Measure-Object
```

- [ ] **Step 4: 若 AI Agent 欄為空**

若 agent 欄顯示「今天沒有抓到品牌 AI 新聞」，先確認 Google News / 數位時代 RSS 是否可達（手動開啟 `https://news.google.com/rss/search?q=%22Gemini%22&hl=zh-TW&gl=TW&ceid=TW:zh-Hant` 與 `https://rss.bnextmedia.com.tw/feed/bnext`）。來源正常仍為空時，依 systematics-debugging 流程查 `match_brands` 關鍵字是否需要補充。

- [ ] **Step 5: Commit + push**

```bash
git add "每日AI新聞/"
git commit -m "每日AI新聞: 產生雙 tab 頁面（AI 新聞 / AI Agent）"
git push
```

- [ ] **Step 6: Firebase Hosting 部署**

Run (workdir `每日AI新聞`):
```powershell
firebase deploy --only hosting --project opencode-sk
```
Expected: Hosting URL 顯示 `https://...web.app` 部署完成。

- [ ] **Step 7: 回報**

向使用者回報「已上傳部署完成」，附上 Hosting 網址（`每日AI新聞/網址.txt` 內既有 URL）。
