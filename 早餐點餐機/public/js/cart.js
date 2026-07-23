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
