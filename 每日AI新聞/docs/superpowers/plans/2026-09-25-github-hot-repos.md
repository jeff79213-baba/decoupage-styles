# GitHub 熱門分頁 實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在「每日新聞」頁面新增第 4 個分頁「GitHub 熱門」，內含「AI 應用星數 Top 5」與「近 30 天爆款 Top 5」兩個排行榜。

**Architecture:** 新增獨立模組 `github_rank.py` 負責 GitHub 資料抓取、篩選、排序、快取與 HTML 產出；`fetch_news.py` 僅在頁面模板加一個 tab 與 panel，並於 `main()` 呼叫一次 `fetch_github_rank()`。抓取採 GitHub Search API + ETag 條件式請求，資料存於 `github_rank_cache.json`；304 回應不計入 rate limit、不下載內容，直接沿用快取。

**Tech Stack:** Python 3、stdlib `unittest`、既有 `requests`（不新增任何相依套件）、靜態 HTML

**設計文件：** `docs/superpowers/specs/2026-09-25-github-hot-repos-design.md`

## Global Constraints

- 所有 Python 檔案開頭為 `# -*- coding: utf-8 -*-`，docstring 與註解一律**繁體中文**
- 測試框架為 stdlib `unittest`，測試檔為 `test_news.py`（不另開新測試檔）
- 測試執行指令固定為：
  ```powershell
  C:\Users\TW-10\Documents\firebase雲端資料夾\.venv\Scripts\python.exe -m unittest test_news -v
  ```
  （須以 `每日AI新聞` 為工作目錄）
- 不新增任何 pip 相依套件，只用 `requests`（已安裝）
- HTML 片段內的屬性引號沿用現有 `fetch_news.py` 慣例：字串用單引號（`class='card'`），程式碼字串用雙引號
- 所有使用者可控字串（repo 名稱、描述、URL）渲染前一律 `html.escape`
- 每個 Task 結束時 commit，commit 後 `git push origin main`（依 AGENTS.md 自動部署原則）
- 工作目錄：`C:\Users\TW-10\Documents\firebase雲端資料夾\每日AI新聞`
- GitHub API 免金鑰限制：Search API 10 次／分鐘。本設計每次執行 4 次請求，須確保 4 次以內

### 對設計文件的兩處明確化（實作時以此為準）

1. `search_repos` 回傳值語意固定為二值組 `(repos, etag)`：
   - `(list, etag)` → HTTP 200，資料最新
   - `(None, etag)` → HTTP 304，資料未變更，沿用快取
   - `(None, None)` → 請求失敗，無資料
2. 內部包裝 `fetch_query_cached` 另回傳 `status` 字串（`"ok"` / `"not_modified"` / `"error"`），
   避免下游靠「etag 是否為 None」猜測成功與否（GitHub 可能在 200 回應中不附 ETag）。

---

### Task 1: 純函式層 — 常數、query 組法、URL、解析、排除、合併

**Files:**
- Create: `github_rank.py`
- Modify: `test_news.py`（檔尾 `if __name__ == "__main__":` 之前插入新測試類別）

**Interfaces:**
- Consumes: 無（本專案既有模組）
- Produces: `github_rank` 模組，提供
  - `strip_html` 不需要；改為 `clean_description(text, limit=100) -> str`
  - `fmt_stars(n) -> str`
  - `build_query(topics, min_stars, created_after=None) -> str`
  - `build_search_url(query, etag=None) -> tuple[str, dict]`
  - `parse_repo(item) -> dict | None`
  - `is_excluded(repo) -> bool`
  - `merge_repos(repo_lists) -> list[dict]`
  - 常數：`GITHUB_SEARCH_URL`、`CACHE_FILE`、`MIN_STARS`、`MIN_STARS_RECENT`、`TOPICS`、
    `FETCH_PER_QUERY`、`HOT_WINDOWS`、`TOP_N`、`MAX_DAYS`、`EXCLUDE_KEYWORDS`、`UA`、`TAIWAN_TZ`

- [ ] **Step 1: 寫失敗的測試**

在 `test_news.py` 的 `if __name__ == "__main__":` 之前插入：

```python
import github_rank as gh


class TestBuildQuery(unittest.TestCase):
    def test_single_topic_with_star_threshold(self):
        self.assertEqual(gh.build_query(["ai"], 1000), "topic:ai stars:>1000")

    def test_multiple_topics_are_anded(self):
        q = gh.build_query(["ai", "llm", "agent"], 50)
        self.assertEqual(q, "topic:ai topic:llm topic:agent stars:>50")

    def test_created_after_appended(self):
        q = gh.build_query(["ai"], 50, created_after="2026-06-26")
        self.assertEqual(q, "topic:ai stars:>50 created:>=2026-06-26")

    def test_created_after_none_omitted(self):
        self.assertNotIn("created:", gh.build_query(["ai"], 50))


class TestBuildSearchUrl(unittest.TestCase):
    def test_contains_sort_order_and_per_page(self):
        url, headers = gh.build_search_url("topic:ai stars:>1000")
        self.assertTrue(url.startswith(gh.GITHUB_SEARCH_URL + "?"))
        self.assertIn("sort=stars", url)
        self.assertIn("order=desc", url)
        self.assertIn(f"per_page={gh.FETCH_PER_QUERY}", url)
        self.assertIn("topic%3Aai", url)

    def test_etag_becomes_if_none_match(self):
        _, headers = gh.build_search_url("q", etag='W/"abc"')
        self.assertEqual(headers["If-None-Match"], 'W/"abc"')

    def test_no_etag_no_conditional_header(self):
        _, headers = gh.build_search_url("q")
        self.assertNotIn("If-None-Match", headers)

    def test_user_agent_always_present(self):
        _, headers = gh.build_search_url("q")
        self.assertEqual(headers["User-Agent"], "daily-ai-news")

    def test_no_token_means_no_authorization(self):
        with mock.patch.dict(os.environ, {}, clear=True):
            _, headers = gh.build_search_url("q")
        self.assertNotIn("Authorization", headers)

    def test_token_env_adds_authorization(self):
        with mock.patch.dict(os.environ, {"GITHUB_TOKEN": "ghp_test"}, clear=True):
            _, headers = gh.build_search_url("q")
        self.assertEqual(headers["Authorization"], "Bearer ghp_test")


class TestParseRepo(unittest.TestCase):
    def item(self, **kw):
        base = {"full_name": "owner/repo", "html_url": "https://github.com/owner/repo",
                "description": "A tool", "language": "Python",
                "stargazers_count": 1234, "forks_count": 56,
                "created_at": "2026-08-01T10:00:00Z"}
        base.update(kw)
        return base

    def test_maps_all_fields(self):
        r = gh.parse_repo(self.item())
        self.assertEqual(r["full_name"], "owner/repo")
        self.assertEqual(r["html_url"], "https://github.com/owner/repo")
        self.assertEqual(r["description"], "A tool")
        self.assertEqual(r["language"], "Python")
        self.assertEqual(r["stars"], 1234)
        self.assertEqual(r["forks"], 56)
        self.assertEqual(r["created_at"], "2026-08-01T10:00:00Z")

    def test_missing_full_name_returns_none(self):
        self.assertIsNone(gh.parse_repo(self.item(full_name="")))

    def test_non_dict_returns_none(self):
        self.assertIsNone(gh.parse_repo("not a dict"))

    def test_null_counters_become_zero(self):
        r = gh.parse_repo(self.item(stargazers_count=None, forks_count=None, language=None))
        self.assertEqual(r["stars"], 0)
        self.assertEqual(r["forks"], 0)
        self.assertEqual(r["language"], "")


class TestCleanDescription(unittest.TestCase):
    def test_collapses_whitespace(self):
        self.assertEqual(gh.clean_description("a  b\n c"), "a b c")

    def test_truncates_with_ellipsis(self):
        got = gh.clean_description("x" * 200, limit=20)
        self.assertTrue(got.endswith("…"))
        self.assertEqual(len(got), 21)

    def test_none_returns_empty(self):
        self.assertEqual(gh.clean_description(None), "")


class TestFmtStars(unittest.TestCase):
    def test_thousand_separator(self):
        self.assertEqual(gh.fmt_stars(45231), "45,231")

    def test_zero(self):
        self.assertEqual(gh.fmt_stars(0), "0")


class TestIsExcluded(unittest.TestCase):
    def test_awesome_prefix_excluded(self):
        self.assertTrue(gh.is_excluded({"full_name": "owner/awesome-ai", "description": "清單"}))

    def test_keyword_in_description_excluded(self):
        self.assertTrue(gh.is_excluded({"full_name": "owner/tool", "description": "A ROADMAP for AI"}))

    def test_normal_app_not_excluded(self):
        self.assertFalse(gh.is_excluded({"full_name": "owner/agent-cli",
                                         "description": "Run AI agents from the terminal"}))

    def test_missing_fields_not_excluded(self):
        self.assertFalse(gh.is_excluded({}))


class TestMergeRepos(unittest.TestCase):
    def r(self, name, stars):
        return {"full_name": name, "description": "", "language": "", "stars": stars,
                "forks": 0, "html_url": "", "created_at": "2026-01-01T00:00:00Z"}

    def test_dedupes_across_lists(self):
        out = gh.merge_repos([[self.r("a/1", 10)], [self.r("a/1", 10), self.r("b/2", 5)]])
        self.assertEqual([x["full_name"] for x in out], ["a/1", "b/2"])

    def test_drops_excluded(self):
        out = gh.merge_repos([[self.r("a/awesome-x", 999), self.r("b/2", 5)]])
        self.assertEqual([x["full_name"] for x in out], ["b/2"])

    def test_sorted_by_stars_desc(self):
        out = gh.merge_repos([[self.r("a/1", 10), self.r("b/2", 500)]])
        self.assertEqual([x["full_name"] for x in out], ["b/2", "a/1"])

    def test_tie_broken_by_name_ascending(self):
        out = gh.merge_repos([[self.r("z/last", 100), self.r("a/first", 100)]])
        self.assertEqual([x["full_name"] for x in out], ["a/first", "z/last"])

    def test_none_list_tolerated(self):
        out = gh.merge_repos([None, [self.r("a/1", 1)]])
        self.assertEqual(len(out), 1)
```

