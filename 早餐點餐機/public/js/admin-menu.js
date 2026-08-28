let menuData = null;
let _dirty = false;
let _saveTimer = null;
let _loading = true;
let _selectedCatId = null;

function guard() {
  if (_loading || !menuData) {
    alert(_loading ? '資料載入中，請稍候...' : '菜單尚未載入，請重新整理');
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
    try { await window.FirebaseCore.saveMenu(menuData); } catch (e) { console.error('Auto-save failed:', e); }
  }, 500);
}

async function initMenuAdmin() {
  if (!window.AuthManager.requireAuth()) {
    document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;"><h1>密碼錯誤</h1></div>';
    return;
  }

  document.getElementById('loadingHint').style.display = 'block';
  window.FirebaseCore.init();
  menuData = await window.FirebaseCore.getMenu();
  if (!menuData.addonLibrary) menuData.addonLibrary = [];
  if (!menuData.categories) menuData.categories = [];

  window.ThemeManager.setCachedMenu(menuData);
  await window.ThemeManager.load();

  _loading = false;
  document.getElementById('loadingHint').style.display = 'none';
  document.getElementById('menuBody').style.display = 'grid';

  renderCategoryList();
  renderAddonLibList();

  // Auto-select first category
  if (menuData.categories.length > 0) {
    selectCategory(menuData.categories[0].id);
  }
  const shopId = window.APP_CONFIG.shopId;
  document.getElementById('linkBack').href = `admin.html?shop=${shopId}`;
}

// ===== Category List (Left Panel) =====
function renderCategoryList() {
  const container = document.getElementById('categoryList');
  if (menuData.categories.length === 0) {
    container.innerHTML = '<p style="color:var(--text-muted);padding:12px;font-size:14px">尚未新增分類</p>';
    return;
  }
  container.innerHTML = menuData.categories.map(cat => {
    const count = (cat.items || []).length;
    const active = cat.id === _selectedCatId ? ' active' : '';
    const addonNames = (cat.addonIds || []).map(id => {
      const a = (menuData.addonLibrary || []).find(x => x.id === id);
      return a ? a.name : '';
    }).filter(Boolean).join('、');
    return `
      <div class="cat-item${active}" draggable="true" data-cat-id="${cat.id}">
        <span class="drag-handle" title="拖曳排序">☰</span>
        <div class="cat-item-info">
          <span class="cat-item-name">${cat.name}</span>
          <span class="cat-item-count">${count} 項${addonNames ? ' ・ ' + addonNames : ''}</span>
        </div>
        <div class="cat-item-actions">
          <button class="icon-btn" onclick="event.stopPropagation();editCategoryInline('${cat.id}')" title="編輯">✎</button>
          <button class="icon-btn icon-btn-danger" onclick="event.stopPropagation();deleteCategory('${cat.id}')" title="刪除">✕</button>
        </div>
      </div>
    `;
  }).join('');
  initCategoryDrag();
}

function selectCategory(catId) {
  _selectedCatId = catId;
  const cat = menuData.categories.find(c => c.id === catId);
  if (!cat) return;

  document.getElementById('itemsTitle').textContent = cat.name;
  document.getElementById('btnAddItem').style.display = '';
  document.getElementById('btnSelectAddons').style.display = '';
  document.getElementById('itemFormArea').innerHTML = '';

  renderCategoryList();
  renderItemList();
}

function editCategoryAddons() {
  if (!guard() || !_selectedCatId) return;
  const cat = menuData.categories.find(c => c.id === _selectedCatId);
  if (!cat) return;
  const currentIds = cat.addonIds || [];

  if (menuData.addonLibrary.length === 0) {
    alert('配料庫為空，請先到下方配料庫新增配料');
    return;
  }

  const modal = document.getElementById('addonPickerModal');
  const list = document.getElementById('addonPickerList');
  list.innerHTML = menuData.addonLibrary.map(addon => {
    const checked = currentIds.includes(addon.id);
    return `
      <div class="addon-picker-item${checked ? ' checked' : ''}" data-addon-id="${addon.id}" onclick="this.classList.toggle('checked')">
        ${addon.name}
        ${addon.price > 0 ? '<span class="addon-picker-price">$' + addon.price + '</span>' : ''}
      </div>
    `;
  }).join('');

  modal.dataset.catId = _selectedCatId;
  modal.style.display = 'flex';
}

