# Telegram Bot 管理手冊

## 啟動（電腦重開機後）

### 1. 啟動 opencode serve
執行 `_start-server.vbs` 或 `start-server.bat`。

### 2. 啟動 Telegram Bot
```powershell
npx @grinev/opencode-telegram-bot@latest start --daemon
```

## 刪除指定的會話

告訴我「刪除 Telegram 會話」，並告訴我要刪哪些。我會：
1. 用 Node.js 直接操作 `opencode.db`（SQLite）
2. 從 `session`、`session_message`、`message`、`part`、`event` 表格刪除該會話的資料
3. 清掉 `settings.json` 的 session 快取

## 相關路徑

| 項目 | 路徑 |
|------|------|
| 對話資料庫 | `%USERPROFILE%\.local\share\opencode\opencode.db` |
| Bot 設定 | `%APPDATA%\opencode-telegram-bot\.env` |
| Bot session 快取 | `%APPDATA%\opencode-telegram-bot\settings.json` |

## Bot Token
`8843177672:AAFWU7jnx3IRjN_vYTKjCzBObGk8pj-yYVU`

## 允許的使用者 ID
`8677508113`