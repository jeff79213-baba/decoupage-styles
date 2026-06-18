---
name: deploy-workflow
description: 當使用者說「上傳到Firebase」或「上傳到GitHub」時，自動執行完整部署流程（Firebase上傳 + GitHub推送 + 產生網址.txt）
---

## 觸發
使用者指令包含「上傳到 Firebase」或「上傳到 GitHub」時執行。

## 執行步驟

### 1. Firebase 上傳
```powershell
node _tools\upload.js
```

### 2. GitHub 推送
- 如尚未初始化 git：`git init`
- `git add .`、`git commit -m "update"`
- 如無遠端：用 `gh repo create` 建立 repo（名稱由中文資料夾名轉寫為英文）
- `git push -u origin main`

### 3. 判斷專案類型，產出 網址.txt
- 若專案含 index.html 等前端檔案 → 啟用 GitHub Pages，網址為 `https://<user>.github.io/<repo>/`
- 其他類型 → 由 AI 判斷適合的存取網址
- 將網址寫入專案根目錄的 `網址.txt`
