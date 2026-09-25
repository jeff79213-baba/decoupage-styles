# 每日新聞 — 新增「GitHub 熱門」分頁（星數 Top5 ＋ 爆款 Top5）設計文件

- 日期：2026-09-25
- 專案：每日AI新聞（網站名稱「每日新聞」）
- 涉及檔案：新增 `github_rank.py`、`github_rank_cache.json`（執行時產生）；修改 `fetch_news.py`、`test_news.py`、`README.md`、`index.html`（由腳本重新生成）

## 背景與目標

現有頁面有三個分頁：AI 新聞、AI Agent、健康。皆為新聞類內容。使用者希望增加 GitHub 相關的兩個欄位：

1. **AI 應用總星數前五名**
2. **有爆發性成長、星數增加快速的前五名**

## 需求確認（已與使用者確認）

| 項目 | 決定 |
|------|------|
| 欄位一 | 依當下 `stargazers_count` 排序取前 5 |
| 欄位二 | **不做星數歷史追蹤**；改用「近 30 天新建且星數高」作為爆款邏輯 |
| AI 篩選 | `topic:ai` ＋ `topic:llm` ＋ `topic:agent` 合併去重，排除清單類倉庫 |
| 呈現位置 | 頁籤列新增獨立第 4 分頁「GitHub 熱門」，內含兩個 section |
| 更新頻率 | **每天照抓最新資料**；以 ETag 條件式請求讓「資料沒變」時不計入 rate limit |
| 名次穩定 | 顯示名次升降標記（↑ / ↓），避免榜單看起來在無意義跳動 |
| 實作方式 | 獨立模組 `github_rank.py`，由 `fetch_news.py` 呼叫（方案 B） |

### 為什麼不做星數快照追蹤

使用者的原始需求含「星數增加快速」，評估後改採「近 30 天新建」作為爆款代理指標：

- 星數成長率需要跨日快照才能計算，首次執行無資料，且快照檔會隨時間膨脹
- 「近 30 天新建、星數已達高標」同樣能代表爆發性成長，且**單次抓取即可得出**，實作成本與額度都最低
- 代價：無法區分「30 天內飆到 1 萬星」與「30 天內慢慢累積到 1 萬星」

## 資料來源

GitHub REST Search API（`https://api.github.com/search/repositories`），免金鑰即可使用。

### 額度事實

| 限制 | 數值 |
|------|------|
| Search API（免金鑰） | 10 次／分鐘 |
| Search API（有 `GITHUB_TOKEN`） | 30 次／分鐘 |
| 本設計每次執行請求數 | 4 次 |

每天 07:00 執行一次 4 次請求，佔單次限額的 4 成，**額度不是瓶頸**。但仍採用條件式請求以省流量並加速執行（見「快取與條件式請求」）。

### 請求組法

| 用途 | query | 其他參數 |
|------|-------|----------|
| AI 應用候選（3 次） | `topic:ai stars:>1000`、`topic:llm stars:>1000`、`topic:agent stars:>1000` | `sort=stars`、`order=desc`、`per_page=20` |
| 近期爆款候選（1 次） | `topic:ai topic:llm topic:agent created:>=YYYY-MM-DD stars:>50`（`YYYY-MM-DD` = 今天 −90 天） | 同上 |

- `stars:>1000` 門檻排除小型雜訊倉庫（可調，見「可調整參數」）
- 近期爆款查詢的 `created:` 下限為「執行當天 −90 天」，一次取回最長窗口的資料，再於本地分窗過濾（見下方演算法）
- GitHub Search 對 `topic:` 為 AND 關係，故爆款查詢字串為 `topic:ai topic:llm topic:agent`（三個都要有）。此為刻意選擇：爆款榜單寧可少也不要鬆

### 認證

- 預設免金鑰
- 若環境變數存在 `GITHUB_TOKEN`，帶上 `Authorization: Bearer <token>`（提高限額至 30 次/分、5000 次/時）
- `User-Agent` 必填（GitHub 要求），值為 `daily-ai-news`
- `Accept: application/vnd.github+json`

## 排除規則（清單類倉庫）

合併去重後，剔除名稱或描述命中下列關鍵字（不分大小寫、視為單詞）的倉庫：

```
awesome  roadmap  tutorial  course  curriculum  ebook  book  reading
paper  interview  cheatsheet  cheat-sheet  learn  guide  notes  slides
```

理由：`topic:ai` 混有大量「資源整理型」倉庫（清單、課程、論文彙整），這些不是可用的 AI 應用，會占掉寶貴的 5 個名額。

