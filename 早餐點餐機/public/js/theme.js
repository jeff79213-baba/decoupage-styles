window.ThemeManager = {
  currentTheme: 'dark',

  async load() {
    try {
      const menu = await window.FirebaseCore.getMenu();
      this.setTheme(menu.theme || 'sage');
    } catch (e) {
      console.warn('Could not load theme from Firestore, using default');
      this.setTheme('sage');
    }
  },

  setTheme(theme) {
    this.currentTheme = theme;
    document.documentElement.setAttribute('data-theme', theme);

    // Load appropriate font
    const fontLink = document.createElement('link');
    fontLink.rel = 'stylesheet';
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
