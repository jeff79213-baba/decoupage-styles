const {initializeApp, cert} = require('firebase-admin/app');
const {getFirestore} = require('firebase-admin/firestore');
const path = require('path');
const fs = require('fs');

const sa = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../opencode-sk-firebase-adminsdk-fbsvc-b6b29a6c03.json'), 'utf8'));
initializeApp({credential: cert(sa), projectId: 'opencode-sk'});
const db = getFirestore();

(async () => {
  // Create a test event
  const ref = await db.collection('events').add({
    name: '測試活動',
    adminPassword: 'test123',
    createdAt: new Date()
  });
  console.log('Test event created:', ref.id);

  // Read it back
  const doc = await ref.get();
  console.log('Event data:', doc.data());

  // Delete it
  await ref.delete();
  console.log('Test event deleted');
  console.log('✅ Firestore read/write working!');
})().catch(e => console.error('Error:', e.message));
