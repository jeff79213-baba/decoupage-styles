let menuData = null;
let _dirty = false;
let _saveTimer = null;

function guard() {
  if (!menuData) {
    alert('菜單尚未載入，請重新整理');
    return false;
  }
  return true;
}

function debounceSave() {
  _dirty = true;
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(async () => {
    if (!_dirty) return;
    _dirty = false;
    try {
      await window.FirebaseCore.saveMenu(menuData);
    } catch (e) {
      console.error('Auto-save failed:', e);
    }
  }, 500);
}

async function initMenuAdmin() {
  if (!window.AuthManager.requireAuth()) {
    document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;"><h1>密碼錯誤</h1></div>';
    return;
  }

  window.FirebaseCore.init();
  menuData = await window.FirebaseCore.getMenu();
  if (!menuData.addonLibrary) menuData.addonLibrary = [];
  if (!menuData.categories) menuData.categories = [];

  window.ThemeManager.setCachedMenu(menuData);
  await window.ThemeManager.load();

  renderAddonLibrary();
  renderCategories();

  const shopId = window.APP_CONFIG.shopId;
  document.getElementById('linkBack').href = `admin.html?shop=${shopId}`;
}

// ===== Addon Library =====
function renderAddonLibrary() {
  if (!guard()) return;
  const container = document.getElementById('addonList');
  container.innerHTML = menuData.addonLibrary.length === 0
    ? '<p style="color:var(--text-muted);padding:8px">尚未新增配料</p>'
    : menuData.addonLibrary.map(addon => `
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

function addAddonInline() {
  if (!guard()) return;
  const container = document.getElementById('addonFormArea');
  const row = document.createElement('div');
  row.className = 'inline-form-row';
  row.innerHTML = `
    <input type="text" class="inline-input" placeholder="配料名稱" data-field="name">
    <input type="number" class="inline-input inline-input-sm" placeholder="價格" value="0" data-field="price">
    <button class="btn btn-sm btn-primary" onclick="confirmAddAddon(this)">確認</button>
    <button class="btn btn-sm btn-secondary" onclick="this.closest('.inline-form-row').remove()">取消</button>
  `;
  container.appendChild(row);
  row.querySelector('[data-field="name"]').focus();
}

function confirmAddAddon(btn) {
  const row = btn.closest('.inline-form-row');
  const name = row.querySelector('[data-field="name"]').value.trim();
  const price = parseInt(row.querySelector('[data-field="price"]').value) || 0;
  if (!name) { row.querySelector('[data-field="name"]').focus(); return; }

  const id = name.toLowerCase().replace(/\s+/g, '_') + '_' + Date.now();
  menuData.addonLibrary.push({ id, name, price });
  row.remove();
  debounceSave();
  renderAddonLibrary();
}

function editAddon(addonId) {
  if (!guard()) return;
  const addon = menuData.addonLibrary.find(a => a.id === addonId);
  if (!addon) return;
  const container = document.getElementById('addonList');
  const row = container.querySelector(`[onclick*="${addonId}"]`)?.closest('.item-row');
  if (!row) return;

  row.dataset.origHtml = row.innerHTML;
  row.innerHTML = `
    <div class="item-info" style="display:flex;gap:8px;align-items:center">
      <input type="text" class="inline-input" value="${addon.name}" data-field="name">
      <input type="number" class="inline-input inline-input-sm" value="${addon.price}" data-field="price">
    </div>
    <div class="item-actions">
      <button class="btn btn-sm btn-primary" onclick="confirmEditAddon(this,'${addonId}')">確認</button>
      <button class="btn btn-sm btn-secondary" onclick="cancelEdit(this)">取消</button>
    </div>
  `;
  row.querySelector('[data-field="name"]').focus();
}

function confirmEditAddon(btn, addonId) {
  const row = btn.closest('.item-row');
  const name = row.querySelector('[data-field="name"]').value.trim();
  const price = parseInt(row.querySelector('[data-field="price"]').value) || 0;
  if (!name) return;
  const addon = menuData.addonLibrary.find(a => a.id === addonId);
  if (addon) { addon.name = name; addon.price = price; }
  debounceSave();
  renderAddonLibrary();
  renderCategories();
}

function cancelEdit(btn) {
  const row = btn.closest('.item-row');
  if (row.dataset.origHtml) {
    row.innerHTML = row.dataset.origHtml;
    delete row.dataset.origHtml;
  } else {
    row.remove();
  }
}

function deleteAddon(addonId) {
  if (!guard()) return;
  if (!confirm('確定刪除此配料？')) return;
  menuData.addonLibrary = menuData.addonLibrary.filter(a => a.id !== addonId);
  menuData.categories.forEach(cat => {
    cat.addonIds = (cat.addonIds || []).filter(id => id !== addonId);
  });
  debounceSave();
  renderAddonLibrary();
  renderCategories();
}

// ===== Categories =====
function renderCategories() {
  if (!guard()) return;
  const container = document.getElementById('categoryList');
  if (menuData.categories.length === 0) {
    container.innerHTML = '<p style="color:var(--text-muted);padding:8px">尚未新增分類</p>';
    return;
  }
  container.innerHTML = menuData.categories.map(cat => `
    <div class="category-item">
      <div class="category-header">
        <h3>${cat.name}</h3>
        <div class="category-actions">
          <button class="btn btn-sm btn-secondary" onclick="editCategoryInline('${cat.id}')">編輯</button>
          <button class="btn btn-sm btn-danger" onclick="deleteCategory('${cat.id}')">刪除</button>
          <button class="btn btn-sm btn-secondary" onclick="moveCategory('${cat.id}', -1)">↑</button>
          <button class="btn btn-sm btn-secondary" onclick="moveCategory('${cat.id}', 1)">↓</button>
        </div>
      </div>
      <div class="category-items">
        ${(cat.items || []).map(item => `
          <div class="item-row">
            <div class="item-info">
              <span class="item-name">${item.name}</span>
              <span class="item-price">$${item.price}</span>
              ${item.enabled === false ? '<span style="color:#dc3545">（已下架）</span>' : ''}
            </div>
            <div class="item-actions">
              <button class="btn btn-sm btn-secondary" onclick="editItemInline('${cat.id}','${item.id}')">編輯</button>
              <button class="btn btn-sm btn-danger" onclick="deleteItem('${cat.id}','${item.id}')">刪除</button>
              <button class="btn btn-sm btn-secondary" onclick="toggleItemEnabled('${cat.id}','${item.id}')">${item.enabled === false ? '上架' : '下架'}</button>
            </div>
          </div>
        `).join('')}
      </div>
      <div class="category-addons" style="margin-top:12px">
        <strong>配料：</strong>
        ${(cat.addonIds || []).map(aid => {
          const addon = menuData.addonLibrary.find(a => a.id === aid);
          return addon ? `<span class="addon-chip">${addon.name} $${addon.price}<button onclick="removeAddonFromCategory('${cat.id}','${aid}')">×</button></span>` : '';
        }).join('')}
        <button class="btn btn-sm btn-primary" onclick="addAddonToCategory('${cat.id}')">+ 從配料庫新增</button>
      </div>
      <button class="btn btn-sm btn-primary" style="margin-top:8px" onclick="addItemInline('${cat.id}')">+ 新增品項</button>
      <div id="itemFormArea_${cat.id}" style="margin-top:4px"></div>
    </div>
  `).join('');
}

function addCategoryInline() {
  if (!guard()) return;
  const container = document.getElementById('categoryFormArea');
  const row = document.createElement('div');
  row.className = 'inline-form-row';
  row.innerHTML = `
    <input type="text" class="inline-input" placeholder="分類名稱" data-field="name">
    <button class="btn btn-sm btn-primary" onclick="confirmAddCategory(this)">確認</button>
    <button class="btn btn-sm btn-secondary" onclick="this.closest('.inline-form-row').remove()">取消</button>
  `;
  container.appendChild(row);
  row.querySelector('[data-field="name"]').focus();
}

function confirmAddCategory(btn) {
  const row = btn.closest('.inline-form-row');
  const name = row.querySelector('[data-field="name"]').value.trim();
  if (!name) { row.querySelector('[data-field="name"]').focus(); return; }

  const id = name.toLowerCase().replace(/\s+/g, '_') + '_' + Date.now();
  menuData.categories.push({ id, name, sortOrder: menuData.categories.length + 1, items: [], addonIds: [] });
  row.remove();
  debounceSave();
  renderCategories();
}

function editCategoryInline(catId) {
  if (!guard()) return;
  const cat = menuData.categories.find(c => c.id === catId);
  if (!cat) return;
  const el = document.querySelector(`.category-item h3`);
  const header = el?.closest('.category-header');
  if (!header) return;

  header.dataset.origHtml = header.innerHTML;
  header.innerHTML = `
    <input type="text" class="inline-input" value="${cat.name}" data-field="name">
    <div class="category-actions">
      <button class="btn btn-sm btn-primary" onclick="confirmEditCategory(this,'${catId}')">確認</button>
      <button class="btn btn-sm btn-secondary" onclick="cancelCatEdit(this,'${catId}')">取消</button>
    </div>
  `;
  header.querySelector('[data-field="name"]').focus();
}

function confirmEditCategory(btn, catId) {
  const row = btn.closest('.category-header');
  const name = row.querySelector('[data-field="name"]').value.trim();
  if (!name) return;
  const cat = menuData.categories.find(c => c.id === catId);
  if (cat) cat.name = name;
  debounceSave();
  renderCategories();
}

function cancelCatEdit(btn) {
  renderCategories();
}

function deleteCategory(catId) {
  if (!guard()) return;
  if (!confirm('確定刪除此分類？')) return;
  menuData.categories = menuData.categories.filter(c => c.id !== catId);
  debounceSave();
  renderCategories();
}

function moveCategory(catId, direction) {
  if (!guard()) return;
  const idx = menuData.categories.findIndex(c => c.id === catId);
  const newIdx = idx + direction;
  if (newIdx < 0 || newIdx >= menuData.categories.length) return;
  [menuData.categories[idx], menuData.categories[newIdx]] = [menuData.categories[newIdx], menuData.categories[idx]];
  menuData.categories.forEach((c, i) => c.sortOrder = i + 1);
  debounceSave();
  renderCategories();
}

// ===== Items =====
function addItemInline(catId) {
  if (!guard()) return;
  const cat = menuData.categories.find(c => c.id === catId);
  if (!cat) return;
  const container = document.getElementById('itemFormArea_' + catId);
  if (!container) return;
  const row = document.createElement('div');
  row.className = 'inline-form-row';
  row.innerHTML = `
    <input type="text" class="inline-input" placeholder="品項名稱" data-field="name">
    <input type="number" class="inline-input inline-input-sm" placeholder="價格" value="0" data-field="price">
    <button class="btn btn-sm btn-primary" onclick="confirmAddItem(this,'${catId}')">確認</button>
    <button class="btn btn-sm btn-secondary" onclick="this.closest('.inline-form-row').remove()">取消</button>
  `;
  container.appendChild(row);
  row.querySelector('[data-field="name"]').focus();
}

function confirmAddItem(btn, catId) {
  const row = btn.closest('.inline-form-row');
  const name = row.querySelector('[data-field="name"]').value.trim();
  const price = parseInt(row.querySelector('[data-field="price"]').value) || 0;
  if (!name) { row.querySelector('[data-field="name"]').focus(); return; }

  const cat = menuData.categories.find(c => c.id === catId);
  if (cat) {
    if (!cat.items) cat.items = [];
    const id = name.toLowerCase().replace(/\s+/g, '_') + '_' + Date.now();
    cat.items.push({ id, name, price, enabled: true });
    debounceSave();
    renderCategories();
  }
}

function editItemInline(catId, itemId) {
  if (!guard()) return;
  const cat = menuData.categories.find(c => c.id === catId);
  const item = cat?.items?.find(i => i.id === itemId);
  if (!item) return;

  renderCategories();
  const catItems = document.querySelectorAll('.category-item');
  let targetCatEl = null;
  menuData.categories.forEach((c, i) => { if (c.id === catId) targetCatEl = catItems[i]; });
  if (!targetCatEl) return;

  const rows = targetCatEl.querySelectorAll('.item-row');
  let targetRow = null;
  (cat.items || []).forEach((it, i) => { if (it.id === itemId) targetRow = rows[i]; });
  if (!targetRow) return;

  targetRow.dataset.origHtml = targetRow.innerHTML;
  targetRow.innerHTML = `
    <div class="item-info" style="display:flex;gap:8px;align-items:center;flex:1">
      <input type="text" class="inline-input" value="${item.name}" data-field="name">
      <input type="number" class="inline-input inline-input-sm" value="${item.price}" data-field="price">
    </div>
    <div class="item-actions">
      <button class="btn btn-sm btn-primary" onclick="confirmEditItem(this,'${catId}','${itemId}')">確認</button>
      <button class="btn btn-sm btn-secondary" onclick="cancelEdit(this)">取消</button>
    </div>
  `;
  targetRow.querySelector('[data-field="name"]').focus();
}

function confirmEditItem(btn, catId, itemId) {
  const row = btn.closest('.item-row');
  const name = row.querySelector('[data-field="name"]').value.trim();
  const price = parseInt(row.querySelector('[data-field="price"]').value) || 0;
  if (!name) return;
  const cat = menuData.categories.find(c => c.id === catId);
  const item = cat?.items?.find(i => i.id === itemId);
  if (item) { item.name = name; item.price = price; }
  debounceSave();
  renderCategories();
}

function deleteItem(catId, itemId) {
  if (!guard()) return;
  if (!confirm('確定刪除此品項？')) return;
  const cat = menuData.categories.find(c => c.id === catId);
  if (cat) {
    cat.items = (cat.items || []).filter(i => i.id !== itemId);
    debounceSave();
    renderCategories();
  }
}

function toggleItemEnabled(catId, itemId) {
  if (!guard()) return;
  const cat = menuData.categories.find(c => c.id === catId);
  const item = cat?.items?.find(i => i.id === itemId);
  if (item) {
    item.enabled = !item.enabled;
    debounceSave();
    renderCategories();
  }
}

// ===== Category Addons =====
function addAddonToCategory(catId) {
  if (!guard()) return;
  const cat = menuData.categories.find(c => c.id === catId);
  if (!cat) return;
  const currentIds = cat.addonIds || [];

  if (menuData.addonLibrary.length === 0) {
    alert('配料庫為空，請先新增配料');
    return;
  }

  const modal = document.getElementById('addonPickerModal');
  const list = document.getElementById('addonPickerList');
  list.innerHTML = menuData.addonLibrary.map(addon => {
    const checked = currentIds.includes(addon.id) ? 'checked' : '';
    return `
      <label class="addon-picker-item">
        <input type="checkbox" value="${addon.id}" ${checked}>
        <span class="addon-picker-name">${addon.name}</span>
        <span class="addon-picker-price">$${addon.price}</span>
      </label>
    `;
  }).join('');

  modal.dataset.catId = catId;
  modal.style.display = 'flex';
}

function closeAddonPicker() {
  document.getElementById('addonPickerModal').style.display = 'none';
}

function saveAddonPicker() {
  const modal = document.getElementById('addonPickerModal');
  const catId = modal.dataset.catId;
  const cat = menuData.categories.find(c => c.id === catId);
  if (!cat) return;

  const checked = [];
  document.querySelectorAll('#addonPickerList input[type="checkbox"]:checked').forEach(cb => {
    checked.push(cb.value);
  });
  cat.addonIds = checked;
  debounceSave();
  renderCategories();
  closeAddonPicker();
}

function removeAddonFromCategory(catId, addonId) {
  if (!guard()) return;
  const cat = menuData.categories.find(c => c.id === catId);
  if (cat) {
    cat.addonIds = (cat.addonIds || []).filter(id => id !== addonId);
    debounceSave();
    renderCategories();
  }
}

// ===== Import/Export =====
function exportJSON() {
  if (!guard()) return;
  document.getElementById('jsonInput').value = JSON.stringify(menuData, null, 2);
}

function importJSON() {
  if (!guard()) return;
  try {
    const data = JSON.parse(document.getElementById('jsonInput').value);
    if (data.categories && data.addonLibrary) {
      menuData.categories = data.categories;
      menuData.addonLibrary = data.addonLibrary;
      debounceSave();
      renderAddonLibrary();
      renderCategories();
      alert('匯入成功');
    } else {
      alert('JSON 格式不正確');
    }
  } catch (e) {
    alert('JSON 解析失敗：' + e.message);
  }
}

function downloadTemplate() {
  const ws = XLSX.utils.aoa_to_sheet([
    ['分類名稱', '分類排序', '品項名稱', '品項價格', '配料名稱', '配料價格'],
    ['漢堡', 1, '豬肉漢堡', 65, '加蛋', 10],
    ['漢堡', 1, '牛肉漢堡', 75, '', ''],
    ['蛋餅', 2, '原味蛋餅', 35, '醬油膏', 0],
    ['飲料', 3, '紅茶', 25, '', '']
  ]);
  XLSX.writeFile(XLSX.utils.book_new(), '菜單範本.xlsx');
}

function handleExcelUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    const json = XLSX.utils.sheet_to_json(XLSX.read(new Uint8Array(e.target.result), { type: 'array' }).Sheets[XLSX.read(new Uint8Array(e.target.result), { type: 'array' }).SheetNames[0]]);
    const categories = {};
    const addonLibrary = [];
    json.forEach(row => {
      const catName = row['分類名稱'];
      const itemName = row['品項名稱'];
      if (!catName || !itemName) return;
      if (!categories[catName]) {
        categories[catName] = { id: catName.toLowerCase().replace(/\s+/g, '_'), name: catName, sortOrder: row['分類排序'] || 1, items: [], addonIds: [] };
      }
      const cat = categories[catName];
      if (!cat.items.find(i => i.name === itemName)) {
        cat.items.push({ id: itemName.toLowerCase().replace(/\s+/g, '_') + '_' + Date.now(), name: itemName, price: row['品項價格'] || 0, enabled: true });
      }
      const addonName = row['配料名稱'];
      if (addonName) {
        let addon = addonLibrary.find(a => a.name === addonName);
        if (!addon) {
          addon = { id: addonName.toLowerCase().replace(/\s+/g, '_') + '_' + Date.now(), name: addonName, price: row['配料價格'] || 0 };
          addonLibrary.push(addon);
        }
        if (!cat.addonIds.includes(addon.id)) cat.addonIds.push(addon.id);
      }
    });
    menuData.categories = Object.values(categories);
    menuData.addonLibrary = addonLibrary;
    debounceSave();
    renderAddonLibrary();
    renderCategories();
    alert('匯入成功');
  };
  reader.readAsArrayBuffer(file);
}

// ===== Save =====
async function saveMenu() {
  if (!guard()) return;
  try {
    await window.FirebaseCore.saveMenu(menuData);
    renderAddonLibrary();
    renderCategories();
  } catch (e) {
    console.error('Save failed:', e);
    alert('儲存失敗：' + e.message);
  }
}

document.addEventListener('DOMContentLoaded', initMenuAdmin);
