let menuData = null;

async function initAdmin() {
  if (!window.AuthManager.requireAuth()) {
    document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;"><h1>密碼錯誤</h1></div>';
    return;
  }

  window.FirebaseCore.init();
  try {
    menuData = await window.FirebaseCore.getMenu();
  } catch (e) {
    console.error('Failed to load menu:', e);
    alert('無法載入菜單資料，請檢查網路連線');
    return;
  }

  // Cache for theme manager
  window.ThemeManager.setCachedMenu(menuData);
  await window.ThemeManager.load();

  document.getElementById('storeName').value = menuData.storeName || '';
  document.getElementById('storeSubtitle').value = menuData.subtitle || '';

  // Highlight current theme
  document.getElementById('themeDark').classList.toggle('active', menuData.theme === 'dark');
  document.getElementById('themeSage').classList.toggle('active', menuData.theme === 'sage');
  showThemeCustomSection(menuData.theme, menuData.themeColors);

  // Update nav links with shopId
  const shopId = window.APP_CONFIG.shopId;
  document.getElementById('linkMenu').href = `admin-menu.html?shop=${shopId}`;
  document.getElementById('linkOrders').href = `admin-orders.html?shop=${shopId}`;

  // Generate QR code
  generateQR();
}

async function saveStoreInfo() {
  if (!menuData) return;
  menuData.storeName = document.getElementById('storeName').value;
  menuData.subtitle = document.getElementById('storeSubtitle').value;
  try {
    await window.FirebaseCore.saveMenu(menuData);
    alert('已儲存');
  } catch (e) {
    console.error('Save failed:', e);
    alert('儲存失敗：' + e.message);
  }
}

async function setTheme(theme) {
  if (!menuData) return;
  menuData.theme = theme;
  try {
    await window.FirebaseCore.saveMenu(menuData);
    window.ThemeManager.setTheme(theme);
    window.ThemeManager.applyCustomColors(menuData.themeColors);
    document.getElementById('themeDark').classList.toggle('active', theme === 'dark');
    document.getElementById('themeSage').classList.toggle('active', theme === 'sage');
    showThemeCustomSection(theme, menuData.themeColors);
  } catch (e) {
    console.error('Theme save failed:', e);
    alert('主題儲存失敗：' + e.message);
  }
}

function showThemeCustomSection(theme, themeColors) {
  const section = document.getElementById('themeCustomSection');
  if (!section) return;
  section.style.display = '';

  const defaults = theme === 'dark'
    ? { primary: '#F27D42', bg: '#1A1A1A', surface: '#262626', text: '#FFFFFF' }
    : { primary: '#B58D3D', bg: '#F2F5F0', surface: '#E0E8DE', text: '#1A2E28' };

  const colors = themeColors || defaults;
  document.getElementById('colorPrimary').value = colors.primary || defaults.primary;
  document.getElementById('colorBg').value = colors.bg || defaults.bg;
  document.getElementById('colorSurface').value = colors.surface || defaults.surface;
  document.getElementById('colorText').value = colors.text || defaults.text;
  document.getElementById('colorPrimaryHex').textContent = colors.primary || defaults.primary;
  document.getElementById('colorBgHex').textContent = colors.bg || defaults.bg;
  document.getElementById('colorSurfaceHex').textContent = colors.surface || defaults.surface;
  document.getElementById('colorTextHex').textContent = colors.text || defaults.text;

  ['colorPrimary', 'colorBg', 'colorSurface', 'colorText'].forEach(id => {
    document.getElementById(id).addEventListener('input', e => {
      document.getElementById(id + 'Hex').textContent = e.target.value;
    });
  });
}

async function saveThemeColors() {
  if (!menuData) return;
  const colors = {
    primary: document.getElementById('colorPrimary').value,
    bg: document.getElementById('colorBg').value,
    surface: document.getElementById('colorSurface').value,
    text: document.getElementById('colorText').value
  };
  menuData.themeColors = colors;
  try {
    await window.FirebaseCore.saveMenu(menuData);
    window.ThemeManager.applyCustomColors(colors);
    alert('顏色已儲存');
  } catch (e) {
    console.error('Save colors failed:', e);
    alert('儲存失敗：' + e.message);
  }
}

async function resetThemeColors() {
  if (!menuData) return;
  menuData.themeColors = null;
  try {
    await window.FirebaseCore.saveMenu(menuData);
    window.ThemeManager.applyCustomColors(null);
    const defaults = menuData.theme === 'dark'
      ? { primary: '#F27D42', bg: '#1A1A1A', surface: '#262626', text: '#FFFFFF' }
      : { primary: '#B58D3D', bg: '#F2F5F0', surface: '#E0E8DE', text: '#1A2E28' };
    showThemeCustomSection(menuData.theme, null);
    alert('已恢復預設顏色');
  } catch (e) {
    console.error('Reset colors failed:', e);
    alert('重設失敗：' + e.message);
  }
}

async function changePassword() {
  const newPw = document.getElementById('newPassword').value;
  const confirmPw = document.getElementById('confirmPassword').value;

  if (!newPw || newPw.length === 0) {
    alert('請輸入新密碼');
    return;
  }

  if (newPw !== confirmPw) {
    alert('密碼不一致');
    return;
  }

  if (newPw.length < 4) {
    alert('密碼至少4碼');
    return;
  }

  localStorage.setItem('admin_password', btoa(newPw));
  alert('密碼已變更');
  document.getElementById('newPassword').value = '';
  document.getElementById('confirmPassword').value = '';
}

function goToKiosk() {
  window.location.href = `/?shop=${window.APP_CONFIG.shopId}`;
}

function generateQR() {
  const url = `${window.location.origin}/?shop=${window.APP_CONFIG.shopId}`;
  const container = document.getElementById('qrCode');
  container.innerHTML = '';

  if (typeof QRCode !== 'undefined') {
    new QRCode(container, {
      text: url,
      width: 200,
      height: 200,
      colorDark: '#000000',
      colorLight: '#ffffff'
    });
  } else {
    container.innerHTML = `<p>QR Code URL: ${url}</p>`;
  }
}

function downloadQR() {
  const canvas = document.querySelector('#qrCode canvas');
  if (!canvas) {
    alert('QR Code 尚未產生');
    return;
  }
  const url = canvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = url;
  a.download = `QR_${window.APP_CONFIG.shopId}.png`;
  a.click();
}

document.addEventListener('DOMContentLoaded', initAdmin);
