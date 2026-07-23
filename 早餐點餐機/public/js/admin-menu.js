let menuData = null;

async function initMenuAdmin() {
  if (!window.AuthManager.requireAuth()) {
    document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;"><h1>密碼錯誤</h1></div>';
    return;
  }

  window.FirebaseCore.init();
  menuData = await window.FirebaseCore.getMenu();
  renderAddonLibrary();
  renderCategories();

  // Update back link
  const shopId = window.APP_CONFIG.shopId;
  document.getElementById('linkBack').href = `admin.html?shop=${shopId}`;
}

// ===== Addon Library =====
function renderAddonLibrary() {
  const container = document.getElementById('addonList');
  container.innerHTML = menuData.addonLibrary.map(addon => `
    <div class="item-row">
      <div class="item-info">
        <span class="item-name">${addon.name}</span>
        <span class="item-price">$${addon.price}</span>
      </div>
      <div class="item-actions">
        <button class="btn btn-sm btn-secondary" onclick="editAddon('${addon.id}')">編輯</button>
        <button class="btn btn-sm btn-danger" onclick="deleteAddon('${addon.id}')">刪除</button>
      </div>
    </div>
  `).join('');
}

function showAddAddon() {
  const name = prompt('配料名稱：');
  if (!name) return;
  const price = parseInt(prompt('價格（0 = 免費）：')) || 0;
  const id = name.toLowerCase().replace(/\s+/g, '_') + '_' + Date.now();

  menuData.addonLibrary.push({ id, name, price });
  saveMenu();
}

function editAddon(addonId) {
  const addon = menuData.addonLibrary.find(a => a.id === addonId);
  if (!addon) return;

  const name = prompt('配料名稱：', addon.name);
  if (!name) return;
  const price = parseInt(prompt('價格：', addon.price)) || 0;

  addon.name = name;
  addon.price = price;
  saveMenu();
}

function deleteAddon(addonId) {
  if (!confirm('確定刪除此配料？')) return;
  menuData.addonLibrary = menuData.addonLibrary.filter(a => a.id !== addonId);
  // Remove from all categories
  menuData.categories.forEach(cat => {
    cat.addonIds = cat.addonIds.filter(id => id !== addonId);
  });
  saveMenu();
}

// ===== Categories =====
function renderCategories() {
  const container = document.getElementById('categoryList');
  container.innerHTML = menuData.categories.map(cat => `
    <div class="category-item">
      <div class="category-header">
        <h3>${cat.name}</h3>
        <div class="category-actions">
          <button class="btn btn-sm btn-secondary" onclick="editCategory('${cat.id}')">編輯</button>
          <button class="btn btn-sm btn-danger" onclick="deleteCategory('${cat.id}')">刪除</button>
          <button class="btn btn-sm btn-secondary" onclick="moveCategory('${cat.id}', -1)">↑</button>
          <button class="btn btn-sm btn-secondary" onclick="moveCategory('${cat.id}', 1)">↓</button>
        </div>
      </div>
      <div class="category-items">
        ${cat.items.map(item => `
          <div class="item-row">
            <div class="item-info">
              <span class="item-name">${item.name}</span>
              <span class="item-price">$${item.price}</span>
              ${!item.enabled ? '<span style="color:#dc3545">（已下架）</span>' : ''}
            </div>
            <div class="item-actions">
              <button class="btn btn-sm btn-secondary" onclick="editItem('${cat.id}', '${item.id}')">編輯</button>
              <button class="btn btn-sm btn-danger" onclick="deleteItem('${cat.id}', '${item.id}')">刪除</button>
              <button class="btn btn-sm btn-secondary" onclick="toggleItemEnabled('${cat.id}', '${item.id}')">${item.enabled ? '下架' : '上架'}</button>
            </div>
          </div>
        `).join('')}
      </div>
      <div class="category-addons" style="margin-top:12px">
        <strong>配料：</strong>
        ${cat.addonIds.map(aid => {
          const addon = menuData.addonLibrary.find(a => a.id === aid);
          return addon ? `<span class="addon-chip">${addon.name}<button onclick="removeAddonFromCategory('${cat.id}','${aid}')">×</button></span>` : '';
        }).join('')}
        <button class="btn btn-sm btn-primary" onclick="addAddonToCategory('${cat.id}')">+ 從配料庫新增</button>
      </div>
      <button class="btn btn-sm btn-primary" style="margin-top:8px" onclick="showAddItem('${cat.id}')">+ 新增品項</button>
    </div>
  `).join('');
}

function showAddCategory() {
  const name = prompt('分類名稱：');
  if (!name) return;
  const id = name.toLowerCase().replace(/\s+/g, '_') + '_' + Date.now();

  menuData.categories.push({
    id,
    name,
    sortOrder: menuData.categories.length + 1,
    items: [],
    addonIds: []
  });
  saveMenu();
}

function editCategory(catId) {
  const cat = menuData.categories.find(c => c.id === catId);
  if (!cat) return;
  const name = prompt('分類名稱：', cat.name);
  if (name) {
    cat.name = name;
    saveMenu();
  }
}

function deleteCategory(catId) {
  if (!confirm('確定刪除此分類？')) return;
  menuData.categories = menuData.categories.filter(c => c.id !== catId);
  saveMenu();
}

function moveCategory(catId, direction) {
  const idx = menuData.categories.findIndex(c => c.id === catId);
  const newIdx = idx + direction;
  if (newIdx < 0 || newIdx >= menuData.categories.length) return;
  [menuData.categories[idx], menuData.categories[newIdx]] = [menuData.categories[newIdx], menuData.categories[idx]];
  // Update sort orders
  menuData.categories.forEach((c, i) => c.sortOrder = i + 1);
  saveMenu();
}

