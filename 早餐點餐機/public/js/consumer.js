let menuData = null;
let selectedCategory = null;
let activeItems = {};
let dineType = null;
let editingCartKey = null;

function applyScrollMode() {
  const scrollMode = localStorage.getItem('sk-scroll-mode') === '1';
  document.body.classList.toggle('scroll-mode', scrollMode);
  document.querySelector('.consumer-container')?.classList.toggle('scroll-mode', scrollMode);
  const btn = document.getElementById('modeToggle');
  if (btn) {
    btn.classList.toggle('active', scrollMode);
    btn.textContent = scrollMode ? '固定' : '滑動';
  }
}

function toggleScrollMode() {
  const current = localStorage.getItem('sk-scroll-mode') === '1';
  localStorage.setItem('sk-scroll-mode', current ? '0' : '1');
  applyScrollMode();
}

async function initConsumer() {
  try {
    window.FirebaseCore.init();
    window.StatsTracker.init();
    applyScrollMode();

    menuData = await window.FirebaseCore.getMenu();
    window.StatsTracker.trackRead();

    window.ThemeManager.setCachedMenu(menuData);
    await window.ThemeManager.load();

    document.getElementById('storeName').innerHTML = `<span>//</span> ${menuData.storeName}`;
    document.getElementById('adminLink').href = `admin.html?shop=${window.APP_CONFIG.shopId}`;

    if (menuData.categories.length === 0) {
      document.getElementById('itemsGrid').innerHTML =
        '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text-muted)">' +
        '<p style="font-size:18px;margin-bottom:8px">尚無菜單</p>' +
        '<p>請到後台管理新增分類與品項</p></div>';
      document.getElementById('categories').innerHTML = '';
      document.getElementById('addonBar').style.display = 'none';
      return;
    }

    renderCategories();
    renderCart();
    loadTodayOrders();

    window.addEventListener('cart-updated', () => { renderCart(); renderItems(); });
  } catch (e) {
    console.error('Failed to initialize:', e);
    document.getElementById('storeName').textContent = '載入失敗';
  }
}

function renderCategories() {
  const container = document.getElementById('categories');
  container.innerHTML = menuData.categories.map((cat, i) => `
    <button class="category-btn ${i === 0 ? 'active' : ''}"
            onclick="selectCategory('${cat.id}')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        ${getCategoryIcon(cat.id)}
      </svg>
      <span class="cat-label">${cat.name}</span>
    </button>
  `).join('');

  if (menuData.categories.length > 0) {
    selectCategory(menuData.categories[0].id);
  }
}

function getCategoryIcon(catId) {
  const icons = {
    burger: '<rect x="2" y="8" width="20" height="12" rx="2"/><path d="M6 8V6a6 6 0 0 1 12 0v2"/>',
    egg_pancake: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/>',
    drink: '<path d="M8 2h8l-2 18H10L8 2z"/><path d="M6 2h12"/>',
    default: '<rect x="3" y="3" width="18" height="18" rx="2"/>'
  };
  return icons[catId] || icons.default;
}

function selectCategory(catId) {
  selectedCategory = menuData.categories.find(c => c.id === catId);
  if (!selectedCategory) return;

  document.querySelectorAll('.category-btn').forEach(btn => {
    btn.classList.toggle('active', btn.textContent.trim().includes(selectedCategory.name));
  });

  renderItems();
  renderAddons();
}

let lastClickedItemId = null;

function getCartQty(itemId) {
  const cartItems = window.CartManager.getItems();
  let qty = 0;
  cartItems.forEach(ci => { if (ci.id === itemId) qty += ci.quantity; });
  return qty;
}

function getCartItemAddons(itemId) {
  const cartItems = window.CartManager.getItems();
  const last = [...cartItems].reverse().find(ci => ci.id === itemId);
  if (!last || last.addons.length === 0) return '';
  return last.addons.map(a => '+' + a.name + (a.price > 0 ? ' $' + a.price : '')).join(' ');
}

function renderItems() {
  const container = document.getElementById('itemsGrid');
  if (!selectedCategory) return;
  const enabledItems = selectedCategory.items.filter(item => item.enabled !== false);
  if (enabledItems.length === 0) {
    container.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:24px;color:var(--text-muted)">此分類無可用品項</div>';
    return;
  }
  container.innerHTML = enabledItems.map(item => {
    const qty = getCartQty(item.id);
    const inCart = qty > 0;
    const isLast = item.id === lastClickedItemId;
    const itemAddons = getCartItemAddons(item.id);
    return `
      <div class="item-card${inCart ? ' in-cart' : ''}${isLast ? ' last-clicked' : ''}" onclick="clickItem('${item.id}')">
        <button class="cancel-btn" onclick="event.stopPropagation(); removeItemFromCart('${item.id}')">✕</button>
        ${inCart ? '<div class="item-count">' + qty + '</div>' : ''}
        <div class="item-name">${item.name}</div>
        <div class="item-price">$${item.price}</div>
        ${itemAddons ? '<div class="item-addons">' + itemAddons + '</div>' : ''}
      </div>
    `;
  }).join('');
}

