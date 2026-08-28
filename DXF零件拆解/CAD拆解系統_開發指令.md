# 專案指令：DXF 圖檔零件拆解分析系統

## 專案目標
建立一個網頁應用程式，讓使用者上傳 DXF 格式的工程圖檔，系統自動拆解出圖面上的
各個零件（例如多支鐵管），列出每個零件的**尺寸、厚度、位置**，並產生可下載的
標註圖與零件清單表格，供焊接廠商施工使用。

**核心原則：所有尺寸數據必須來自 DXF 檔案內的原始向量資料（標註實體），
不可由 AI 用視覺判讀或臆測方式產生數字。AI 僅負責零件分組邏輯與生成說明文字。**

---

## 技術架構

```
[前端 UI]  --上傳DXF-->  [後端 API]
                            │
                    ┌───────┴────────┐
                    │  ezdxf 解析層   │  ← 抓取所有客觀數據
                    └───────┬────────┘
                            │ 結構化 JSON
                    ┌───────┴────────┐
                    │  Gemini API 層  │  ← 只做分組/生成說明
                    └───────┬────────┘
                            │
[前端 UI]  <--下載結果--   [輸出：標註圖 + 表格 + 問題清單]
```

### 建議技術棧
- 後端：Python + FastAPI（或 Flask）
- DXF 解析：`ezdxf`（pip install ezdxf）
- 圖面轉圖片：`ezdxf` 內建的 matplotlib 匯出功能
- 前端：React 或簡單的 HTML/JS 皆可，需求是上傳/下載/顯示表格
- AI 分析：Google Gemini API（需使用者自行提供 API Key，存在 .env，不可寫死進程式碼）

---

## 後端開發規格

### Step 1：DXF 解析模組（`dxf_parser.py`）
使用 ezdxf 讀取上傳的 DXF 檔案，需要抓取以下資料並整理成 JSON：

1. **所有 DIMENSION（標註）實體**
   - 標註數值（長度、角度等）
   - 標註所在的圖層（layer）
   - 標註的座標位置（用於後續定位到圖域）
   - 標註關聯的幾何物件（如果能透過座標比對推得）

2. **所有幾何實體**（LINE、LWPOLYLINE、CIRCLE、ARC 等）
   - 座標、圖層、線型

3. **所有 TEXT / MTEXT 文字物件**
   - 文字內容（可能包含件號、材質、備註）
   - 所在座標與圖層

4. **圖框/座標範圍**
   - 讀取整張圖的座標邊界（用於後續建立圖域網格）
   - 檢查圖面是否已存在圖域標示（若圖層或文字中有網格相關標記則沿用，
     否則交由後續步驟新增）

5. **匯出圖面預覽圖**
   - 用 ezdxf 的 `ezdxf.addons.drawing` 搭配 matplotlib，將整張圖匯出成 PNG，
     供人工比對與後續在圖上疊加標註框

輸出格式範例：
```json
{
  "bounding_box": {"xmin": 0, "ymin": 0, "xmax": 5000, "ymax": 3000},
  "dimensions": [
    {"value": 1200, "unit": "mm", "position": [120, 340], "layer": "DIM"}
  ],
  "entities": [
    {"type": "LWPOLYLINE", "layer": "PART", "points": [[0,0],[100,0],[100,50]]}
  ],
  "texts": [
    {"content": "P-01", "position": [50, 60], "layer": "TEXT"}
  ],
  "preview_image_path": "output/preview.png"
}
```

### Step 2：圖域網格模組（`grid_builder.py`）
- 檢查 Step 1 輸出的 bounding_box。
- 若圖面本身沒有網格標記：依 bounding_box 等分為 N 欄（數字 1,2,3...）
  × M 列（字母 A,B,C...），欄列數量先設可調整參數（預設如 8×6），
  在預覽圖上疊加網格線與座標標籤。
- 提供函式：輸入任一座標點，回傳其所在的圖域座標（如 "C-4"）。
- 這一步完全是幾何計算，不使用 AI，確保網格定位準確。