- [ ] **Step 2: 執行測試確認失敗**

Run:
```powershell
C:\Users\TW-10\Documents\firebase雲端資料夾\.venv\Scripts\python.exe -m unittest test_news -v
```
Expected: FAIL，錯誤訊息為 `ModuleNotFoundError: No module named 'github_rank'`

- [ ] **Step 3: 實作最小程式碼**

建立 `github_rank.py`：

```python
# -*- coding: utf-8 -*-
"""GitHub 熱門專案排行

負責 GitHub Search API 的查詢組法、資料解析、篩選、排序、ETag 快取與 HTML 產出。
被 fetch_news.py 呼叫，輸出兩個排行榜：AI 應用星數 Top N、近 N 天爆款 Top N。
"""
import sys
import os
import json
import re
import html
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

import requests

TAIWAN_TZ = timezone(timedelta(hours=8))

GITHUB_SEARCH_URL = "https://api.github.com/search/repositories"
CACHE_FILE = "github_rank_cache.json"
MIN_STARS = 1000          # 成熟榜單星數門檻
MIN_STARS_RECENT = 50     # 爆款榜單星數門檻
TOPICS = ["ai", "llm", "agent"]
FETCH_PER_QUERY = 20
HOT_WINDOWS = [30, 60, 90]   # 爆款時間窗，由短到長
MAX_DAYS = HOT_WINDOWS[-1]
TOP_N = 5
DESC_LIMIT = 100

# 清單／教學／資源整理型倉庫的排除關鍵字（不分大小寫，比對 full_name 與 description）
EXCLUDE_KEYWORDS = [
    "awesome", "roadmap", "tutorial", "course", "curriculum", "ebook", "book",
    "reading", "paper", "interview", "cheatsheet", "cheat-sheet", "learn",
    "guide", "notes", "slides",
]

UA = {"User-Agent": "daily-ai-news", "Accept": "application/vnd.github+json"}


def clean_description(text, limit=DESC_LIMIT):
    """壓平空白並截斷描述。GitHub description 為純文字，不需去除 HTML 標籤。"""
    if not text:
        return ""
    text = re.sub(r"\s+", " ", str(text)).strip()
    if len(text) > limit:
        return text[:limit].rstrip() + "…"
    return text


def fmt_stars(n):
    """星數／fork 數以千分位顯示。"""
    return f"{int(n or 0):,}"


def build_query(topics, min_stars, created_after=None):
    """組 GitHub Search query 字串。topic 之間為 AND 關係。"""
    parts = [f"topic:{t}" for t in topics]
    parts.append(f"stars:>{min_stars}")
    if created_after:
        parts.append(f"created:>={created_after}")
    return " ".join(parts)


def build_search_url(query, etag=None):
    """回傳 (url, headers)。有 etag 時帶 If-None-Match 做條件式請求；
    環境變數 GITHUB_TOKEN 存在時附帶 Bearer 認證。"""
    url = GITHUB_SEARCH_URL + "?" + urlencode({
        "q": query, "sort": "stars", "order": "desc", "per_page": FETCH_PER_QUERY,
    })
    headers = dict(UA)
    token = os.environ.get("GITHUB_TOKEN", "").strip()
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if etag:
        headers["If-None-Match"] = etag
    return url, headers


def parse_repo(item):
    """從 GitHub Search item dict 抽出呈現所需欄位；非 dict 或缺 full_name 回 None。"""
    if not isinstance(item, dict):
        return None
    full_name = (item.get("full_name") or "").strip()
    if not full_name:
        return None
    return {
        "full_name": full_name,
        "html_url": item.get("html_url") or "",
        "description": clean_description(item.get("description")),
        "language": item.get("language") or "",
        "stars": int(item.get("stargazers_count") or 0),
        "forks": int(item.get("forks_count") or 0),
        "created_at": item.get("created_at") or "",
    }


def is_excluded(repo):
    """名稱或描述命中清單類關鍵字即排除（不分大小寫）。"""
    text = f"{repo.get('full_name', '')} {repo.get('description', '')}".lower()
    return any(kw in text for kw in EXCLUDE_KEYWORDS)


def merge_repos(repo_lists):
    """跨多組查詢合併：依 full_name 去重、排除清單類、依星數降冪；
    星數相同以 full_name 字典序升冪打破平手，確保順序可預期。"""
    seen = set()
    out = []
    for repos in repo_lists or []:
        for repo in repos or []:
            name = repo.get("full_name")
            if not name or name in seen or is_excluded(repo):
                continue
            seen.add(name)
            out.append(repo)
    out.sort(key=lambda r: (-r.get("stars", 0), r.get("full_name", "")))
    return out
```

- [ ] **Step 4: 執行測試確認通過**

Run:
```powershell
C:\Users\TW-10\Documents\firebase雲端資料夾\.venv\Scripts\python.exe -m unittest test_news -v
```
Expected: PASS（既有 11 個測試類別全數通過，新增 7 個類別全數通過）

- [ ] **Step 5: Commit 並推送**

```powershell
git add github_rank.py test_news.py
git commit -m "feat: GitHub 排行純函式層（query 組法、解析、排除、合併排序）"
git push origin main
```

---

### Task 2: 選榜邏輯 — Top N、時間窗挑選、名次升降

**Files:**
- Modify: `github_rank.py`（檔尾追加）
- Modify: `test_news.py`（Task 1 插入點之後）

**Interfaces:**
- Consumes: Task 1 的 `merge_repos` 產物（`{full_name, html_url, description, language, stars, forks, created_at}`）、常數 `HOT_WINDOWS`、`TOP_N`
- Produces:
  - `pick_top(repos, n=TOP_N) -> list[dict]`
  - `parse_created(raw) -> datetime | None`
  - `repo_age_days(repo, now) -> int | None`
  - `pick_hot(repos, now, windows=None, n=TOP_N) -> tuple[list[dict], int]`
  - `rank_moves(current, previous) -> dict[str, str]`
  - `apply_moves(repos, moves) -> list[dict]`（每個 repo 附加 `move` 欄位）

- [ ] **Step 1: 寫失敗的測試**

在 `test_news.py` 中 `class TestMergeRepos` 之後插入：