- 比對範圍：`full_name`（owner/repo）與 `description`（移除 HTML 標籤後）
- 開頭 `awesome-`／結尾 `-awesome` 亦命中（因關鍵字比對非邊界）
- 純資源型倉庫即使星數極高（如 `free-programming-books` 類）也會被排除

## 演算法

### 欄位一：AI 應用星數 Top 5

1. 執行 3 次 topic 查詢
2. 合併所有 `items`，以 `full_name` 去重
3. 套用排除規則
4. 依 `stargazers_count` 降冪排序
5. 取前 5

排序穩定性：星數相同時以 `full_name` 字典序升冪打破平手，確保每次執行的順序可預期（不隨 API 回應順序浮動）。

### 欄位二：近 30 天爆款 Top 5

1. 執行 1 次近期查詢（`created:>=今天-90天`，一次取回最長窗口資料）
2. 合併去重 ＋ 套用排除規則
3. 於本地以 `created_at` 由短到長試各時間窗：先取 30 天內者、不足 5 則改取 60 天內、仍不足改取 90 天內
4. 在最終採用的時間窗內依 `stargazers_count` 降冪排序，取前 5

**不足 5 個時自動放寬**：實際採用的天數會顯示於 section 標題（例如 `🚀 近 60 天爆款 Top 5`），不隱瞞。

## 快取與條件式請求

### 目標

1. **每天拿到最新資料**（不因省額度而降低更新頻率）
2. **資料沒變時不花額度**（GitHub 對 `304 Not Modified` 不計入 rate limit）

### 流程

```
讀 github_rank_cache.json
  ├─ 無快取 → 4 次無條件請求 → 200 → 寫快取
  └─ 有快取 → 4 次請求帶 If-None-Match: <上次 etag>
        ├─ 304 → 資料未變，沿用快取內 repos（不計額度、不下載）
        └─ 200 → 更新 etag 與 repos → 寫快取
```

### 快取檔結構 `github_rank_cache.json`

```json
{
  "updated_at": "2026-09-25 07:00",
  "queries": {
    "topic_ai":    {"etag": "W/\"abc123\"", "repos": []},
    "topic_llm":   {"etag": "W/\"def456\"", "repos": []},
    "topic_agent": {"etag": "W/\"ghi789\"", "repos": []},
    "recent":      {"etag": "W/\"jkl012\"", "repos": []}
  },
  "ranks": {
    "top": ["owner-a/repo-1", "owner-b/repo-2"],
    "hot": ["owner-c/repo-3", "owner-d/repo-4"]
  }
}
```

- `queries` 內 `repos` 為查詢結果清單（本文件以空陣列示意，實際內容見下方欄位定義）
- 每個 `repos` 元素僅保存呈現所需欄位，縮小檔案：`full_name`、`html_url`、`description`、`language`、`stargazers_count`、`forks_count`、`created_at`
- `ranks` 保存**上一次**呈現的排名順序（`full_name` 清單），用於計算名次升降
- 寫入採「先寫暫存檔再 `os.replace`」，避免執行中斷產生半損毀檔案

### 名次升降計算

由 `ranks` 與本次結果比較：

| 情況 | 顯示 |
|------|------|
| 本次名次比上次小（上升） | `↑N`（N = 上升格數），上升 ≥3 為 `↑↑N` |
| 本次名次比上次大（下降） | `↓N` |
| 首次執行（無 `ranks`）、持平、或上次榜單無此 repo | 不顯示 |

此功能**僅在有更新時重算**：200 回應時用新 `ranks` 與本次結果比較並把新 `ranks` 寫回快取；304 回應時資料未變，直接沿用快取中既有的 `ranks`，不重算（重算結果也必然相同）。

## 頁面呈現

### 結構

頁籤列由 3 個增至 4 個：

```
[AI 新聞] [AI Agent] [健康] [GitHub 熱門]
```

新增分頁內容：

```html
<div id="github" class="panel">
  <section>
    <h2>⭐ AI 應用星數 Top 5 <span class="count">(topic:ai / llm / agent)</span></h2>
    <!-- 5 張卡片 -->
  </section>
  <section>
    <h2>🚀 近 30 天爆款 Top 5 <span class="count">(stars/日數依實際天數標示)</span></h2>
    <!-- 5 張卡片 -->
  </section>
</div>
```

### 卡片內容

```html
<div class="card gh-card">
  <div class="gh-rank">1</div>
  <div class="gh-main">
    <a href="https://github.com/owner/repo" target="_blank" rel="noopener">owner/repo</a>
    <div class="gh-move">↑2</div>
    <div class="summary">一句描述（去除 HTML 標籤，長度上限 100 字）</div>
    <div class="meta">
      <span class="badge">Python</span>
      <span class="badge">★ 45,231</span>
      <span>fork 3,204</span>
      <span>建立於 2026-08-30</span>
    </div>
  </div>
</div>
```

