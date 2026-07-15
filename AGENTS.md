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

## 📌 UI 規範：密碼欄位顯示開關
所有 `type="password"` 的輸入欄位，**必須附帶顯示/隱藏密碼的切換按鈕**。

### 標準做法
```html
<div class="pw-wrap" style="position:relative;display:flex;align-items:center">
  <input type="password" id="xxx" style="padding-right:40px">
  <button type="button" onclick="togglePw('xxx',this)"
    style="position:absolute;right:8px;background:none;border:none;cursor:pointer;font-size:16px">🙈</button>
</div>
```
```js
function togglePw(inputId, btn) {
  const inp = document.getElementById(inputId);
  const show = inp.type === "password";
  inp.type = show ? "text" : "password";
  btn.textContent = show ? "👁️" : "🙈";
}
```

### 規則
- 按鈕放在輸入框右側，使用 eye emoji（👁️/🙈），不需花俏設計
- 不需外部套件，純 CSS + JS 即可
- 每個專案第一次建立密碼欄位時自動帶入此段程式碼

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

---

## 🐍 Python 文件處理工具

### 環境位置
主目錄 `.venv`：`C:\Users\TW-10\Documents\firebase雲端資料夾\.venv`

### 在子專案使用
子專案資料夾內沒有自己的 `.venv`，需呼叫主目錄的 Python：

```powershell
# 使用主目錄的 Python 執行腳本
C:\Users\TW-10\Documents\firebase雲端資料夾\.venv\Scripts\python.exe your_script.py

# 或相對路徑（從子專案向上找）
..\..\.venv\Scripts\python.exe your_script.py
```

### 已安裝的核心套件（10/10）
| 套件 | 用途 |
|------|------|
| python-docx | Word 文件讀寫 |
| openpyxl | Excel 讀寫 |
| python-pptx | PowerPoint 生成 |
| pypdf | PDF 合併、拆分 |
| PyMuPDF (fitz) | PDF 抽文字、轉圖片 |
| reportlab | 生成 PDF |
| pillow | 圖片處理 |
| matplotlib | 統計圖表 |
| qrcode | QR Code 生成 |
| markitdown | 文件轉 Markdown（含 pdf,docx,pptx,xlsx） |

### 使用範例
```python
# 在子專案中使用（假設從子專案執行）
import sys
sys.path.insert(0, r"C:\Users\TW-10\Documents\firebase雲端資料夾\.venv\Lib\site-packages")

# 或直接用完整路徑的 python 執行即可
from docx import Document
import fitz  # PyMuPDF
```

---

## 📚 考卷變教材工作流程

### 觸發指令
當使用者說「**把這份考卷變成教材**」或放入新的考卷 PDF 時自動執行。

### 產出規則
- **分類好的內容 → TXT 檔案**（每個類別一份）
- **統整在一起 → HTML 檔案**（互動式學習清單）

### 資料夾結構
```
AI應用規劃師-考卷變教材/
├── 工作流程手冊.txt
├── 學習清單.html
└── {考試名稱}_{科目}/
    ├── {類別一}.txt
    ├── {類別二}.txt
    └── ...
```

### 處理步驟
1. 用 PyMuPDF 讀取 PDF 全部內容（UTF-8 編碼）
2. 逐題分析，依知識領域分類（7~10 大類）
3. 建立新資料夾，命名格式：`{考試名稱}_{科目}`
4. 每個類別產生 TXT：說明 → 考試陷阱 → 考題重點 → 精選考題
5. 產生統整 HTML 學習清單
6. 更新工作流程手冊

### TXT 格式規範
```
═══════════════════════════════
  類別名稱
  考試名稱｜科目名稱
  題號範圍 ｜ 共 N 題
═══════════════════════════════

【說明】...
【考試陷阱】...
【考題重點】...

═══════════════════════════════
精選考題
═══════════════════════════════

【第N題】標題
題目：...
答案：(X)
解析：...
```