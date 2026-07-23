# 早餐點餐機 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a tablet-optimized breakfast ordering kiosk system with consumer page, admin backend, and Firebase cloud sync.

**Architecture:** Single HTML entry point with `?shop={shopId}` parameter. Shared CSS theme system with Dark/Sage themes. Firebase Firestore for menu data, orders, and usage tracking. Local storage for cart and session.

**Tech Stack:** HTML, CSS (custom properties), vanilla JavaScript, Firebase (Firestore, Hosting), SheetJS (Excel import/export)

## Global Constraints

- No frameworks (React, Vue, etc.) - vanilla HTML/CSS/JS only
- No emoji on item cards
- Category buttons use simple SVG line icons
- Theme: Dark (#1A1A1A + #F27D42) or Sage (#0E3E37 + #B58D3D)
- Font: Inter (Dark) / Montserrat (Sage)
- Border radius: 16-24px, capsule buttons
- Touch-optimized for tablet (1024x768+)
- Firebase shared project, `shops/{shopId}/` path

---

## File Structure

```
早餐點餐機/
├── public/                     ← Firebase Hosting root
│   ├── index.html              ← Consumer ordering page
│   ├── admin.html              ← Admin home
│   ├── admin-menu.html         ← Menu management
│   ├── admin-orders.html       ← Order records
│   ├── css/
│   │   ├── common.css          ← Shared reset, variables, theme
│   │   ├── consumer.css        ← Consumer page styles
│   │   └── admin.css           ← Admin pages styles
│   ├── js/
│   │   ├── config.js           ← Firebase config + shop detection
│   │   ├── firebase-core.js    ← Firestore CRUD operations
│   │   ├── stats-tracker.js    ← Usage tracking
│   │   ├── theme.js            ← Theme loading + switching
│   │   ├── cart.js             ← Cart logic (localStorage)
│   │   ├── consumer.js         ← Consumer page logic
│   │   ├── admin-home.js       ← Admin home logic
│   │   ├── admin-menu.js       ← Menu management logic
│   │   └── admin-orders.js     ← Order records logic
│   └── assets/
│       └── excel-template.xlsx ← Downloadable Excel template
├── firebase.json               ← Firebase config
├── .firebaserc                 ← Firebase project alias
└── docs/
    └── superpowers/
        ├── specs/
        │   └── 2026-07-22-breakfast-kiosk-design.md
        └── plans/
            └── 2026-07-22-breakfast-kiosk-implementation.md
```

---

## Phase 1: Foundation

### Task 1: Firebase Project Setup

**Files:**
- Create: `firebase.json`
- Create: `.firebaserc`
- Create: `public/index.html` (placeholder)
- Create: `public/admin.html` (placeholder)

**Interfaces:**
- Consumes: None (first task)
- Produces: Firebase hosting config, deployable placeholder pages

- [ ] **Step 1: Create firebase.json**

```json
{
  "hosting": {
    "public": "public",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      { "source": "**", "destination": "/index.html" }
    ]
  }
}
```

- [ ] **Step 2: Create .firebaserc**

```json
{
  "projects": {
    "default": "breakfast-kiosk-shared"
  }
}
```

- [ ] **Step 3: Create placeholder public/index.html**

```html
<!DOCTYPE html>
<html lang="zh-TW">
<head><meta charset="UTF-8"><title>早餐點餐機</title></head>
<body><h1>載入中...</h1></body>
</html>
```

- [ ] **Step 4: Create placeholder public/admin.html**

```html
<!DOCTYPE html>
<html lang="zh-TW">
<head><meta charset="UTF-8"><title>後台管理</title></head>
<body><h1>後台管理</h1></body>
</html>
```

- [ ] **Step 5: Commit**

```bash
git add firebase.json .firebaserc public/
git commit -m "chore: initialize firebase hosting with placeholder pages"
```

---

### Task 2: Firebase Config + Shop Detection

**Files:**
- Create: `public/js/config.js`

**Interfaces:**
- Consumes: None
- Produces: `window.APP_CONFIG` with `shopId`, `firebaseConfig`; `getShopId()` function

- [ ] **Step 1: Create public/js/config.js**

```javascript
// Firebase config - replace with actual project values
const FIREBASE_CONFIG = {
  apiKey: "YOUR_API_KEY",
  authDomain: "breakfast-kiosk-shared.firebaseapp.com",
  projectId: "breakfast-kiosk-shared",
  storageBucket: "breakfast-kiosk-shared.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Get shopId from URL parameter ?shop=xxx
function getShopId() {
  const params = new URLSearchParams(window.location.search);
  const shopId = params.get('shop');
  if (!shopId) {
    // Default for development
    return 'demo-shop';
  }
  return shopId;
}

// Global config
window.APP_CONFIG = {
  firebaseConfig: FIREBASE_CONFIG,
  shopId: getShopId()
};
```

- [ ] **Step 2: Commit**

```bash
git add public/js/config.js
git commit -m "feat: add firebase config and shop detection"
```

---

### Task 3: Firebase Core Operations

**Files:**
- Create: `public/js/firebase-core.js`

**Interfaces:**
- Consumes: `window.APP_CONFIG` from config.js
- Produces: `window.FirebaseCore` with `init()`, `getMenu()`, `saveMenu()`, `getOrders()`, `saveOrder()`, `getStats()`, `updateStats()`

- [ ] **Step 1: Create public/js/firebase-core.js**

```javascript
// Firebase SDK v9+ modular imports (via CDN)
// Will be loaded via <script> tags in HTML

window.FirebaseCore = {
  db: null,
  shopId: null,

  init() {
    this.shopId = window.APP_CONFIG.shopId;
    // Initialize Firebase app
    firebase.initializeApp(window.APP_CONFIG.firebaseConfig);
    this.db = firebase.firestore();
    console.log(`Firebase initialized for shop: ${this.shopId}`);
  },

  // Shop path helper
  shopPath() {
    return `shops/${this.shopId}`;
  },

  // Menu operations
  async getMenu() {
    const doc = await this.db.doc(`${this.shopPath()}/menu`).get();
    if (doc.exists) {
      return doc.data();
    }
    // Return default menu structure if no data
    return {
      storeName: '新店家',
      subtitle: '請到後台設定菜單',
      theme: 'sage',
      addonLibrary: [],
      categories: []
    };
  },

  async saveMenu(menuData) {
    await this.db.doc(`${this.shopPath()}/menu`).set(menuData);
    await this.updateStats('writes', 1);
  },

  // Order operations
  async saveOrder(orderData) {
    const orderRef = await this.db.collection(`${this.shopPath()}/orders`).add({
      ...orderData,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    await this.updateStats('writes', 1);
    return orderRef.id;
  },

  async getOrders(limit = 100) {
    const snapshot = await this.db.collection(`${this.shopPath()}/orders`)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  async deleteOrder(orderId) {
    await this.db.doc(`${this.shopPath()}/orders/${orderId}`).delete();
    await this.updateStats('writes', 1);
  },

  async deleteOrders(orderIds) {
    const batch = this.db.batch();
    orderIds.forEach(id => {
      batch.delete(this.db.doc(`${this.shopPath()}/orders/${id}`));
    });
    await batch.commit();
    await this.updateStats('writes', orderIds.length);
  },

  // Stats operations
  async updateStats(type, count) {
    const today = new Date().toISOString().split('T')[0];
    const statsRef = this.db.doc(`${this.shopPath()}/stats`);

    await this.db.runTransaction(async (transaction) => {
      const doc = await transaction.get(statsRef);
      const data = doc.exists ? doc.data() : { dailyStats: {}, totalStats: { reads: 0, writes: 0 } };

      // Update daily stats
      if (!data.dailyStats[today]) {
        data.dailyStats[today] = { reads: 0, writes: 0 };
      }
      data.dailyStats[today][type] += count;

      // Update total stats
      data.totalStats[type] += count;

      transaction.set(statsRef, data);
    });
  },

  async getStats() {
    const doc = await this.db.doc(`${this.shopPath()}/stats`).get();
    return doc.exists ? doc.data() : { dailyStats: {}, totalStats: { reads: 0, writes: 0 } };
  },

  async cleanOldStats(retentionDays = 365) {
    const statsRef = this.db.doc(`${this.shopPath()}/stats`);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);
    const cutoffStr = cutoff.toISOString().split('T')[0];

    await this.db.runTransaction(async (transaction) => {
      const doc = await transaction.get(statsRef);
      if (!doc.exists) return;

      const data = doc.data();
      let cleaned = 0;
      for (const date in data.dailyStats) {
        if (date < cutoffStr) {
          delete data.dailyStats[date];
          cleaned++;
        }
      }

      if (cleaned > 0) {
        transaction.set(statsRef, data);
      }
    });
  }
};
```

- [ ] **Step 2: Commit**

```bash
git add public/js/firebase-core.js
git commit -m "feat: add firebase core operations with stats tracking"
```

---

### Task 4: Theme System

**Files:**
- Create: `public/css/common.css`
- Create: `public/js/theme.js`

**Interfaces:**
- Consumes: `window.APP_CONFIG` from config.js
- Produces: `window.ThemeManager` with `load()`, `setTheme()`, `getTheme()`

- [ ] **Step 1: Create public/css/common.css**

```css
/* Reset + Base */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html, body { height: 100%; overflow: hidden; }

/* Theme Variables - Dark (default) */
:root {
  --bg: #1A1A1A;
  --surface: #2A2A2A;
  --surface-hover: #333333;
  --primary: #F27D42;
  --primary-hover: #E06B30;
  --text: #FFFFFF;
  --text-muted: #AAAAAA;
  --border: #444444;
  --card-bg: #2A2A2A;
  --card-selected: #F27D42;
  --font-main: 'Inter', sans-serif;
  --radius: 16px;
  --radius-sm: 12px;
  --radius-pill: 999px;
}

/* Sage Theme */
[data-theme="sage"] {
  --bg: #0E3E37;
  --surface: #1A5C52;
  --surface-hover: #247065;
  --primary: #B58D3D;
  --primary-hover: #9A7830;
  --text: #FFFFFF;
  --text-muted: #B0C4B8;
  --border: #2A7A6A;
  --card-bg: #1A5C52;
  --card-selected: #B58D3D;
  --font-main: 'Montserrat', sans-serif;
}

body {
  font-family: var(--font-main);
  background-color: var(--bg);
  color: var(--text);
}

/* Utility Classes */
.container { display: flex; height: 100vh; }
.panel { padding: 20px; }
.btn {
  padding: 12px 24px;
  border-radius: var(--radius-pill);
  border: none;
  cursor: pointer;
  font-size: 16px;
  font-weight: 600;
  transition: all 0.2s;
}
.btn-primary {
  background-color: var(--primary);
  color: var(--text);
}
.btn-primary:hover {
  background-color: var(--primary-hover);
}
.btn-secondary {
  background-color: var(--surface);
  color: var(--text);
}
.btn-secondary:hover {
  background-color: var(--surface-hover);
}
.card {
  background-color: var(--card-bg);
  border-radius: var(--radius);
  padding: 16px;
  transition: all 0.2s;
}
.card-selected {
  background-color: var(--card-selected);
  color: var(--text);
}
```

- [ ] **Step 2: Create public/js/theme.js**

```javascript
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
```

- [ ] **Step 3: Commit**

```bash
git add public/css/common.css public/js/theme.js
git commit -m "feat: add theme system with Dark/Sage support"
```

---

### Task 5: Stats Tracker

**Files:**
- Create: `public/js/stats-tracker.js`

**Interfaces:**
- Consumes: `window.FirebaseCore` from firebase-core.js
- Produces: `window.StatsTracker` with `trackRead()`, `trackWrite()`

- [ ] **Step 1: Create public/js/stats-tracker.js**

```javascript
window.StatsTracker = {
  pendingWrites: 0,
  flushInterval: null,

  init() {
    // Flush pending writes every 30 seconds
    this.flushInterval = setInterval(() => this.flush(), 30000);
  },

  async trackRead() {
    try {
      await window.FirebaseCore.updateStats('reads', 1);
    } catch (e) {
      console.warn('Failed to track read:', e);
    }
  },

  async trackWrite() {
    this.pendingWrites++;
    // Flush immediately if threshold reached
    if (this.pendingWrites >= 5) {
      await this.flush();
    }
  },

  async flush() {
    if (this.pendingWrites === 0) return;
    try {
      await window.FirebaseCore.updateStats('writes', this.pendingWrites);
      this.pendingWrites = 0;
    } catch (e) {
      console.warn('Failed to flush stats:', e);
    }
  }
};
```

- [ ] **Step 2: Commit**

```bash
git add public/js/stats-tracker.js
git commit -m "feat: add stats tracker with batched writes"
```

---

### Task 6: Cart Logic

**Files:**
- Create: `public/js/cart.js`

**Interfaces:**
- Consumes: None (standalone localStorage logic)
- Produces: `window.CartManager` with `getItems()`, `addItem()`, `removeItem()`, `updateQuantity()`, `updateAddon()`, `clear()`, `getTotal()`

- [ ] **Step 1: Create public/js/cart.js**

```javascript
window.CartManager = {
  STORAGE_KEY: 'kiosk_cart',

  getItems() {
    const data = localStorage.getItem(this.STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  },

  saveItems(items) {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent('cart-updated', { detail: items }));
  },

  addItem(item, addons = [], quantity = 1) {
    const items = this.getItems();
    // Create a unique key based on item id + sorted addon ids
    const addonKey = addons.sort().join('+');
    const key = `${item.id}_${addonKey}`;

    // Check if same item+addons already exists
    const existing = items.find(i => i.key === key);
    if (existing) {
      existing.quantity += quantity;
    } else {
      items.push({
        key,
        id: item.id,
        name: item.name,
        price: item.price,
        addons: addons.map(a => ({
          id: a.id,
          name: a.name,
          price: a.price
        })),
        quantity
      });
    }

    this.saveItems(items);
  },

  removeItem(key) {
    const items = this.getItems().filter(i => i.key !== key);
    this.saveItems(items);
  },

  updateQuantity(key, quantity) {
    const items = this.getItems();
    const item = items.find(i => i.key === key);
    if (item) {
      item.quantity = Math.max(0, quantity);
      if (item.quantity === 0) {
        this.removeItem(key);
      } else {
        this.saveItems(items);
      }
    }
  },

  updateAddon(key, addon, add = true) {
    const items = this.getItems();
    const item = items.find(i => i.key === key);
    if (!item) return;

    if (add) {
      item.addons.push({ id: addon.id, name: addon.name, price: addon.price });
    } else {
      item.addons = item.addons.filter(a => a.id !== addon.id);
    }

    // Update key
    const addonKey = item.addons.map(a => a.id).sort().join('+');
    item.key = `${item.id}_${addonKey}`;

    this.saveItems(items);
  },

  clear() {
    localStorage.removeItem(this.STORAGE_KEY);
    window.dispatchEvent(new CustomEvent('cart-updated', { detail: [] }));
  },

  getTotal() {
    return this.getItems().reduce((sum, item) => {
      const addonTotal = item.addons.reduce((s, a) => s + a.price, 0);
      return sum + (item.price + addonTotal) * item.quantity;
    }, 0);
  },

  getCount() {
    return this.getItems().reduce((sum, item) => sum + item.quantity, 0);
  }
};
```

- [ ] **Step 2: Commit**

```bash
git add public/js/cart.js
git commit -m "feat: add cart manager with localStorage persistence"
```

---

## Phase 2: Consumer Page

### Task 7: Consumer Page HTML Structure

**Files:**
- Modify: `public/index.html`
- Create: `public/css/consumer.css`

**Interfaces:**
- Consumes: All Phase 1 files
- Produces: Complete HTML structure for consumer ordering page

- [ ] **Step 1: Create public/css/consumer.css**

```css
/* Consumer Page Layout */
.consumer-container {
  display: grid;
  grid-template-columns: 160px 1fr 320px;
  grid-template-rows: 60px 1fr 100px;
  height: 100vh;
  gap: 1px;
  background-color: var(--border);
}

/* Header */
.header {
  grid-column: 1 / -1;
  background-color: var(--bg);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
}
.header-title {
  font-size: 24px;
  font-weight: 700;
}
.header-subtitle {
  font-size: 14px;
  color: var(--text-muted);
}
.header-actions {
  display: flex;
  gap: 8px;
}
.dine-btn {
  padding: 8px 16px;
  border-radius: var(--radius-pill);
  border: 2px solid var(--border);
  background: transparent;
  color: var(--text);
  cursor: pointer;
  transition: all 0.2s;
}
.dine-btn.active {
  background-color: var(--primary);
  border-color: var(--primary);
}

/* Category Panel */
.categories {
  background-color: var(--bg);
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px;
  overflow-y: auto;
}
.category-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  border-radius: var(--radius-sm);
  border: none;
  background: transparent;
  color: var(--text);
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;
}
.category-btn:hover {
  background-color: var(--surface);
}
.category-btn.active {
  background-color: var(--primary);
  color: var(--text);
}
.category-btn svg {
  width: 24px;
  height: 24px;
}

/* Items Panel */
.items-panel {
  background-color: var(--bg);
  padding: 12px;
  overflow-y: auto;
}
.items-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 12px;
}
.item-card {
  background-color: var(--card-bg);
  border-radius: var(--radius);
  padding: 16px;
  cursor: pointer;
  transition: all 0.2s;
  text-align: center;
}
.item-card:hover {
  background-color: var(--surface-hover);
}
.item-card.active {
  background-color: var(--card-selected);
  color: var(--text);
  box-shadow: 0 0 0 3px var(--primary);
}
.item-card.selected {
  background-color: var(--surface);
  opacity: 0.7;
}
.item-card .item-name {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 4px;
}
.item-card .item-price {
  font-size: 14px;
  color: var(--text-muted);
}
.item-card.active .item-price,
.item-card.selected .item-price {
  color: var(--text);
}
.item-card .item-count {
  position: absolute;
  top: 8px;
  right: 8px;
  background: var(--primary);
  color: var(--text);
  border-radius: 50%;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
}
.item-card .cancel-btn {
  position: absolute;
  top: 8px;
  left: 8px;
  background: rgba(0,0,0,0.5);
  color: var(--text);
  border: none;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  cursor: pointer;
  display: none;
}
.item-card.active .cancel-btn {
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Cart Panel */
.cart-panel {
  background-color: var(--bg);
  display: flex;
  flex-direction: column;
}
.cart-header {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  font-weight: 600;
}
.cart-items {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}
.cart-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  border-radius: var(--radius-sm);
  background-color: var(--surface);
  margin-bottom: 8px;
  cursor: pointer;
}
.cart-item-info {
  flex: 1;
}
.cart-item-name {
  font-weight: 600;
}
.cart-item-addons {
  font-size: 12px;
  color: var(--text-muted);
}
.cart-item-qty {
  display: flex;
  align-items: center;
  gap: 8px;
}
.cart-item-qty button {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: none;
  background: var(--primary);
  color: var(--text);
  cursor: pointer;
}
.cart-footer {
  padding: 12px 16px;
  border-top: 1px solid var(--border);
}
.cart-total {
  display: flex;
  justify-content: space-between;
  font-size: 18px;
  font-weight: 700;
  margin-bottom: 12px;
}
.cart-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* Addon Bar */
.addon-bar {
  grid-column: 1 / -1;
  background-color: var(--surface);
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 20px;
  overflow-x: auto;
}
.addon-label {
  font-weight: 600;
  white-space: nowrap;
}
.addon-btn {
  padding: 8px 16px;
  border-radius: var(--radius-pill);
  border: 2px solid var(--border);
  background: transparent;
  color: var(--text);
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}
.addon-btn.active {
  background-color: var(--primary);
  border-color: var(--primary);
}
.addon-btn .addon-price {
  font-size: 12px;
  color: var(--text-muted);
}
.addon-btn.active .addon-price {
  color: var(--text);
}
.add-to-cart-btn {
  margin-left: auto;
  padding: 12px 32px;
  border-radius: var(--radius-pill);
  border: none;
  background-color: var(--primary);
  color: var(--text);
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
}
.add-to-cart-btn:hover {
  background-color: var(--primary-hover);
}

/* Order Confirmation Modal */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0,0,0,0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.modal {
  background: var(--surface);
  border-radius: var(--radius);
  padding: 24px;
  max-width: 400px;
  width: 90%;
}
.modal h2 {
  margin-bottom: 16px;
}
.modal-items {
  max-height: 300px;
  overflow-y: auto;
  margin-bottom: 16px;
}
.modal-item {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid var(--border);
}
.modal-total {
  font-size: 20px;
  font-weight: 700;
  text-align: right;
  margin-bottom: 16px;
}
.modal-actions {
  display: flex;
  gap: 8px;
}
.modal-actions button {
  flex: 1;
}
```

- [ ] **Step 2: Rewrite public/index.html**

```html
<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>早餐點餐機</title>
  <link rel="stylesheet" href="css/common.css">
  <link rel="stylesheet" href="css/consumer.css">
</head>
<body>
  <div class="consumer-container">
    <!-- Header -->
    <header class="header">
      <div>
        <div class="header-title" id="storeName">載入中...</div>
        <div class="header-subtitle" id="storeSubtitle"></div>
      </div>
      <div class="header-actions">
        <button class="dine-btn" id="btnDineIn" onclick="selectDineType('dine')">內用</button>
        <button class="dine-btn" id="btnTakeout" onclick="selectDineType('takeout')">外帶</button>
      </div>
    </header>

    <!-- Categories -->
    <nav class="categories" id="categories"></nav>

    <!-- Items -->
    <main class="items-panel">
      <div class="items-grid" id="itemsGrid"></div>
    </main>

    <!-- Cart -->
    <aside class="cart-panel">
      <div class="cart-header">購物車</div>
      <div class="cart-items" id="cartItems"></div>
      <div class="cart-footer">
        <div class="cart-total">
          <span>總計</span>
          <span id="cartTotal">$0</span>
        </div>
        <div class="cart-actions">
          <button class="btn btn-secondary" onclick="openPrinter()">廚房列印（尚未開啟）</button>
          <button class="btn btn-primary" id="btnConfirm" onclick="confirmOrder()">確認訂單</button>
        </div>
      </div>
    </aside>

    <!-- Addon Bar -->
    <div class="addon-bar" id="addonBar">
      <span class="addon-label" id="addonLabel">配料</span>
      <div id="addonButtons"></div>
      <button class="add-to-cart-btn" onclick="addToCart()">加入購物車</button>
    </div>
  </div>

  <!-- Order Confirmation Modal -->
  <div class="modal-overlay" id="orderModal" style="display:none">
    <div class="modal">
      <h2>訂單確認</h2>
      <div id="modalDineType"></div>
      <div class="modal-items" id="modalItems"></div>
      <div class="modal-total" id="modalTotal"></div>
      <div class="modal-actions">
        <button class="btn btn-secondary" onclick="closeModal()">返回修改</button>
        <button class="btn btn-primary" onclick="submitOrder()">確認送出</button>
      </div>
    </div>
  </div>

  <!-- Scripts -->
  <script src="https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore-compat.js"></script>
  <script src="js/config.js"></script>
  <script src="js/firebase-core.js"></script>
  <script src="js/theme.js"></script>
  <script src="js/stats-tracker.js"></script>
  <script src="js/cart.js"></script>
  <script src="js/consumer.js"></script>
</body>
</html>
```

- [ ] **Step 3: Commit**

```bash
git add public/index.html public/css/consumer.css
git commit -m "feat: add consumer page HTML structure and styles"
```

---

### Task 8: Consumer Page Logic

**Files:**
- Create: `public/js/consumer.js`

**Interfaces:**
- Consumes: All Phase 1 modules + consumer.html structure
- Produces: Complete consumer ordering page functionality

- [ ] **Step 1: Create public/js/consumer.js**

```javascript
// State
let menuData = null;
let selectedCategory = null;
let activeItems = {};  // { itemId: { item, addons: [], quantity } }
let dineType = null;   // 'dine' | 'takeout' | null

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
  // TODO: Expand to show addon editing
  console.log('Edit cart item:', key);
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
```

- [ ] **Step 2: Commit**

```bash
git add public/js/consumer.js
git commit -m "feat: add consumer page logic with item/addon/cart management"
```

---

## Phase 3: Admin Backend

### Task 9: Admin Home Page

**Files:**
- Modify: `public/admin.html`
- Create: `public/css/admin.css`
- Create: `public/js/admin-home.js`

**Interfaces:**
- Consumes: All Phase 1 modules
- Produces: Admin home page with store info, theme switch, password settings

- [ ] **Step 1: Create public/css/admin.css**

```css
/* Admin Layout */
.admin-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 24px;
}
.admin-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}
.admin-section {
  background: var(--surface);
  border-radius: var(--radius);
  padding: 20px;
  margin-bottom: 16px;
}
.admin-section h2 {
  font-size: 18px;
  margin-bottom: 16px;
}
.form-group {
  margin-bottom: 12px;
}
.form-group label {
  display: block;
  margin-bottom: 4px;
  font-size: 14px;
  color: var(--text-muted);
}
.form-group input {
  width: 100%;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--text);
  font-size: 14px;
}
.theme-buttons {
  display: flex;
  gap: 8px;
}
.theme-btn {
  flex: 1;
  padding: 12px;
  border-radius: var(--radius-sm);
  border: 2px solid var(--border);
  cursor: pointer;
  transition: all 0.2s;
}
.theme-btn.active {
  border-color: var(--primary);
}
.nav-links {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.nav-link {
  display: block;
  padding: 20px;
  background: var(--surface);
  border-radius: var(--radius);
  text-decoration: none;
  color: var(--text);
  text-align: center;
  transition: all 0.2s;
}
.nav-link:hover {
  background: var(--surface-hover);
}
```

- [ ] **Step 2: Rewrite public/admin.html**

```html
<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>後台管理</title>
  <link rel="stylesheet" href="css/common.css">
  <link rel="stylesheet" href="css/admin.css">
</head>
<body>
  <div class="admin-container">
    <div class="admin-header">
      <h1>後台管理</h1>
      <button class="btn btn-secondary" onclick="goToKiosk()">前往點餐頁</button>
    </div>

    <!-- Store Info -->
    <div class="admin-section">
      <h2>店家資訊</h2>
      <div class="form-group">
        <label>店名</label>
        <input type="text" id="storeName" placeholder="好吃早餐店">
      </div>
      <div class="form-group">
        <label>副標題</label>
        <input type="text" id="storeSubtitle" placeholder="新鮮現做・幸福滋味">
      </div>
      <button class="btn btn-primary" onclick="saveStoreInfo()">儲存</button>
    </div>

    <!-- Theme Switch -->
    <div class="admin-section">
      <h2>主題切換</h2>
      <div class="theme-buttons">
        <button class="theme-btn" id="themeDark" onclick="setTheme('dark')">
          Dark
        </button>
        <button class="theme-btn" id="themeSage" onclick="setTheme('sage')">
          Sage
        </button>
      </div>
    </div>

    <!-- Password -->
    <div class="admin-section">
      <h2>密碼設定</h2>
      <div class="form-group">
        <label>新密碼</label>
        <input type="password" id="newPassword" placeholder="********">
      </div>
      <div class="form-group">
        <label>確認密碼</label>
        <input type="password" id="confirmPassword" placeholder="********">
      </div>
      <button class="btn btn-primary" onclick="changePassword()">變更密碼</button>
    </div>

    <!-- Navigation -->
    <div class="nav-links">
      <a href="admin-menu.html?shop={{shopId}}" class="nav-link">
        <h3>菜單管理</h3>
        <p>管理品項、配料、分類</p>
      </a>
      <a href="admin-orders.html?shop={{shopId}}" class="nav-link">
        <h3>訂單紀錄</h3>
        <p>查看歷史訂單、統計</p>
      </a>
    </div>
  </div>

  <script src="https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore-compat.js"></script>
  <script src="js/config.js"></script>
  <script src="js/firebase-core.js"></script>
  <script src="js/theme.js"></script>
  <script src="js/admin-home.js"></script>
</body>
</html>
```

- [ ] **Step 3: Create public/js/admin-home.js**

```javascript
let menuData = null;

async function initAdmin() {
  window.FirebaseCore.init();
  menuData = await window.FirebaseCore.getMenu();

  document.getElementById('storeName').value = menuData.storeName;
  document.getElementById('storeSubtitle').value = menuData.subtitle;

  // Highlight current theme
  document.getElementById('themeDark').classList.toggle('active', menuData.theme === 'dark');
  document.getElementById('themeSage').classList.toggle('active', menuData.theme === 'sage');
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

document.addEventListener('DOMContentLoaded', initAdmin);
```

- [ ] **Step 4: Update navigation links to use shopId**

```javascript
// In initAdmin(), after DOM load:
document.querySelectorAll('.nav-link').forEach(link => {
  link.href = link.href.replace('{{shopId}}', window.APP_CONFIG.shopId);
});
```

- [ ] **Step 5: Commit**

```bash
git add public/admin.html public/css/admin.css public/js/admin-home.js
git commit -m "feat: add admin home page with store info and theme settings"
```

---

### Task 10: Menu Management Page - HTML Structure

**Files:**
- Modify: `public/admin-menu.html`
- Modify: `public/css/admin.css` (append)

**Interfaces:**
- Consumes: All Phase 1 modules
- Produces: Menu management page HTML

- [ ] **Step 1: Create public/admin-menu.html**

```html
<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>菜單管理</title>
  <link rel="stylesheet" href="css/common.css">
  <link rel="stylesheet" href="css/admin.css">
</head>
<body>
  <div class="admin-container">
    <div class="admin-header">
      <h1>菜單管理</h1>
      <a href="admin.html?shop={{shopId}}" class="btn btn-secondary">返回後台</a>
    </div>

    <!-- Addon Library -->
    <div class="admin-section">
      <h2>配料庫（全局）</h2>
      <div id="addonList"></div>
      <button class="btn btn-primary" onclick="showAddAddon()">+ 新增配料</button>
    </div>

    <!-- Categories -->
    <div class="admin-section">
      <h2>分類管理</h2>
      <div id="categoryList"></div>
      <button class="btn btn-primary" onclick="showAddCategory()">+ 新增分類</button>
    </div>

    <!-- Import/Export -->
    <div class="admin-section">
      <h2>匯入/匯出</h2>
      <button class="btn btn-secondary" onclick="downloadTemplate()">下載空白 Excel 範本</button>
      <button class="btn btn-secondary" onclick="document.getElementById('excelUpload').click()">上傳 Excel 檔案</button>
      <input type="file" id="excelUpload" accept=".xlsx,.xls" style="display:none" onchange="handleExcelUpload(event)">
      <hr style="margin: 16px 0; border-color: var(--border);">
      <p style="margin-bottom: 8px;">貼上 JSON：</p>
      <textarea id="jsonInput" style="width:100%; height:150px; background:var(--bg); color:var(--text); border:1px solid var(--border); border-radius:var(--radius-sm); padding:12px; font-family:monospace;"></textarea>
      <button class="btn btn-primary" onclick="importJSON()">匯入</button>
      <button class="btn btn-secondary" onclick="exportJSON()">匯出 JSON</button>
    </div>
  </div>

  <script src="https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore-compat.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>
  <script src="js/config.js"></script>
  <script src="js/firebase-core.js"></script>
  <script src="js/theme.js"></script>
  <script src="js/admin-menu.js"></script>
</body>
</html>
```

- [ ] **Step 2: Append to public/css/admin.css**

```css
/* Menu Management */
.category-item {
  background: var(--bg);
  border-radius: var(--radius-sm);
  padding: 16px;
  margin-bottom: 12px;
}
.category-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}
.category-header h3 {
  flex: 1;
}
.category-actions {
  display: flex;
  gap: 4px;
}
.item-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  background: var(--surface);
  border-radius: var(--radius-sm);
  margin-bottom: 4px;
}
.item-row .item-info {
  flex: 1;
}
.item-row .item-name {
  font-weight: 600;
}
.item-row .item-price {
  font-size: 14px;
  color: var(--text-muted);
}
.item-row .item-actions {
  display: flex;
  gap: 4px;
}
.addon-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: var(--primary);
  color: var(--text);
  border-radius: var(--radius-pill);
  font-size: 12px;
}
.addon-chip button {
  background: none;
  border: none;
  color: var(--text);
  cursor: pointer;
  padding: 0;
  font-size: 14px;
}
.btn-sm {
  padding: 6px 12px;
  font-size: 12px;
}
.btn-danger {
  background: #dc3545;
  color: white;
}
.btn-danger:hover {
  background: #c82333;
}
```

- [ ] **Step 3: Commit**

```bash
git add public/admin-menu.html public/css/admin.css
git commit -m "feat: add menu management page HTML structure"
```

---

### Task 11: Menu Management Logic

**Files:**
- Create: `public/js/admin-menu.js`

**Interfaces:**
- Consumes: All Phase 1 modules + admin-menu.html structure
- Produces: Complete menu management functionality

- [ ] **Step 1: Create public/js/admin-menu.js**

```javascript
let menuData = null;

async function initMenuAdmin() {
  window.FirebaseCore.init();
  menuData = await window.FirebaseCore.getMenu();
  renderAddonLibrary();
  renderCategories();

  // Update nav link
  document.querySelectorAll('a[href*="{{shopId}}"]').forEach(link => {
    link.href = link.href.replace('{{shopId}}', window.APP_CONFIG.shopId);
  });
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
```

- [ ] **Step 2: Commit**

```bash
git add public/js/admin-menu.js
git commit -m "feat: add menu management logic with CRUD and Excel import"
```

---

### Task 12: Order Records Page

**Files:**
- Modify: `public/admin-orders.html`
- Create: `public/js/admin-orders.js`

**Interfaces:**
- Consumes: All Phase 1 modules
- Produces: Order records page with filtering, stats, export

- [ ] **Step 1: Create public/admin-orders.html**

```html
<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>訂單紀錄</title>
  <link rel="stylesheet" href="css/common.css">
  <link rel="stylesheet" href="css/admin.css">
</head>
<body>
  <div class="admin-container">
    <div class="admin-header">
      <h1>訂單紀錄</h1>
      <a href="admin.html?shop={{shopId}}" class="btn btn-secondary">返回後台</a>
    </div>

    <!-- Filters -->
    <div class="admin-section">
      <h2>篩選</h2>
      <div style="display:flex; gap:12px; flex-wrap:wrap;">
        <div class="form-group">
          <label>開始日期</label>
          <input type="date" id="startDate">
        </div>
        <div class="form-group">
          <label>結束日期</label>
          <input type="date" id="endDate">
        </div>
        <div class="form-group">
          <label>內用/外帶</label>
          <select id="dineFilter" style="padding:10px; border-radius:var(--radius-sm); background:var(--bg); color:var(--text); border:1px solid var(--border);">
            <option value="">全部</option>
            <option value="dine">內用</option>
            <option value="takeout">外帶</option>
          </select>
        </div>
        <div class="form-group">
          <label>&nbsp;</label>
          <button class="btn btn-primary" onclick="filterOrders()">篩選</button>
        </div>
      </div>
    </div>

    <!-- Orders List -->
    <div class="admin-section">
      <h2>訂單列表</h2>
      <div id="ordersList"></div>
      <div style="margin-top:12px;">
        <button class="btn btn-sm btn-danger" onclick="deleteSelected()">刪除選取</button>
        <button class="btn btn-sm btn-danger" onclick="deleteAll()">手動清除全部</button>
      </div>
    </div>

    <!-- Stats -->
    <div class="admin-section">
      <h2>統計</h2>
      <div id="statsContent"></div>
    </div>

    <!-- Settings -->
    <div class="admin-section">
      <h2>設定</h2>
      <div class="form-group">
        <label>自動刪除（天）</label>
        <input type="number" id="retentionDays" value="30" min="1" max="365">
      </div>
      <button class="btn btn-primary" onclick="saveRetention()">儲存</button>
    </div>

    <!-- Export -->
    <div class="admin-section">
      <h2>匯出</h2>
      <button class="btn btn-secondary" onclick="exportCSV()">匯出 CSV</button>
      <button class="btn btn-secondary" onclick="exportExcel()">匯出 Excel</button>
    </div>
  </div>

  <script src="https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore-compat.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>
  <script src="js/config.js"></script>
  <script src="js/firebase-core.js"></script>
  <script src="js/admin-orders.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create public/js/admin-orders.js**

```javascript
let allOrders = [];
let filteredOrders = [];
let selectedOrders = new Set();

async function initOrders() {
  window.FirebaseCore.init();
  allOrders = await window.FirebaseCore.getOrders(500);
  filteredOrders = [...allOrders];

  // Update nav link
  document.querySelectorAll('a[href*="{{shopId}}"]').forEach(link => {
    link.href = link.href.replace('{{shopId}}', window.APP_CONFIG.shopId);
  });

  renderOrders();
  renderStats();
  loadRetention();
}

function filterOrders() {
  const startDate = document.getElementById('startDate').value;
  const endDate = document.getElementById('endDate').value;
  const dineType = document.getElementById('dineFilter').value;

  filteredOrders = allOrders.filter(order => {
    const orderDate = new Date(order.timestamp);
    if (startDate && orderDate < new Date(startDate)) return false;
    if (endDate && orderDate > new Date(endDate + 'T23:59:59')) return false;
    if (dineType && order.dineType !== dineType) return false;
    return true;
  });

  renderOrders();
  renderStats();
}

function renderOrders() {
  const container = document.getElementById('ordersList');
  container.innerHTML = filteredOrders.map(order => {
    const date = new Date(order.timestamp);
    const dateStr = `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
    const dineLabel = order.dineType === 'dine' ? '內用' : '外帶';
    const isSelected = selectedOrders.has(order.id);

    return `
      <div class="item-row" style="cursor:pointer" onclick="toggleOrderDetail('${order.id}')">
        <input type="checkbox" ${isSelected ? 'checked' : ''} onclick="event.stopPropagation(); toggleSelect('${order.id}')">
        <div class="item-info">
          <span class="item-name">${dateStr} ${dineLabel} $${order.total}</span>
        </div>
        <button class="btn btn-sm btn-danger" onclick="event.stopPropagation(); deleteSingle('${order.id}')">刪除</button>
      </div>
      <div id="detail-${order.id}" style="display:none; padding:12px; background:var(--surface); border-radius:var(--radius-sm); margin-bottom:8px;">
        ${order.items.map(item => {
          const addonText = item.addons.map(a => a.name).join(' + ');
          return `<div>${item.name} ${addonText ? '+' + addonText : ''} X${item.quantity} = $${(item.price + item.addons.reduce((s, a) => s + a.price, 0)) * item.quantity}</div>`;
        }).join('')}
      </div>
    `;
  }).join('');
}

function toggleOrderDetail(orderId) {
  const el = document.getElementById('detail-' + orderId);
  el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

function toggleSelect(orderId) {
  if (selectedOrders.has(orderId)) {
    selectedOrders.delete(orderId);
  } else {
    selectedOrders.add(orderId);
  }
}

async function deleteSingle(orderId) {
  if (!confirm('確定刪除此訂單？')) return;
  await window.FirebaseCore.deleteOrder(orderId);
  allOrders = allOrders.filter(o => o.id !== orderId);
  filteredOrders = filteredOrders.filter(o => o.id !== orderId);
  selectedOrders.delete(orderId);
  renderOrders();
  renderStats();
}

async function deleteSelected() {
  if (selectedOrders.size === 0) {
    alert('請先選取訂單');
    return;
  }
  if (!confirm(`確定刪除 ${selectedOrders.size} 筆訂單？`)) return;
  await window.FirebaseCore.deleteOrders([...selectedOrders]);
  allOrders = allOrders.filter(o => !selectedOrders.has(o.id));
  filteredOrders = filteredOrders.filter(o => !selectedOrders.has(o.id));
  selectedOrders.clear();
  renderOrders();
  renderStats();
}

async function deleteAll() {
  if (!confirm('確定清除所有訂單？此操作無法復原！')) return;
  const ids = allOrders.map(o => o.id);
  if (ids.length > 0) {
    await window.FirebaseCore.deleteOrders(ids);
  }
  allOrders = [];
  filteredOrders = [];
  selectedOrders.clear();
  renderOrders();
  renderStats();
}

function renderStats() {
  const container = document.getElementById('statsContent');
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);

  const todayOrders = allOrders.filter(o => o.timestamp.startsWith(today));
  const weekOrders = allOrders.filter(o => new Date(o.timestamp) >= weekAgo);
  const monthOrders = allOrders.filter(o => new Date(o.timestamp) >= monthAgo);

  const todayTotal = todayOrders.reduce((s, o) => s + o.total, 0);
  const weekTotal = weekOrders.reduce((s, o) => s + o.total, 0);
  const monthTotal = monthOrders.reduce((s, o) => s + o.total, 0);

  // Popular items
  const itemCounts = {};
  allOrders.forEach(order => {
    order.items.forEach(item => {
      itemCounts[item.name] = (itemCounts[item.name] || 0) + item.quantity;
    });
  });
  const popular = Object.entries(itemCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

  container.innerHTML = `
    <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:12px; margin-bottom:16px;">
      <div style="text-align:center;">
        <div style="font-size:24px; font-weight:700;">$${todayTotal}</div>
        <div style="color:var(--text-muted);">今日 / ${todayOrders.length} 筆</div>
      </div>
      <div style="text-align:center;">
        <div style="font-size:24px; font-weight:700;">$${weekTotal}</div>
        <div style="color:var(--text-muted);">本週 / ${weekOrders.length} 筆</div>
      </div>
      <div style="text-align:center;">
        <div style="font-size:24px; font-weight:700;">$${monthTotal}</div>
        <div style="color:var(--text-muted);">本月 / ${monthOrders.length} 筆</div>
      </div>
    </div>
    <div>
      <strong>熱門品項：</strong>
      ${popular.map(([name, count], i) => `${i + 1}. ${name} (${count})`).join('、')}
    </div>
  `;
}

function loadRetention() {
  const days = localStorage.getItem('kiosk_retention_days') || 30;
  document.getElementById('retentionDays').value = days;
}

function saveRetention() {
  const days = document.getElementById('retentionDays').value;
  localStorage.setItem('kiosk_retention_days', days);
  alert('已儲存');
}

function exportCSV() {
  const headers = ['訂單ID', '時間', '內用/外帶', '品項', '總計'];
  const rows = filteredOrders.map(order => {
    const items = order.items.map(i => `${i.name} X${i.quantity}`).join('; ');
    return [order.id, order.timestamp, order.dineType === 'dine' ? '內用' : '外帶', items, order.total];
  });

  const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
  downloadFile(csv, '訂單紀錄.csv', 'text/csv');
}

function exportExcel() {
  const data = filteredOrders.map(order => ({
    '訂單ID': order.id,
    '時間': order.timestamp,
    '內用/外帶': order.dineType === 'dine' ? '內用' : '外帶',
    '品項': order.items.map(i => `${i.name} X${i.quantity}`).join('; '),
    '總計': order.total
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '訂單紀錄');
  XLSX.writeFile(wb, '訂單紀錄.xlsx');
}

function downloadFile(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

document.addEventListener('DOMContentLoaded', initOrders);
```

- [ ] **Step 3: Commit**

```bash
git add public/admin-orders.html public/js/admin-orders.js
git commit -m "feat: add order records page with filtering, stats, and export"
```

---

## Phase 4: Integration + Polish

### Task 13: Cart Editing Modal

**Files:**
- Modify: `public/index.html` (add modal)
- Modify: `public/css/consumer.css` (add modal styles)
- Modify: `public/js/consumer.js` (add editCartItem logic)

**Interfaces:**
- Consumes: CartManager from cart.js
- Produces: Cart item editing with addon management

- [ ] **Step 1: Add cart edit modal to index.html**

```html
<!-- Cart Edit Modal -->
<div class="modal-overlay" id="cartEditModal" style="display:none">
  <div class="modal">
    <h2 id="cartEditTitle">編輯品項</h2>
    <div id="cartEditAddons"></div>
    <div class="modal-actions">
      <button class="btn btn-secondary" onclick="closeCartEdit()">取消</button>
      <button class="btn btn-primary" onclick="saveCartEdit()">儲存</button>
    </div>
  </div>
</div>
```

- [ ] **Step 2: Add modal styles to consumer.css**

```css
.cart-edit-addons {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
}
.cart-edit-addon {
  padding: 8px 16px;
  border-radius: var(--radius-pill);
  border: 2px solid var(--border);
  background: transparent;
  color: var(--text);
  cursor: pointer;
}
.cart-edit-addon.active {
  background: var(--primary);
  border-color: var(--primary);
}
```

- [ ] **Step 3: Update consumer.js editCartItem function**

```javascript
let editingCartKey = null;

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
```

- [ ] **Step 4: Commit**

```bash
git add public/index.html public/css/consumer.css public/js/consumer.js
git commit -m "feat: add cart item editing with addon management"
```

---

### Task 14: QR Code Generation

**Files:**
- Modify: `public/admin.html` (add QR section)
- Modify: `public/js/admin-home.js` (add QR generation)

**Interfaces:**
- Consumes: shopId from config
- Produces: QR code display and download

- [ ] **Step 1: Add QR section to admin.html**

```html
<!-- QR Code -->
<div class="admin-section">
  <h2>QR Code</h2>
  <div id="qrCode" style="text-align:center; margin:16px 0;"></div>
  <button class="btn btn-primary" onclick="downloadQR()">下載 QR Code</button>
</div>
```

- [ ] **Step 2: Add QR library to admin.html head**

```html
<script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js"></script>
```

- [ ] **Step 3: Add QR generation to admin-home.js**

```javascript
// After initAdmin():
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

// Call in initAdmin():
generateQR();
```

- [ ] **Step 4: Commit**

```bash
git add public/admin.html public/js/admin-home.js
git commit -m "feat: add QR code generation for shop"
```

---

### Task 15: Password Protection

**Files:**
- Modify: `public/admin.html`
- Modify: `public/admin-menu.html`
- Modify: `public/admin-orders.html`
- Create: `public/js/auth.js`

**Interfaces:**
- Consumes: localStorage password hash
- Produces: Password gate for admin pages

- [ ] **Step 1: Create public/js/auth.js**

```javascript
window.AuthManager = {
  PASSWORD_KEY: 'admin_password',

  isAuthenticated() {
    return sessionStorage.getItem('admin_auth') === 'true';
  },

  login(password) {
    const stored = localStorage.getItem(this.PASSWORD_KEY);
    if (!stored) {
      // No password set, allow access
      sessionStorage.setItem('admin_auth', 'true');
      return true;
    }
    if (btoa(password) === stored) {
      sessionStorage.setItem('admin_auth', 'true');
      return true;
    }
    return false;
  },

  requireAuth() {
    if (this.isAuthenticated()) return true;
    const password = prompt('請輸入管理密碼：');
    if (!password) return false;
    return this.login(password);
  }
};
```

- [ ] **Step 2: Add auth check to each admin page**

Add at the top of each admin page's `<script>` section:

```javascript
if (!window.AuthManager.requireAuth()) {
  document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;"><h1>密碼錯誤</h1></div>';
  throw new Error('Authentication failed');
}
```

- [ ] **Step 3: Add auth.js script to each admin page**

```html
<script src="js/auth.js"></script>
```

- [ ] **Step 4: Commit**

```bash
git add public/js/auth.js public/admin.html public/admin-menu.html public/admin-orders.html
git commit -m "feat: add password protection for admin pages"
```

---

### Task 16: Auto-Delete Old Orders

**Files:**
- Modify: `public/js/admin-orders.js`

**Interfaces:**
- Consumes: FirebaseCore.deleteOrders()
- Produces: Automatic cleanup of expired orders

- [ ] **Step 1: Add auto-delete function to admin-orders.js**

```javascript
async function autoDeleteOldOrders() {
  const retentionDays = parseInt(localStorage.getItem('kiosk_retention_days') || '30');
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);

  const oldOrders = allOrders.filter(o => new Date(o.timestamp) < cutoff);
  if (oldOrders.length > 0) {
    await window.FirebaseCore.deleteOrders(oldOrders.map(o => o.id));
    allOrders = allOrders.filter(o => new Date(o.timestamp) >= cutoff);
    filteredOrders = filteredOrders.filter(o => new Date(o.timestamp) >= cutoff);
    renderOrders();
    renderStats();
  }
}

// Call in initOrders() after renderOrders():
await autoDeleteOldOrders();
```

- [ ] **Step 2: Commit**

```bash
git add public/js/admin-orders.js
git commit -m "feat: add auto-delete for expired orders"
```

---

### Task 17: Final Integration Test

**Files:**
- Modify: All files as needed for bug fixes

**Interfaces:**
- Consumes: All previous tasks
- Produces: Working system

- [ ] **Step 1: Test consumer page flow**
  - Load index.html?shop=demo-shop
  - Verify menu loads
  - Test category switching
  - Test item selection (unselected → active → selected)
  - Test addon toggle
  - Test add to cart
  - Test cart merge logic
  - Test order confirmation

- [ ] **Step 2: Test admin pages**
  - Load admin.html?shop=demo-shop
  - Test password protection
  - Test store info save
  - Test theme switch
  - Test menu management CRUD
  - Test addon library management
  - Test Excel import/export
  - Test order filtering and stats

- [ ] **Step 3: Test Firebase sync**
  - Verify menu saves to Firestore
  - Verify orders save to Firestore
  - Verify stats update correctly
  - Test multi-device sync

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "fix: integration bug fixes and polish"
```

---

## Verification Checklist

- [ ] Consumer page loads menu from Firestore
- [ ] Category switching works correctly
- [ ] Item states (unselected/active/selected) work correctly
- [ ] Addon toggle works on active item only
- [ ] Cart merge logic works (same item + same addons = merge)
- [ ] Cart editing works (change addons)
- [ ] Order confirmation flow works
- [ ] Admin password protection works
- [ ] Theme switching works
- [ ] Menu CRUD works
- [ ] Addon library management works
- [ ] Excel import/export works
- [ ] Order filtering works
- [ ] Stats display works
- [ ] CSV/Excel export works
- [ ] Auto-delete old orders works
- [ ] QR code generates and downloads
- [ ] Multi-device sync works