function clickItem(itemId) {
  if (!selectedCategory) return;
  const item = selectedCategory.items.find(i => i.id === itemId);
  if (!item) return;
  lastClickedItemId = itemId;
  window.CartManager.addItem(item, [], 1);
}

function removeItemFromCart(itemId) {
  const items = window.CartManager.getItems();
  items.forEach(ci => {
    if (ci.id === itemId) window.CartManager.removeItem(ci.key);
  });
}

function clearCart() {
  if (window.CartManager.getCount() === 0) return;
  if (!confirm('確定清除購物車？')) return;
  window.CartManager.clear();
}

function renderAddons() {
  const container = document.getElementById('addonButtons');
  const label = document.getElementById('addonLabel');

  if (!selectedCategory || selectedCategory.addonIds.length === 0) {
    container.innerHTML = '<span style="color:var(--text-muted)">此分類無配料</span>';
    label.textContent = '配料';
    return;
  }

  label.textContent = `配料（${selectedCategory.name}）`;

  const categoryAddons = menuData.addonLibrary.filter(a =>
    selectedCategory.addonIds.includes(a.id)
  );

  container.innerHTML = categoryAddons.map(addon => `
    <button class="addon-btn" onclick="addAddonToCart('${addon.id}')">
      ${addon.name}
      ${addon.price > 0 ? '<span class="addon-price">+$' + addon.price + '</span>' : ''}
    </button>
  `).join('');
}

function addAddonToCart(addonId) {
  const addon = menuData.addonLibrary.find(a => a.id === addonId);
  if (!addon || !selectedCategory) return;

  const cartItems = window.CartManager.getItems();
  const lastItem = [...cartItems].reverse().find(ci => {
    return selectedCategory.items.some(mi => mi.id === ci.id);
  });

  if (!lastItem) {
    alert('請先選擇品項');
    return;
  }

  const item = selectedCategory.items.find(i => i.id === lastItem.id);
  if (!item) return;

  window.CartManager.removeItem(lastItem.key);
  const existingAddons = lastItem.addons.filter(a => a.id !== addonId);
  const alreadyHas = lastItem.addons.some(a => a.id === addonId);
  const newAddons = alreadyHas ? existingAddons : [...existingAddons, addon];
  window.CartManager.addItem(item, newAddons, lastItem.quantity);
}

function renderCart() {
  const items = window.CartManager.getItems();
  const container = document.getElementById('cartItems');
  const totalEl = document.getElementById('cartTotal');
  const countEl = document.getElementById('cartCount');

  container.innerHTML = items.map(item => {
    const addonText = item.addons.map(a => a.name).join(' + ');
    const addonPrice = item.addons.reduce((s, a) => s + a.price, 0);
    const unitPrice = item.price + addonPrice;
    const itemTotal = unitPrice * item.quantity;
    return `
      <div class="cart-item" onclick="editCartItem('${item.key}')">
        <div class="cart-item-top">
          <span class="cart-item-name">${item.name}</span>
          <div class="cart-item-qty">
            <button class="qty-btn minus" onclick="event.stopPropagation(); changeQty('${item.key}', -1)">-</button>
            <span class="qty-num">${item.quantity}</span>
            <button class="qty-btn" onclick="event.stopPropagation(); changeQty('${item.key}', 1)">+</button>
          </div>
        </div>
        ${item.addons.length > 0 ? '<div class="cart-item-addons">' + item.addons.map(a => '<span class="cart-addon-tag">+ ' + a.name + (a.price > 0 ? ' $' + a.price : '') + '</span>').join('') + '</div>' : ''}
        <div class="cart-item-price">$${itemTotal}</div>
      </div>
    `;
  }).join('');

  const totalCount = items.reduce((s, i) => s + i.quantity, 0);
  if (countEl) countEl.textContent = totalCount;
  totalEl.textContent = `$${window.CartManager.getTotal()}`;
  document.getElementById('btnConfirm').disabled = items.length === 0;
}

function changeQty(key, delta) {
  const items = window.CartManager.getItems();
  const item = items.find(i => i.key === key);
  if (item) {
    window.CartManager.updateQuantity(key, item.quantity + delta);
  }
}