function addCategoryInline() {
  if (!guard()) return;
  const container = document.getElementById('categoryFormArea');
  container.innerHTML = '';
  const row = document.createElement('div');
  row.className = 'inline-form-row inline-form-col';
  row.innerHTML = `
    <input type="text" class="inline-input" placeholder="分類名稱" data-field="name">
    <div class="inline-form-actions">
      <button class="btn btn-sm btn-primary" onclick="confirmAddCategory(this)">確定</button>
      <button class="btn btn-sm btn-secondary" onclick="document.getElementById('categoryFormArea').innerHTML=''">取消</button>
    </div>
  `;
  container.appendChild(row);
  const inp = row.querySelector('[data-field="name"]');
  inp.focus();
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); confirmAddCategory(row.querySelector('.btn-primary')); } });
}

function confirmAddCategory(btn) {
  const row = btn.closest('.inline-form-row');
  const name = row.querySelector('[data-field="name"]').value.trim();
  if (!name) { row.querySelector('[data-field="name"]').focus(); return; }
  const id = name.toLowerCase().replace(/\s+/g, '_') + '_' + Date.now();
  menuData.categories.push({ id, name, sortOrder: menuData.categories.length + 1, items: [], addonIds: [] });
  row.remove();
  debounceSave();
  renderCategoryList();
}

function editCategoryInline(catId) {
  if (!guard()) return;
  const cat = menuData.categories.find(c => c.id === catId);
  if (!cat) return;
  const items = document.querySelectorAll('.cat-item');
  let target = null;
  menuData.categories.forEach((c, i) => { if (c.id === catId) target = items[i]; });
  if (!target) return;

  target.dataset.origHtml = target.innerHTML;
  target.innerHTML = `
    <div class="cat-item-info" style="flex:1">
      <input type="text" class="inline-input" value="${cat.name}" data-field="name" style="width:100%">
    </div>
    <div class="cat-item-actions">
      <button class="icon-btn" onclick="event.stopPropagation();confirmEditCategory(this,'${catId}')" title="確認">✓</button>
      <button class="icon-btn" onclick="event.stopPropagation();cancelEdit(this)" title="取消">✕</button>
    </div>
  `;
  target.querySelector('[data-field="name"]').focus();
}

function confirmEditCategory(btn, catId) {
  const row = btn.closest('.cat-item');
  const name = row.querySelector('[data-field="name"]').value.trim();
  if (!name) return;
  const cat = menuData.categories.find(c => c.id === catId);
  if (cat) cat.name = name;
  if (_selectedCatId === catId) document.getElementById('itemsTitle').textContent = name;
  debounceSave();
  renderCategoryList();
}

function cancelEdit(btn) {
  const row = btn.closest('.cat-item');
  if (row?.dataset.origHtml) {
    row.innerHTML = row.dataset.origHtml;
    delete row.dataset.origHtml;
  }
}

function deleteCategory(catId) {
  if (!guard()) return;
  if (!confirm('確定刪除此分類？')) return;
  menuData.categories = menuData.categories.filter(c => c.id !== catId);
  if (_selectedCatId === catId) {
    _selectedCatId = null;
    document.getElementById('itemsTitle').textContent = '請選擇左側分類';
    document.getElementById('btnAddItem').style.display = 'none';
    document.getElementById('itemList').innerHTML = '';
  }
  debounceSave();
  renderCategoryList();
}

function moveCategory(catId, direction) {
  if (!guard()) return;
  const idx = menuData.categories.findIndex(c => c.id === catId);
  const newIdx = idx + direction;
  if (newIdx < 0 || newIdx >= menuData.categories.length) return;
  [menuData.categories[idx], menuData.categories[newIdx]] = [menuData.categories[newIdx], menuData.categories[idx]];
  menuData.categories.forEach((c, i) => c.sortOrder = i + 1);
  debounceSave();
  renderCategoryList();
}

