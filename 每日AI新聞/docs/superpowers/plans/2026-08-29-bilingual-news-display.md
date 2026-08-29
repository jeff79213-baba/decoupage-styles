# 英文新聞「中英對照」顯示 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓 `fetch_news.py` 生成頁面時，把英文新聞（標題＋摘要）輸出為「中文為主 + 英文原文小字在下」的中英對照，兩個標籤頁同時生效。

**Architecture:** 在 `fetch_news.py` 新增純函式 `is_english()`（拉丁字母比例 > 0.5）與 `translate_if_english()`（翻譯英文欄位並保留原文於 `item["orig"]`）。`fetch_feed()` 與 `fetch_google_news()` 改用它處理所有來源；`build_page_html()` 與 `agent_section_html()` 渲染時若有 `orig` 則輸出 `.orig` 小字行。CSS 新增 `.orig` 樣式。

**Tech Stack:** Python 3.12（stdlib unittest 測試）、requests、feedparser、Firebase Hosting（靜態站）。

## Global Constraints

- 不新增任何 Python 相依套件（只用現有 stdlib + requests + feedparser）。
- 英文判定門檻：拉丁字母比例 **> 0.5**（`latin / (latin + cjk)`）。
- 翻譯沿用現有 `google_translate(text)`（免費端點，目的地 zh-TW）；翻譯結果與原文相同 = 失敗 → 不寫 `orig`、主文字維持英文。
- 中英混雜但實為中文的標題（如「ChatGPT續宰AI流量龍頭 泰國全球排名第26」）**不得**被判定為英文。
- 中文來源（iThome、科技新報、數位時代、中文 Google News）維持原樣。
- 測試命令（在 `每日AI新聞` 資料夾內執行）：
  `C:\Users\TW-10\Documents\firebase雲端資料夾\.venv\Scripts\python.exe -m unittest test_news -v`
- 每次 commit 只暫存該任務相關檔案，不要 `git add .`（repo 是整個 firebase雲端資料夾 的 monorepo，有大量無關變動）。
- 每任務完成後 commit；全部完成後重新生成 `index.html` 並 `firebase deploy --only hosting` 部署。

---

### Task 1: `is_english()` 英文偵測純函式

**Files:**
- Modify: `每日AI新聞/fetch_news.py`（在 `google_translate()` 之前新增函式）
- Test: `每日AI新聞/test_news.py`

**Interfaces:**
- Consumes: 無（純函式）
- Produces: `is_english(text: str) -> bool`

- [ ] **Step 1: 寫失敗測試**

在 `test_news.py` 的 `class TestAgentQuery` 之後、「`if __name__ == "__main__":`」之前新增：

```python
class TestIsEnglish(unittest.TestCase):
    def test_english_detected(self):
        self.assertTrue(fn.is_english("Neocloud Lambda secures $1B in debt to buy more chips"))
        self.assertTrue(fn.is_english("An Anthropic researcher just gave us a peek at self-improving AI"))

    def test_chinese_not_detected(self):
        self.assertFalse(fn.is_english("台積電先進製程 晶圓代工增溫，需求回溫"))

    def test_mixed_chinese_title_not_detected(self):
        self.assertFalse(fn.is_english("ChatGPT續宰AI流量龍頭 泰國全球排名第26"))

    def test_mixed_openai_title_not_detected(self):
        self.assertFalse(fn.is_english("OpenAI提出網路集體防禦行動，獲Google、Anthropic及微軟等上百家企業呼應"))

    def test_empty_false(self):
        self.assertFalse(fn.is_english(""))
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `C:\Users\TW-10\Documents\firebase雲端資料夾\.venv\Scripts\python.exe -m unittest test_news.TestIsEnglish -v`（workdir = `每日AI新聞`）
Expected: FAIL，`AttributeError: module 'fetch_news' has no attribute 'is_english'`

- [ ] **Step 3: 實作 `is_english`**

在 `fetch_news.py` 的 `strip_html()` 與 `google_translate()` 之間插入：

```python
def is_english(text):
    """粗略判定文字是否以英文為主（拉丁字母比例 > 0.5）。"""
    if not text:
        return False
    latin = sum(1 for ch in text if ch.isascii() and ch.isalpha())
    cjk = sum(1 for ch in text if "\u4e00" <= ch <= "\u9fff")
    total = latin + cjk
    if total == 0:
        return False
    return latin / total > 0.5
