# Firebase 專案管理

這個專案連接了 Firebase Firestore（專案: opencode-sk），可透過以下工具操作：

## 工具腳本（在 _tools/ 目錄下）

### 上傳本地專案到 Firebase
```powershell
node _tools\upload.js             # 上傳當前目錄
node _tools\upload.js 專案資料夾   # 上傳指定資料夾
```
這會將檔案上傳到 Firestore 路徑：`projects/{專案名}/files/{檔案路徑}`

### 刪除 Firebase 資料
```powershell
node _tools\delete.js list                     # 列出所有專案
node _tools\delete.js list 專案名              # 列出該專案檔案
node _tools\delete.js delete 專案名            # 刪除整個專案
node _tools\delete.js delete 專案名/檔案路徑   # 刪除單一檔案
```

### 直接在 Firestore 建立專案
```powershell
node _tools\create-project.js 專案名稱
```

### 查詢 Firebase 資料（給 Telegram Bot 用）
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