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

## 📌 測試策略（Test Pyramid）

### 分層原則
| 層級 | 工具 | 適用場景 | 強制 |
|------|------|----------|------|
| 單元測試 | Vitest / Jest | 純函式邏輯：權限判斷、導向目標計算、表單驗證規則 | ✅ |
| 元件測試 | Testing Library | 按鈕隱藏、條件渲染、表單欄位狀態、錯誤提示顯示 | ✅ |
| E2E 測試 | Playwright | 跨頁面完整使用者旅程、多角色權限流程、金流、敏感資料操作 | ⚡ 高風險限定 |

### 啟動 E2E 的判斷原則
**只有涉及以下任一條件才強制寫 E2E，否則用單元/元件測試即可：**
- **跨角色權限流程**：管理員 vs 一般使用者操作同一功能（需真實登入切換）
- **金流相關**：結帳、退款、訂單狀態流轉
- **敏感資料操作**：刪除帳號、匯出個資
- **跨頁面導向鏈**：未登入 → 點功能 → 導登入頁 → 登入後導回原頁

### 批次原則
開發階段先累積功能，一次寫完對應測試，不逐 commit 補。

### 部署前檢查
```powershell
npx playwright test          # 跑全部 E2E
npx vitest run               # 跑單元 + 元件測試
```

### 開發中使用篩選
```powershell
npx playwright test --grep "checkout|admin-role"
```

### Playwright 初始化腳本
```powershell
npm init playwright@latest -- --yes --browser chromium
```

### ⚠️ 自動提醒
當我判斷某個實作功能**符合上述 E2E 條件（跨角色權限、金流、敏感資料、跨頁導向鏈）**，我會主動提醒你：「這個建議補 E2E」，徵得你同意後才寫，不自行決定。

---

## 📌 UI 規範：密碼欄位顯示開關
所有 `type="password"` 的輸入欄位，**必須附帶顯示/隱藏密碼的切換按鈕**。

### 標準做法
```html
<div class="pw-wrap" style="position:relative;display:flex;align-items:center">
  <input type="password" id="xxx" style="padding-right:40px">
  <button type="button" class="pw-toggle" onclick="togglePw('xxx',this)">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#666" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
  </button>
</div>
```
```js
function togglePw(inputId, btn) {
  const inp = document.getElementById(inputId);
  const show = inp.type === "password";
  inp.type = show ? "text" : "password";
  btn.innerHTML = show
    ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#666" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>'
    : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#666" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
}
```

### 規則
- 按鈕放在輸入框右側，使用 SVG 黑色眼睛圖示（開著=顯示，閉著+斜線=隱藏）
- 不需外部套件，純 CSS + JS 即可
- 每個專案第一次建立密碼欄位時自動帶入此段程式碼

---

## 📋 通用安全規範（所有專案通用）

### Firebase Firestore Security Rules
- 上線前 rules **不可為 `if true`**
- 最低標準：`allow read, write: if request.auth != null;`
- 建議分離 read / write 條件（例如：public read → authenticated write）
- 同一 Firebase project 的 rules 只有一份，多專案共用 project 時要注意不要互相覆蓋

### 金鑰與 API Key 管理
- **Firebase API key（`AIza...`）** 出現在前端是正常的，真正的保護來自 Security Rules
- **service account 金鑰（`*-adminsdk-*.json`）** 嚴禁進入前端 bundle，僅限後端/工具腳本使用
- **Supabase `service_role` key** 等同管理員權限，只能放後端環境變數，不可出現在前端
- **Supabase `anon` key** 可出現在前端，但 RLS 才是真正的保護

### 後端 API / Cloud Functions 身份驗證
- `onCall` → 使用 `context.auth` 檢查
- `onRequest`（Express） → 使用 `req.headers.authorization` + `admin.auth().verifyIdToken()` 檢查
- 每個受保護端點都必須驗證，不可只靠前端隱藏

### 資料結構與敏感欄位
- 密碼**禁止**存在 Firestore 明文，應使用 Firebase Authentication 或後端 bcrypt 雜湊
- 員工薪資、個資等敏感資料，不應整包拉到前端再篩選（應在後端過濾）
- 前端 Firestore query 只取當下需要的欄位

### Supabase 專用
- 新建 table 後**必須手動開啟 RLS**
- RLS policy 不可用 `USING (true)` 作為正式規則
- 撰寫 policy 後先用匿名 session 測試確認阻擋正確

### 上線前檢查清單
- [ ] 用匿名/未登入身份測試能讀到什麼
- [ ] Firestore Rules 不是 `if true`
- [ ] Cloud Functions 每條路由都有 auth 檢查
- [ ] 前端沒有誤用 `service_role` key
- [ ] 密碼沒存在 Firestore 明文

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

