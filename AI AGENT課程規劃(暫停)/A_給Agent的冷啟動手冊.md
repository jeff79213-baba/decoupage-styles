# A_給Agent的冷啟動手冊

> 這份手冊是給「新安裝好 opencode 的 AI Agent」執行的。
> 你的任務：依序執行以下每一步。每步都有驗證指令，**驗證通過才能往下走**。
> 遇到標示「⏸ 授權點」的步驟，停下來等使用者操作完成再繼續。
> 對人類使用者來說，每步的「🗣️ 白話說明」就是課程教材。

## 執行總覽
本手冊共 10 步，從檢查環境到完整驗證，全程照做即可復現開發機環境。

---

## 第 1 步：檢查環境（作業系統、網路、winget）

🗣️ 白話說明：蓋房子之前要先看工地狀況。這一步是「地基的檢查」——確認你的電腦是哪一種作業系統、能不能上網、有沒有內建的「應用程式商店」（winget）。三樣都正常，後面才有辦法繼續裝東西。

🖥️ 執行：

```powershell
# 1. 檢查作業系統版本（應該要是 Windows 10 或 11）
[System.Environment]::OSVersion.VersionString

# 2. 檢查網路連線（能連到外網即可）
Test-NetConnection -ComputerName www.google.com -Port 443

# 3. 檢查 winget（微軟內建的應用程式商店）有沒有安裝
winget --version
```

✅ 預期結果：
- 第 1 項：印出 `Microsoft Windows NT 10.0.xxxxx` 之類的版本字串（代表 Win10/11）
- 第 2 項：`TcpTestSucceeded : True`
- 第 3 項：印出 `v1.x` 開頭的版本號（例如 `v1.9.x`）

🔍 驗證：三條指令的輸出都符合上面預期，才算過關。

⏸ 授權點：無（全部都是查詢指令，不會動到系統設定）

⚠️ 若失敗：
- 網路不通 → 先解決網路問題（連 Wi-Fi、接網路線、檢查防火牆）再繼續
- 沒有 winget → 到 Microsoft Store 搜尋安裝「App Installer」，裝完重開終端機再試；若仍不行，改用各步驟提供的「官方網站手動安裝」替代方案

💡 為什麼：後面所有工具都要靠「網路下載」＋「winget 安裝」，這兩樣地基不穩，後面每一步都會跟著卡住，所以第一件事就是先確認工地狀況。

---

## 第 2 步：安裝 Node.js

🗣️ 白話說明：Node.js 是「電腦裡的一座小型工廠」，AI 工具要站著它上面才能跑。這一步之後，你才會有 npm（應用程式商店）可以下載其他工具。

🖥️ 執行：

```powershell
winget install OpenJS.NodeJS.LTS
```

✅ 預期結果：顯示安裝完成（`Successfully installed` 之類的訊息）

🔍 驗證：

```powershell
node --version    # 應顯示 v26.1.0
npm --version     # 應顯示 11.13.0
```

⏸ 授權點：無（winget 自動安裝；若無 winget，改手動下載 https://nodejs.org 的 LTS 安裝檔）

⚠️ 若失敗：到 https://nodejs.org 下載 LTS 安裝檔手動安裝，裝完重開終端機再驗證

💡 為什麼：沒有 Node.js 就沒有 npm，沒有 npm 就裝不了 opencode——這是整個 AI 環境的地基。

---

## 第 3 步：安裝 Git 並設定身份

🗣️ 白話說明：Git 是「時光機 ＋ 檔案保險箱」。你每做一次修改，它就幫你存一個「備份點」，做壞了隨時可以倒回舊版本。這一步也順便告訴 Git「你是誰」，以後每次存檔都會蓋上你的名字。

🖥️ 執行：

```powershell
# 安裝 Git
winget install Git.Git

# 設定你的身份（Git 存檔時要用的名字與信箱）
git config --global user.name "你的名字"
git config --global user.email "你的Email"
```