```python
class TestPickTop(unittest.TestCase):
    def r(self, name, stars):
        return {"full_name": name, "stars": stars}

    def test_takes_first_five(self):
        repos = [self.r(f"a/{i}", 100 - i) for i in range(9)]
        self.assertEqual(len(gh.pick_top(repos)), 5)

    def test_keeps_input_order(self):
        repos = [self.r("a/1", 10), self.r("b/2", 20)]
        self.assertEqual([x["full_name"] for x in gh.pick_top(repos)], ["a/1", "b/2"])

    def test_fewer_than_five_returns_all(self):
        self.assertEqual(len(gh.pick_top([self.r("a/1", 1)])), 1)

    def test_empty(self):
        self.assertEqual(gh.pick_top([]), [])


class TestParseCreated(unittest.TestCase):
    def test_parses_github_timestamp(self):
        got = gh.parse_created("2026-08-01T10:00:00Z")
        self.assertEqual(got.year, 2026)
        self.assertEqual(got.tzinfo, timezone.utc)

    def test_invalid_returns_none(self):
        self.assertIsNone(gh.parse_created("not a date"))

    def test_none_returns_none(self):
        self.assertIsNone(gh.parse_created(None))


class TestRepoAgeDays(unittest.TestCase):
    def test_age_from_now(self):
        repo = {"created_at": "2026-08-26T00:00:00Z"}
        now = datetime(2026, 9, 25, 0, 0, tzinfo=timezone.utc)
        self.assertEqual(gh.repo_age_days(repo, now), 30)

    def test_unparsable_returns_none(self):
        self.assertIsNone(gh.repo_age_days({"created_at": ""}, datetime.now(TW)))


class TestPickHot(unittest.TestCase):
    NOW = datetime(2026, 9, 25, 0, 0, tzinfo=timezone.utc)

    def repo(self, name, age_days, stars):
        created = (self.NOW - timedelta(days=age_days)).strftime("%Y-%m-%dT%H:%M:%SZ")
        return {"full_name": name, "created_at": created, "stars": stars}

    def test_uses_30_day_window_when_full(self):
        repos = [self.repo(f"a/{i}", 10, 100 + i) for i in range(6)]
        picked, days = gh.pick_hot(repos, self.NOW)
        self.assertEqual(days, 30)
        self.assertEqual(len(picked), 5)

    def test_widens_to_60_days_when_30_insufficient(self):
        repos = [self.repo("old/60", 55, 10), self.repo("old/61", 58, 20),
                 self.repo("new/5", 5, 30), self.repo("new/6", 6, 40),
                 self.repo("new/7", 7, 50)]
        picked, days = gh.pick_hot(repos, self.NOW)
        self.assertEqual(days, 60)
        self.assertEqual(len(picked), 5)

    def test_widens_to_90_days_when_60_insufficient(self):
        repos = [self.repo("a/70", 70, 10), self.repo("b/80", 80, 20),
                 self.repo("c/85", 85, 30), self.repo("d/88", 88, 40)]
        picked, days = gh.pick_hot(repos, self.NOW)
        self.assertEqual(days, 90)
        self.assertEqual(len(picked), 4)

    def test_beyond_longest_window_excluded(self):
        repos = [self.repo("old/200", 200, 999), self.repo("new/1", 1, 10)]
        picked, days = gh.pick_hot(repos, self.NOW)
        self.assertEqual([x["full_name"] for x in picked], ["new/1"])
        self.assertEqual(days, 30)

    def test_empty_repos(self):
        picked, days = gh.pick_hot([], self.NOW)
        self.assertEqual(picked, [])
        self.assertEqual(days, 30)

    def test_preserves_sorted_input_order(self):
        # pick_hot 不自行排序；排序由呼叫端的 merge_repos 負責，此處只驗證順序不被破壞
        repos = [self.repo("b/high", 5, 900), self.repo("c/mid", 6, 100),
                 self.repo("d/x", 7, 50), self.repo("a/low", 8, 10), self.repo("e/y", 9, 5)]
        picked, _ = gh.pick_hot(repos, self.NOW)
        self.assertEqual([x["full_name"] for x in picked],
                         ["b/high", "c/mid", "d/x", "a/low", "e/y"])


class TestRankMoves(unittest.TestCase):
    def test_rose_and_fell_by_one(self):
        self.assertEqual(gh.rank_moves(["b", "a"], ["a", "b"]), {"b": "↑1", "a": "↓1"})

    def test_big_jump_uses_double_arrow(self):
        moves = gh.rank_moves(["e", "b", "c", "d", "a"], ["a", "b", "c", "d", "e"])
        self.assertEqual(moves["e"], "↑↑4")

    def test_unchanged_position_not_shown(self):
        self.assertEqual(gh.rank_moves(["a", "b"], ["a", "b"]), {})

    def test_new_repo_not_shown(self):
        self.assertEqual(gh.rank_moves(["new", "a"], ["a", "b"]), {"a": "↓1"})

    def test_missing_repo_not_shown(self):
        self.assertEqual(gh.rank_moves(["a"], ["a", "b"]), {})

    def test_no_previous_data_gives_nothing(self):
        self.assertEqual(gh.rank_moves(["a", "b"], None), {})


class TestApplyMoves(unittest.TestCase):
    def test_adds_move_field(self):
        out = gh.apply_moves([{"full_name": "a/1"}], {"a/1": "↑2"})
        self.assertEqual(out[0]["move"], "↑2")

    def test_missing_move_is_empty_string(self):
        out = gh.apply_moves([{"full_name": "a/1"}], {})
        self.assertEqual(out[0]["move"], "")

    def test_does_not_mutate_input(self):
        src = [{"full_name": "a/1"}]
        gh.apply_moves(src, {"a/1": "↑2"})
        self.assertNotIn("move", src[0])
```

- [ ] **Step 2: 執行測試確認失敗**

Run:
```powershell
C:\Users\TW-10\Documents\firebase雲端資料夾\.venv\Scripts\python.exe -m unittest test_news.TestPickTop -v
```
Expected: FAIL，錯誤訊息為 `AttributeError: module 'github_rank' has no attribute 'pick_top'`

- [ ] **Step 3: 實作最小程式碼**

在 `github_rank.py` 檔尾追加：

```python
def pick_top(repos, n=TOP_N):
    """取星數排序後的前 n 筆（輸入須已排序）。"""
    return list(repos or [])[:n]


def parse_created(raw):
    """解析 GitHub 的 'YYYY-MM-DDTHH:MM:SSZ' 為 UTC datetime；失敗回 None。"""
    if not raw or not isinstance(raw, str):
        return None
    try:
        return datetime.strptime(raw, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def repo_age_days(repo, now):
    """repo 建立至 now 的天數；日期無法解析回 None。"""
    created = parse_created(repo.get("created_at"))
    if created is None:
        return None
    return (now.astimezone(timezone.utc) - created).days


def pick_hot(repos, now, windows=None, n=TOP_N):
    """由短到長試各時間窗挑選爆款。

    輸入須已依星數降冪排序（由呼叫端的 merge_repos 負責），此函式只做時間窗過濾，
    不改變順序。

    回傳 (清單, 實際採用天數)。某窗內達 n 筆即採用該窗並取前 n 筆；
    所有窗都不足時回傳累積筆數最多的窗（可能少於 n 筆，不補假資料）。
    """
    windows = windows or HOT_WINDOWS
    ages = {}
    for repo in repos or []:
        age = repo_age_days(repo, now)
        if age is not None:
            ages[repo.get("full_name")] = age
    best = ([], windows[0])
    for days in windows:
        picked = [r for r in repos or []
                  if 0 <= ages.get(r.get("full_name"), 10 ** 9) <= days]
        if len(picked) >= n:
            return picked[:n], days
        if len(picked) > len(best[0]):
            best = (picked[:n], days)
    return best


def rank_moves(current, previous):
    """比對本次與上次的 full_name 順序，回傳 {full_name: 標記}。

    正數為上升（↑N，≥3 為 ↑↑N）、負數為下降（↓N）、持平或上次無此筆者不標記。
    """
    prev = {name: i for i, name in enumerate(previous or [])}
    moves = {}
    for i, name in enumerate(current or []):
        if name not in prev:
            continue
        delta = prev[name] - i
        if delta > 0:
            moves[name] = ("↑↑" if delta >= 3 else "↑") + str(delta)
        elif delta < 0:
            moves[name] = "↓" + str(-delta)
    return moves


def apply_moves(repos, moves):
    """把名次升降標記寫入每個 repo 的 move 欄位（無變化為空字串）；回傳新清單。"""
    out = []
    for repo in repos or []:
        item = dict(repo)
        item["move"] = (moves or {}).get(item.get("full_name"), "")
        out.append(item)
    return out
```

- [ ] **Step 4: 執行測試確認通過**

Run:
```powershell
C:\Users\TW-10\Documents\firebase雲端資料夾\.venv\Scripts\python.exe -m unittest test_news -v
```
Expected: PASS（全數）

- [ ] **Step 5: Commit 並推送**

