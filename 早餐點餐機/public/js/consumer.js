// State
let menuData = null;
let selectedCategory = null;
let activeItems = {};  // { itemId: { item, addons: [], quantity } }
let dineType = null;   // 'dine' | 'takeout' | null
let editingCartKey = null;

// Initialize
async function initConsumer() {
  try {
    // Initialize Firebase
    window.FirebaseCore.init();
    window.StatsTracker.init();

    // Load menu
    menuData = await window.FirebaseCore.getMenu();
    window.StatsTracker.trackRead();

    // Apply theme
    await window.ThemeManager.load();

    // Render
    document.getElementById('storeName').textContent = menuData.storeName;
    document.getElementById('storeSubtitle').textContent = menuData.subtitle;
    renderCategories();
    renderCart();

    // Listen for cart updates
    window.addEventListener('cart-updated', () => renderCart());
  } catch (e) {
    console.error('Failed to initialize:', e);
    document.getElementById('storeName').textContent = '載入失敗';
  }
}

// Render categories
function renderCategories() {
  const container = document.getElementById('categories');
  container.innerHTML = menuData.categories.map((cat, i) => `
    <button class="category-btn ${i === 0 ? 'active' : ''}"
            onclick="selectCategory('${cat.id}')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        ${getCategoryIcon(cat.id)}
      </svg>
      ${cat.name}
    </button>
  `).join('');

  // Select first category
  if (menuData.categories.length > 0) {
    selectCategory(menuData.categories[0].id);
  }
}

// Category icons (simple SVG)
function getCategoryIcon(catId) {
  const icons = {
    burger: '<rect x="2" y="8" width="20" height="12" rx="2"/><path d="M6 8V6a6 6 0 0 1 12 0v2"/>',
    egg_pancake: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/>',
    drink: '<path d="M8 2h8l-2 18H10L8 2z"/><path d="M6 2h12"/>',
    default: '<rect x="3" y="3" width="18" height="18" rx="2"/>'
  };
  return icons[catId] || icons.default;
}

// Select category
function selectCategory(catId) {
  selectedCategory = menuData.categories.find(c => c.id === catId);
  if (!selectedCategory) return;

  // Update active state
  document.querySelectorAll('.category-btn').forEach(btn => {
    btn.classList.toggle('active', btn.textContent.trim().includes(selectedCategory.name));
  });

  renderItems();
  renderAddons();
}

// Render items
function renderItems() {
  const container = document.getElementById('itemsGrid');
  container.innerHTML = selectedCategory.items.map(item => {
    const state = getItemState(item.id);
    const count = getItemCount(item.id);
    return `
      <div class="item-card ${state}" onclick="toggleItem('${item.id}')">
        ${state === 'active' ? '<button class="cancel-btn" onclick="event.stopPropagation(); cancelItem(\'' + item.id + '\')">×</button>' : ''}
        ${count > 0 ? '<div class="item-count">X' + count + '</div>' : ''}
        <div class="item-name">${item.name}</div>
        <div class="item-price">$${item.price}</div>
      </div>
    `;
  }).join('');
}

// Get item state
function getItemState(itemId) {
  const state = activeItems[itemId];
  if (!state) return '';
  if (state.quantity === 0) return '';
  if (state.isActive) return 'active';
  return 'selected';
}

// Get item count
function getItemCount(itemId) {
  const state = activeItems[itemId];
  return state ? state.quantity : 0;
}

// Toggle item
function toggleItem(itemId) {
  const item = selectedCategory.items.find(i => i.id === itemId);
  if (!item) return;

  if (!activeItems[itemId]) {
    // First click - make active
    activeItems[itemId] = {
      item,
      addons: [],
      quantity: 1,
      isActive: true
    };
  } else if (activeItems[itemId].isActive) {
    // Click on active - make selected
    activeItems[itemId].isActive = false;
  } else {
    // Click on selected - make active
    // Deactivate previous active
    Object.keys(activeItems).forEach(id => {
      if (activeItems[id].isActive) activeItems[id].isActive = false;
    });
    activeItems[itemId].isActive = true;
  }

  renderItems();
  renderAddons();
}