✅ 預期結果：Git 安裝完成；身份設定指令沒有回報錯誤

🔍 驗證：

```powershell
git --version                       # 應顯示 git version 2.54.0
git config --global user.name       # 應顯示你設定的名字
git config --global user.email      # 應顯示你設定的信箱
```

⏸ 授權點：無

⚠️ 若失敗：到 https://git-scm.com/downloads 下載安裝檔手動安裝，裝完重開終端機再驗證

💡 為什麼：沒有 Git，改壞的檔案就回不去，專案沒有後悔藥；而且 GitHub CLI（gh）推檔案上網時需要 Git 在背後做版本控制——Git 是「鋼骨」，後面的 gh 才站得上去。

---

## 第 4 步：安裝 GitHub CLI（gh）並登入授權

🗣️ 白話說明：GitHub 是「放專案的雲端倉庫」，而 gh 是它的「遙控器」——你不用開網頁，用指令就能把專案傳上網、建立專案、管理更新。這一步是「把成品送出去的大門」的第一道鎖。

🖥️ 執行：

```powershell
# 安裝 GitHub CLI
winget install GitHub.cli
```

✅ 預期結果：gh 安裝完成

🔍 驗證：

```powershell
gh --version   # 應顯示 gh version 2.92.0
```

⏸ 授權點：**有** —— 執行 `gh auth login` 後，會跳出瀏覽器請使用者登入 GitHub 帳號，**必須停下來等使用者完成網頁登入**，確認 `gh auth status` 顯示已登入才能繼續：

```powershell
gh auth login    # 依提示選擇 GitHub.com → HTTPS → Login with a web browser
gh auth status   # 應顯示 Logged in to github.com as 你的帳號
```

⚠️ 若失敗：到 https://cli.github.com 下載安裝檔手動安裝；登入失敗通常是瀏覽器授權沒完成，重新執行 `gh auth login` 即可

💡 為什麼：沒有 gh，每次上傳都要手動開網頁操作，而「上傳部署」是整個課程的畢業標準；gh 需要有「鋼骨」（Git）先裝好、也有使用者授權，才能真正把專案推上 GitHub。

---

## 第 5 步：全域安裝 opencode

🗣️ 白話說明：opencode 是「AI 助理本體」——你打字它做事，是整個課程的主角。前面裝的 Node 跟 npm 都是為了它而存在，這一步才真正把「員工」請進門。

🖥️ 執行：

```powershell
npm install -g opencode-ai
```

✅ 預期結果：顯示 `added 1 package` 或 `added N packages` 的安裝完成訊息

🔍 驗證：

```powershell
opencode --version   # 應顯示 1.16.2
```

⏸ 授權點：無

⚠️ 若失敗：先確認 Node.js 已裝好（回到第 2 步）；npm 快取異常時可加 `--force` 重裝，或在 https://opencode.ai 查最新安裝方式

💡 為什麼：沒有 opencode，整個課程就沒有主角；前面辛苦裝好的 Node、npm 也派不上用場。它是站在「小型工廠」（Node.js）之上才跑得起來的。

---

## 第 6 步：設定 opencode 的 AI 服務提供者（API 金鑰）

🗣️ 白話說明：opencode 是「AI 助理」，但它的「大腦」是雲端上的 AI 服務。API 金鑰就是你向那個服務買到的「識別證」——證明你是付費用戶，大腦才願意回答你。沒有這張識別證，AI 助理只會發呆。

🖥️ 執行：

```powershell
# 登入並設定模型提供者（依提示選擇提供者，例如 openrouter / nvidia，再貼上 API 金鑰）
opencode auth login
```

設定完成後，在 opencode 的設定檔 `opencode.json` 中指定要使用的模型（例如）：

```json
{
  "$schema": "https://opencode.ai/config.json",
  "model": "你選擇的提供者/模型名稱"
}
```

