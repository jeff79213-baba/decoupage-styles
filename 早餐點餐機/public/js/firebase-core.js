// Firebase SDK v9+ modular imports (via CDN)
// Will be loaded via <script> tags in HTML

window.FirebaseCore = {
  db: null,
  shopId: null,

  init() {
    this.shopId = window.APP_CONFIG.shopId;
    // Initialize Firebase app
    firebase.initializeApp(window.APP_CONFIG.firebaseConfig);
    this.db = firebase.firestore();
    console.log(`Firebase initialized for shop: ${this.shopId}`);
  },

  // Shop path helper
  shopPath() {
    return `shops/${this.shopId}`;
  },

  // Menu operations
  async getMenu() {
    const doc = await this.db.doc(`${this.shopPath()}/menu`).get();
    if (doc.exists) {
      return doc.data();
    }
    // Return default menu structure if no data
    return {
      storeName: '新店家',
      subtitle: '請到後台設定菜單',
      theme: 'sage',
      addonLibrary: [],
      categories: []
    };
  },

  async saveMenu(menuData) {
    await this.db.doc(`${this.shopPath()}/menu`).set(menuData);
    await this.updateStats('writes', 1);
  },

  // Order operations
  async saveOrder(orderData) {
    const orderRef = await this.db.collection(`${this.shopPath()}/orders`).add({
      ...orderData,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    await this.updateStats('writes', 1);
    return orderRef.id;
  },

  async getOrders(limit = 100) {
    const snapshot = await this.db.collection(`${this.shopPath()}/orders`)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  async deleteOrder(orderId) {
    await this.db.doc(`${this.shopPath()}/orders/${orderId}`).delete();
    await this.updateStats('writes', 1);
  },

  async deleteOrders(orderIds) {
    const batch = this.db.batch();
    orderIds.forEach(id => {
      batch.delete(this.db.doc(`${this.shopPath()}/orders/${id}`));
    });
    await batch.commit();
    await this.updateStats('writes', orderIds.length);
  },

  // Stats operations
  async updateStats(type, count) {
    const today = new Date().toISOString().split('T')[0];
    const statsRef = this.db.doc(`${this.shopPath()}/stats`);

    await this.db.runTransaction(async (transaction) => {
      const doc = await transaction.get(statsRef);
      const data = doc.exists ? doc.data() : { dailyStats: {}, totalStats: { reads: 0, writes: 0 } };

      // Update daily stats
      if (!data.dailyStats[today]) {
        data.dailyStats[today] = { reads: 0, writes: 0 };
      }
      data.dailyStats[today][type] += count;

      // Update total stats
      data.totalStats[type] += count;

      transaction.set(statsRef, data);
    });
  },

  async getStats() {
    const doc = await this.db.doc(`${this.shopPath()}/stats`).get();
    return doc.exists ? doc.data() : { dailyStats: {}, totalStats: { reads: 0, writes: 0 } };
  },

  async cleanOldStats(retentionDays = 365) {
    const statsRef = this.db.doc(`${this.shopPath()}/stats`);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);
    const cutoffStr = cutoff.toISOString().split('T')[0];

    await this.db.runTransaction(async (transaction) => {
      const doc = await transaction.get(statsRef);
      if (!doc.exists) return;

      const data = doc.data();
      let cleaned = 0;
      for (const date in data.dailyStats) {
        if (date < cutoffStr) {
          delete data.dailyStats[date];
          cleaned++;
        }
      }

      if (cleaned > 0) {
        transaction.set(statsRef, data);
      }
    });
  }
};
