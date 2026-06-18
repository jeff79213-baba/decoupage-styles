const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const config = require("./config");

if (!config.serviceAccountPath) {
  console.error("找不到 Firebase 服務帳戶金鑰檔案");
  process.exit(1);
}

const serviceAccount = require(config.serviceAccountPath);
initializeApp({ credential: cert(serviceAccount), projectId: config.projectId });
const db = getFirestore();

const cmd = process.argv[2];
const arg = process.argv[3];

async function listProjects() {
  const snap = await db.collection("projects").orderBy("updatedAt", "desc").get();
  if (snap.empty) return console.log("📭 沒有任何專案");
  console.log(`📂 專案列表 (${snap.size})：`);
  snap.docs.forEach((d) => {
    const data = d.data();
    console.log(`  • ${d.id} (${data.fileCount || "?"} 個檔案)`);
  });
}

async function listFiles(project) {
  const snap = await db.collection("projects").doc(project).collection("files").orderBy("__name__").get();
  if (snap.empty) return console.log(`❌ 專案「${project}」沒有檔案`);
  console.log(`📁 ${project} (${snap.size} 個檔案)：`);
  snap.docs.forEach((d) => console.log(`  • ${d.id}`));
}

async function deleteProject(project) {
  const batch = db.batch();
  batch.delete(db.collection("projects").doc(project));
  const filesSnap = await db.collection("projects").doc(project).collection("files").get();
  filesSnap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
  console.log(`✅ 已刪除專案「${project}」（${filesSnap.size} 個檔案）`);
}

async function deleteFile(project, filePath) {
  const ref = db.collection("projects").doc(project).collection("files").doc(filePath);
  const doc = await ref.get();
  if (!doc.exists) return console.log(`❌ 找不到 ${project}/${filePath}`);
  await ref.delete();
  console.log(`✅ 已刪除 ${project}/${filePath}`);
}

(async () => {
  switch (cmd) {
    case "list":
    case "ls":
      if (arg) await listFiles(arg);
      else await listProjects();
      break;
    case "delete":
    case "del":
      if (!arg) {
        console.log("用法：");
        console.log("  node _tools\\delete.js list                     — 列出所有專案");
        console.log("  node _tools\\delete.js list 專案名              — 列出該專案檔案");
        console.log("  node _tools\\delete.js delete 專案名            — 刪除整個專案");
        console.log("  node _tools\\delete.js delete 專案名/檔案路徑   — 刪除單一檔案");
        break;
      }
      const splitIdx = arg.indexOf("/");
      if (splitIdx === -1) {
        await deleteProject(arg);
      } else {
        const project = arg.slice(0, splitIdx);
        const filePath = arg.slice(splitIdx + 1);
        await deleteFile(project, filePath);
      }
      break;
    default:
      console.log("用法：");
      console.log("  node _tools\\delete.js list                     — 列出所有專案");
      console.log("  node _tools\\delete.js list 專案名              — 列出該專案檔案");
      console.log("  node _tools\\delete.js delete 專案名            — 刪除整個專案");
      console.log("  node _tools\\delete.js delete 專案名/檔案路徑   — 刪除單一檔案");
  }
  process.exit(0);
})();
