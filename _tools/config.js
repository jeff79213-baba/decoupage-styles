const path = require("path");
const fs = require("fs");

const toolsDir = __dirname;
const rootDir = path.resolve(toolsDir, "..");

const keyFiles = fs.readdirSync(rootDir).filter((f) => f.endsWith(".json") && f.includes("firebase-adminsdk"));
const serviceAccountPath = keyFiles.length > 0 ? path.join(rootDir, keyFiles[0]) : null;

module.exports = {
  serviceAccountPath,
  projectId: "opencode-sk",
  botToken: "8843177672:AAFWU7jnx3IRjN_vYTKjCzBObGk8pj-yYVU",
  rootDir,
  filesCollection: "files",
  excludeExt: [
    ".exe", ".dll", ".so", ".dylib",
    ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".ico", ".svg", ".webp",
    ".mp4", ".mp3", ".avi", ".mov", ".wmv", ".flv", ".mkv",
    ".zip", ".rar", ".7z", ".tar", ".gz",
    ".pdf", ".doc", ".docx", ".xls", ".xlsx",
    ".ttf", ".otf", ".woff", ".woff2", ".eot",
  ],
  excludeDir: ["node_modules", ".git", "_tools", "__pycache__", ".venv", "venv"],
};
