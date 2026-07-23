# AI 團隊構想

## 目標
在 OpenCode 中建立多個 AI 角色，讓他們協作討論專案

## 現況分析
- OpenCode 支援自訂 subagent（不同角色 prompt）
- 可以用 @角色名 叫出不同角色
- 但**無法自動循環討論**，需要手動一輪一輪 cue
- Skills 只是說明書，無法控制流程
- 沒有像 Claude Code AI Team OS 那樣的 hook 系統

## 已研究的專案
- **Seqvio**：用 TSX 寫程式產生講解影片，不是 key hub
- **AI Team OS**：Claude Code 專用，可自動排程多角色協作，但無法在 OpenCode 使用

## 待辦（下次討論）
- [ ] 設計三個角色 prompt（架構師、工程師、審查員）
- [ ] 實際測試角色協作流程
- [ ] 是否需要用 MCP 自訂工具來輔助流程
