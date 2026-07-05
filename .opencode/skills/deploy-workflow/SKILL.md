---
name: deploy-workflow
description: 當使用者說「上傳部署」時，自動執行完整部署流程（GitHub推送 + Firebase Hosting部署 + 產生網址.txt）
---

## 觸發
使用者指令為「**上傳部署**」時執行。

## 第一步：判斷當前專案
根據對話中編輯的檔案路徑，定位到：
```
C:\Users\TW-10\Documents\firebase雲端資料夾\對應專案\
```
若無法判斷，自動選取該目錄下最新修改的子資料夾。

## 第二步：安全檢查（先確認後上傳）
### 確認 .gitignore 有保護機密
- 若專案目錄下無 `.gitignore` → 自動建立，加入以下規則：
  ```
  .env
  *.local
  service-account.json
  opencode-sk-*.json
  node_modules
  ```

### 掃描可疑機密檔案
檢查專案中是否有以下特徵的檔案或內容：
- 檔名含 `key`、`secret`、`password`、`token`、`credential`、`auth`、`.env`（未加入 .gitignore 者）
- 程式碼中有寫死的 `apiKey`、`api_secret`、`password=`、`token=` 等疑似機密值
- 非 `config.js` 等預期設定檔中的疑似機密字串

### ⚠️ 發現可疑 → 暫停
列出所有可疑項目，詢問使用者：
```
🔒 偵測到可能包含機密資訊的檔案/內容：
  1. xxx.js (第15行：可能含 API Key)
  2. xxx.txt (檔名含 "password")
  
請問這些可以上傳到 GitHub 嗎？
```
等待使用者確認後才繼續。

## 第三步：GitHub 處理

### 狀況 A：全新資料夾（無 `.git`）
```powershell
git init
git add .
git commit -m "初始提交：{專案名稱}"
# 中文資料夾名 → 英文 slug（例：鍵盤彈鋼琴 → keyboard-piano）
gh repo create {repo-名稱} --public --source=. --remote=origin --push
```

### 狀況 B：已有 `.git` 但無 remote
```powershell
gh repo create {repo-名稱} --public --source=. --remote=origin --push
```

### 狀況 C：已有 remote
```powershell
git add .
git commit -m "更新：{專案名稱} - {日期}"
git push origin main
```

## 第四步：啟用 GitHub Pages（新 repo 限定）
若為 **狀況 A 或 B**（即新建立的 repo），自動啟用 GitHub Pages：
```powershell
# 建立暫存 JSON 檔
$tmp = [System.IO.Path]::GetTempFileName()
'{"source":{"branch":"main","path":"/"}}' | Set-Content -Encoding ASCII $tmp
gh api repos/jeff79213-baba/{repo名稱}/pages -X POST --input $tmp
Remove-Item $tmp
```

若為 **狀況 C**（既有 repo），跳過此步驟（Pages 已啟用）。

## 第五步：Firebase 處理
檢查專案目錄下是否有 `firebase.json`：
- **有** → 在該目錄執行 `firebase deploy --only hosting`
- **無** → 跳過

## 第六步：建立網址文件
在專案根目錄建立 `網址.txt`，格式如下：
```
--- GitHub ---
https://github.com/jeff79213-baba/{repo名稱}

--- GitHub Pages ---
https://jeff79213-baba.github.io/{repo名稱}/

--- Firebase Hosting ---
https://{firebase-project}.web.app（如有部署）

--- 本地路徑 ---
C:\Users\TW-10\Documents\firebase雲端資料夾\{專案資料夾}
```

## 第七步：回報結果
```
✅ GitHub：{repo名稱} - 推送成功
✅ GitHub Pages：https://jeff79213-baba.github.io/{repo名稱}/ - 已啟用（新 repo）
✅ Firebase：{專案名稱} - 已部署（若適用）
📄 網址文件已建立：/專案路徑/網址.txt
```
