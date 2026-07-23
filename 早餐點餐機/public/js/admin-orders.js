let allOrders = [];
let filteredOrders = [];
let selectedOrders = new Set();

async function initOrders() {
  if (!window.AuthManager.requireAuth()) {
    document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;"><h1>密碼錯誤</h1></div>';
    return;
  }

  window.FirebaseCore.init();
  allOrders = await window.FirebaseCore.getOrders(500);
  filteredOrders = [...allOrders];

  // Update back link
  const shopId = window.APP_CONFIG.shopId;
  document.getElementById('linkBack').href = `admin.html?shop=${shopId}`;

  renderOrders();
  renderStats();
  loadRetention();

  // Auto-delete old orders
  await autoDeleteOldOrders();
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