// ===== Item List (Right Panel) =====
function renderItemList() {
  const container = document.getElementById('itemList');
  const cat = menuData.categories.find(c => c.id === _selectedCatId);
  if (!cat) { container.innerHTML = ''; return; }
  const items = cat.items || [];
  if (items.length === 0) {
    container.innerHTML = '<p style="color:var(--text-muted);padding:12px;font-size:14px">此分類尚無品項</p>';
    return;
  }
  container.innerHTML = items.map(item => {
    const disabled = item.enabled === false;
    return `
      <div class="item-row${disabled ? ' item-disabled' : ''}" draggable="true" data-item-id="${item.id}">
        <span class="drag-handle" title="拖曳排序">☰</span>
        <div class="item-info">
          <span class="item-name">${item.name}</span>
          <span class="item-price">$${item.price}</span>
          ${disabled ? '<span class="item-badge-off">已下架</span>' : ''}
        </div>
        <div class="item-actions">
          <button class="btn btn-sm btn-secondary" onclick="editItemInline('${item.id}')">編輯</button>
          <button class="btn btn-sm btn-danger" onclick="deleteItem('${item.id}')">刪除</button>
          <button class="btn btn-sm btn-secondary" onclick="toggleItemEnabled('${item.id}')">${disabled ? '上架' : '下架'}</button>
        </div>
      </div>
    `;
  }).join('');
  initItemDrag();
}

function addItemInline() {
  if (!guard() || !_selectedCatId) return;
  const container = document.getElementById('itemFormArea');
  container.innerHTML = '';
  const row = document.createElement('div');
  row.className = 'inline-form-row';
  row.innerHTML = `
    <input type="text" class="inline-input" placeholder="蛋餅-30、漢堡-45（名稱-價格）" id="newItemInput" style="flex:1">
    <button class="btn btn-sm btn-primary" onclick="confirmAddItem()">確定</button>
    <button class="btn btn-sm btn-secondary" onclick="document.getElementById('itemFormArea').innerHTML=''">取消</button>
  `;
  container.appendChild(row);
  const inp = document.getElementById('newItemInput');
  inp.focus();
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); confirmAddItem(); } });
}

function confirmAddItem() {
  const raw = document.getElementById('newItemInput')?.value.trim();
  if (!raw) { document.getElementById('newItemInput')?.focus(); return; }

  const lines = raw.split(/[,，\n]+/).map(l => l.trim()).filter(Boolean);
  const cat = menuData.categories.find(c => c.id === _selectedCatId);
  if (!cat) return;
  if (!cat.items) cat.items = [];

  let added = 0;
  for (const line of lines) {
    const match = line.match(/^(.+?)[-－](\d+)$/);
    let name, price;
    if (match) {
      name = match[1].trim();
      price = parseInt(match[2]) || 0;
    } else {
      name = line;
      price = 0;
    }
    if (!name) continue;
    const id = name.toLowerCase().replace(/\s+/g, '_') + '_' + Date.now() + '_' + Math.random().toString(36).slice(2,5);
    cat.items.push({ id, name, price, enabled: true });
    added++;
  }

  document.getElementById('itemFormArea').innerHTML = '';
  if (added > 0) {
    debounceSave();
    renderCategoryList();
    renderItemList();
  }
}

function editItemInline(itemId) {
  if (!guard()) return;
  const cat = menuData.categories.find(c => c.id === _selectedCatId);
  const item = cat?.items?.find(i => i.id === itemId);
  if (!item) return;

  renderItemList();
  const rows = document.querySelectorAll('#itemList .item-row');
  let target = null;
  (cat.items || []).forEach((it, i) => { if (it.id === itemId) target = rows[i]; });
  if (!target) return;

  target.dataset.origHtml = target.innerHTML;
  target.innerHTML = `
    <div class="item-info" style="display:flex;gap:8px;align-items:center;flex:1">
      <input type="text" class="inline-input" value="${item.name}" data-field="name" style="flex:1">
      <input type="number" class="inline-input inline-input-sm" value="${item.price}" data-field="price">
    </div>
    <div class="item-actions">
      <button class="btn btn-sm btn-primary" onclick="confirmEditItem(this,'${itemId}')">✓</button>
      <button class="btn btn-sm btn-secondary" onclick="renderItemList()">✕</button>
    </div>
  `;
  target.querySelector('[data-field="name"]').focus();
}