✅ 預期結果：顯示金鑰已登入、提供者已設定成功

🔍 驗證：執行 `opencode` 啟動，送出一句測試訊息（例如「你好」），AI 有正常回應代表金鑰有效、設定正確。

⏸ 授權點：**有** —— API 金鑰是私密資料，**必須停下來，請使用者自己到提供者網站申請並貼上**。Agent 不可自行搜尋、猜測或代辦取得金鑰。

⚠️ 若失敗：檢查金鑰是否貼錯（前後有沒有多餘空白）、提供者名稱是否拼錯、金鑰是否已到期或額度用完；依提供者的後台重新產生一組新金鑰再試

💡 為什麼：沒有金鑰，opencode 這個「助理」就沒有大腦，送出任何訊息都不會有回應——整個課程的第一個對話就開不了。

---

## 第 7 步：安裝 Firebase CLI 並登入授權

🗣️ 白話說明：Firebase CLI 是「上架機器的工具」——把做好的網頁搬到網路上，讓全世界都看得到。它是「把成品送出去的大門」的第二道鎖（第一道是 GitHub）。

🖥️ 執行：

```powershell
# 安裝 Firebase CLI
npm install -g firebase-tools
```

✅ 預期結果：顯示 `added 1 package` 或 `added N packages` 的安裝完成訊息

🔍 驗證：

```powershell
firebase --version   # 應顯示 15.20.0
```

⏸ 授權點：**有** —— 執行 `firebase login` 後，會跳出瀏覽器請使用者登入 Google 帳號，**必須停下來等使用者完成網頁登入**，確認登入成功才能繼續：

```powershell
firebase login       # 會自動開啟瀏覽器，登入後回到終端機顯示成功
```

⚠️ 若失敗：確認 Node.js 與 npm 正常（第 2 步）；登入失敗通常也是瀏覽器授權沒完成，重新執行 `firebase login` 即可

💡 為什麼：沒有 Firebase CLI，做好的網頁只能在自己電腦上看，無法公開給全世界。它由 npm 安裝，依賴 Node.js，所以順序必須排在 Node.js 之後。

---

## 第 8 步：安裝 Python 並建立 .venv 虛擬環境

🗣️ 白話說明：Python 是「第二座工廠」，專門處理 Word／Excel／PDF 這類文件。而 .venv 是「隔離的作業間」——在獨立空間裡放一整套文件處理工具，各專案互不打架。它是與 Node.js 平行的一條獨立生產線。

🖥️ 執行：

```powershell
# 1. 安裝 Python
winget install Python.Python.3.12

# 2. 在專案根目錄建立虛擬環境（例如 C:\Users\TW-10\Documents\firebase雲端資料夾）
python -m venv .venv

# 3. 用虛擬環境的 pip 安裝 10 個文件處理核心套件
.venv\Scripts\python.exe -m pip install python-docx openpyxl python-pptx pypdf PyMuPDF reportlab pillow matplotlib qrcode markitdown
```

✅ 預期結果：Python 安裝完成；`.venv` 資料夾建立成功；10 個套件全部安裝完成（`Successfully installed ...`）

🔍 驗證：

```powershell
python --version   # 應顯示 Python 3.12.10
```

```powershell
# 確認 10 個核心套件都已進入虛擬環境（全部印出 OK 即通過）
.venv\Scripts\python.exe -c "import docx, openpyxl, pptx, pypdf, fitz, reportlab, PIL, matplotlib, qrcode, markitdown; print('10 個套件全部 OK')"
```

⏸ 授權點：無

⚠️ 若失敗：`python` 指令找不到時，到 https://python.org 下載 3.12 安裝檔手動安裝，記得勾選「Add Python to PATH」；套件安裝失敗通常是網路問題，重跑一次 pip install 即可

