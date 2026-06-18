const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const path = require("path");
const fs = require("fs");
const config = require("./config");

if (!config.serviceAccountPath) {
  console.error("找不到 Firebase 服務帳戶金鑰檔案");
  process.exit(1);
}

const serviceAccount = require(config.serviceAccountPath);
initializeApp({ credential: cert(serviceAccount), projectId: config.projectId });
const db = getFirestore();

const targetDir = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const projectName = path.basename(targetDir);

if (!fs.existsSync(targetDir)) {
  console.error(`目錄不存在: ${targetDir}`);
  process.exit(1);
}

const extSet = new Set(config.excludeExt.map((e) => e.toLowerCase()));
const dirSet = new Set(config.excludeDir);

function walkDir(dir, relativePath = "") {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const item of list) {
    const fullPath = path.join(dir, item);
    const relPath = relativePath ? path.join(relativePath, item) : item;
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (!dirSet.has(item)) {
        results = results.concat(walkDir(fullPath, relPath));
      }
    } else {
      const ext = path.extname(item).toLowerCase();
      if (!extSet.has(ext)) {
        results.push({ fullPath, relPath });
      }
    }
  }
  return results;
}

(async () => {
  const files = walkDir(targetDir);
  if (files.length === 0) {
    console.log("沒有找到可上傳的檔案");
    process.exit(0);
  }

  console.log(`📁 專案: ${projectName}`);
  console.log(`找到 ${files.length} 個檔案，開始上傳...\n`);

  const filesCol = db.collection("projects").doc(projectName).collection("files");
  let count = 0;

  for (const { fullPath, relPath } of files) {
    try {
      const content = fs.readFileSync(fullPath, "utf-8");
      const docId = relPath.replace(/\\/g, "/");
      await filesCol.doc(docId).set({
        content,
        updatedAt: new Date(),
        size: content.length,
      });
      count++;
      console.log(`  [${count}/${files.length}] ${relPath}`);
    } catch (err) {
      console.log(`  ⚠ 跳過 ${relPath}（非文字檔或讀取失敗）`);
    }
  }

  await db.collection("projects").doc(projectName).set(
    { updatedAt: new Date(), fileCount: count },
    { merge: true }
  );

  console.log(`\n✅ 上傳完成！共 ${count} 個檔案`);
  console.log(`📂 Firebase 路徑: projects > ${projectName} > files`);
})();