function confirmEditItem(btn, itemId) {
  const row = btn.closest('.item-row');
  const name = row.querySelector('[data-field="name"]').value.trim();
  const price = parseInt(row.querySelector('[data-field="price"]').value) || 0;
  if (!name) return;
  const cat = menuData.categories.find(c => c.id === _selectedCatId);
  const item = cat?.items?.find(i => i.id === itemId);
  if (item) { item.name = name; item.price = price; }
  debounceSave();
  renderItemList();
}

function deleteItem(itemId) {
  if (!guard()) return;
  if (!confirm('確定刪除此品項？')) return;
  const cat = menuData.categories.find(c => c.id === _selectedCatId);
  if (cat) { cat.items = (cat.items || []).filter(i => i.id !== itemId); }
  debounceSave();
  renderCategoryList();
  renderItemList();
}

function toggleItemEnabled(itemId) {
  if (!guard()) return;
  const cat = menuData.categories.find(c => c.id === _selectedCatId);
  const item = cat?.items?.find(i => i.id === itemId);
  if (item) { item.enabled = !item.enabled; debounceSave(); renderItemList(); }
}

// ===== Item Addons (per-category) =====
function editItemAddons(itemId) {
  if (!guard()) return;
  const cat = menuData.categories.find(c => c.id === _selectedCatId);
  if (!cat) return;
  const currentIds = cat.addonIds || [];

  if (menuData.addonLibrary.length === 0) {
    alert('配料庫為空，請先到配料庫新增配料');
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

  modal.dataset.catId = _selectedCatId;
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
  document.querySelectorAll('#addonPickerList .addon-picker-item.checked').forEach(el => {
    const id = el.dataset.addonId;
    if (id) checked.push(id);
  });
  cat.addonIds = checked;
  debounceSave();
  closeAddonPicker();
}

// ===== Addon Library (inline) =====

let _addonEditMode = false;

function toggleAddonEditMode() {
  _addonEditMode = !_addonEditMode;
  const btn = document.getElementById('btnToggleAddonEdit');
  btn.textContent = _addonEditMode ? '完成' : '編輯・刪除';
  btn.classList.toggle('btn-primary', _addonEditMode);
  btn.classList.toggle('btn-secondary', !_addonEditMode);
  renderAddonLibList();
}

function renderAddonLibList() {
  const container = document.getElementById('addonLibList');
  if (menuData.addonLibrary.length === 0) {
    container.innerHTML = '<span style="color:var(--text-muted);font-size:13px">尚無配料</span>';
    return;
  }
  container.innerHTML = menuData.addonLibrary.map(addon => `
    <span class="addon-chip${_addonEditMode ? ' addon-chip-draggable' : ''}" draggable="${_addonEditMode}" data-addon-id="${addon.id}">
      ${_addonEditMode ? '<span class="drag-handle" title="拖曳排序">☰</span>' : ''}
      <span class="addon-chip-text">${addon.name} $${addon.price}</span>
      ${_addonEditMode ? `
        <button class="addon-chip-edit" onclick="event.stopPropagation();editAddonLib('${addon.id}')" title="編輯">✎</button>
        <button class="addon-chip-del" onclick="event.stopPropagation();deleteAddonLib('${addon.id}')" title="刪除">✕</button>
      ` : ''}
    </span>
  `).join('');
  if (_addonEditMode) initAddonDrag();
}

function initAddonDrag() {
  let dragAddonId = null;
  const chips = document.querySelectorAll('#addonLibList .addon-chip-draggable[draggable]');
  chips.forEach(chip => {
    chip.addEventListener('dragstart', e => {
      dragAddonId = chip.dataset.addonId;
      chip.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    chip.addEventListener('dragend', () => {
      chip.classList.remove('dragging');
      document.querySelectorAll('#addonLibList .addon-chip').forEach(c => c.classList.remove('drag-over'));
      dragAddonId = null;
    });
    chip.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (chip.dataset.addonId !== dragAddonId) chip.classList.add('drag-over');
    });
    chip.addEventListener('dragleave', () => chip.classList.remove('drag-over'));
    chip.addEventListener('drop', e => {
      e.preventDefault();
      chip.classList.remove('drag-over');
      if (!dragAddonId || chip.dataset.addonId === dragAddonId) return;
      const fromIdx = menuData.addonLibrary.findIndex(a => a.id === dragAddonId);
      const toIdx = menuData.addonLibrary.findIndex(a => a.id === chip.dataset.addonId);
      if (fromIdx < 0 || toIdx < 0) return;
      const [moved] = menuData.addonLibrary.splice(fromIdx, 1);
      menuData.addonLibrary.splice(toIdx, 0, moved);
      debounceSave();
      renderAddonLibList();
    });
  });
}

function addAddonFromModal() {
  const raw = document.getElementById('newAddonName').value.trim();
  if (!raw) { document.getElementById('newAddonName').focus(); return; }

  const lines = raw.split(/[,，\n]+/).map(l => l.trim()).filter(Boolean);
  let added = 0;

  for (const line of lines) {
    const match = line.match(/^(.+?)[-－](\d+)$/);
    if (match) {
      const name = match[1].trim();
      const price = parseInt(match[2]) || 0;
      if (!name) continue;
      const id = name.toLowerCase().replace(/\s+/g, '_') + '_' + Date.now() + '_' + Math.random().toString(36).slice(2,5);
      menuData.addonLibrary.push({ id, name, price });
      added++;
    } else {
      const name = line;
      const id = name.toLowerCase().replace(/\s+/g, '_') + '_' + Date.now() + '_' + Math.random().toString(36).slice(2,5);
      menuData.addonLibrary.push({ id, name, price: 0 });
      added++;
    }
  }

  document.getElementById('newAddonName').value = '';
  if (added > 0) {
    debounceSave();
    renderAddonLibList();
  }
}

function editAddonLib(addonId) {
  const addon = menuData.addonLibrary.find(a => a.id === addonId);
  if (!addon) return;
  const newName = prompt('配料名稱', addon.name);
  if (newName === null) return;
  const newPriceStr = prompt('價格', addon.price);
  if (newPriceStr === null) return;
  const name = newName.trim();
  const price = parseInt(newPriceStr) || 0;
  if (!name) return;
  addon.name = name;
  addon.price = price;
  debounceSave();
  renderAddonLibList();
  renderItemList();
}

function deleteAddonLib(addonId) {
  if (!confirm('確定刪除此配料？')) return;
  menuData.addonLibrary = menuData.addonLibrary.filter(a => a.id !== addonId);
  menuData.categories.forEach(cat => {
    cat.addonIds = (cat.addonIds || []).filter(id => id !== addonId);
  });
  debounceSave();
  renderAddonLibList();
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
    } else if (data.items && Array.isArray(data.items)) {
      const catMap = {};
      data.items.forEach(item => {
        const catName = item.category || '未分類';
        if (!catMap[catName]) {
          catMap[catName] = { id: catName.toLowerCase().replace(/\s+/g, '_'), name: catName, sortOrder: Object.keys(catMap).length + 1, items: [], addonIds: [] };
        }
        catMap[catName].items.push({
          id: item.name.toLowerCase().replace(/\s+/g, '_') + '_' + Math.random().toString(36).slice(2,6),
          name: item.name,
          price: item.price || 0,
          enabled: true
        });
      });
      menuData.categories = Object.values(catMap);
      menuData.addonLibrary = menuData.addonLibrary || [];
      if (data.title) menuData.storeName = data.title;
      if (data.subtitle) menuData.subtitle = data.subtitle;
    } else {
      alert('JSON 格式不正確，需要包含 items 陣列或 categories + addonLibrary');
      return;
    }

    _selectedCatId = null;
    debounceSave();
    renderCategoryList();
    renderAddonLibList();
    document.getElementById('itemList').innerHTML = '';
    document.getElementById('itemsTitle').textContent = '請選擇左側分類';
    document.getElementById('btnAddItem').style.display = 'none';
    alert('匯入成功');
  } catch (e) { alert('JSON 解析失敗：' + e.message); }
}

