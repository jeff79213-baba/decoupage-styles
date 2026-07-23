window.AuthManager = {
  PASSWORD_KEY: 'admin_password',
  AUTH_KEY: 'admin_auth_global',

  isAuthenticated() {
    return sessionStorage.getItem(this.AUTH_KEY) === 'true';
  },

  login(password) {
    const stored = localStorage.getItem(this.PASSWORD_KEY);
    if (!stored) {
      sessionStorage.setItem(this.AUTH_KEY, 'true');
      return true;
    }
    if (btoa(password) === stored) {
      sessionStorage.setItem(this.AUTH_KEY, 'true');
      return true;
    }
    return false;
  },

  requireAuth() {
    if (this.isAuthenticated()) return true;
    const password = prompt('請輸入管理密碼：\n（尚未設定密碼，直接按確定即可進入）');
    if (password === null) return false;
    return this.login(password);
  }
};
