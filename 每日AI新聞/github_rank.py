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


def pick_top(repos, n=TOP_N):
    """取星數排序後的前 n 筆（輸入須已排序）。"""
    if n <= 0:
        return []
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
    if n <= 0:
        return [], windows[0]
    ages = {}
    for repo in repos or []:
        age = repo_age_days(repo, now)
        if age is not None:
            ages[repo.get("full_name")] = age
    best = ([], windows[0])
    for days in windows:
        picked = [r for r in repos or []
                  if r.get("full_name") in ages and 0 <= ages[r["full_name"]] <= days]
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
    except (OSError, TypeError, ValueError) as e:
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
        repos = [parsed for parsed in (parse_repo(it) for it in items) if parsed]
    except Exception as e:
        print(f"  [GitHub] 回應解析失敗: {e}")
        return None, None
    return repos, r.headers.get("ETag")


def fetch_query_cached(name, query, cache):
    """帶 ETag 條件式請求一組查詢，失敗或 304 時沿用快取內資料。

    回傳 (repos, status, etag)，status 為：
    - "ok"            HTTP 200，repos 為最新資料
    - "not_modified"  HTTP 304，repos 沿用快取
    - "error"         請求失敗，repos 沿用快取（可能為空清單）
    """
    queries = cache.get("queries")
    if not isinstance(queries, dict):
        queries = {}
    prev = queries.get(name)
    if not isinstance(prev, dict):
        prev = {}
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
    if now is None:
        now = datetime.now(TAIWAN_TZ)
    elif now.tzinfo is None:
        now = now.replace(tzinfo=TAIWAN_TZ)
    cache = load_cache(cache_path)
    prev_ranks = cache.get("ranks")
    if not isinstance(prev_ranks, dict):
        prev_ranks = {}
    prev_top = prev_ranks.get("top")
    if not isinstance(prev_top, list):
        prev_top = []
    prev_hot = prev_ranks.get("hot")
    if not isinstance(prev_hot, list):
        prev_hot = []

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
        if not isinstance(repos, list):
            repos = []
        else:
            repos = [repo for repo in repos if isinstance(repo, dict)]
        new_queries[name] = {"etag": etag, "repos": repos}

    top_pool = merge_repos([new_queries[f"topic_{t}"]["repos"] for t in TOPICS])
    hot_pool = merge_repos([new_queries["recent"]["repos"]])

    top = pick_top(top_pool)
    hot, hot_days = pick_hot(hot_pool, now)
    top = apply_moves(top, rank_moves([r["full_name"] for r in top], prev_top))
    hot = apply_moves(hot, rank_moves([r["full_name"] for r in hot], prev_hot))

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