function downloadTemplate() {
  const ws = XLSX.utils.aoa_to_sheet([
    ['分類名稱', '分類排序', '品項名稱', '品項價格', '配料名稱', '配料價格'],
    ['漢堡', 1, '豬肉漢堡', 65, '加蛋', 10],
    ['漢堡', 1, '牛肉漢堡', 75, '', ''],
    ['飲料', 3, '紅茶', 25, '', '']
  ]);
  XLSX.writeFile(XLSX.utils.book_new(), '菜單範本.xlsx');
}

function handleExcelUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    const raw = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
    const json = XLSX.utils.sheet_to_json(raw.Sheets[raw.SheetNames[0]]);
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
        if (!addon) { addon = { id: addonName.toLowerCase().replace(/\s+/g, '_') + '_' + Date.now(), name: addonName, price: row['配料價格'] || 0 }; addonLibrary.push(addon); }
        if (!cat.addonIds.includes(addon.id)) cat.addonIds.push(addon.id);
      }
    });
    menuData.categories = Object.values(categories);
    menuData.addonLibrary = addonLibrary;
    _selectedCatId = null;
    debounceSave();
    renderCategoryList();
    alert('匯入成功');
  };
  reader.readAsArrayBuffer(file);
}

// ===== Drag & Drop - Items =====
let _dragItemId = null;