```

- [ ] **Step 4: 執行測試確認通過**

Run: 同上命令
Expected: PASS（5 tests）

- [ ] **Step 5: Commit**

```bash
git add "每日AI新聞/fetch_news.py" "每日AI新聞/test_news.py"
git commit -m "feat(每日AI新聞): 新增 is_english 英文偵測純函式"
```

---

### Task 2: `translate_if_english()` 與擷取流程整合

**Files:**
- Modify: `每日AI新聞/fetch_news.py`（新增函式 + 修改 `fetch_feed()` 與 `fetch_google_news()`）
- Test: `每日AI新聞/test_news.py`

**Interfaces:**
- Consumes: `is_english(text) -> bool`（Task 1）、`google_translate(text) -> str`
- Produces: `translate_if_english(item: dict) -> dict`（原地修改：翻譯英文欄位、`orig` 保留原文）

- [ ] **Step 1: 寫失敗測試**

在 `test_news.py` 的 `TestIsEnglish` 之後新增（檔案頂部已 `import unittest`，需再加 `from unittest import mock`）：

先在檔案開頭把 `import unittest` 改為：

```python
import unittest
from unittest import mock
```

再新增：

```python
class TestTranslateIfEnglish(unittest.TestCase):
    def test_translates_english_keeps_orig(self):
        item = {"title": "Neocloud secures $1B", "summary": "English summary here", "link": "http://x"}
        with mock.patch("fetch_news.google_translate", return_value="中文翻譯") as mt:
            fn.translate_if_english(item)
        self.assertEqual(item["title"], "中文翻譯")
        self.assertEqual(item["summary"], "中文翻譯")
        self.assertEqual(item["orig"], {"title": "Neocloud secures $1B", "summary": "English summary here"})
        self.assertEqual(mt.call_count, 2)

    def test_translation_failure_no_orig(self):
        item = {"title": "Neocloud secures $1B", "summary": "English summary here", "link": "http://x"}
        with mock.patch("fetch_news.google_translate", side_effect=lambda s: s):
            fn.translate_if_english(item)
        self.assertEqual(item["title"], "Neocloud secures $1B")
        self.assertNotIn("orig", item)

    def test_chinese_item_untouched(self):
        item = {"title": "台積電先進製程 需求回溫", "summary": "晶圓代工出貨成長", "link": "http://x"}
        with mock.patch("fetch_news.google_translate", side_effect=AssertionError("不應呼叫翻譯")):
            fn.translate_if_english(item)
        self.assertEqual(item["title"], "台積電先進製程 需求回溫")
        self.assertNotIn("orig", item)
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `C:\Users\TW-10\Documents\firebase雲端資料夾\.venv\Scripts\python.exe -m unittest test_news.TestTranslateIfEnglish -v`（workdir = `每日AI新聞`）
Expected: FAIL，`AttributeError: module 'fetch_news' has no attribute 'translate_if_english'`

- [ ] **Step 3: 實作 `translate_if_english` 並整合**

在 `fetch_news.py` 的 `is_english()` 之後新增：

```python
def translate_if_english(item):
    """將 item 的英文標題/摘要翻譯成中文，原文保留於 item['orig']。
    翻譯失敗（結果等於原文）時不寫 orig。原地修改並回傳 item。"""
    orig = {}
    for field in ("title", "summary"):
        text = item.get(field) or ""
        if not is_english(text):
            continue
        trans = google_translate(text)
        if trans and trans != text:
            item[field] = trans
            orig[field] = text
    if orig:
        item["orig"] = orig
    return item
```

修改 `fetch_feed()` 結尾區塊（原 168–176 行，`if lang == "en":` 判斷式）為：

```python
    if lang == "en":
        print(f"  [{name}] {len(items)} 則（翻譯中…）")
        for it in items:
            translate_if_english(it)
            time.sleep(0.6)
    else:
        print(f"  [{name}] {len(items)} 則")
        for it in items:
            translate_if_english(it)
```