```powershell
git add github_rank.py test_news.py
git commit -m "feat: GitHub 選榜邏輯（Top N、時間窗挑選、名次升降標記）"
git push origin main
```

---

### Task 3: 快取 I/O 與網路層（ETag 條件式請求）

**Files:**
- Modify: `github_rank.py`（檔尾追加）
- Modify: `test_news.py`

**Interfaces:**
- Consumes: Task 1 的 `build_search_url(query, etag) -> (url, headers)`、`parse_repo(item)`
- Produces:
  - `load_cache(path=CACHE_FILE) -> dict`
  - `save_cache(path, data) -> None`（原子寫入，失敗不拋例外）
  - `search_repos(query, etag=None, session=None) -> tuple[list[dict] | None, str | None]`
    - `(list, etag)` HTTP 200
    - `(None, etag)` HTTP 304
    - `(None, None)` 失敗

- [ ] **Step 1: 寫失敗的測試**

在 `test_news.py` 中 `class TestApplyMoves` 之後插入：

```python
class _FakeResponse:
    def __init__(self, status_code=200, payload=None, headers=None, text=""):
        self.status_code = status_code
        self._payload = payload
        self.headers = headers or {}
        self.text = text

    def json(self):
        if self._payload is None:
            raise ValueError("no json payload")
        return self._payload


class _FakeSession:
    def __init__(self, response=None, exc=None):
        self._response = response
        self._exc = exc
        self.calls = []

    def get(self, url, headers=None, timeout=None):
        self.calls.append({"url": url, "headers": headers or {}, "timeout": timeout})
        if self._exc:
            raise self._exc
        return self._response


def gh_item(name="owner/repo", stars=100):
    return {"full_name": name, "html_url": f"https://github.com/{name}",
            "description": "d", "language": "Python", "stargazers_count": stars,
            "forks_count": 1, "created_at": "2026-09-01T00:00:00Z"}


class TestLoadCache(unittest.TestCase):
    def setUp(self):
        self.tmp = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                "_tmp_gh_cache.json")
        self.addCleanup(lambda: os.path.exists(self.tmp) and os.remove(self.tmp))

    def test_missing_file_returns_empty(self):
        self.assertEqual(gh.load_cache(self.tmp), {})

    def test_broken_json_returns_empty(self):
        with open(self.tmp, "w", encoding="utf-8") as f:
            f.write("{not json")
        self.assertEqual(gh.load_cache(self.tmp), {})

    def test_non_dict_json_returns_empty(self):
        with open(self.tmp, "w", encoding="utf-8") as f:
            f.write("[1, 2]")
        self.assertEqual(gh.load_cache(self.tmp), {})

    def test_roundtrip(self):
        gh.save_cache(self.tmp, {"updated_at": "x", "queries": {}})
        self.assertEqual(gh.load_cache(self.tmp), {"updated_at": "x", "queries": {}})


class TestSaveCache(unittest.TestCase):
    def setUp(self):
        self.tmp = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                "_tmp_gh_cache.json")
        self.addCleanup(lambda: os.path.exists(self.tmp) and os.remove(self.tmp))

    def test_creates_file(self):
        gh.save_cache(self.tmp, {"a": 1})
        self.assertTrue(os.path.exists(self.tmp))

    def test_no_temp_file_left_behind(self):
        gh.save_cache(self.tmp, {"a": 1})
        self.assertFalse(os.path.exists(self.tmp + ".tmp"))

    def test_unicode_preserved(self):
        gh.save_cache(self.tmp, {"desc": "中文"})
        self.assertEqual(gh.load_cache(self.tmp)["desc"], "中文")

    def test_write_failure_does_not_raise(self):
        gh.save_cache(os.path.join(self.tmp, "nested", "x.json"), {"a": 1})


class TestSearchReposOk(unittest.TestCase):
    def test_returns_parsed_repos(self):
        sess = _FakeSession(_FakeResponse(200, {"items": [gh_item()]}))
        repos, etag = gh.search_repos("topic:ai", session=sess)
        self.assertEqual(len(repos), 1)
        self.assertEqual(repos[0]["full_name"], "owner/repo")
        self.assertEqual(etag, None)

    def test_returns_response_etag(self):
        resp = _FakeResponse(200, {"items": []}, headers={"ETag": 'W/"e1"'})
        _, etag = gh.search_repos("q", session=_FakeSession(resp))
        self.assertEqual(etag, 'W/"e1"')

    def test_skips_items_without_full_name(self):
        sess = _FakeSession(_FakeResponse(200, {"items": [gh_item(), {"full_name": ""}]}))
        repos, _ = gh.search_repos("q", session=sess)
        self.assertEqual(len(repos), 1)

    def test_passes_timeout(self):
        sess = _FakeSession(_FakeResponse(200, {"items": []}))
        gh.search_repos("q", session=sess)
        self.assertEqual(sess.calls[0]["timeout"], 20)


class TestSearchReposNotModified(unittest.TestCase):
    def test_304_returns_none_and_etag(self):
        resp = _FakeResponse(304, None)
        repos, etag = gh.search_repos("q", etag='W/"old"', session=_FakeSession(resp))
        self.assertIsNone(repos)
        self.assertEqual(etag, 'W/"old"')

    def test_sends_if_none_match(self):
        sess = _FakeSession(_FakeResponse(304, None))
        gh.search_repos("q", etag='W/"old"', session=sess)
        self.assertEqual(sess.calls[0]["headers"]["If-None-Match"], 'W/"old"')


class TestSearchReposErrors(unittest.TestCase):
    def test_timeout_returns_none_none(self):
        repos, etag = gh.search_repos("q", session=_FakeSession(exc=Exception("timeout")))
        self.assertIsNone(repos)
        self.assertIsNone(etag)

    def test_403_returns_none_none(self):
        repos, etag = gh.search_repos("q", session=_FakeSession(_FakeResponse(403, None)))
        self.assertIsNone(repos)
        self.assertIsNone(etag)

    def test_422_returns_none_none(self):
        repos, etag = gh.search_repos("q", session=_FakeSession(_FakeResponse(422, None)))
        self.assertIsNone(repos)
        self.assertIsNone(etag)

    def test_500_returns_none_none(self):
        repos, etag = gh.search_repos("q", session=_FakeSession(_FakeResponse(500, None)))
        self.assertIsNone(repos)
        self.assertIsNone(etag)

    def test_bad_json_returns_none_none(self):
        sess = _FakeSession(_FakeResponse(200, None))
        repos, etag = gh.search_repos("q", session=sess)
        self.assertIsNone(repos)
        self.assertIsNone(etag)
```

- [ ] **Step 2: 執行測試確認失敗**

Run:
```powershell
C:\Users\TW-10\Documents\firebase雲端資料夾\.venv\Scripts\python.exe -m unittest test_news.TestSearchReposOk -v
```
Expected: FAIL，錯誤訊息為 `AttributeError: module 'github_rank' has no attribute 'search_repos'`

- [ ] **Step 3: 實作最小程式碼**

在 `github_rank.py` 檔尾追加：

```python
def load_cache(path=CACHE_FILE):
    """讀取快取；檔案不存在或 JSON 損毀回空 dict。"""
    try:
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, dict) else {}
    except FileNotFoundError:
        return {}
    except (OSError, ValueError) as e:
        print(f"  [GitHub] 快取讀取失敗（將重新抓取）: {e}")
        return {}


def save_cache(path, data):
    """原子寫入快取：先寫暫存檔再 os.replace，避免中斷產生半損毀檔。
    寫入失敗僅記錄，不中斷主流程。"""
    tmp = f"{path}.tmp"
    try:
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=1)
        os.replace(tmp, path)
    except OSError as e:
        print(f"  [GitHub] 快取寫入失敗（不影響本次輸出）: {e}")
        try:
            os.remove(tmp)
        except OSError:
            pass


def search_repos(query, etag=None, session=None):
    """查詢 GitHub Search API。

    回傳 (repos, etag)：
    - (list, etag)  HTTP 200，資料最新
    - (None, etag)  HTTP 304，資料未變更，呼叫端應沿用快取
    - (None, None) 請求失敗，呼叫端應沿用快取（可能為空）
    """
    url, headers = build_search_url(query, etag)
    getter = (session or requests).get
    try:
        r = getter(url, headers=headers, timeout=20)
    except Exception as e:
        print(f"  [GitHub] 查詢失敗: {e}")
        return None, None
    if r.status_code == 304:
        return None, etag
    if r.status_code == 403:
        reset = r.headers.get("X-RateLimit-Reset", "?")
        print(f"  [GitHub] 已被限額（403），預計 {reset} 後恢復")
        return None, None
    if r.status_code == 422:
        print(f"  [GitHub] query 語法錯誤（422）: {query} → {r.text[:200]}")
        return None, None
    if r.status_code != 200:
        print(f"  [GitHub] 非預期狀態 {r.status_code}: {query}")
        return None, None
    try:
        items = r.json().get("items") or []
    except Exception as e:
        print(f"  [GitHub] 回應解析失敗: {e}")
        return None, None
    repos = [parsed for parsed in (parse_repo(it) for it in items) if parsed]
    return repos, r.headers.get("ETag")
```

