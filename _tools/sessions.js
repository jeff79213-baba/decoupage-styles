const path = require("path");
const dbPath = path.join(process.env.USERPROFILE, ".local", "share", "opencode", "opencode.db");
const Database = require("C:/Users/TW-10/AppData/Roaming/npm/node_modules/@grinev/opencode-telegram-bot/node_modules/better-sqlite3");

const cmd = process.argv[2];

function open() {
  return new Database(dbPath, { readonly: cmd === "list" });
}

function listSessions() {
  const db = open();
  const sessions = db.prepare("SELECT id, title, directory, model, time_created FROM session ORDER BY time_created").all();
  db.close();
  console.log(`共 ${sessions.length} 個對話：\n`);
  sessions.forEach((s, i) => {
    const dir = s.directory ? s.directory.split("\\").pop().split("/").pop() : "?";
    const model = s.model ? JSON.parse(s.model).id || s.model : "?";
    const time = new Date(s.time_created).toLocaleString("zh-TW");
    console.log(`  [${i}] ${s.id}`);
    console.log(`      標題: ${s.title || "無標題"}`);
    console.log(`      目錄: ${dir}`);
    console.log(`      模型: ${model}`);
    console.log(`      時間: ${time}\n`);
  });
}

function deleteSession(sessionId) {
  const db = open();
  const del = db.transaction(() => {
    const delEvents = db.prepare("DELETE FROM event WHERE aggregate_id = ?");
    const delParts = db.prepare("DELETE FROM part WHERE session_id = ?");
    const delMsgs = db.prepare("DELETE FROM message WHERE session_id = ?");
    const delSessMsgs = db.prepare("DELETE FROM session_message WHERE session_id = ?");
    const delTodo = db.prepare("DELETE FROM todo WHERE session_id = ?");
    const delSess = db.prepare("DELETE FROM session WHERE id = ?");

    const msgIds = db.prepare("SELECT id FROM message WHERE session_id = ?").all(sessionId).map(r => r.id);
    for (const mid of msgIds) {
      delParts.run(mid);
    }
    delEvents.run(sessionId);
    delMsgs.run(sessionId);
    delSessMsgs.run(sessionId);
    delTodo.run(sessionId);
    const info = delSess.run(sessionId);
    return info.changes;
  });
  const result = del(sessionId);
  db.close();
  return result;
}

(async () => {
  switch (cmd) {
    case "list":
      listSessions();
      break;
    case "delete": {
      const sessionId = process.argv[3];
      if (!sessionId) return console.log("請指定 session ID：node sessions.js delete <id>");
      const count = deleteSession(sessionId);
      console.log(`已刪除 session ${sessionId}（${count} 筆記錄）`);
      break;
    }
    default:
      console.log("用法：");
      console.log("  node _tools/sessions.js list           # 列出所有對話");
      console.log("  node _tools/sessions.js delete <id>    # 刪除指定對話");
  }
})();