// Cancel item
function cancelItem(itemId) {
  delete activeItems[itemId];
  renderItems();
  renderAddons();
}

// Render addons
function renderAddons() {
  const container = document.getElementById('addonButtons');
  const label = document.getElementById('addonLabel');

  // Find active item
  const activeEntry = Object.values(activeItems).find(a => a.isActive);
  if (!activeEntry) {
    container.innerHTML = '<span style="color:var(--text-muted)">請先選擇品項</span>';
    label.textContent = '配料';
    return;
  }

  label.textContent = `配料（${activeEntry.item.name}）`;

  // Get addons for current category
  const categoryAddons = menuData.addonLibrary.filter(a =>
    selectedCategory.addonIds.includes(a.id)
  );

  container.innerHTML = categoryAddons.map(addon => {
    const isActive = activeEntry.addons.some(a => a.id === addon.id);
    return `
      <button class="addon-btn ${isActive ? 'active' : ''}"
              onclick="toggleAddon('${addon.id}')">
        ${addon.name}
        ${addon.price > 0 ? '<span class="addon-price">+$' + addon.price + '</span>' : ''}
      </button>
    `;
  }).join('');
}

// Toggle addon
function toggleAddon(addonId) {
  const activeEntry = Object.values(activeItems).find(a => a.isActive);
  if (!activeEntry) return;

  const addon = menuData.addonLibrary.find(a => a.id === addonId);
  if (!addon) return;

  const existingIndex = activeEntry.addons.findIndex(a => a.id === addonId);
  if (existingIndex >= 0) {
    activeEntry.addons.splice(existingIndex, 1);
  } else {
    activeEntry.addons.push(addon);
  }

  renderAddons();
}

// Add to cart
function addToCart() {
  Object.values(activeItems).forEach(entry => {
    if (entry.quantity > 0) {
      window.CartManager.addItem(entry.item, entry.addons, entry.quantity);
    }
  });

  // Clear active items
  activeItems = {};
  renderItems();
  renderAddons();
}

// Render cart
function renderCart() {
  const items = window.CartManager.getItems();
  const container = document.getElementById('cartItems');
  const totalEl = document.getElementById('cartTotal');

  container.innerHTML = items.map(item => {
    const addonText = item.addons.map(a => a.name).join(' + ');
    return `
      <div class="cart-item" onclick="editCartItem('${item.key}')">
        <div class="cart-item-info">
          <div class="cart-item-name">${item.name} ${addonText ? '+' + addonText : ''}</div>
        </div>
        <div class="cart-item-qty">
          <button onclick="event.stopPropagation(); changeQty('${item.key}', -1)">-</button>
          <span>X${item.quantity}</span>
          <button onclick="event.stopPropagation(); changeQty('${item.key}', 1)">+</button>
        </div>
      </div>
    `;
  }).join('');

  totalEl.textContent = `$${window.CartManager.getTotal()}`;

  // Update confirm button state
  document.getElementById('btnConfirm').disabled = items.length === 0;
}

// Change quantity
function changeQty(key, delta) {
  const items = window.CartManager.getItems();
  const item = items.find(i => i.key === key);
  if (item) {
    window.CartManager.updateQuantity(key, item.quantity + delta);
  }
}

// Edit cart item (expand details)
function editCartItem(key) {
  editingCartKey = key;
  const items = window.CartManager.getItems();
  const item = items.find(i => i.key === key);
  if (!item) return;

  document.getElementById('cartEditTitle').textContent = `編輯 ${item.name}`;

  // Find the category for this item
  let category = null;
  for (const cat of menuData.categories) {
    if (cat.items.some(i => i.id === item.id)) {
      category = cat;
      break;
    }
  }

  const addonContainer = document.getElementById('cartEditAddons');
  if (!category || category.addonIds.length === 0) {
    addonContainer.innerHTML = '<p style="color:var(--text-muted)">此品項無配料可選</p>';
  } else {
    const availableAddons = menuData.addonLibrary.filter(a => category.addonIds.includes(a.id));
    addonContainer.innerHTML = availableAddons.map(addon => {
      const isActive = item.addons.some(a => a.id === addon.id);
      return `
        <button class="cart-edit-addon ${isActive ? 'active' : ''}"
                onclick="this.classList.toggle('active')"
                data-addon-id="${addon.id}"
                data-addon-name="${addon.name}"
                data-addon-price="${addon.price}">
          ${addon.name} ${addon.price > 0 ? '+$' + addon.price : ''}
        </button>
      `;
    }).join('');
  }

  document.getElementById('cartEditModal').style.display = 'flex';
}