### ⚠️ Firestore 集合命名規則（重要）
所有 Firestore 頂層集合名稱**必須加上專案前綴**，避免與其他專案衝突。

| 前綴 | 專案 | 集合名稱 |
|------|------|----------|
| `mpc-` | 菜單拍照計算機 | `mpc-shortlinks`, `mpc-store-codes` |
| `gps_` | 中區建材行GPS打卡上班 | `gps_中區建材行` |
| `inv_` | 庫存管理 | `inv_items`, `inv_settings` |
| `projects` | 工具腳本專用 | `projects`（保留給 _tools） |

**規則：**
1. 新專案若需自訂 Firestore 集合，取 2~5 碼專案縮寫作為前綴
2. 前綴確認表中無重複才可使用
3. 子集合（subcollection）不受此限，因為子集合隸屬於特定 document 下
4. `events`、`stock`、`shops` 等舊集合為歷史遺留，新專案禁止沿用

### ⚠️ localStorage 命名規則（重要）
所有 `localStorage` 的 key 也**必須加上專案前綴**，避免同一瀏覽器不同專案互相干擾。

| 前綴 | 專案 | 範例 key |
|------|------|----------|
| `mpc-` | 菜單拍照計算機 | `mpc-calculatorConfig` |
| `gps_` | 中區建材行GPS打卡上班 | `gps_settings` |

**規則：**
1. 前綴與 Firestore 集合命名前綴一致
2. 若僅前端儲存（無後端），仍需加前綴
3. 全域工具（如 `_tools/`）使用不帶前綴的 key 可豁免

## Firebase 金鑰
服務帳戶金鑰在 firebase雲端資料夾 根目錄下的 `opencode-sk-*.json` 檔案。

## ⚠️ Firebase Hosting Site 命名規則（重要）
所有專案**必須使用獨立的 Hosting Site**，禁止多個專案共用同一個 site。

### 現有專案對照表

| 專案資料夾 | Hosting Site | URL |
|---|---|---|
| 庫存管理 | inventory-sk | https://inventory-sk.web.app |
| 後台帳號管理 | backend-sk | https://backend-sk.web.app |
| 中區建材行GPS打卡上班 | gps-sk | https://gps-sk.web.app |
| reaction-test | reaction-test-sk | https://reaction-test-sk.web.app |
| 早餐點餐機 | （獨立 project: breakfast-sk） | https://breakfast-sk.web.app |

### 規則
1. 新專案的 `firebase.json` **必須包含 `"site": "xxx-sk"`**，不可省略
2. Hosting Site 名稱格式：`{英文縮寫}-sk`
3. 不得重複使用已有的 site 名稱
4. 建立新 site 前先執行 `firebase hosting:sites:list --project opencode-sk` 確認無衝突
5. **絕對禁止**在 `.firebaserc` 中只設定 `"default"` 而不在 `firebase.json` 指定 `site`

### 新專案部署流程（簡化版）
1. 確認 site 名稱無重複
2. 建立 site：`firebase hosting:sites:create {name}-sk --project opencode-sk`
3. 在 `firebase.json` 加入 `"site": "{name}-sk"`
4. 在 `.firebaserc` 的 `targets` 加入對應 site
5. 執行 `firebase deploy --only hosting`

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

---

## 🎨 Hallmark 設計技能（按需使用）

### 觸發關鍵字
當使用者說出以下關鍵字時，**讀取並執行** `.opencode/skills/hallmark/SKILL.md`：
- **「需要設計感」**
- **「不要 AI 味」**
- **「用 hallmark」**
- **「幫我設計 landing page」**
- **「audit」**（審計現有頁面）
- **「redesign」**（重新設計）
- **「study」**（從截圖/URL 提取設計 DNA）

### 檔案位置
```
.opencode/skills/hallmark/
├── SKILL.md                    # 主規則文件（必須讀取）
└── references/
    ├── anti-patterns.md        # 57 個反 AI 模式清單
    ├── typography.md            # 字型規範
    ├── color.md                 # 色彩規範（OKLCH）
    ├── layout-and-space.md      # 版面與間距
    ├── motion.md                # 動畫規範
    ├── copy.md                  # 文案規範
    ├── slop-test.md             # 58 道設計檢查閘門
    └── macrostructures.md       # 21 種頁面結構索引
```

### 使用方式
1. 說「需要設計感」或「不要 AI 味」→ 自動載入 SKILL.md 並執行設計流程
2. 說「hallmark audit index.html」→ 僅載入 anti-patterns.md 進行審計
3. 說「hallmark study 截圖」→ 載入 SKILL.md 的 study 流程

### 注意事項
- **不在一般對話中自動載入**，只在明確要求時才讀取
- 每次使用大約消耗 8,000–15,000 token（input + output）
- 用完後不需額外動作，下次對話不會自動載入