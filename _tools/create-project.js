const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const config = require("./config");

if (!config.serviceAccountPath) {
  console.error("找不到 Firebase 服務帳戶金鑰檔案");
  process.exit(1);
}

const projectName = process.argv[2];
if (!projectName) {
  console.error("請輸入專案名稱");
  console.log("用法：node _tools/create-project.js 專案名稱");
  process.exit(1);
}

const serviceAccount = require(config.serviceAccountPath);
initializeApp({ credential: cert(serviceAccount), projectId: config.projectId });
const db = getFirestore();

(async () => {
  const ref = db.collection("projects").doc(projectName);
  const doc = await ref.get();
  if (doc.exists) {
    console.log(`❌ 專案「${projectName}」已經存在`);
    process.exit(1);
  }
  await ref.set({
    createdAt: new Date(),
    updatedAt: new Date(),
    fileCount: 0,
  });
  console.log(`✅ 已建立專案「${projectName}」`);
  console.log(`📂 Firebase 路徑: projects > ${projectName}`);
})();