function closeCartEdit() {
  document.getElementById('cartEditModal').style.display = 'none';
  editingCartKey = null;
}

function saveCartEdit() {
  if (!editingCartKey) return;

  const items = window.CartManager.getItems();
  const item = items.find(i => i.key === editingCartKey);
  if (!item) return;

  // Get selected addons
  const selectedAddons = [];
  document.querySelectorAll('.cart-edit-addon.active').forEach(btn => {
    selectedAddons.push({
      id: btn.dataset.addonId,
      name: btn.dataset.addonName,
      price: parseInt(btn.dataset.addonPrice)
    });
  });

  // Update item addons
  item.addons = selectedAddons;

  // Update key
  const addonKey = selectedAddons.map(a => a.id).sort().join('+');
  item.key = `${item.id}_${addonKey}`;

  // Check for duplicate keys
  const otherItems = items.filter(i => i.key !== editingCartKey && i.key === item.key);
  if (otherItems.length > 0) {
    // Merge quantities
    otherItems[0].quantity += item.quantity;
    window.CartManager.removeItem(editingCartKey);
  } else {
    window.CartManager.saveItems(items);
  }

  closeCartEdit();
}

// Dine type selection
function selectDineType(type) {
  dineType = type;
  document.getElementById('btnDineIn').classList.toggle('active', type === 'dine');
  document.getElementById('btnTakeout').classList.toggle('active', type === 'takeout');
}

// Confirm order
function confirmOrder() {
  if (window.CartManager.getCount() === 0) return;

  // Check dine type
  if (!dineType) {
    // Show prompt
    const type = prompt('請選擇：1 = 內用，2 = 外帶');
    if (type === '1') dineType = 'dine';
    else if (type === '2') dineType = 'takeout';
    else return;
  }

  // Show modal
  const items = window.CartManager.getItems();
  const modalItems = document.getElementById('modalItems');
  const modalTotal = document.getElementById('modalTotal');
  const modalDineType = document.getElementById('modalDineType');

  modalDineType.textContent = dineType === 'dine' ? '內用' : '外帶';
  modalItems.innerHTML = items.map(item => {
    const addonText = item.addons.map(a => a.name).join(' + ');
    const itemTotal = (item.price + item.addons.reduce((s, a) => s + a.price, 0)) * item.quantity;
    return `
      <div class="modal-item">
        <span>${item.name} ${addonText ? '+' + addonText : ''} X${item.quantity}</span>
        <span>$${itemTotal}</span>
      </div>
    `;
  }).join('');

  modalTotal.textContent = `總計: $${window.CartManager.getTotal()}`;
  document.getElementById('orderModal').style.display = 'flex';
}

// Close modal
function closeModal() {
  document.getElementById('orderModal').style.display = 'none';
}

// Submit order
async function submitOrder() {
  const items = window.CartManager.getItems();
  const orderData = {
    items,
    total: window.CartManager.getTotal(),
    dineType,
    itemCount: window.CartManager.getCount(),
    timestamp: new Date().toISOString()
  };

  try {
    await window.FirebaseCore.saveOrder(orderData);
    window.CartManager.clear();
    closeModal();
    alert('訂單已送出！');
    dineType = null;
    document.getElementById('btnDineIn').classList.remove('active');
    document.getElementById('btnTakeout').classList.remove('active');
  } catch (e) {
    console.error('Failed to submit order:', e);
    alert('訂單送出失敗，請重試');
  }
}

// Printer (placeholder)
function openPrinter() {
  alert('功能尚未開啟');
}

// Initialize on load
document.addEventListener('DOMContentLoaded', initConsumer);