💡 為什麼：沒有 Python，文件處理的工作（例如把考卷變成教材、合併 PDF）就完全做不了；沒有 .venv，不同專案的套件版本會互相打架。這條獨立生產線與 Node.js 互不衝突，所以順序不受前面影響。

---

## 第 9 步：安裝 superpowers skills ＋ 複製個人化 skills 與 AGENTS.md

🗣️ 白話說明：superpowers 是「AI 的職場 SOP 手冊」——讓 AI 知道怎麼有紀律地陪你做專案；hallmark 是「AI 的設計總監」（要設計感時載入設計規範）；deploy-workflow 是「AI 的上傳 SOP」（喊『上傳部署』就自動跑完整流程）。AGENTS.md 是「這個專案的作業守則」。這一步是讓 AI 從「工具人」升級成「專業員工」。

🖥️ 執行：

```powershell
# 1. 安裝 superpowers：在 opencode 設定檔 opencode.json 的 plugin 加上這一行
#    "plugin": ["superpowers@git+https://github.com/obra/superpowers.git"]
#    存檔後重啟 opencode，它會自動把套件下載到套件目錄
#    （也可手動執行 git clone https://github.com/obra/superpowers.git 到 opencode 的套件目錄）

# 2. 建立個人化 skills 資料夾，並複製兩個 skill：
#    把 hallmark、deploy-workflow 兩個資料夾複製到專案的 .opencode\skills\ 底下

# 3. 複製 AGENTS.md（自動部署、測試策略、安全規範等專案規則）到專案根目錄
```

✅ 預期結果：
- opencode 重啟後自動載入 superpowers
- `.opencode\skills\hallmark\` 與 `.opencode\skills\deploy-workflow\` 資料夾存在
- 專案根目錄有 `AGENTS.md`

🔍 驗證：

```powershell
# 1. 確認 superpowers 套件已下載，且內含 14 個 skills
Get-ChildItem "套件目錄\node_modules\superpowers\skills" -Directory | Measure-Object   # 應為 14

# 2. 確認個人化 skills 存在
Test-Path ".opencode\skills\hallmark\SKILL.md"           # 應為 True
Test-Path ".opencode\skills\deploy-workflow\SKILL.md"    # 應為 True

