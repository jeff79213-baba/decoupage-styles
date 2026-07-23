let menuData = null;

async function initAdmin() {
  if (!window.AuthManager.requireAuth()) {
    document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;"><h1>密碼錯誤</h1></div>';
    return;
  }

  window.FirebaseCore.init();
  menuData = await window.FirebaseCore.getMenu();

  document.getElementById('storeName').value = menuData.storeName;
  document.getElementById('storeSubtitle').value = menuData.subtitle;

  // Highlight current theme
  document.getElementById('themeDark').classList.toggle('active', menuData.theme === 'dark');
  document.getElementById('themeSage').classList.toggle('active', menuData.theme === 'sage');

  // Update nav links with shopId
  const shopId = window.APP_CONFIG.shopId;
  document.getElementById('linkMenu').href = `admin-menu.html?shop=${shopId}`;
  document.getElementById('linkOrders').href = `admin-orders.html?shop=${shopId}`;

  // Generate QR code
  generateQR();
}

async function saveStoreInfo() {
  menuData.storeName = document.getElementById('storeName').value;
  menuData.subtitle = document.getElementById('storeSubtitle').value;
  await window.FirebaseCore.saveMenu(menuData);
  alert('已儲存');
}

async function setTheme(theme) {
  menuData.theme = theme;
  await window.FirebaseCore.saveMenu(menuData);
  document.getElementById('themeDark').classList.toggle('active', theme === 'dark');
  document.getElementById('themeSage').classList.toggle('active', theme === 'sage');
}

async function changePassword() {
  const newPw = document.getElementById('newPassword').value;
  const confirmPw = document.getElementById('confirmPassword').value;

  if (newPw !== confirmPw) {
    alert('密碼不一致');
    return;
  }

  if (newPw.length < 4) {
    alert('密碼至少4碼');
    return;
  }

  // Store password hash (simple hash, not production-grade)
  localStorage.setItem('admin_password', btoa(newPw));
  alert('密碼已變更');
  document.getElementById('newPassword').value = '';
  document.getElementById('confirmPassword').value = '';
}

function goToKiosk() {
  window.location.href = `index.html?shop=${window.APP_CONFIG.shopId}`;
}

function generateQR() {
  const url = `${window.location.origin}/index.html?shop=${window.APP_CONFIG.shopId}`;
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