- 星數以千分位顯示（`45,231`）
- 語言 badge 僅在 `language` 存在時顯示
- 描述為空時不渲染該行（不顯示空白）
- 爆款欄位顯示建立日期（便於判斷新舊）；星數欄位不顯示建立日期（老專案日期無參考價值）
- 所有使用者可控字串（repo 名稱、描述）一律 `html.escape`

### 空資料處理

| 情境 | 顯示 |
|------|------|
| 快取無資料且 API 失敗 | `今天抓不到 GitHub 資料，請稍後再試。` |
| 快取無資料且搜尋結果為 0 | `目前查不到符合條件的 AI 應用專案。` |
| 網路失敗但快取有資料 | `⚠ 今天更新失敗，顯示最後一次成功抓取的資料（{updated_at}）` |
| 爆款欄不足 5 個且 90 天內仍不足 | 顯示實際找到的數量（不補齊假資料） |

容錯原則：GitHub 欄位失敗**不影響**其他三個分頁的產生與部署（與康健來源相同的失敗隔離風格）。

### 頁尾與來源說明

- 頂部日期行追加：`｜ GitHub 欄來源：GitHub Search API`
- 頁尾追加：`・　GitHub 欄來源：GitHub Search API`

## 模組介面（`github_rank.py`）

```python
GITHUB_SEARCH_URL = "https://api.github.com/search/repositories"
CACHE_FILE = "github_rank_cache.json"
MIN_STARS = 1000          # 成熟榜單門檻
MIN_STARS_RECENT = 50     # 爆款榜單門檻
TOPICS = ["ai", "llm", "agent"]
FETCH_PER_QUERY = 20
HOT_WINDOWS = [30, 60, 90]   # 爆款時間窗，由短到長
EXCLUDE_KEYWORDS = [...]     # 清單類關鍵字

# 純函式（可單獨測試，不連網）
build_query(topic, min_stars, created_after=None) -> str
build_search_url(query, etag=None) -> tuple[str, dict]     # 回傳 (url, headers)
is_excluded(repo) -> bool
parse_repo(item) -> dict | None
merge_repos(repo_lists) -> list[dict]                       # 去重 + 排除 + 穩定排序
pick_top(repos, n=5) -> list[dict]
pick_hot(repos, now, windows=HOT_WINDOWS) -> tuple[list[dict], int]   # 回傳 (清單, 實際天數)
rank_moves(current, previous) -> dict[str, str]             # full_name -> "↑2"
load_cache(path) -> dict
save_cache(path, data) -> None                              # 原子寫入

# 有網路副作用
search_repos(query, etag=None) -> tuple[list[dict] | None, str | None]
                                                       # 回傳 (repos, etag)；304 回 (None, etag)
fetch_github_rank(now=None) -> dict                          # 主流程，回傳可直接渲染的結構
build_github_html(data) -> str                               # 產出兩個 section 的 HTML
```

`build_github_html` 放在 `github_rank.py` 而非 `fetch_news.py`，理由：同樣的「空資料訊息」測試可獨立於新聞分頁測試，與現有 `build_health_html` 保持相同組織方式。

## `fetch_news.py` 整合

```python
import github_rank   # 頂部 import

def main():
    ...
    print("▸ 抓取 GitHub 熱門專案…")
    gh_data = github_rank.fetch_github_rank()
    ...
    render_html(results, agent_items, generated_at, health, gh_data)
```

- `build_page_html(results, agent_items, generated_at, health, github_data)` 新增第 5 個參數（帶預設值 `None`，既有呼叫端不受影響）
- 頁籤列與 `.panel` 各新增一組，與既有 `switchTab` 機制相容（`switchTab` 無需修改，它是依 `data-tab` 通用處理）
- `run_log.txt` 的統計行納入 GitHub 抓取結果（成功/失敗、兩個欄位各幾筆）

## 錯誤處理

| 情況 | 行為 |
|------|------|
| 單一查詢 HTTP 失敗（5xx／網路錯誤） | 記錄 log，該查詢以「沿用快取」處理；4 個查詢皆失敗且無快取 → 該欄位顯示失敗訊息 |
| HTTP 403（限額用盡） | 同上，並在 log 明確標示 `rate limited` 與恢復時間 |
| HTTP 422（query 語法錯誤） | 視為程式錯誤，記錄原始 query 與回應本文到 log，便於排查 |
| 單一查詢回應格式異常 | 該查詢回傳空清單，不影響其他查詢 |
| 快取檔損毀／JSON 解析失敗 | 記錄 log 並視為無快取，重新全量抓取（不讓壞檔卡住整條流程） |
| 快取寫入失敗（磁碟滿／權限） | 記錄 log，**不中斷流程**；當次仍以新資料產生頁面 |

