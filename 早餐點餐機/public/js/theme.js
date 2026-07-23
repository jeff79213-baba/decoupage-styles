window.ThemeManager = {
  currentTheme: 'dark',
  _cachedMenu: null,

  setCachedMenu(menuData) {
    this._cachedMenu = menuData;
  },

  async load() {
    try {
      // Use cached menu if available, avoid extra Firestore read
      const menu = this._cachedMenu || await window.FirebaseCore.getMenu();
      this.setTheme(menu.theme || 'sage');
    } catch (e) {
      console.warn('Could not load theme, using default');
      this.setTheme('sage');
    }
  },

  setTheme(theme) {
    this.currentTheme = theme;
    document.documentElement.setAttribute('data-theme', theme);

    // Remove old font links to avoid duplicates
    document.querySelectorAll('link[data-theme-font]').forEach(l => l.remove());

    // Load appropriate font
    const fontLink = document.createElement('link');
    fontLink.rel = 'stylesheet';
    fontLink.setAttribute('data-theme-font', 'true');
    if (theme === 'sage') {
      fontLink.href = 'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700&display=swap';
    } else {
      fontLink.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap';
    }
    document.head.appendChild(fontLink);
  },

  getTheme() {
    return this.currentTheme;
  }
};