- [ ] **Step 4: 執行測試確認通過**

Run:
```powershell
C:\Users\TW-10\Documents\firebase雲端資料夾\.venv\Scripts\python.exe -m unittest test_news -v
```
Expected: PASS（全數）

- [ ] **Step 5: Commit 並推送**

```powershell
git add github_rank.py test_news.py
git commit -m "feat: GitHub 快取 I/O 與 Search API 條件式請求（304 不計額度）"
git push origin main
```

---

### Task 4: 主流程編排 `fetch_github_rank`

**Files:**
- Modify: `github_rank.py`（檔尾追加）
- Modify: `test_news.py`

**Interfaces:**
- Consumes: `load_cache`、`save_cache`、`search_repos`、`build_query`、`merge_repos`、`pick_top`、`pick_hot`、`rank_moves`、`apply_moves`、常數 `TOPICS`、`MIN_STARS`、`MIN_STARS_RECENT`、`MAX_DAYS`
- Produces:
  - `fetch_query_cached(name, query, cache) -> tuple[list[dict], str, str | None]`（`repos, status, etag`；status 為 `"ok"` / `"not_modified"` / `"error"`）
  - `fetch_github_rank(now=None, cache_path=CACHE_FILE) -> dict`
    回傳 `{top: list[dict], hot: list[dict], hot_days: int, updated_at: str|None, stale: bool}`

- [ ] **Step 1: 寫失敗的測試**

在 `test_news.py` 中 `class TestSearchReposErrors` 之後插入：

```python
def gh_repo(name="owner/repo", stars=100, age_days=5):
    created = (datetime(2026, 9, 25, tzinfo=timezone.utc) - timedelta(days=age_days))
    return {"full_name": name, "html_url": f"https://github.com/{name}",
            "description": "d", "language": "Python", "stars": stars, "forks": 1,
            "created_at": created.strftime("%Y-%m-%dT%H:%M:%SZ")}


class TestFetchQueryCached(unittest.TestCase):
    def test_ok_returns_fresh_repos(self):
        with mock.patch.object(gh, "search_repos", return_value=([{"full_name": "a/1"}], 'W/"e"')):
            repos, status, etag = gh.fetch_query_cached("topic_ai", "q", {})
        self.assertEqual(status, "ok")
        self.assertEqual(repos[0]["full_name"], "a/1")
        self.assertEqual(etag, 'W/"e"')

    def test_304_falls_back_to_cache(self):
        cache = {"queries": {"topic_ai": {"etag": 'W/"old"', "repos": [{"full_name": "a/1"}]}}}
        with mock.patch.object(gh, "search_repos", return_value=(None, 'W/"old"')):
            repos, status, etag = gh.fetch_query_cached("topic_ai", "q", cache)
        self.assertEqual(status, "not_modified")
        self.assertEqual(repos[0]["full_name"], "a/1")

    def test_error_falls_back_to_cache(self):
        cache = {"queries": {"topic_ai": {"etag": 'W/"old"', "repos": [{"full_name": "a/1"}]}}}
        with mock.patch.object(gh, "search_repos", return_value=(None, None)):
            repos, status, etag = gh.fetch_query_cached("topic_ai", "q", cache)
        self.assertEqual(status, "error")
        self.assertEqual(repos[0]["full_name"], "a/1")
        self.assertIsNone(etag)

    def test_error_with_no_cache_returns_empty(self):
        with mock.patch.object(gh, "search_repos", return_value=(None, None)):
            repos, status, _ = gh.fetch_query_cached("topic_ai", "q", {})
        self.assertEqual(repos, [])
        self.assertEqual(status, "error")


class TestFetchGithubRank(unittest.TestCase):
    def setUp(self):
        self.tmp = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                "_tmp_gh_rank.json")
        self.addCleanup(lambda: os.path.exists(self.tmp) and os.remove(self.tmp))
        self.now = datetime(2026, 9, 25, 7, 0, tzinfo=TW)

    def ok(self, repos, etag='W/"e"'):
        return mock.patch.object(gh, "search_repos", return_value=(repos, etag))

    def test_builds_top_and_hot_from_queries(self):
        with self.ok([gh_repo("a/top", 900, 200), gh_repo("a/hot", 800, 3)]):
            data = gh.fetch_github_rank(now=self.now, cache_path=self.tmp)
        self.assertIn("a/top", [r["full_name"] for r in data["top"]])
        self.assertEqual([r["full_name"] for r in data["hot"]], ["a/hot"])
        self.assertEqual(data["hot_days"], 30)
        self.assertFalse(data["stale"])

    def test_excludes_list_repos_from_top(self):
        repos = [gh_repo("a/awesome-list", 9999, 200), gh_repo("a/real", 100, 200)]
        with self.ok(repos):
            data = gh.fetch_github_rank(now=self.now, cache_path=self.tmp)
        self.assertEqual([r["full_name"] for r in data["top"]], ["a/real"])

    def test_uses_four_queries(self):
        with self.ok([]) as m:
            gh.fetch_github_rank(now=self.now, cache_path=self.tmp)
        self.assertEqual(m.call_count, 4)

    def test_writes_cache_with_ranks(self):
        with self.ok([gh_repo("a/one", 500, 3)]):
            gh.fetch_github_rank(now=self.now, cache_path=self.tmp)
        cache = gh.load_cache(self.tmp)
        self.assertIn("a/one", cache["ranks"]["top"])
        self.assertIn("topic_ai", cache["queries"])
        self.assertIn("recent", cache["queries"])

    def test_all_fail_marks_stale_and_uses_old_cache(self):
        gh.save_cache(self.tmp, {
            "updated_at": "2026-09-24 07:00",
            "queries": {"topic_ai": {"etag": None, "repos": [gh_repo("a/old", 300, 200)]},
                        "topic_llm": {"etag": None, "repos": []},
                        "topic_agent": {"etag": None, "repos": []},
                        "recent": {"etag": None, "repos": []}},
            "ranks": {"top": ["a/old"], "hot": []},
        })
        with mock.patch.object(gh, "search_repos", return_value=(None, None)):
            data = gh.fetch_github_rank(now=self.now, cache_path=self.tmp)
        self.assertTrue(data["stale"])
        self.assertEqual(data["updated_at"], "2026-09-24 07:00")
        self.assertEqual([r["full_name"] for r in data["top"]], ["a/old"])

    def test_all_fail_no_cache_returns_empty(self):
        with mock.patch.object(gh, "search_repos", return_value=(None, None)):
            data = gh.fetch_github_rank(now=self.now, cache_path=self.tmp)
        self.assertEqual(data["top"], [])
        self.assertEqual(data["hot"], [])
        self.assertIsNone(data["updated_at"])
        self.assertFalse(data["stale"])

    def test_second_run_uses_etag_from_cache(self):
        with self.ok([gh_repo("a/one", 500, 3)]):
            gh.fetch_github_rank(now=self.now, cache_path=self.tmp)
        with self.ok(None) as m:
            gh.fetch_github_rank(now=self.now, cache_path=self.tmp)
        self.assertEqual(m.call_args_list[0][0][1], 'W/"e"')
```

- [ ] **Step 2: 執行測試確認失敗**

Run:
```powershell
C:\Users\TW-10\Documents\firebase雲端資料夾\.venv\Scripts\python.exe -m unittest test_news.TestFetchGithubRank -v
```
Expected: FAIL，錯誤訊息為 `AttributeError: module 'github_rank' has no attribute 'fetch_github_rank'`

- [ ] **Step 3: 實作最小程式碼**

在 `github_rank.py` 檔尾追加：

