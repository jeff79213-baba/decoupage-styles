# 烤肉團康支援前線拍照版題目 — v2 設計文件（數量設定版）

日期：2026-09-23

## 背景

v1 已上線（`index.html`，Firebase + GitHub Pages，正常運作）。使用者提出三項需求變更：

1. **人數不可以設定上限**：目前 `min=2 max=30` 限縮範圍，要移除上限（甚至連下限也移除）。
2. **數量要可以設定**：目前僅「勾選 + 數量自動算」，主持人無法直接指定每樣物品叫幾個。
3. **設定就等於勾選**：輸入數量即代表使用該物品。

## 互動模型（經 brainstorming 收斂）

**「數量框 ＋ 停用勾」**：

- 每樣物品一列，包含：
  - **數量輸入框**（`type=number`，`min=0`）：空或 0 ＝ 用自動規則；輸入 >0 ＝ 直接用該數字
  - **停用小勾選框**：預設不打勾（全部可出題）；打勾 ＝ 完全不出這項
- **全員入鏡特殊品項（6 樣）**：改為與一般物品相同的「數量框＋停用勾」，0/空 ＝ 不要；**移除 40% 機率自動附題**與「➕ 全員題」按鈕。
- **預設狀態**：全部啟用、數量框皆空白（皆走自動規則）。

> 註：原話「設定就等於勾選」最後以「完全獨立」詮釋——數量框與停用勾互不連動；輸入數字不會自動改變停用勾，停用勾打勾的品項即使有數字也不出題。

## 人數範圍

- 輸入框**不設 `min`/`max`**，完全無限制（0、1、超高數字皆允許）。
- 預設 10 人。
- 器官自動值公式 `Math.max(1, Math.round(人數 × (0.3 + Math.random() × 0.5)))` 仍適用於任意人數（0 或 1 人時取 1）。

## 物品清單

`POOL`（19 樣一般用具）與 `ALL_MEMBERS`（6 樣全員品項）合併為單一物品清單，每樣加入 `act: 'general' | 'member'` 欄位：

| id | emoji | 名稱 | per | body | act |
|----|-------|------|-----|------|-----|
| hand | 🤲 | 手 | 2 | true | general |
| finger | ☝️ | 手指 | 10 | true | general |
| foot | 🦶 | 腳 | 2 | true | general |
| face | 👤 | 臉 | 1 | true | general |
| phone | 📱 | 手機 | 1 | false | general |
| cap | 🧢 | 帽子 | 1 | false | general |
| glass | 🕶️ | 眼鏡 | 1 | false | general |
| shoe | 👟 | 鞋子 | 2 | false | general |
| drink | 🥤 | 飲料 | 2 | false | general |
| beer | 🍺 | 啤酒罐 | 3 | false | general |
| stick | 🥢 | 筷子 | 2 | false | general |
| tongs | 🍴 | 烤肉夾 | 2 | false | general |
| meat | 🍖 | 烤肉食材 | 3 | false | general |
| spoon | 🥄 | 湯匙 | 2 | false | general |
| chair | 🪑 | 椅子 | 1 | false | general |
| botl | 🧴 | 瓶子 | 2 | false | general |
| plate | 🍽️ | 盤子 | 2 | false | general |
| tiss | 🧻 | 衛生紙 | 1 | false | general |
| glove | 🧤 | 手套 | 2 | false | general |
| allpic | 📸 | 全員合照 | — | false | member |
| alllove | 💛 | 全員比愛心 | — | false | member |
| allya | ✌️ | 全員比 YA | — | false | member |
| allgood | 👍 | 全員比讚 | — | false | member |
| alljump | 🕺 | 全員跳起來 | — | false | member |
| allarm | 🤝 | 全員手搭肩 | — | false | member |

「每人上限（per）」欄位僅供主持人參考標示（勾選列小字），不強制限制。

## 出題演算法

1. 從「啟用中」（未停用）的物品中隨機挑 3~5 樣（`n = Math.min(rnd(3,5), enabled.length)`）。
2. 每樣數量：
   - `customQty[id]` 有值（>0）→ 直接用該數字
   - 否則 → `body ? organQty(peopleCount) : 1`
3. `memberBonus` 概念移除；全員品項已是一般可選物品（數量框有填就用該數字，未填亦視為一般物品數量規則）。

## 數量資料模型（方案 A：customQty Map）

- `customQty`：`{ [id]: number|null }`，未填為 `null`
- `enabled`：`Set(id)`，預設含全部物品；停用勾打勾 → 從集合移除
- 出題：`qty = customQty[id] ?? (body ? organQty(peopleCount) : 1)`

## 事件行為（避免跳題）

- **停用勾 / 數量框變動 → 不重新出題**（僅重繪 `renderItems()`）
- 「🎲 重新出題」→ `newQuestion()`
- 人數變更 → 不重新出題（解決先前審查發現的「改人數就跳題號＋重設計時器」問題）
- 全部啟用物品為空 → `requireOneEnabled()` 阻止出題，提示「至少啟用一種物品」

## 複製格式

沿用 v1 格式（不變）：

```
🔥 支援前線第 N 題

請在最快時間內拍照完成：

📱 1 手機
☝️ 5 手指
🤲 2 手
📸 全員合照

📸 完成後拍照並傳到群組！
```

全員品項與一般物品同樣輸出 `${emoji} ${qty} ${name}`（未填用自動規則取得的數量）。

## 計時器

沿用 v1：開始/停止/完成/重設，顯示 MM:SS.d，功能不變。

## 技術範圍

- 仍為單一 `index.html`（純前端、無外部依賴）。
- 測試沿用 `vm + document stub` 方式，新增/調整測試成 v2 規則。
- 部署沿用 v1（Firebase `bbq-support-front-sk` + GitHub Pages `bbq-support-front`），重新 deploy 即更新。

## 驗證方式

- `node tests/generate.test.mjs`：人數無上限、數量手動優先、停用不出題、全員品項可被選中。
- `node tests/copy.test.mjs`：複製格式含全員品項。
- headless Chrome 開啟確認畫面渲染與互動。
- 部署後手機開網址確認。