原則：GitHub 欄位為頁面附加內容，任何失敗都不得使 `fetch_news.py` 整體退出（否則排程任務失敗、整頁不更新）。

## 測試（`test_news.py`）

新增測試類別，純函式皆不連網；`search_repos` 以 `unittest.mock.patch` 注入假回應。

| 測試類別 | 涵蓋內容 |
|----------|----------|
| `TestBuildQuery` | topic 與 `stars:` 門檻組合、`created:` 下限格式、近期查詢三 topic 同時出現 |
| `TestBuildSearchUrl` | URL query string 組法、帶 etag 時 `If-None-Match` header 存在、無 token 時不帶 `Authorization`、有 `GITHUB_TOKEN` 時帶上 |
| `TestIsExcluded` | `awesome-xxx`／描述含 "roadmap"／大小寫混雜／正常專案不誤判 |
| `TestMergeRepos` | 跨查詢去重、排除清單類、星數相同時排序穩定 |
| `TestPickTop` | 超過 5 筆取前 5、少於 5 筆全取、空清單 |
| `TestPickHot` | 30 天內取前 5、不足 5 時回報放寬至 60／90 天、90 天仍不足時回報實際天數與筆數 |
| `TestRankMoves` | 上升／下降／持平／新增專案不顯示／空 `previous` 全不顯示 |
| `TestCacheIO` | 存檔後讀回一致、損毀 JSON 視為空、原子寫入不產生暫存檔殘留 |
| `TestSearchRepos304` | mock 回 304 → 回傳 `(None, etag)` 且不呼叫 `.json()` |
| `TestSearchReposError` | mock 連線例外、403、422 → 回傳 `(None, None)` 不拋例外 |
| `TestFetchGithubRank` | mock 四個查詢成功／部分失敗沿用快取／全失敗無快取三種情境 |
| `TestBuildGithubHtml` | 正常輸出含兩個 section、空資料顯示提示訊息、快取過期警示字串、HTML 逃逸（描述含 `<script>` 被跳脫） |

執行方式（沿用現有慣例）：

```powershell
C:\Users\TW-10\Documents\firebase雲端資料夾\.venv\Scripts\python.exe -m unittest test_news -v
```

## 可調整參數（`github_rank.py` 頂部）

| 參數 | 預設 | 說明 |
|------|------|------|
| `MIN_STARS` | 1000 | 成熟榜單星數門檻 |
| `MIN_STARS_RECENT` | 50 | 爆款榜單星數門檻 |
| `TOPICS` | `["ai", "llm", "agent"]` | AI 篩選 topic |
| `FETCH_PER_QUERY` | 20 | 每個查詢取回的專案數 |
| `HOT_WINDOWS` | `[30, 60, 90]` | 爆款時間窗，由短到長 |
| `TOP_N` | 5 | 兩欄顯示筆數 |
| `CACHE_FILE` | `github_rank_cache.json` | 快取路徑 |

## 影響範圍與風險

| 項目 | 評估 |
|------|------|
| 既有功能 | 不變更。既有函式簽名僅 `build_page_html` 新增可選參數，預設 `None` 時行為與現況相同 |
| 執行時間 | 增加約 2–5 秒（4 次 API 請求） |
| 網路依賴 | 新增對 `api.github.com` 的依賴；失敗時已隔離，不影響其他分頁 |
| 額度 | 免金鑰每日 4 次，遠低於 10 次/分鐘限制 |
| 磁碟 | 新增 `github_rank_cache.json`（估計 100–300 KB） |
| 測試 | 既有 12 個測試類別不受影響；新增測試皆為純函式或 mock |

### 已知的取捨

1. **爆款榜單寧缺勿濫**：`created:` 查詢要求三個 topic 同時存在，可能漏掉只掛 `topic:ai` 的新專案。刻意選擇，以換取榜單品質。
2. **30 天內可能湊不滿 5 個**：以 60/90 天自動放寬補齊，實際天數顯示於標題。
3. **名次升降的語意**：僅比較「與上次成功抓取的榜單」，非與「前一天」。若當日 API 失敗，升降反映的是最後兩次成功抓取的差異。
4. **無法區分累積速度**：如「需求確認」所述，本設計不做星數成長率。