```python
def fetch_query_cached(name, query, cache):
    """帶 ETag 條件式請求一組查詢，失敗或 304 時沿用快取內資料。

    回傳 (repos, status, etag)，status 為：
    - "ok"            HTTP 200，repos 為最新資料
    - "not_modified"  HTTP 304，repos 沿用快取
    - "error"         請求失敗，repos 沿用快取（可能為空清單）
    """
    prev = (cache.get("queries") or {}).get(name) or {}
    prev_etag = prev.get("etag")
    repos, etag = search_repos(query, prev_etag)
    if repos is not None:
        return repos, "ok", etag
    if etag is not None and etag == prev_etag:
        return prev.get("repos") or [], "not_modified", etag
    return prev.get("repos") or [], "error", None


def fetch_github_rank(now=None, cache_path=CACHE_FILE):
    """主流程：抓四組查詢、合併篩選、選出兩欄、計算名次升降、寫回快取。

    回傳 {top, hot, hot_days, updated_at, stale}。
    stale 為 True 表示本次所有查詢都失敗、頁面顯示的是舊快取資料。
    """
    now = now or datetime.now(TAIWAN_TZ)
    cache = load_cache(cache_path)
    prev_queries = cache.get("queries") or {}
    prev_ranks = cache.get("ranks") or {}

    min_date = (now - timedelta(days=MAX_DAYS)).strftime("%Y-%m-%d")
    plan = [(f"topic_{t}", build_query([t], MIN_STARS)) for t in TOPICS]
    plan.append(("recent", build_query(TOPICS, MIN_STARS_RECENT, created_after=min_date)))

    new_queries = {}
    unchanged = 0
    failed = 0
    for name, query in plan:
        repos, status, etag = fetch_query_cached(name, query, cache)
        if status == "not_modified":
            unchanged += 1
        elif status == "error":
            failed += 1
        new_queries[name] = {"etag": etag, "repos": repos}

    top_pool = merge_repos([new_queries[f"topic_{t}"]["repos"] for t in TOPICS])
    hot_pool = merge_repos([new_queries["recent"]["repos"]])

    top = pick_top(top_pool)
    hot, hot_days = pick_hot(hot_pool, now)
    top = apply_moves(top, rank_moves([r["full_name"] for r in top], prev_ranks.get("top")))
    hot = apply_moves(hot, rank_moves([r["full_name"] for r in hot], prev_ranks.get("hot")))

    stale = failed == len(plan)
    updated_at = cache.get("updated_at") if stale else now.strftime("%Y-%m-%d %H:%M")
    stale = bool(stale and updated_at)

    save_cache(cache_path, {
        "updated_at": updated_at,
        "queries": new_queries,
        "ranks": {"top": [r["full_name"] for r in top],
                  "hot": [r["full_name"] for r in hot]},
    })

    note = f"（{unchanged} 組未變更、{failed} 組失敗）" if (unchanged or failed) else ""
    stale_note = "，顯示舊資料" if stale else ""
    print(f"  [GitHub] 星數榜 {len(top)} 則、爆款榜 {len(hot)} 則（{hot_days} 天內）"
          f"{note}{stale_note}")
    return {"top": top, "hot": hot, "hot_days": hot_days,
            "updated_at": updated_at, "stale": stale}
```

- [ ] **Step 4: 執行測試確認通過**

Run:
```powershell
C:\Users\TW-10\Documents\firebase雲端資料夾\.venv\Scripts\python.exe -m unittest test_news -v
```
Expected: PASS（全數）

- [ ] **Step 5: Commit 並推送**

```powershell
git add github_rank.py test_news.py
git commit -m "feat: GitHub 排行主流程（ETag 快取、兩欄選榜、名次升降寫回）"
git push origin main
```

---

### Task 5: HTML 產出 `build_github_html` 與樣式

**Files:**
- Modify: `github_rank.py`（檔尾追加）
- Modify: `test_news.py`

**Interfaces:**
- Consumes: `fmt_stars`、`HOT_WINDOWS`；`fetch_github_rank` 回傳的 dict
- Produces:
  - `GH_CSS`（str，樣式片段，需在頁面 `<style>` 中緊接既有 `CSS` 之後）
  - `gh_card_html(rank, repo, show_date=False) -> str`
  - `build_github_html(data) -> str`（`data` 為 `fetch_github_rank` 的回傳或 `None`）

- [ ] **Step 1: 寫失敗的測試**

在 `test_news.py` 中 `class TestFetchGithubRank` 之後插入：

```python
class TestBuildGithubHtml(unittest.TestCase):
    def data(self, top=None, hot=None, hot_days=30, stale=False, updated_at=None):
        return {"top": top or [], "hot": hot or [], "hot_days": hot_days,
                "stale": stale, "updated_at": updated_at}

    def repo(self, name="owner/repo", stars=45231, forks=3204, language="Python",
             desc="An agent that grows with you", move=""):
        return {"full_name": name, "html_url": f"https://github.com/{name}",
                "description": desc, "language": language, "stars": stars,
                "forks": forks, "created_at": "2026-08-30T00:00:00Z", "move": move}

    def test_none_data_shows_failure_message(self):
        self.assertIn("今天抓不到 GitHub 資料，請稍後再試。", gh.build_github_html(None))

    def test_both_empty_shows_failure_message(self):
        self.assertIn("今天抓不到 GitHub 資料，請稍後再試。",
                      gh.build_github_html(self.data()))

    def test_top_section_heading(self):
        html = gh.build_github_html(self.data(top=[self.repo()]))
        self.assertIn("AI 應用星數 Top 1", html)
        self.assertIn("topic:ai / llm / agent", html)

    def test_hot_section_heading_shows_actual_days(self):
        html = gh.build_github_html(self.data(hot=[self.repo()], hot_days=60))
        self.assertIn("近 60 天爆款 Top 1", html)

    def test_stars_and_forks_formatted(self):
        html = gh.build_github_html(self.data(top=[self.repo()]))
        self.assertIn("45,231", html)
        self.assertIn("fork 3,204", html)

    def test_rank_number_rendered(self):
        html = gh.build_github_html(self.data(top=[self.repo(), self.repo("b/two", 10)]))
        self.assertIn("gh-rank", html)

    def test_language_badge(self):
        html = gh.build_github_html(self.data(top=[self.repo()]))
        self.assertIn("<span class='badge'>Python</span>", html)

    def test_missing_language_renders_no_extra_badge(self):
        # 有語言時 = 語言 badge + 星數 badge 共 2 個
        html = gh.build_github_html(self.data(top=[self.repo(language="")]))
        self.assertEqual(html.count("class='badge'"), 1)

    def test_description_rendered(self):
        html = gh.build_github_html(self.data(top=[self.repo()]))
        self.assertIn("An agent that grows with you", html)

    def test_empty_description_renders_no_summary_div(self):
        html = gh.build_github_html(self.data(top=[self.repo(desc="")]))
        self.assertNotIn("class='summary'", html)

    def test_created_date_only_in_hot_section(self):
        html = gh.build_github_html(self.data(top=[self.repo()], hot=[self.repo("b/two")]))
        top_part, hot_part = html.split("近 30 天爆款")
        self.assertNotIn("建立於", top_part)
        self.assertIn("建立於 2026-08-30", hot_part)

    def test_move_arrow_rendered(self):
        html = gh.build_github_html(self.data(top=[self.repo(move="↑2")]))
        self.assertIn("gh-move", html)
        self.assertIn("↑2", html)

    def test_no_move_field_renders_no_move_div(self):
        repo = self.repo()
        repo["move"] = ""
        html = gh.build_github_html(self.data(top=[repo]))
        self.assertNotIn("gh-move", html)

    def test_stale_warning_shown(self):
        html = gh.build_github_html(self.data(top=[self.repo()], stale=True,
                                              updated_at="2026-09-24 07:00"))
        self.assertIn("今天更新失敗", html)
        self.assertIn("2026-09-24 07:00", html)

    def test_no_stale_warning_when_fresh(self):
        html = gh.build_github_html(self.data(top=[self.repo()], updated_at="2026-09-25 07:00"))
        self.assertNotIn("gh-warn", html)

    def test_top_empty_but_hot_present(self):
        html = gh.build_github_html(self.data(hot=[self.repo()]))
        self.assertIn("目前查不到符合條件的 AI 應用專案。", html)
        self.assertNotIn("今天抓不到 GitHub 資料", html)

    def test_hot_empty_but_top_present(self):
        html = gh.build_github_html(self.data(top=[self.repo()]))
        self.assertIn("目前查不到近期的 AI 專案。", html)

    def test_escapes_html_in_description(self):
        html = gh.build_github_html(self.data(top=[self.repo(desc="<script>alert(1)</script>")]))
        self.assertNotIn("<script>", html)
        self.assertIn("&lt;script&gt;", html)

    def test_escapes_html_in_repo_name(self):
        html = gh.build_github_html(self.data(top=[self.repo(name="<img src=x onerror=1>")]))
        self.assertNotIn("<img", html)


class TestGhCss(unittest.TestCase):
    def test_defines_card_classes(self):
        for cls in (".gh-card", ".gh-rank", ".gh-main", ".gh-move", ".gh-warn"):
            self.assertIn(cls, gh.GH_CSS)
```