修改 `fetch_google_news()` 結尾區塊（原 236–244 行，`if cfg["lang"] == "en":` 判斷式）為：

```python
        if cfg["lang"] == "en":
            print(f"  [Google News {cfg['hl']}] {len(items)} 則（翻譯中…）")
            for it in items:
                translate_if_english(it)
                time.sleep(0.6)
        else:
            print(f"  [Google News {cfg['hl']}] {len(items)} 則")
            for it in items:
                translate_if_english(it)
```

> 註：中文 feed 的 item 即使經過 `translate_if_english()`，因 `is_english` 為 False 而不會呼叫網路、可安全通過；同時也涵蓋「中文 feed 中偶爾出現的英文標題」。

- [ ] **Step 4: 執行測試確認通過**

Run: `C:\Users\TW-10\Documents\firebase雲端資料夾\.venv\Scripts\python.exe -m unittest test_news -v`（workdir = `每日AI新聞`）
Expected: PASS（全部既有 + 新增測試）

- [ ] **Step 5: Commit**

```bash
git add "每日AI新聞/fetch_news.py" "每日AI新聞/test_news.py"
git commit -m "feat(每日AI新聞): translate_if_english 中英對照保留原文，整合各來源擷取流程"
```

---

### Task 3: HTML 渲染 `.orig` 小字行與 CSS

**Files:**
- Modify: `每日AI新聞/fetch_news.py`（CSS 字串 + `build_page_html()` + `agent_section_html()`）
- Test: `每日AI新聞/test_news.py`

**Interfaces:**
- Consumes: item 的 `orig` 欄位（Task 2：`{"title": "…", "summary": "…"}` 或不存在）
- Produces: 含 `.orig` 小字行的 HTML 輸出

- [ ] **Step 1: 寫失敗測試**

在 `test_news.py` 的 `TestBuildPageHtml` 內新增：

```python
    def test_bilingual_item_renders_orig(self):
        results = {
            "TechCrunch AI": [{"title": "中文標題", "summary": "中文摘要", "link": "http://a",
                               "time": None, "source": "TechCrunch AI", "brands": [],
                               "orig": {"title": "English title", "summary": "English summary"}}],
        }
        html = fn.build_page_html(results, [], "2026-08-29 00:00")
        self.assertIn("class='orig'", html)
        self.assertIn("English title", html)
        self.assertIn("English summary", html)

    def test_chinese_item_no_orig_line(self):
        results = {
            "iThome": [{"title": "一般新聞", "summary": "一般摘要", "link": "http://a",
                        "time": None, "source": "iThome", "brands": []}],
        }
        html = fn.build_page_html(results, [], "2026-08-29 00:00")
        self.assertNotIn("class='orig'", html)

    def test_agent_bilingual_renders_orig(self):
        agent = [{"title": "中文標題", "summary": "中文摘要", "link": "http://b", "time": None,
                  "brands": ["Gemini"], "source": "Google News",
                  "orig": {"title": "English title", "summary": "English summary"}}]
        html = fn.build_page_html({}, agent, "2026-08-29 00:00")
        self.assertIn("English title", html)
        self.assertIn("English summary", html)
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `C:\Users\TW-10\Documents\firebase雲端資料夾\.venv\Scripts\python.exe -m unittest test_news.TestBuildPageHtml -v`（workdir = `每日AI新聞`）
Expected: FAIL（新測試要求 `.orig` / 英文原文，但目前渲染沒有輸出）

- [ ] **Step 3: 實作渲染變更**

在 `fetch_news.py` 的 `CSS` 字串末尾（`footer{...}` 行之後）追加一行：

```python
    .orig{color:var(--muted);font-size:12px;margin-top:2px;line-height:1.4}
