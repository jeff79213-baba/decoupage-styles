# 每日 AI 新聞抓取器

每天 07:00 自動抓取 AI 新聞，生成單一 HTML 檔案（每天覆蓋）。

## 檔案說明

| 檔案 | 用途 |
|------|------|
| `fetch_news.py` | 主要腳本：抓 RSS → 翻譯英文 → 生成 index.html |
| `index.html` | 產出的新聞頁面（每天自動覆蓋） |
| `run_log.txt` | 抓取執行紀錄 |
| `deploy_log.txt` | Firebase 部署紀錄 |
| `run_hidden.vbs` | 隱藏式啟動器（排程呼叫它，全程不彈視窗） |
| `網址.txt` | 線上新聞網址（固定，每天自動更新內容） |
| `firebase.json` / `.firebaserc` | Firebase Hosting 設定（獨立 site：daily-ai-news-sk） |

## 線上網址

```
https://daily-ai-news-sk.web.app
```

## 手動執行

```powershell
C:\Users\TW-10\Documents\firebase雲端資料夾\.venv\Scripts\python.exe fetch_news.py
```

（需在 `每日AI新聞` 資料夾內執行，或先 `cd` 進來）

## 新聞來源（皆為 AI 專屬 RSS）

| 來源 | 語言 | 網址 |
|------|------|------|
| iThome（AI 分類） | 中文 | https://www.ithome.com.tw/rss/cat/ai |
| 科技新報（AI 分類） | 中文 | https://technews.tw/category/ai/feed/ |
| TechCrunch AI | 英文（自動翻中文） | https://techcrunch.com/category/artificial-intelligence/feed/ |
| MIT Technology Review | 英文（自動翻中文） | https://www.technologyreview.com/feed/ |

> 註：原本想用的 INSIDE 已停用 RSS（各網址皆 404），故以 iThome 替代。

## 排程任務

- 名稱：`每日AI新聞抓取`
- 觸發：每天 07:00（電腦若關機，開機後自動補跑）
- 執行步驟：排程呼叫 `wscript.exe run_hidden.vbs`，由 VBS 以「視窗完全隱藏」方式依序執行：
  1. `.venv\Scripts\python.exe fetch_news.py`（抓取＋翻譯＋生成 HTML）
  2. `firebase deploy --only hosting --project opencode-sk`（部署到線上網址）
- 完全不會彈出黑視窗、不搶鍵盤焦點，不影響你使用電腦
- 調整時間：開啟「工作排程器」→ 工作排程器程式庫 → 每日AI新聞抓取 → 內容

## 可調整參數（fetch_news.py 頂部）

| 參數 | 預設 | 說明 |
|------|------|------|
| `HOURS_WINDOW` | 30 | 只抓最近 30 小時的新聞 |
| `MAX_PER_FEED` | 6 | 每個來源最多幾則 |
| `FEEDS` | 4 家 | 增減來源直接改這裡 |

## 常見問題

- **翻譯品質有機器感**：目前用免費 Google 翻譯端點，零成本。想要品質更好可改用 OpenAI API（需金鑰，每次成本極低）。
- **某個來源抓不到**：看 `run_log.txt`，或手動執行看錯誤訊息。
- **想加來源**：在 `FEEDS` 加一筆 `{"name": "...", "lang": "zh/en", "url": "...rss網址"}` 即可。
