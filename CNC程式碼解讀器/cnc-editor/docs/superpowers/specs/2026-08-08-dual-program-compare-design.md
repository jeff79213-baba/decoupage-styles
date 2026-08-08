# CNC 編輯平台 — 雙程式比較與編輯功能設計

日期：2026-08-08
狀態：已與使用者確認

## 目標

讓使用者能同時載入兩支 CNC 程式，各自獨立編輯，可用分頁簽切換或左右並排比較，左側刀號/變數/座標欄位跟隨「作用中程式」，並讓使用者一眼看出目前作用的是哪支程式。

## 資料模型（store 多檔化）

目前 `stores/editor.js` 只有單一 `rawText / parsed / currentLine`，改為多檔陣列：

```
state:
  files: [
    { id, fileName, rawText, parsed, currentLine, bookmarks }
  ]
  activeFileId: null
  selectedNav / searchKeyword / searchResults / searchIndex   (搜尋狀態，切檔時清空)
  showTypeColumn / monochrome / monoEnabled / syntaxColors     (維持全域)
```

**getters 全部改由 active 檔供應**：
- `activeParsed`（active 檔的 parsed）
- `tools / variables / coordinates / lines / blocks / lineCoords` → 由 `activeParsed` 提供
- `currentFileName` → active 檔的 fileName
- `currentLine`、`bookmarks` → 每檔各自記錄

## 畫面設計

### 分頁簽列（編輯器上方一條）
- 每個分頁顯示檔名（如 `A.NC`、`B.NC`），作為該程式的標籤
- 點分頁 → 切換 active 檔，編輯器內容、左側欄位、標籤全部切過去
- 每個分頁帶「×」關閉鈕，關閉後 active 自動移到鄰近分頁
- 未開任何檔時顯示「開啟檔案」提示

### 並排模式
- 工具列「分切」按鈕改為「並排」：切換後左右兩格各顯示一支程式
  - 第一格 = 目前作用中程式；第二格 = 另一支
  - 只開一支時，第二格顯示「拖入或開啟第二支程式」
- 分隔條可拖曳調寬度（沿用現有 splitPct 機制）
- 並排時左側欄位跟隨作用中程式：點右邊編輯器，左側切到那一支的資料

### 作用中程式明顯標示（多管齊下）
1. **分頁簽高亮**：作用中分頁藍色底＋白字，非作用為灰暗色
2. **檔名欄底色**：編輯器上方檔名欄，作用中那格深色背景＋檔名大字；並排時非作用那格淡色
3. **左側頂部標示**：左側欄位區頂部固定顯示「目前程式：**A.NC**」
4. **並排點擊切換**：點哪格編輯器，該格變高亮、左側資料切到它、分頁簽同步切換

## 行為規則

| 動作 | 綁定對象 |
|------|----------|
| 開啟/拖入新檔 | **新增一支**並設為 active（不覆蓋舊檔） |
| 儲存檔案 | active 檔的 rawText + 檔名 |
| 下載刀號表 | active 檔的 parsed |
| 搜尋 / 上標籤 / 清除標籤 | 全部作用於 active 檔 |
| 搜尋結果 | 切檔即清空（另一支要重新搜尋） |
| 標籤 bookmarks | 每檔獨立，切檔後另一支沒有標籤 |

## 元件分工

- `stores/editor.js`：多檔狀態、active 檔切換、所有 getter 改由 activeParsed 供應、新增 `addFile/removeFile/setActiveFile/updateFileText` action
- `App.vue`：分頁簽列渲染、並排模式切換、檔案載入（新增一支）
- `EditorPanel.vue`：接收 `fileId` prop，所有編輯/搜尋/標籤操作針對該檔；並排時掛兩個實例
- `LeftNav.vue` / `ToolTable.vue` / `VariableTable.vue` / `CoordViewer.vue`：讀取 active 檔資料（getter 改動後自然生效）
- `SimCanvas.vue`：讀取 active 檔 parsed / currentLine

## 錯誤處理與邊界

- 無檔案時：分頁列空、左側顯示空提示、編輯器顯示「未開啟檔案」
- 關閉分頁：確保剩餘分頁的 active 正確轉移；全部關完回到無檔案狀態
- 並排時只有一支：第二格顯示提示，不報錯
- 拖入檔案 id 唯一性：用遞增計數或 timestamp，避免重複

## 測試策略

- 單元：store action（addFile/removeFile/setActiveFile 切換時 getter 正確性、bookmarks 獨立性）
- 元件：分頁簽渲染與切換、active 標示 class 正確、並排模式兩格綁定不同檔、第二格空提示
- 手動/CDP 驗證：開兩支 → 各自搜尋上標籤 → 切檔標籤不串 → 存檔存對檔 → 並排點擊左側跟隨
