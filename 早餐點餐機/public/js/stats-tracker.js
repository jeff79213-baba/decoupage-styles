window.StatsTracker = {
  pendingWrites: 0,
  flushInterval: null,

  init() {
    // Flush pending writes every 30 seconds
    this.flushInterval = setInterval(() => this.flush(), 30000);
  },

  async trackRead() {
    try {
      await window.FirebaseCore.updateStats('reads', 1);
    } catch (e) {
      console.warn('Failed to track read:', e);
    }
  },

  async trackWrite() {
    this.pendingWrites++;
    // Flush immediately if threshold reached
    if (this.pendingWrites >= 5) {
      await this.flush();
    }
  },

  async flush() {
    if (this.pendingWrites === 0) return;
    try {
      await window.FirebaseCore.updateStats('writes', this.pendingWrites);
      this.pendingWrites = 0;
    } catch (e) {
      console.warn('Failed to flush stats:', e);
    }
  }
};
