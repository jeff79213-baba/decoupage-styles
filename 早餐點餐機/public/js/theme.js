window.ThemeManager = {
  currentTheme: 'dark',
  _cachedMenu: null,

  init() {
    const cached = localStorage.getItem('kiosk_theme');
    if (cached) this.setTheme(cached, true);
    this.applyCustomColors();
  },

  setCachedMenu(menuData) {
    this._cachedMenu = menuData;
  },

  async load() {
    try {
      const menu = this._cachedMenu || await window.FirebaseCore.getMenu();
      const theme = menu.theme || 'sage';
      localStorage.setItem('kiosk_theme', theme);
      this.setTheme(theme);
      if (menu.themeColors) this.applyCustomColors(menu.themeColors);
    } catch (e) {
      console.warn('Could not load theme, using cached or default');
      const cached = localStorage.getItem('kiosk_theme');
      if (cached) this.setTheme(cached);
      else this.setTheme('sage');
      this.applyCustomColors();
    }
  },

  setTheme(theme, skipCache) {
    this.currentTheme = theme;
    if (!skipCache) localStorage.setItem('kiosk_theme', theme);
    document.documentElement.setAttribute('data-theme', theme);

    document.querySelectorAll('link[data-theme-font]').forEach(l => l.remove());

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

  applyCustomColors(colors) {
    if (!colors) {
      colors = JSON.parse(localStorage.getItem('kiosk_themeColors') || 'null');
    }
    if (!colors) {
      document.documentElement.style.removeProperty('--bg');
      document.documentElement.style.removeProperty('--surface');
      document.documentElement.style.removeProperty('--surface-hover');
      document.documentElement.style.removeProperty('--primary');
      document.documentElement.style.removeProperty('--primary-hover');
      document.documentElement.style.removeProperty('--text');
      document.documentElement.style.removeProperty('--card-bg');
      return;
    }
    if (colors.primary) {
      document.documentElement.style.setProperty('--primary', colors.primary);
      document.documentElement.style.setProperty('--primary-hover', colors.primary);
      document.documentElement.style.setProperty('--card-selected', colors.primary);
    }
    if (colors.bg) {
      document.documentElement.style.setProperty('--bg', colors.bg);
    }
    if (colors.surface) {
      document.documentElement.style.setProperty('--surface', colors.surface);
      document.documentElement.style.setProperty('--card-bg', colors.surface);
    }
    if (colors.text) {
      document.documentElement.style.setProperty('--text', colors.text);
    }
    localStorage.setItem('kiosk_themeColors', JSON.stringify(colors));
  },

  getTheme() {
    return this.currentTheme;
  }
};