- [ ] **Step 2: 執行測試確認失敗**

Run:
```powershell
C:\Users\TW-10\Documents\firebase雲端資料夾\.venv\Scripts\python.exe -m unittest test_news.TestBuildGithubHtml -v
```
Expected: FAIL，錯誤訊息為 `AttributeError: module 'github_rank' has no attribute 'build_github_html'`

- [ ] **Step 3: 實作最小程式碼**

在 `github_rank.py` 檔尾追加：

```python
GH_CSS = """
    .gh-card{display:flex;gap:12px;align-items:flex-start}
    .gh-rank{flex:0 0 28px;height:28px;line-height:28px;text-align:center;border-radius:8px;
            background:var(--accent);color:#fff;font-weight:700;font-size:14px}
    .gh-main{flex:1;min-width:0}
    .gh-main a{text-decoration:none;color:var(--ink);font-weight:600;font-size:15px}
    .gh-main a:hover{color:var(--accent)}
    .gh-move{color:#059669;font-size:12px;font-weight:700;margin-left:6px}
    .gh-warn{color:#b45309;font-size:13px;margin-bottom:10px}
    @media(max-width:480px){.gh-rank{flex:0 0 24px;height:24px;line-height:24px;font-size:13px}}
    """


def gh_card_html(rank, repo, show_date=False):
    """單張 GitHub 排行卡：名次、名稱、名次升降、描述、語言／星數／fork／建立日期。"""
    move = repo.get("move") or ""
    move_html = f"<span class='gh-move'>{html.escape(move)}</span>" if move else ""
    desc = repo.get("description") or ""
    desc_html = f"<div class='summary'>{html.escape(desc)}</div>" if desc else ""
    lang = repo.get("language") or ""
    lang_html = f"<span class='badge'>{html.escape(lang)}</span>" if lang else ""
    date_html = ""
    if show_date:
        day = (repo.get("created_at") or "")[:10]
        if day:
            date_html = f"<span>建立於 {html.escape(day)}</span>"
    return (
        f"<div class='card gh-card'>"
        f"<div class='gh-rank'>{rank}</div>"
        f"<div class='gh-main'>"
        f"<a href='{html.escape(repo.get('html_url', ''))}' target='_blank' rel='noopener'>"
        f"{html.escape(repo.get('full_name', ''))}</a>{move_html}"
        f"{desc_html}"
        f"<div class='meta'>{lang_html}"
        f"<span class='badge'>★ {fmt_stars(repo.get('stars', 0))}</span>"
        f"<span>fork {fmt_stars(repo.get('forks', 0))}</span>{date_html}</div>"
        f"</div></div>"
    )


def build_github_html(data):
    """產生 GitHub 分頁內容：星數榜與爆款榜兩個 section。

    data 為 fetch_github_rank 的回傳或 None。兩欄皆空時顯示單一失敗訊息。
    """
    data = data or {}
    top = data.get("top") or []
    hot = data.get("hot") or []
    days = data.get("hot_days") or HOT_WINDOWS[0]
    if not top and not hot:
        return ("<section><h2>GitHub 熱門</h2>"
                "<p>今天抓不到 GitHub 資料，請稍後再試。</p></section>")

    warn = ""
    if data.get("stale"):
        warn = ("<p class='gh-warn'>⚠ 今天更新失敗，顯示最後一次成功抓取的資料"
                f"（{html.escape(data.get('updated_at') or '無記錄')}）</p>")

    sec = []
    if top:
        cards = "\n".join(gh_card_html(i, r) for i, r in enumerate(top, 1))
        sec.append(f"<section><h2>⭐ AI 應用星數 Top {len(top)} "
                   f"<span class='count'>(topic:ai / llm / agent)</span></h2>{cards}</section>")
    else:
        sec.append("<section><h2>⭐ AI 應用星數 Top 5</h2>"
                   "<p>目前查不到符合條件的 AI 應用專案。</p></section>")
    if hot:
        cards = "\n".join(gh_card_html(i, r, show_date=True) for i, r in enumerate(hot, 1))
        sec.append(f"<section><h2>🚀 近 {days} 天爆款 Top {len(hot)} "
                   f"<span class='count'>(近期新建高星數)</span></h2>{cards}</section>")
    else:
        sec.append(f"<section><h2>🚀 近 {days} 天爆款 Top 5</h2>"
                   "<p>目前查不到近期的 AI 專案。</p></section>")
    return warn + "\n".join(sec)
```

- [ ] **Step 4: 執行測試確認通過**

Run:
```powershell
C:\Users\TW-10\Documents\firebase雲端資料夾\.venv\Scripts\python.exe -m unittest test_news -v
```
Expected: PASS（全數）

- [ ] **Step 5: Commit 並推送**

```powershell
git add github_rank.py test_news.py
git commit -m "feat: GitHub 排行 HTML 產出（兩欄卡片、名次升降、樣式）"
git push origin main
```

---

### Task 6: 串接 `fetch_news.py` 新增第 4 分頁

**Files:**
- Modify: `fetch_news.py`（import、`build_page_html` 簽名與模板、`render_html` 簽名、`main`）
- Modify: `test_news.py`
- Modify: `README.md`
- Create: `.gitignore`（加入 `github_rank_cache.json`）

**Interfaces:**
- Consumes: `github_rank.fetch_github_rank() -> dict`、`github_rank.build_github_html(data) -> str`、`github_rank.GH_CSS -> str`
- Produces: `build_page_html(results, agent_items, generated_at, health=None, github_data=None) -> str`（第 5 個參數可省略，既有呼叫端不受影響）；`render_html(results, agent_items, generated_at, health=None, github_data=None) -> None`

- [ ] **Step 1: 寫失敗的測試**

在 `test_news.py` 中 `class TestGhCss` 之後、`if __name__ == "__main__":` 之前插入：

```python
class TestPageWithGithubTab(unittest.TestCase):
    def gh_data(self):
        return {"top": [{"full_name": "owner/repo", "html_url": "https://github.com/owner/repo",
                         "description": "d", "language": "Python", "stars": 100,
                         "forks": 1, "created_at": "2026-08-30T00:00:00Z", "move": ""}],
                "hot": [], "hot_days": 30, "updated_at": "2026-09-25 07:00", "stale": False}

    def test_tab_button_present(self):
        html = fn.build_page_html({}, [], "2026-09-25 07:00", github_data=self.gh_data())
        self.assertIn('data-tab="github"', html)
        self.assertIn("switchTab('github')", html)
        self.assertIn("GitHub 熱門", html)

    def test_panel_present_and_hidden_by_default(self):
        html = fn.build_page_html({}, [], "2026-09-25 07:00", github_data=self.gh_data())
        self.assertIn('id="github" class="panel"', html)

    def test_panel_active_only_for_ai_news(self):
        html = fn.build_page_html({}, [], "2026-09-25 07:00", github_data=self.gh_data())
        self.assertIn('class="panel active"', html)
        self.assertNotIn('id="github" class="panel active"', html)

    def test_repo_rendered_in_page(self):
        html = fn.build_page_html({}, [], "2026-09-25 07:00", github_data=self.gh_data())
        self.assertIn("https://github.com/owner/repo", html)
        self.assertIn("owner/repo", html)
        self.assertIn("gh-rank", html)

    def test_github_css_injected(self):
        html = fn.build_page_html({}, [], "2026-09-25 07:00", github_data=self.gh_data())
        self.assertIn(".gh-rank", html)

    def test_none_github_data_shows_empty_state(self):
        html = fn.build_page_html({}, [], "2026-09-25 07:00")
        self.assertIn("今天抓不到 GitHub 資料，請稍後再試。", html)

    def test_source_note_in_header_and_footer(self):
        html = fn.build_page_html({}, [], "2026-09-25 07:00", github_data=self.gh_data())
        self.assertEqual(html.count("GitHub 欄來源：GitHub Search API"), 2)

    def test_existing_tabs_untouched(self):
        html = fn.build_page_html({}, [], "2026-09-25 07:00", github_data=self.gh_data())
        for tab in ('data-tab="ai-news"', 'data-tab="ai-agent"', 'data-tab="health"'):
            self.assertIn(tab, html)
```

