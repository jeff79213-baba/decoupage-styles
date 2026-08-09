# 三格並排比較與編輯功能設計 spec

日期：2026-08-09
專案：CNC程式碼解讀器/cnc-editor

## 背景與目標

現行「雙程式並排」存在兩個問題：
1. **位置跳動**：`splitPair` computed 由 `activeFileId` 派生，點右側 → active 變右側 → computed 重算 → 右側瞬間跳到左側，藍線指示總在左側。
2. **僅支援兩支**：無法同時觀看三支，也無法替換/換位。

目標：
- 並排模式支援 **2 格或 3 格**，使用者點「並排」鈕旁小選單選擇格數。
- 三格內容與 `activeFileId` **完全分離**，點選哪格，該格上方出現藍線指示，左側刀號/變數/座標欄位跟隨 active。
- 並排後程式**位置不跳動**。
- 每格 header 可**拖曳換位**、**下拉替換**未顯示的程式。
- 未點並排（單格模式）時，畫面只顯示分頁簽選中的一支程式。

## 名詞

- **分頁簽列**：單格模式上方顯示所有已匯入程式的 tabs（現況不變）。
- **並排模式**：`splitCount > 0` 時，分頁簽列隱藏，改由格子 header 管理。
- **格子（slot）**：並排模式中的一個編輯器位置。
- **空格**：`splitSlotIds` 中的 `null`，顯示 placeholder。

## 資料結構（store）

新增 state：

```js
splitCount: 0,        // 0 = 單格, 2 = 並排兩支, 3 = 並排三支
splitSlotIds: []      // 每格內容：fileId 或 null（空格）；長度 = splitCount
```

新增 getter：

```js
splitSlots() {
  // 回傳長度 = splitCount 的陣列，每項為 { id, file: FileObj|null }
}
```

新增 actions：

- `setSplit(count)` — 設定並排格數。進入/切換規則見「並排格數切換」。
- `exitSplit()` — 回到單格模式（`splitCount = 0`、`splitSlotIds = []`），分頁簽列回復。
- `setSlot(index, fileId)` — 用 fileId 替換指定格（下拉替換用）。fileId 已在別格時：先從原格移除再放入（交換內容，維持「同檔不重複」）。
- `closeSlot(index)` — 該格設為 `null`。**不從 `files` 移除檔案**；該程式回到分頁簽。
- `moveSlot(from, to)` — 拖曳換位：`splitSlotIds` 中以 splice 從 `from` 移到 `to`。

修改現有 actions：

- `addFile(file)` — 完成讀檔後，若 `splitCount > 0` 且有空格（`null`），自動填入第一個空格。若無空格，僅加入 `files`（分頁簽）。
- `removeFile(id)` — 現有邏輯不變；另在 `splitSlotIds` 中若含該 id，將其該格設為 `null`（檔案關閉後格子變空格）。

## 並排格數切換規則

| 動作 | 結果 |
|---|---|
| 點「並排」→ 選 2 格 | `splitCount = 2`；`splitSlotIds` 若為空，取 `files` 前兩支（不足以 `null` 補），active 保持原值 |
| 點「並排」→ 選 3 格 | `splitCount = 3`；保留既有 slot 內容，新增第 3 格取「下一個未顯示的 file」，無則 `null` |
| 2 格 → 切 3 格 | 前兩格內容不動，第 3 格填補 |
| 3 格 → 切 2 格 | 第 3 格內容**不刪除**，回到分頁簽（`files` 保留）；`splitSlotIds` 截斷為 2 |
| 點「並排」時只有 1 支 | 仍可並排，多出的格為空格 |
| 點「並排」時只有 2 支 | 3 格時第 3 格為空格 |

## 單格模式（splitCount = 0）

- 畫面只顯示分頁簽選中的一支（`activeFileId`），與現況一致。
- 分頁簽列顯示，點 tab → `setActiveFile`。
- 既有 toolbar 開啟/儲存/下載刀號表綁定 active 檔，不變。
- 此為預設狀態；「並排」鈕在小選單選擇後才進入並排模式。

