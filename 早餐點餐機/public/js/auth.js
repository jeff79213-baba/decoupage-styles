window.AuthManager = {
  PASSWORD_KEY: 'admin_password',

  isAuthenticated() {
    return sessionStorage.getItem('admin_auth') === 'true';
  },

  login(password) {
    const stored = localStorage.getItem(this.PASSWORD_KEY);
    if (!stored) {
      // No password set, allow access
      sessionStorage.setItem('admin_auth', 'true');
      return true;
    }
    if (btoa(password) === stored) {
      sessionStorage.setItem('admin_auth', 'true');
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