- [ ] **Step 2: 執行測試確認失敗**

Run:
```powershell
C:\Users\TW-10\Documents\firebase雲端資料夾\.venv\Scripts\python.exe -m unittest test_news.TestPageWithGithubTab -v
```
Expected: FAIL，斷言 `data-tab="github"` 不在 HTML 中

- [ ] **Step 3: 實作 — 頂部 import**

在 `fetch_news.py` 的 `import feedparser` 之後加入：

```python
import github_rank
```

- [ ] **Step 4: 實作 — `build_page_html` 簽名與 GitHub 片段**

將 `fetch_news.py` 中 `build_page_html` 的定義行改為：

```python
def build_page_html(results, agent_items, generated_at, health=None, github_data=None):
```

並在函式開頭（`if health:` 之前）加入：

```python
    github_frag = github_rank.build_github_html(github_data)
```

- [ ] **Step 5: 實作 — 模板加入 tab、panel、樣式、來源說明**

在頁面模板中：

`<style>{CSS}</style>` 改為：

```
<style>{CSS}{github_rank.GH_CSS}</style>
```

頁籤列的 `data-tab="health"` 按鈕之後、`</div>` 之前加入：

```html
  <button type="button" class="tab" data-tab="github" onclick="switchTab('github')">GitHub 熱門</button>
```

`id="health"` 的 `</div>` 之後加入：

```html
<div id="github" class="panel">
{github_frag}
</div>
```

header 的日期行改為：

```html
  <div class="date">更新時間：{html.escape(generated_at)}　｜　AI Agent 欄來源：Google News、數位時代 + 品牌關鍵字搜尋　｜　GitHub 欄來源：GitHub Search API</div>
```

footer 改為：

```html
<footer>由 fetch_news.py 自動產生　・　每日自動更新　・　健康欄來源：康健　・　GitHub 欄來源：GitHub Search API</footer>
```

- [ ] **Step 6: 實作 — `render_html` 與 `main` 串接**

將 `render_html` 改為：

```python
def render_html(results, agent_items, generated_at, health=None, github_data=None):
    page = build_page_html(results, agent_items, generated_at, health, github_data)
    with open(OUT_FILE, "w", encoding="utf-8") as f:
        f.write(page)
    total = sum(len(v) for v in results.values()) + len(agent_items)
    print(f"✔ 已生成 {OUT_FILE}（共 {total} 則）")
```

在 `main()` 中，康健抓取之後、`generated_at = ...` 之前加入：

```python
    print("▸ 抓取 GitHub 熱門專案…")
    gh_data = github_rank.fetch_github_rank()
```

並將 `render_html(...)` 呼叫改為：

```python
    render_html(results, agent_items, generated_at, health, gh_data)
```

- [ ] **Step 7: 實作 — `run_log.txt` 統計納入 GitHub 欄**

將 `main()` 結尾的統計與寫 log 段落改為：

```python
    sources = [f["name"] for f in FEEDS] + [f["name"] for f in AGENT_FEEDS] + ["Google News"]
    ok = sum(1 for name in sources if source_items.get(name))
    total = sum(len(v) for v in results.values()) + len(agent_items) + len(ch_latest) + len(ch_theme_items)
    gh_top = len(gh_data.get("top") or [])
    gh_hot = len(gh_data.get("hot") or [])
    gh_note = "（沿用舊資料）" if gh_data.get("stale") else ""
    line = (f"[{generated_at}] 完成：{ok}/{len(sources)} 來源成功，共 {total} 則；"
            f"GitHub 欄：星數榜 {gh_top} 則、爆款榜 {gh_hot} 則{gh_note}\n")
    with open("run_log.txt", "a", encoding="utf-8") as f:
        f.write(line)
```

- [ ] **Step 8: 執行測試確認通過**

Run:
```powershell
C:\Users\TW-10\Documents\firebase雲端資料夾\.venv\Scripts\python.exe -m unittest test_news -v
```
Expected: PASS（全數）

- [ ] **Step 9: 新增 `.gitignore`**

在 `每日AI新聞\.gitignore` 建立檔案，內容為：

```
github_rank_cache.json
```

- [ ] **Step 10: 更新 README**

在 `README.md` 的「檔案說明」表格加入兩列：

```markdown
| `github_rank.py` | GitHub 熱門專案排行：抓取＋篩選＋ETag 快取＋產生兩個排行榜 |
| `github_rank_cache.json` | GitHub 查詢快取（含 ETag 與上次排名），不納入版控 |
```

在「新聞來源（皆為 AI 專屬 RSS）」之前插入新章節：

```markdown
## GitHub 熱門欄

第 4 個分頁，資料來自 GitHub Search API（免金鑰，每天 4 次請求）：

| 欄位 | 邏輯 |
|------|------|
| ⭐ AI 應用星數 Top 5 | `topic:ai`／`topic:llm`／`topic:agent` 合併去重，排除 awesome／roadmap／tutorial 等清單類，依星數取前 5 |
| 🚀 近 30 天爆款 Top 5 | 同上但三個 topic 都要有，且建立於 90 天內；不足 5 個時自動放寬到 60／90 天（實際天數顯示於標題） |

- 卡片上的 `↑2` 表示比上次抓取上升 2 名
- 查詢帶 ETag 條件式請求：資料沒變時 GitHub 回 304，不計入 rate limit、不下載內容，直接沿用 `github_rank_cache.json`
- 想提高限額可設定環境變數 `GITHUB_TOKEN`
- 抓取失敗時沿用快取舊資料並在頁面顯示警示，不影響其他分頁
```

- [ ] **Step 11: 端到端驗證（真實網路呼叫）**

Run:
```powershell
C:\Users\TW-10\Documents\firebase雲端資料夾\.venv\Scripts\python.exe fetch_news.py
```
Expected: 輸出包含 `▸ 抓取 GitHub 熱門專案…` 與 `[GitHub] 星數榜 5 則、爆款榜 N 則（30 天內）`，
且 `index.html` 內含 `data-tab="github"`。

再執行第二次驗證 304 路徑：

```powershell
C:\Users\TW-10\Documents\firebase雲端資料夾\.venv\Scripts\python.exe fetch_news.py
```
Expected: 輸出包含 `[GitHub] 星數榜 5 則、爆款榜 N 則（30 天內）（4 組未變更、0 組失敗）`
（若當日星數變動而未命中 304，顯示 `0 組未變更` 亦屬正常）

- [ ] **Step 12: 部署並 Commit**

```powershell
git add fetch_news.py test_news.py README.md .gitignore index.html
git commit -m "feat: 新增 GitHub 熱門分頁（星數 Top5 ＋ 爆款 Top5、ETag 快取）"
git push origin main
firebase deploy --only hosting --project opencode-sk
```

- [ ] **Step 13: 部署後驗證**

```powershell
Start-Process "https://daily-ai-news-sk.web.app"
```
Expected: 頁面出現第 4 個分頁「GitHub 熱門」，切換後顯示兩個排行榜各 5 筆

---

## 驗收標準

- [ ] `python -m unittest test_news -v` 全數通過（既有 11 類別 + 新增 23 類別，共 34 類別）
- [ ] `index.html` 內含 4 個 `.tab` 按鈕與 4 個 `.panel`
- [ ] 星數榜 5 筆、爆款榜 ≤5 筆，標題天數與實際採用視窗一致
- [ ] 第二次執行時 4 組查詢命中 304（不計入 rate limit）
- [ ] 殺掉網路（`fetch_github_rank` 內全部失敗）時頁面仍產生，GitHub 欄顯示舊資料警示
- [ ] `github_rank_cache.json` 未被 git 追蹤（`git status` 不顯示）
- [ ] 線上網址 https://daily-ai-news-sk.web.app 可切換至 GitHub 熱門分頁

## 風險與回滾

| 風險 | 緩解 | 回滾 |
|------|------|------|
| GitHub API 改版或限額 | 已隔離，失敗只影響該欄 | 移除 `main()` 中的 `gh_data` 呼叫並傳 `None` |
| `build_page_html` 模板改壞 | 既有 11 個測試類別涵蓋前三個分頁 | `git revert` Task 6 |
| 快取檔累積過大 | 只存呈現欄位（7 個 key），估計 100–300 KB | 刪除 `github_rank_cache.json` |
