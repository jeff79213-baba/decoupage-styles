# CNC 程式編輯平台 — 設計規格

## 1. 概述

網頁版 CNC NC 程式編輯平台，協助操作員分析、編輯、模擬 G-code。未來可擴充為 Electron 桌面版。

## 2. 技術選型

| 層級 | 選擇 | 原因 |
|------|------|------|
| 建置工具 | Vite | 快速 HMR，零配置 |
| 框架 | Vue 3 (Composition API) | 元件化、狀態管理彈性 |
| 狀態管理 | Pinia | 輕量、Vue 3 原生 |
| 編輯器 | CodeMirror 6 | 語法高亮、搜尋標記、可擴充 |
| 模擬 | Canvas API | 2D 路徑繪製，無外部依賴 |
| 樣式 | 純 CSS / UnoCSS | 依開發規模決定 |

## 3. 整體布局（B 方案）

```
┌──────────────────────────────────────────────────────────┐
│  CNC 程式編輯平台  [開啟] [儲存] [下載刀號表]             │
├─────────┬────────────────────────────────────────────────┤
│         │  編輯程式區 (CodeMirror)                       │
│ 左導航  │  + 語法高亮                                   │
│ (切換)  │  + 搜尋標籤 + 上下跳轉                         │
│         │  + 顏色設定                                   │
│ ○ 刀號  ├────────────────────────────────────────────────┤
│ ○ 變數  │  2D 路徑模擬 (Canvas)                         │
│ ○ 座標系│  XY 軌跡 + 放大縮小平移                        │
└─────────┴────────────────────────────────────────────────┘
```

## 4. 功能分區

### 4.1 編輯程式區（CodeMirror）

- **CNC 語法高亮**：G-code(藍)、M-code(紅)、N區段(紫)、變數#(橙)、註解(灰)
- **搜尋+標籤**：輸入關鍵字 → 標記所有符合行（左側標籤點）→ 上下按鈕循環跳轉，到底回到最上方
- **顏色設定**：使用者可自訂各語法類別顏色，存 `localStorage`
- **開啟檔案**：`<input type="file" accept=".nc">` 讀取本地 NC 檔
- **儲存檔案**：Blob 下載為 `.NC` 檔，保留原檔名

### 4.2 左側導航（切換顯示）

#### 刀號區（預設顯示）
- 解析結果表格：N 號、刀具名稱、刀桿名稱、加工類型
- 加工類型欄可切換顯示/隱藏
- **下載刀號表**按鈕 → 匯出 `.txt`

#### 變數區
- 顯示 N 區段 → 變數對應表
- 例：`N1 → #100=54`, `N4 → #100=54`

#### 座標系區
- 列表：G54/G55/G56... 及對應加工範圍
- 簡易 XY 平面示意圖標示各座標系位置

### 4.3 2D 路徑模擬（Canvas）

- 解析 G0(快速移動，虛線)、G1(切削移動，實線)
- 支援 G41/G42 刀具補正偏移顯示
- 顯示當前 N 區段對應模擬範圍
- 滑鼠拖曳平移、滾輪縮放
- 初期僅 XY 平面，Z 值不影響視覺

## 5. 檔案結構（預期）

```
cnc-editor/
├── index.html
├── vite.config.js
├── package.json
├── src/
│   ├── main.js
│   ├── App.vue
│   ├── stores/
│   │   └── editor.js          # Pinia store
│   ├── components/
│   │   ├── EditorPanel.vue     # CodeMirror 編輯器
│   │   ├── LeftNav.vue         # 左側導航容器
│   │   ├── ToolTable.vue       # 刀號表
│   │   ├── VariableTable.vue   # 變數表
│   │   ├── CoordViewer.vue     # 座標系列表+圖示
│   │   ├── SimCanvas.vue       # 2D 路徑模擬
│   │   ├── SearchBar.vue       # 搜尋+標籤導航
│   │   └── ColorSettings.vue   # 顏色設定面板
│   ├── parsers/
│   │   └── ncParser.js         # NC 檔案解析邏輯
│   └── utils/
│       └── simulator.js        # 路徑模擬運算
```

## 6. 資料流

```
NC 檔案 (File API)
    ↓
ncParser.js → 解析成結構化資料
    ↓
Pinia Store (editor)
    ├── 原始文字 (rawText)
    ├── 解析結果 (tools[], variables[], coordinates[])
    │
    ├──→ EditorPanel (CodeMirror 顯示 + 編輯)
    ├──→ ToolTable (刀號表)
    ├──→ VariableTable (變數表)
    ├──→ CoordViewer (座標系)
    └──→ SimCanvas (路徑繪製)
```

## 7. 非功能性需求

- 開啟大型 NC 檔（>1MB）不卡頓
- 顏色設定存 `localStorage`，跨關閉保留
- 未來可擴充：Electron 封裝、3D 模擬、多分頁