function initItemDrag() {
  const rows = document.querySelectorAll('#itemList .item-row[draggable]');
  rows.forEach(row => {
    row.addEventListener('dragstart', e => {
      _dragItemId = row.dataset.itemId;
      row.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    row.addEventListener('dragend', () => {
      row.classList.remove('dragging');
      document.querySelectorAll('#itemList .item-row').forEach(r => r.classList.remove('drag-over'));
      _dragItemId = null;
    });
    row.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (row.dataset.itemId !== _dragItemId) row.classList.add('drag-over');
    });
    row.addEventListener('dragleave', () => row.classList.remove('drag-over'));
    row.addEventListener('drop', e => {
      e.preventDefault();
      row.classList.remove('drag-over');
      if (!_dragItemId || row.dataset.itemId === _dragItemId) return;
      const cat = menuData.categories.find(c => c.id === _selectedCatId);
      if (!cat || !cat.items) return;
      const fromIdx = cat.items.findIndex(i => i.id === _dragItemId);
      const toIdx = cat.items.findIndex(i => i.id === row.dataset.itemId);
      if (fromIdx < 0 || toIdx < 0) return;
      const [moved] = cat.items.splice(fromIdx, 1);
      cat.items.splice(toIdx, 0, moved);
      debounceSave();
      renderItemList();
    });
  });
}

// ===== Drag & Drop - Categories =====
let _dragCatId = null;

function initCategoryDrag() {
  const items = document.querySelectorAll('#categoryList .cat-item[draggable]');
  items.forEach(el => {
    el.addEventListener('click', e => {
      if (e.target.closest('.icon-btn') || e.target.closest('.drag-handle')) return;
      selectCategory(el.dataset.catId);
    });
    el.addEventListener('dragstart', e => {
      _dragCatId = el.dataset.catId;
      el.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    el.addEventListener('dragend', () => {
      el.classList.remove('dragging');
      document.querySelectorAll('#categoryList .cat-item').forEach(c => c.classList.remove('drag-over'));
      _dragCatId = null;
    });
    el.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (el.dataset.catId !== _dragCatId) el.classList.add('drag-over');
    });
    el.addEventListener('dragleave', () => el.classList.remove('drag-over'));
    el.addEventListener('drop', e => {
      e.preventDefault();
      el.classList.remove('drag-over');
      if (!_dragCatId || el.dataset.catId === _dragCatId) return;
      const fromIdx = menuData.categories.findIndex(c => c.id === _dragCatId);
      const toIdx = menuData.categories.findIndex(c => c.id === el.dataset.catId);
      if (fromIdx < 0 || toIdx < 0) return;
      const [moved] = menuData.categories.splice(fromIdx, 1);
      menuData.categories.splice(toIdx, 0, moved);
      debounceSave();
      renderCategoryList();
    });
  });
}

document.addEventListener('DOMContentLoaded', initMenuAdmin);
