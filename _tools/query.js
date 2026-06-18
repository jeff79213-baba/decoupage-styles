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
  if (snap.empty) return console.log("[]");
  const list = snap.docs.map((d) => ({ name: d.id, fileCount: d.data().fileCount || 0 }));
  console.log(JSON.stringify(list, null, 2));
}

async function listFiles(project) {
  const snap = await db.collection("projects").doc(project).collection("files").orderBy("__name__").get();
  if (snap.empty) return console.log("[]");
  const list = snap.docs.map((d) => ({ path: d.id, size: d.data().size }));
  console.log(JSON.stringify(list, null, 2));
}

async function viewFile(project, filePath) {
  const doc = await db.collection("projects").doc(project).collection("files").doc(filePath).get();
  if (!doc.exists) return console.log("null");
  console.log(JSON.stringify(doc.data(), null, 2));
}

(async () => {
  switch (cmd) {
    case "list":
      if (arg) await listFiles(arg);
      else await listProjects();
      break;
    case "files":
      if (!arg) { console.log("請指定專案名稱"); break; }
      await listFiles(arg);
      break;
    case "view":
      if (!arg) { console.log("格式：query view 專案名/路徑"); break; }
      const idx = arg.indexOf("/");
      if (idx === -1) { console.log("格式：query view 專案名/路徑"); break; }
      await viewFile(arg.slice(0, idx), arg.slice(idx + 1));
      break;
    default:
      console.log("用法：");
      console.log("  node query list                    # 列出專案");
      console.log("  node query list 專案名             # 列出檔案");
      console.log("  node query view 專案名/路徑        # 查看檔案內容");
  }
  process.exit(0);
})();