```

把 `build_page_html()` 內 `for it in items:` 迴圈的 card 組字區塊（原 281–286 行）改成：

```python
        for it in items:
            badge = "<span class='badge'>翻譯</span>" if cards[name]["lang"] == "en" else ""
            t = fmt_time(it["time"])
            o = it.get("orig", {})
            orig_title = f"<div class='orig'>{html.escape(o['title'])}</div>" if o.get("title") else ""
            orig_summary = f"<div class='orig'>{html.escape(o['summary'])}</div>" if o.get("summary") else ""
            sec.append(
                f"<div class='card'><a href='{html.escape(it['link'])}' target='_blank' rel='noopener'>"
                f"{html.escape(it['title'])}</a>{orig_title}"
                f"<div class='summary'>{html.escape(it['summary'])}</div>{orig_summary}"
                f"<div class='meta'>{badge}<span>{t}</span></div></div>"
            )
```

把 `agent_section_html()` 內 `for it in items:` 迴圈的 `sec.append(...)`（原 261–266 行）改成：

```python
        o = it.get("orig", {})
        orig_title = f"<div class='orig'>{html.escape(o['title'])}</div>" if o.get("title") else ""
        orig_summary = f"<div class='orig'>{html.escape(o['summary'])}</div>" if o.get("summary") else ""
        sec.append(
            f"<div class='card'><div class='tags'>{tags}</div>"
            f"<a href='{html.escape(it.get('link', ''))}' target='_blank' rel='noopener'>{html.escape(it.get('title', ''))}</a>"
            f"{orig_title}"
            f"<div class='summary'>{html.escape(it.get('summary', ''))}</div>{orig_summary}"
            f"<div class='meta'>{badge}<span>{t}</span></div></div>"
        )
```

- [ ] **Step 4: 執行全部測試確認通過**

Run: `C:\Users\TW-10\Documents\firebase雲端資料夾\.venv\Scripts\python.exe -m unittest test_news -v`（workdir = `每日AI新聞`）
Expected: PASS（全部測試）

- [ ] **Step 5: Commit**

```bash
git add "每日AI新聞/fetch_news.py" "每日AI新聞/test_news.py"
git commit -m "feat(每日AI新聞): 渲染中英對照 .orig 小字行（標題＋摘要）"
```

---

### Task 4: 重新生成 `index.html`、驗證與部署

**Files:**
- Regenerate: `每日AI新聞/index.html`
- Modify: `每日AI新聞/run_log.txt`（腳本執行自動追加，屬預期變動）

**Interfaces:**
- Consumes: Task 1–3 完成的 `fetch_news.py`
- Produces: 已部署的中英對照線上頁面

- [ ] **Step 1: 重新執行抓取腳本**

Run: `C:\Users\TW-10\Documents\firebase雲端資料夾\.venv\Scripts\python.exe fetch_news.py`（workdir = `每日AI新聞`）
Expected: 輸出各來源列數、`✔ 已生成 index.html（共 N 則）`

- [ ] **Step 2: 驗證生成結果**

Run: `Select-String -Path "每日AI新聞/index.html" -Pattern "class='orig'" | Measure-Object | Select-Object -ExpandProperty Count`
Expected: 數量 > 0（英文來源的新聞都應有 `.orig` 小字行）

再抽檢兩則：
- TechCrunch AI 區塊：中文標題下應有英文原文小字
- AI Agent 區塊：英文新聞為中英對照；「ChatGPT續宰AI流量龍頭 泰國全球排名第26」應維持純中文、**無** `.orig` 行

若中文來源（iThome）區塊被誤加 `.orig`，回 Task 3 檢查。

- [ ] **Step 3: 執行全部測試確認通過**

Run: `C:\Users\TW-10\Documents\firebase雲端資料夾\.venv\Scripts\python.exe -m unittest test_news -v`（workdir = `每日AI新聞`）
Expected: PASS

- [ ] **Step 4: Commit + Push**

```bash
git add "每日AI新聞/fetch_news.py" "每日AI新聞/test_news.py" "每日AI新聞/index.html"
git commit -m "feat(每日AI新聞): 重建 index.html 為中英對照版並上線部署"
git push
```

- [ ] **Step 5: 部署 Firebase Hosting**

Run: `firebase deploy --only hosting`（workdir = `每日AI新聞`）
Expected: 部署成功，回傳線上網址 `https://daily-ai-news-sk.web.app`

- [ ] **Step 6: 回報完成**

確認線上頁面兩個標籤頁的英文新聞皆顯示「中文為主 + 英文原文小字在下」，向使用者回報「已上傳部署完成」。