# 3. 確認 AGENTS.md 存在
Test-Path "AGENTS.md"                                    # 應為 True
```

⏸ 授權點：無

⚠️ 若失敗：git clone 失敗通常是網路或 Git 未裝好（回到第 3 步）；skill 沒被載入時，重啟 opencode，並檢查資料夾名稱、SKILL.md 的檔案位置是否正確

💡 為什麼：沒有 superpowers，AI 面對任務不會自動走最佳流程，做出來的東西品質不穩定；沒有 hallmark、deploy-workflow，網頁容易一股「AI 味」、部署時每次都要手動打一長串指令。這些「SOP 手冊」是讓 AI 有紀律、品質穩定的關鍵。

---

## 第 10 步：全環境驗證清單

🗣️ 白話說明：全部裝完之後，最後做一次「大盤點」——像畢業考一樣，把每一樣工具都拿出來檢查一遍，確認都在、版本都對。全部通過，代表這台電腦已經完整復現開發機環境，課程可以正式開始。

🖥️ 執行：依下表逐項執行驗證指令，每一項都必須符合「預期版本」。

| # | 工具 | 預期版本 / 狀態 | 驗證指令 | 白話檢查重點 |
|---|------|----------------|----------|------------|
| 1 | Node.js | v26.1.0 | `node --version` | 小型工廠開機正常 |
| 2 | npm | 11.13.0 | `npm --version` | 應用程式商店可用 |
| 3 | opencode | 1.16.2 | `opencode --version` | AI 助理本體在線 |
| 4 | Git | 2.54.0 | `git --version` | 時光機 / 保險箱正常 |
| 5 | GitHub CLI (gh) | 2.92.0 | `gh --version` | GitHub 遙控器在線 |
| 6 | Firebase CLI | 15.20.0 | `firebase --version` | 上架工具在線 |
| 7 | Python | 3.12.10 | `python --version` | 第二座工廠開機正常 |
| 8 | .venv | 內含 10 個核心套件 | `Get-ChildItem ".venv\Lib\site-packages" -Directory \| Where-Object Name -in @("docx","openpyxl","pptx","pypdf","fitz","reportlab","PIL","matplotlib","qrcode","markitdown")` | 隔離作業間內 10 件工具齊全 |
| 9 | superpowers skills | 14 個 | 檢查 superpowers 套件目錄的 skills 數量 | 職場 SOP 手冊齊全 |
| 10 | hallmark（自訂 skill） | 自訂 | `Test-Path ".opencode\skills\hallmark\SKILL.md"` | 設計總監在場 |
| 11 | deploy-workflow（自訂 skill） | 自訂 | `Test-Path ".opencode\skills\deploy-workflow\SKILL.md"` | 上傳 SOP 在場 |
| 12 | customize-opencode（內建 skill） | 內建（opencode 自帶，無需安裝） | 修改 opencode.json 或 `.opencode\` 設定後，重啟 opencode 觀察設定是否生效 | AI 的自我設定說明書內建 |
| 13 | npm 其他全域套件（備用工具箱） | vercel、qrcode、@grinev/opencode-telegram-bot | `npm ls -g --depth=0` | 備用工具箱在場 |

> 備用工具箱說明：vercel（備援部署）、qrcode（產生 QR Code）、opencode-telegram-bot（Telegram 通知）是額外加分的工具，不影響主流程。若第 13 項檢查發現缺少，任何時候補裝即可：

```powershell
npm install -g vercel qrcode @grinev/opencode-telegram-bot
```

✅ 預期結果：上表 13 項全部符合預期版本／狀態

🔍 驗證：逐項執行並比對，**任何一項不符合就回到對應步驟重做**（例如第 1 項不對 → 回第 2 步）

⏸ 授權點：無

⚠️ 若失敗：找出是哪一項不合格，回到該工具對應的步驟卡，依「⚠️ 若失敗」的替代方案處理後，再回到這一步重驗

💡 為什麼：這是整個安裝流程的「畢業考」。全部過關，才代表新電腦與開發機環境一致，之後課程教材、上傳部署流程才能照著走而不出錯。

---

## 裝完之後：AI 的行為模式

superpowers 裝好後，AI 會具備「有紀律地陪你做專案」的行為。從你提出一個想法，到成品上架網路，完整流程是：

```
提出專案 → brainstorming 提問 → 寫設計報告 → 寫實作計劃 → 執行 → 測試 → 上傳部署
```

| 階段 | 白話說明 |
|------|----------|
| 提出專案 | 你告訴 AI「我想做一個 XX」 |
| brainstorming 提問 | AI 像開會確認需求一樣，反覆問你「要做給誰？要什麼功能？長什麼樣子？」，確保雙方想的是同一件事 |
| 寫設計報告 | AI 把你回答的內容整理成一份「設計文件」，白紙黑字寫下要做什麼 |
| 寫實作計劃 | AI 把設計拆成一條條「可執行的小任務」，排好先後順序 |
| 執行 | AI 照著計劃一步一步寫程式、建檔案 |
| 測試 | 每完成一部份，AI 就跑測試確認沒做壞，通過才繼續下一步 |
| 上傳部署 | 全部完成後，喊「上傳部署」，AI 自動把專案送上 GitHub 與 Firebase，產出一個可以公開分享的網址 |

**這就是「AI 是你的員工」的完整合作方式**：AI 不會不問就亂做，也不會做完就交差，而是像專業員工一樣——先開會確認需求、再寫計劃、按表施工、驗收測試、最後交付成品。這段流程也是課程第 3 章（AI 怎麼跟我合作做一個專案）與第 5 章（認識 Skill）的基礎。