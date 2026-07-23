window.AuthManager = {
  PASSWORD_KEY: 'admin_password',

  getAuthKey() {
    const shopId = window.APP_CONFIG ? window.APP_CONFIG.shopId : 'default';
    return `admin_auth_${shopId}`;
  },

  isAuthenticated() {
    return sessionStorage.getItem(this.getAuthKey()) === 'true';
  },

  login(password) {
    const stored = localStorage.getItem(this.PASSWORD_KEY);
    if (!stored) {
      // No password set, allow access
      sessionStorage.setItem(this.getAuthKey(), 'true');
      return true;
    }
    if (btoa(password) === stored) {
      sessionStorage.setItem(this.getAuthKey(), 'true');
      return true;
    }
    return false;
  },

  requireAuth() {
    if (this.isAuthenticated()) return true;
    const password = prompt('請輸入管理密碼：\n（尚未設定密碼，直接按確定即可進入）');
    if (password === null) return false;  // User clicked Cancel
    return this.login(password);
  }
};