## App.vue 版面

```
toolbar（開啟/儲存/下載刀號表/並排鈕）
分頁簽列            ← 僅 splitCount = 0 顯示
[格子1 | 格子2 | 格子3]  ← 僅 splitCount > 0 顯示（flex 均分）
LeftNav | 編輯區
SimCanvas
```

- 移除：`splitMode` ref、`splitPair` computed、`onDividerDown`、`splitPct`、`.split-divider`、`.split-body`。
- 新增：「並排」鈕旁小選單（2 格 / 3 格）；並排時三格 `<EditorPanel>` 以 `:key="slot.id || 'empty-i'"` 掛載。
- 每格上方為格子 header（見下）。

## 格子 header（EditorPanel 新增）

並排模式（傳入 `splitMode` prop = true）時，EditorPanel 上方 header 顯示：

```
[檔名]  ── 可拖曳換位          [▾] [×]
```

- **檔名區**：顯示 `fileInfo.fileName`；空格顯示「無程式」placeholder。點格子（含編輯器本體）→ `setActiveFile(格內 id)`。
- **× 關閉**：`store.closeSlot(index)`，格子變空格。
- **▾ 下拉**：列出「不在 `splitSlotIds` 內」的所有 `files`（依分頁簽順序）；點一支 → `store.setSlot(index, id)`。空格時點 header 直接展開 ▾。
- **拖曳**：拖 header 檔名區 → `moveSlot(from, to)`。僅並排模式可拖；單格模式（無此 header 拖曳）不可拖。
- **active 指示**：`activeFileId === fileId` 時藍線 + 檔名高亮（現有 `isActive` 機制，不變）。空格無 active。

## 檔案變更清單

- Modify: `src/stores/editor.js`（state/getters/actions 如上）
- Modify: `src/App.vue`（並排選單、三格版面、移除 splitPair/splitPct、header 拖曳與下拉事件）
- Modify: `src/components/EditorPanel.vue`（`splitMode` prop、header 的 ×/▾/拖曳、空格 placeholder）
- Modify: `src/components/SearchBar.vue`（如需要，僅在並排時縮放；預期不改）
- Test: `src/stores/editor.test.js`（新增 split 相關測試）

## 錯誤處理與邊界

- `setSlot(index, fileId)` 的 index 超出範圍 → 忽略。
- 所有 slot 操作都以 `splitSlotIds` 為唯一權威；`files` 只增不因 slot 操作刪除。
- 拖曳跨格無效落點（拖到自身）→ 不動作。
- 移除最後一支檔案時，`activeFileId` 清空（現有邏輯），並排格子全變空格，畫面顯示「無程式」。

## 測試策略

**單元測試（Vitest，擴充 editor.test.js）：**
- `setSplit(2)` 建立 2 格、`setSplit(3)` 建立 3 格；不足以 null 補
- 2→3 格保留前 2 格；3→2 格截斷且不刪除 files
- `addFile` 填第一個空格；滿格不填
- `closeSlot` 變空格、其他格不動、檔案仍在 files
- `moveSlot` 換位正確
- `setSlot` 替換內容；同檔重複時交換不重複
- 既有 12 個測試維持通過

**建置與端對端：**
- `npm test` 全過、`vite build` 成功
- CDP 驗證：3 格並排、點格切 active（藍線/左欄跟隨）、拖曳換位、下拉替換、空格補位、2↔3 切換、單格模式只顯示一支、無 `Runtime.exceptionThrown`
- 安裝版重建（`scripts/build-install.ps1`）+ `file://` 驗證

## 非目標（YAGNI）

- 不支援三格以上（四格、任意多格）。
- 不做格子的「圖釘固定」。
- 不改動 SimCanvas（已跟隨 active）。
- 不做跨格同步捲動。
