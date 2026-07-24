window.FirebaseCore = {
  db: null,
  shopId: null,
  _initialized: false,

  init() {
    if (this._initialized) return;
    if (!window.APP_CONFIG) {
      console.error('APP_CONFIG not loaded');
      return;
    }
    this.shopId = window.APP_CONFIG.shopId;
    try {
      firebase.initializeApp(window.APP_CONFIG.firebaseConfig);
    } catch (e) {
      // App already initialized
    }
    this.db = firebase.firestore();
    this._initialized = true;
    console.log(`Firebase initialized for shop: ${this.shopId}`);
  },

  shopDoc() {
    return this.db.doc(`shops/${this.shopId}`);
  },

  shopOrders() {
    return this.db.collection(`shops/${this.shopId}/orders`);
  },

  // Menu operations (stored as fields in shop document)
  async getMenu() {
    if (!this.db) return this._defaultMenu();
    try {
      const doc = await this.shopDoc().get();
      if (doc.exists) {
        const data = doc.data();
        // Ensure required fields exist
        return {
          storeName: data.storeName || '新店家',
          subtitle: data.subtitle || '請到後台設定菜單',
          theme: data.theme || 'sage',
          addonLibrary: data.addonLibrary || [],
          categories: data.categories || [],
          dailyStats: data.dailyStats || {},
          totalStats: data.totalStats || { reads: 0, writes: 0 }
        };
      }
      // First time: create the shop document with defaults
      const defaults = this._defaultMenu();
      await this.shopDoc().set(defaults);
      return defaults;
    } catch (e) {
      console.error('getMenu error:', e);
      return this._defaultMenu();
    }
  },

  _defaultMenu() {
    return {
      storeName: '新店家',
      subtitle: '請到後台設定菜單',
      theme: 'sage',
      addonLibrary: [],
      categories: [],
      dailyStats: {},
      totalStats: { reads: 0, writes: 0 }
    };
  },

  async saveMenu(menuData) {
    // Save only menu-related fields, preserve stats
    const { storeName, subtitle, theme, addonLibrary, categories } = menuData;
    await this.shopDoc().set({
      storeName, subtitle, theme, addonLibrary, categories
    }, { merge: true });
    this._updateStatsLocal('writes', 1);
  },

  // Order operations
  async saveOrder(orderData) {
    const orderRef = await this.shopOrders().add({
      ...orderData,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    this._updateStatsLocal('writes', 1);
    return orderRef.id;
  },

  async getOrders(limit = 100) {
    const snapshot = await this.shopOrders()
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  async deleteOrder(orderId) {
    await this.shopOrders().doc(orderId).delete();
    this._updateStatsLocal('writes', 1);
  },

  async deleteOrders(orderIds) {
    const batch = this.db.batch();
    orderIds.forEach(id => {
      batch.delete(this.shopOrders().doc(id));
    });
    await batch.commit();
    this._updateStatsLocal('writes', orderIds.length);
  },

  // Stats operations (stored in shop document)
  _updateStatsLocal(type, count) {
    const today = new Date().toISOString().split('T')[0];
    const update = {};

    // Use dot notation to update nested fields without overwriting entire stats
    update[`dailyStats.${today}.${type}`] = firebase.firestore.FieldValue.increment(count);
    update[`totalStats.${type}`] = firebase.firestore.FieldValue.increment(count);

    this.shopDoc().update(update).catch(e => console.warn('Stats update failed:', e));
  },

  async getStats() {
    const doc = await this.shopDoc().get();
    if (!doc.exists) return { dailyStats: {}, totalStats: { reads: 0, writes: 0 } };
    const data = doc.data();
    return {
      dailyStats: data.dailyStats || {},
      totalStats: data.totalStats || { reads: 0, writes: 0 }
    };
  },

  async cleanOldStats(retentionDays = 365) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);
    const cutoffStr = cutoff.toISOString().split('T')[0];

    try {
      const doc = await this.shopDoc().get();
      if (!doc.exists) return;
      const data = doc.data();
      if (!data.dailyStats) return;

      let cleaned = 0;
      const updates = {};
      for (const date in data.dailyStats) {
        if (date < cutoffStr) {
          updates[`dailyStats.${date}`] = firebase.firestore.FieldValue.delete();
          cleaned++;
        }
      }
      if (cleaned > 0) {
        await this.shopDoc().update(updates);
      }
    } catch (e) {
      console.warn('Clean old stats failed:', e);
    }
  }
};