### Step 3：Gemini API 分析模組（`ai_analyzer.py`）
將 Step 1、Step 2 產生的結構化 JSON（不是圖片本身，是數據）傳給 Gemini API，
搭配下方【AI 分析 Prompt】，請 AI 只做「零件分組」與「生成說明」，
**嚴禁**在此步驟修改或生成任何尺寸數字，所有數字必須直接引用 Step 1 抓到的原始值。

### Step 4：輸出模組（`report_generator.py`）
- 產生標註圖（在 Step 1 的 PNG 上疊加零件框線、編號、圖域網格）
- 產生零件拆解表格，輸出成 Excel（用 `openpyxl`）
- 產生問題清單（同樣輸出成表格或 JSON）
- 全部打包成可下載的檔案（zip 或個別下載連結）

---

## AI 分析 Prompt（放入 ai_analyzer.py 呼叫 Gemini API 時使用）

```
你是一位資深機械/鈑金工程圖判讀專家。你收到的輸入是一份 DXF 圖面經程式解析後的
結構化資料（座標、標註數值、文字、圖層），不是圖片本身。你的任務是依據這些
「已確定的客觀數據」，將圖面拆解為零件清單，供焊接廠商施工參考。

# 絕對規則
1. 所有尺寸數字必須直接引用輸入資料中 dimensions 陣列裡的原始數值，
   禁止自行計算、估算或修改任何數字。
2. 零件分組依據：優先使用 texts 中出現的件號（如 P-01, P-02）進行分組；
   若無明確件號，才依據 entities 的圖層與幾何相鄰關係進行推斷分組，
   並在該零件標記 confidence 為 "存疑"，同時說明推斷依據。
3. 若某個標註數值找不到對應的零件歸屬，或某個零件缺少關鍵尺寸
  （長寬高其中之一或厚度），一律列入 issues，不可省略不報告，也不可自行補值。
4. 若同一零件出現矛盾標註（例如同一段被標了兩個不同數字），列入 issues，
   不可自行選用其中一個。
5. 不要輸出任何輸入資料中不存在的規格、材質、公差建議。

# 輸出格式（僅回傳此 JSON，不要有其他文字）
{
  "parts": [
    {
      "part_id": "",
      "zone": "",
      "name": "",
      "dimensions": {"length": null, "width": null, "thickness": null, "unit": "mm"},
      "source_refs": ["對應到輸入資料中的哪些 dimension/text 項目"],
      "confidence": "明確 / 存疑",
      "note": ""
    }
  ],
  "issues": [
    {"zone": "", "description": "", "reason": ""}
  ]
}

# 輸入資料
{{此處放入 Step1+Step2 產生的 JSON}}
```

---

## 前端 UI 需求

1. 上傳頁面：拖拉或選擇 DXF 檔案上傳
2. 處理中狀態顯示（DXF 解析中 → AI 分析中 → 產生報告中）
3. 結果頁面：
   - 顯示標註後的圖面預覽（含圖域網格與零件框線編號）
   - 顯示零件拆解表格（可排序、可捲動）
   - 顯示問題清單（明確標示需要人工確認的項目，建議用醒目顏色）
4. 下載按鈕：下載 Excel 表格、下載標註圖（PNG）、下載完整報告（zip）

---

## 開發順序建議（給 Agent 執行）

1. 先建立 `dxf_parser.py`，用一份簡單的測試 DXF 檔案驗證能否正確抓出標註數值
   （這一步不涉及 AI，先確保數據源準確）
2. 建立 `grid_builder.py`，驗證網格計算與座標定位邏輯正確
3. 建立 `ai_analyzer.py`，串接 Gemini API，並用上方 Prompt 測試分組結果
4. 建立 `report_generator.py`，產生 Excel 與標註圖
5. 建立 FastAPI 路由，串接上傳/處理/下載流程
6. 建立前端 UI，串接後端 API
7. 用實際的工程圖 DXF 檔案做端對端測試，特別檢查：
   - 標註數字是否與原圖完全一致（重點測試項目）
   - 零件分組是否合理
   - 問題清單是否有效攔截了模糊/矛盾的標註，而非漏報

---

## 環境變數需求
```
GEMINI_API_KEY=<使用者自行填入，不可提交到版本控制>
```

## Python 套件需求
```
ezdxf
fastapi
uvicorn
openpyxl
matplotlib
python-multipart
google-genai
```