function editCartItem(key) {
  editingCartKey = key;
  const items = window.CartManager.getItems();
  const item = items.find(i => i.key === key);
  if (!item) return;

  document.getElementById('cartEditTitle').textContent = `編輯 ${item.name}`;

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

  const selectedAddons = [];
  document.querySelectorAll('.cart-edit-addon.active').forEach(btn => {
    selectedAddons.push({
      id: btn.dataset.addonId,
      name: btn.dataset.addonName,
      price: parseInt(btn.dataset.addonPrice)
    });
  });

  item.addons = selectedAddons;

  const addonKey = selectedAddons.map(a => a.id).sort().join('+');
  item.key = `${item.id}_${addonKey}`;

  const otherIdx = items.findIndex(i => i.key !== editingCartKey && i.key === item.key);
  if (otherIdx >= 0) {
    items[otherIdx].quantity += item.quantity;
    items.splice(items.indexOf(item), 1);
  }

  window.CartManager.saveItems(items);
  closeCartEdit();
}

function selectDineType(type) {
  dineType = type;
  document.getElementById('btnDineIn').classList.toggle('active', type === 'dine');
  document.getElementById('btnTakeout').classList.toggle('active', type === 'takeout');
}

function confirmOrder() {
  if (window.CartManager.getCount() === 0) return;

  if (!dineType) {
    const type = prompt('請選擇：1 = 內用，2 = 外帶');
    if (type === '1') dineType = 'dine';
    else if (type === '2') dineType = 'takeout';
    else return;
  }

  const items = window.CartManager.getItems();
  const modalItems = document.getElementById('modalItems');
  const modalTotal = document.getElementById('modalTotal');
  const modalDineType = document.getElementById('modalDineType');

  modalDineType.textContent = dineType === 'dine' ? '內用' : '外帶';
  modalItems.innerHTML = items.map((item, idx) => {
    const addonText = item.addons.map(a => a.name).join(' + ');
    const addonPriceText = item.addons.filter(a => a.price > 0).map(a => `+$${a.price}`).join(' ');
    const itemTotal = (item.price + item.addons.reduce((s, a) => s + a.price, 0)) * item.quantity;
    return `
      <div class="modal-item">
        <div class="modal-item-left">
          <span class="modal-item-num">#${idx + 1}</span>
          <div class="modal-item-info">
            <span class="modal-item-name">${item.name}</span>
            ${addonText ? '<span class="modal-item-addons">' + addonText + (addonPriceText ? ' ' + addonPriceText : '') + '</span>' : ''}
          </div>
        </div>
        <div class="modal-item-right">
          <span class="modal-item-qty">×${item.quantity}</span>
          <span class="modal-item-price">$${itemTotal}</span>
        </div>
      </div>
    `;
  }).join('');

  modalTotal.textContent = `總計: $${window.CartManager.getTotal()}`;
  document.getElementById('orderModal').style.display = 'flex';
}

function closeModal() {
  document.getElementById('orderModal').style.display = 'none';
}

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
    activeItems = {};
    dineType = null;
    document.getElementById('btnDineIn').classList.remove('active');
    document.getElementById('btnTakeout').classList.remove('active');
    renderItems();
    loadTodayOrders();
  } catch (e) {
    console.error('Failed to submit order:', e);
    alert('訂單送出失敗，請重試');
  }
}

async function loadTodayOrders() {
  try {
    const allOrders = await window.FirebaseCore.getOrders(50);
    const today = new Date().toISOString().split('T')[0];
    const todayOrders = allOrders.filter(o => {
      const ts = o.createdAt?.toDate ? o.createdAt.toDate() : (o.timestamp ? new Date(o.timestamp) : null);
      return ts && ts.toISOString().split('T')[0] === today;
    });

    document.getElementById('todayOrdersTitle').textContent = `今日訂單 (${todayOrders.length})`;

    const list = document.getElementById('todayOrdersList');
    if (todayOrders.length === 0) {
      list.innerHTML = '<div style="padding:12px;color:var(--text-muted);font-size:14px">尚無訂單</div>';
      return;
    }

    list.innerHTML = todayOrders.map((order, i) => {
      const ts = order.createdAt?.toDate ? order.createdAt.toDate() : (order.timestamp ? new Date(order.timestamp) : null);
      const time = ts ? ts.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }) : '';
      const itemsText = (order.items || []).map(it => it.name).join('、');
      const typeLabel = order.dineType === 'dine' ? '內用' : order.dineType === 'takeout' ? '外帶' : '';
      return `
        <div class="today-order-item">
          <span class="today-order-num">#${todayOrders.length - i}</span>
          <span class="today-order-time">${time}</span>
          <span class="today-order-detail">${itemsText}</span>
          <span class="today-order-type">${typeLabel}</span>
          <span class="today-order-total">$${order.total}</span>
        </div>
      `;
    }).join('');
  } catch (e) {
    console.warn('Load today orders failed:', e);
  }
}

function toggleTodayOrders() {
  const list = document.getElementById('todayOrdersList');
  const toggle = document.getElementById('todayOrdersToggle');
  const open = list.style.display === 'none';
  list.style.display = open ? 'block' : 'none';
  toggle.textContent = open ? '▾' : '▸';
}

document.addEventListener('DOMContentLoaded', initConsumer);
