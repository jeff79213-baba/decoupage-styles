# 專案管理與部署規則

## 📌 自動部署原則
**每次修改程式碼後，自動執行 commit + push 部署**，不再需要等待「上傳部署」指令。

> ⚠️ 執行後需主動回報「已上傳部署完成」讓使用者知道。

## 📌 一鍵「上傳部署」
當我對使用者說「**上傳部署**」時，執行**完整的初始化部署流程**（含新 repo 建立、GitHub Pages 啟用等）：

### 第一步：判斷當前專案
定位到 `C:\Users\TW-10\Documents\firebase雲端資料夾\對應專案\`
（根據對話中編輯的檔案路徑自動判斷）

### 第二步：安全檢查
- 自動建立 `.gitignore`（`.env`、金鑰檔、`node_modules`）
- 掃描檔名與程式碼中是否有寫死的機密資訊（key、secret、password、token 等）
- ⚠️ 發現可疑 → 暫停並詢問您是否可上傳

### 第三步：GitHub 推送（三種狀況）
| 狀況 | 動作 |
|------|------|
| 無 `.git`（全新） | `git init` → 中文名轉英文 slug → `gh repo create --public` → push |
| 有 `.git` 無 remote | `gh repo create --public` → push |
| 已有 remote | `git add / commit / push` |

### 第四步：啟用 GitHub Pages（新 repo 限定）
- 若為第三狀況之「全新 repo」，自動啟用 GitHub Pages：
  ```
  gh api repos/jeff79213-baba/{repo}/pages -X POST --input <json>
  ```
- 若為既有 repo 已推送，跳過此步驟

### 第五步：Firebase Hosting 部署
- 檢查目錄下是否有 `firebase.json`
- 有 → `firebase deploy --only hosting`
- 無 → 跳過

### 第六步：建立網址文件
在專案根目錄建立 `網址.txt`，包含 GitHub URL ＋ GitHub Pages URL ＋ Firebase URL（如有）

---

## 舊專案（共用 repo）維持現狀
- 蝶谷巴特風格小幫手、鍵盤彈鋼琴 → 仍共用 `decoupage-styles` repo
- 芭拉咘咘麵包車V2 → 獨立 `balabubu-bakery` repo（已正確）
- 未來新專案一律獨立 repo

---

## 工具腳本（在 _tools/ 目錄下）

### 上傳本地專案到 Firebase
```powershell
node _tools\upload.js             # 上傳當前目錄
node _tools\upload.js 專案資料夾   # 上傳指定資料夾
```

### 刪除 Firebase 資料
```powershell
node _tools\delete.js list                     # 列出所有專案
node _tools\delete.js list 專案名              # 列出該專案檔案
node _tools\delete.js delete 專案名            # 刪除整個專案
node _tools\delete.js delete 專案名/檔案路徑   # 刪除單一檔案
```

### 查詢 Firebase 資料
```powershell
node _tools\query.js list              # 列出所有專案
node _tools\query.js files 專案名       # 列出專案檔案
node _tools\query.js view 專案名/路徑   # 顯示檔案內容
```

### 管理 OpenCode 對話（session）
```powershell
node _tools\sessions.js list           # 列出所有對話
node _tools\sessions.js delete <id>    # 刪除指定對話
```

## Firebase 結構
```
projects (collection)
  └── {專案名稱} (document)
        ├── createdAt: Date
        ├── updatedAt: Date
        ├── fileCount: number
        └── files (subcollection)
              └── {檔案路徑} (document)
                    ├── content: string
                    ├── updatedAt: Date
                    └── size: number
```

## Firebase 金鑰
服務帳戶金鑰在 firebase雲端資料夾 根目錄下的 `opencode-sk-*.json` 檔案。