// ===== Items =====
function showAddItem(catId) {
  const name = prompt('品項名稱：');
  if (!name) return;
  const price = parseInt(prompt('價格：')) || 0;
  const id = name.toLowerCase().replace(/\s+/g, '_') + '_' + Date.now();

  const cat = menuData.categories.find(c => c.id === catId);
  if (cat) {
    cat.items.push({ id, name, price, enabled: true });
    saveMenu();
  }
}

function editItem(catId, itemId) {
  const cat = menuData.categories.find(c => c.id === catId);
  const item = cat?.items.find(i => i.id === itemId);
  if (!item) return;

  const name = prompt('品項名稱：', item.name);
  if (!name) return;
  const price = parseInt(prompt('價格：', item.price)) || 0;

  item.name = name;
  item.price = price;
  saveMenu();
}

function deleteItem(catId, itemId) {
  if (!confirm('確定刪除此品項？')) return;
  const cat = menuData.categories.find(c => c.id === catId);
  if (cat) {
    cat.items = cat.items.filter(i => i.id !== itemId);
    saveMenu();
  }
}

function toggleItemEnabled(catId, itemId) {
  const cat = menuData.categories.find(c => c.id === catId);
  const item = cat?.items.find(i => i.id === itemId);
  if (item) {
    item.enabled = !item.enabled;
    saveMenu();
  }
}

// ===== Category Addons =====
function addAddonToCategory(catId) {
  const cat = menuData.categories.find(c => c.id === catId);
  if (!cat) return;

  // Show available addons
  const available = menuData.addonLibrary.filter(a => !cat.addonIds.includes(a.id));
  if (available.length === 0) {
    alert('所有配料已加入此分類');
    return;
  }

  const list = available.map((a, i) => `${i + 1}. ${a.name}`).join('\n');
  const choice = prompt('選擇配料（輸入編號）：\n' + list);
  const idx = parseInt(choice) - 1;

  if (idx >= 0 && idx < available.length) {
    cat.addonIds.push(available[idx].id);
    saveMenu();
  }
}

function removeAddonFromCategory(catId, addonId) {
  const cat = menuData.categories.find(c => c.id === catId);
  if (cat) {
    cat.addonIds = cat.addonIds.filter(id => id !== addonId);
    saveMenu();
  }
}

// ===== Import/Export =====
function exportJSON() {
  const json = JSON.stringify(menuData, null, 2);
  document.getElementById('jsonInput').value = json;
}

function importJSON() {
  const json = document.getElementById('jsonInput').value;
  try {
    const data = JSON.parse(json);
    if (data.categories && data.addonLibrary) {
      menuData = data;
      saveMenu();
      alert('匯入成功');
    } else {
      alert('JSON 格式不正確');
    }
  } catch (e) {
    alert('JSON 解析失敗：' + e.message);
  }
}

function downloadTemplate() {
  // Create Excel template
  const ws_data = [
    ['分類名稱', '分類排序', '品項名稱', '品項價格', '配料名稱', '配料價格'],
    ['漢堡', 1, '豬肉漢堡', 65, '加蛋', 10],
    ['漢堡', 1, '豬肉漢堡', 65, '加起司', 15],
    ['漢堡', 1, '牛肉漢堡', 75, '', ''],
    ['蛋餅', 2, '原味蛋餅', 35, '醬油膏', 0],
    ['飲料', 3, '紅茶', 25, '', '']
  ];
  const ws = XLSX.utils.aoa_to_sheet(ws_data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '菜單');
  XLSX.writeFile(wb, '菜單範本.xlsx');
}

function handleExcelUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    const data = new Uint8Array(e.target.result);
    const workbook = XLSX.read(data, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const json = XLSX.utils.sheet_to_json(sheet);

    // Parse Excel to menu structure
    const categories = {};
    const addonLibrary = [];

    json.forEach(row => {
      const catName = row['分類名稱'];
      const catSort = row['分類排序'] || 1;
      const itemName = row['品項名稱'];
      const itemPrice = row['品項價格'] || 0;
      const addonName = row['配料名稱'];
      const addonPrice = row['配料價格'] || 0;

      if (!catName || !itemName) return;

      // Create category if not exists
      if (!categories[catName]) {
        categories[catName] = {
          id: catName.toLowerCase().replace(/\s+/g, '_'),
          name: catName,
          sortOrder: catSort,
          items: [],
          addonIds: []
        };
      }

      // Create item if not exists
      const cat = categories[catName];
      if (!cat.items.find(i => i.name === itemName)) {
        cat.items.push({
          id: itemName.toLowerCase().replace(/\s+/g, '_') + '_' + Date.now(),
          name: itemName,
          price: itemPrice,
          enabled: true
        });
      }

      // Add addon
      if (addonName) {
        let addon = addonLibrary.find(a => a.name === addonName);
        if (!addon) {
          addon = {
            id: addonName.toLowerCase().replace(/\s+/g, '_') + '_' + Date.now(),
            name: addonName,
            price: addonPrice
          };
          addonLibrary.push(addon);
        }
        if (!cat.addonIds.includes(addon.id)) {
          cat.addonIds.push(addon.id);
        }
      }
    });

    menuData.categories = Object.values(categories);
    menuData.addonLibrary = addonLibrary;
    saveMenu();
    alert('匯入成功');
  };
  reader.readAsArrayBuffer(file);
}

// ===== Save =====
async function saveMenu() {
  await window.FirebaseCore.saveMenu(menuData);
  renderAddonLibrary();
  renderCategories();
}

document.addEventListener('DOMContentLoaded', initMenuAdmin);
