/* =========================================
   政府網站快速搜尋 — 主要邏輯
   ========================================= */

// ─── Firebase 設定（請替換為你自己的 Firebase 專案設定）───
const firebaseConfig = {
  apiKey: "AIzaSyAfGMh5s7l409V3KPwMGRz8H_Cs6cYaLrs",
  authDomain: "home-app-57ac7.firebaseapp.com",
  projectId: "home-app-57ac7",
  storageBucket: "home-app-57ac7.firebasestorage.app",
  messagingSenderId: "386359891243",
  appId: "1:386359891243:web:882219dc8f3e91e230a16e"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// ─── 狀態 ───
let allWebsites = [];
let filteredWebsites = [];
let activeCategory = 'all';
let searchKeyword = '';
let totalClicks = 0;

// ─── DOM 參考 ───
const $ = id => document.getElementById(id);
const searchInput = $('searchInput');
const searchBtn = $('searchBtn');
const categoriesSection = $('categoriesSection');
const resultsList = $('resultsList');
const resultStats = $('resultStats');
const loadingIndicator = $('loadingIndicator');
const submitToggle = $('submitToggle');
const submitForm = $('submitForm');
const submitName = $('submitName');
const submitUrl = $('submitUrl');
const submitCategory = $('submitCategory');
const submitCity = $('submitCity');
const submitTags = $('submitTags');
const submitDesc = $('submitDesc');
const submitBtn = $('submitBtn');
const submitMessage = $('submitMessage');
const exportBtn = $('exportBtn');

// ─── 初始化 ───
document.addEventListener('DOMContentLoaded', () => {
  loadData();
  setupSearch();
  setupSubmitForm();
  setupExport();
});

// ─── 載入資料 ───
async function loadData() {
  loadingIndicator.style.display = 'block';
  resultsList.innerHTML = '';

  try {
    const snapshot = await db.collection('websites').orderBy('clicks', 'desc').get();

    if (snapshot.empty) {
      loadingIndicator.textContent = '尚無網站資料，請先新增或載入範例資料';
      showSeedButton();
      return;
    }

    allWebsites = [];
    snapshot.forEach(doc => {
      allWebsites.push({ id: doc.id, ...doc.data() });
    });

    totalClicks = allWebsites.reduce((sum, w) => sum + (w.clicks || 0), 0);

    loadingIndicator.style.display = 'none';
    buildCategories();
    applyFilters();
  } catch (err) {
    loadingIndicator.textContent = '載入失敗，請確認 Firebase 設定是否正確';
    console.error(err);
  }
}

// ─── 載入範例資料按鈕 ───
function showSeedButton() {
  const btn = document.createElement('button');
  btn.className = 'btn-primary';
  btn.textContent = '載入範例資料';
  btn.style.marginTop = '12px';
  btn.onclick = loadSeedData;
  loadingIndicator.appendChild(btn);
}

async function loadSeedData() {
  loadingIndicator.textContent = '正在載入範例資料…';
  try {
    const resp = await fetch('seed-data.json');
    const seedData = await resp.json();
    const batch = db.batch();
    seedData.forEach(item => {
      const ref = db.collection('websites').doc();
      batch.set(ref, {
        name: item.name,
        url: item.url,
        category: item.category,
        tags: item.tags || [],
        description: item.description || '',
        city: item.city || '',
        likes: 0,
        dislikes: 0,
        clicks: 0,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    });
    await batch.commit();
    loadingIndicator.textContent = '範例資料載入完成！重新整理中…';
    setTimeout(() => loadData(), 500);
  } catch (err) {
    loadingIndicator.textContent = '載入範例資料失敗：' + err.message;
    console.error(err);
  }
}

// ─── 建立分類按鈕 ───
function buildCategories() {
  const cats = new Set();
  allWebsites.forEach(w => { if (w.category) cats.add(w.category); });

  categoriesSection.innerHTML = '<button class="category-chip active" data-category="all">全部</button>';
  [...cats].sort().forEach(c => {
    const btn = document.createElement('button');
    btn.className = 'category-chip';
    btn.dataset.category = c;
    btn.textContent = c;
    btn.addEventListener('click', () => selectCategory(c));
    categoriesSection.appendChild(btn);
  });

  // Populate submit category dropdown
  submitCategory.innerHTML = '<option value="">選分類</option>';
  [...cats].sort().forEach(c => {
    const opt = document.createElement('option');
    opt.value = c;
    opt.textContent = c;
    submitCategory.appendChild(opt);
  });
  // Add custom option
  const customOpt = document.createElement('option');
  customOpt.value = '__custom__';
  customOpt.textContent = '其他（自行輸入）…';
  submitCategory.appendChild(customOpt);
}

// ─── 選擇分類 ───
function selectCategory(cat) {
  activeCategory = cat === activeCategory ? 'all' : cat;
  document.querySelectorAll('.category-chip').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.category === activeCategory);
  });
  applyFilters();
}

// ─── 搜尋 ───
function setupSearch() {
  const doSearch = () => {
    searchKeyword = searchInput.value.trim().toLowerCase();
    applyFilters();
  };
  searchBtn.addEventListener('click', doSearch);
  searchInput.addEventListener('keyup', e => { if (e.key === 'Enter') doSearch(); });
  // Debounced real-time search
  let timer;
  searchInput.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(doSearch, 250);
  });
}

// ─── 過濾 ───
function applyFilters() {
  filteredWebsites = allWebsites.filter(w => {
    if (activeCategory !== 'all' && w.category !== activeCategory) return false;
    if (!searchKeyword) return true;
    const kw = searchKeyword;
    const haystack = [
      w.name, w.description, w.category, w.city || '',
      ...(w.tags || [])
    ].filter(Boolean).join(' ').toLowerCase();
    return haystack.includes(kw);
  });

  renderResults();
}

// ─── 顯示結果 ───
function renderResults() {
  resultStats.textContent = filteredWebsites.length
    ? `找到 ${filteredWebsites.length} 個網站`
    : '';

  if (filteredWebsites.length === 0) {
    resultsList.innerHTML = `
      <div class="no-results">
        ${searchKeyword
          ? `沒有找到與「<strong>${searchKeyword}</strong>」相關的網站`
          : '請輸入關鍵字或選擇分類'}
        <div class="suggest">試試：房屋稅、勞保、戶政、健保、教育…<br>
        或點「＋ 提交新網址」來貢獻你知道的政府網站</div>
      </div>`;
    return;
  }

  resultsList.innerHTML = filteredWebsites.map(w => {
    const rate = totalClicks > 0 ? ((w.clicks || 0) / totalClicks * 100).toFixed(1) : 0;
    const tags = (w.tags || []).slice(0, 4);
    const cityTag = w.city ? `<span class="result-tag">📍${w.city}</span>` : '';

    return `
      <div class="result-card" data-id="${w.id}">
        <div class="result-name">${escapeHtml(w.name)}</div>
        ${cityTag ? `<div>${cityTag}</div>` : ''}
        <a class="result-url" href="${escapeHtml(w.url)}" target="_blank" rel="noopener" data-click="true">
          ${escapeHtml(w.url)}
        </a>
        ${w.description ? `<div class="result-desc">${escapeHtml(w.description)}</div>` : ''}
        ${tags.length ? `<div class="result-tags">${tags.map(t => `<span class="result-tag">${escapeHtml(t)}</span>`).join('')}</div>` : ''}

        <div class="usage-row">
          <div class="usage-bar-bg">
            <div class="usage-bar-fill" style="width:${rate}%"></div>
          </div>
          <span class="usage-label">${rate}% 使用率</span>
        </div>

        <div class="actions-row">
          <button class="action-btn like-btn" data-id="${w.id}">
            👍 <span class="count">${w.likes || 0}</span>
          </button>
          <button class="action-btn dislike-btn" data-id="${w.id}">
            👎 <span class="count">${w.dislikes || 0}</span>
          </button>
          <button class="action-btn comment-toggle" data-id="${w.id}">
            💬 <span class="count">${w.commentCount || 0}</span> 則留言
          </button>
        </div>

        <div class="comments-section" id="comments-${w.id}" style="display:none">
          <div id="comments-list-${w.id}"></div>
          <div class="comment-form">
            <input type="text" id="comment-input-${w.id}" placeholder="寫下你的回應…">
            <button onclick="addComment('${w.id}')">送出</button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Attach event listeners
  document.querySelectorAll('[data-click="true"]').forEach(el => {
    el.addEventListener('click', e => {
      const id = el.closest('.result-card')?.dataset.id;
      if (id) trackClick(id);
    });
  });

  document.querySelectorAll('.like-btn').forEach(el => {
    el.addEventListener('click', () => vote(el.dataset.id, 'like'));
  });

  document.querySelectorAll('.dislike-btn').forEach(el => {
    el.addEventListener('click', () => vote(el.dataset.id, 'dislike'));
  });

  document.querySelectorAll('.comment-toggle').forEach(el => {
    el.addEventListener('click', () => toggleComments(el.dataset.id));
  });
}

// ─── 按讚 / 倒讚 ───
async function vote(id, type) {
  const field = type === 'like' ? 'likes' : 'dislikes';
  try {
    const ref = db.collection('websites').doc(id);
    await ref.update({ [field]: firebase.firestore.FieldValue.increment(1) });
    // Update local
    const w = allWebsites.find(x => x.id === id);
    if (w) w[field] = (w[field] || 0) + 1;
    applyFilters();
  } catch (err) {
    console.error(err);
    showToast('投票失敗，請稍後再試');
  }
}

// ─── 點擊追蹤 ───
async function trackClick(id) {
  try {
    const ref = db.collection('websites').doc(id);
    await ref.update({ clicks: firebase.firestore.FieldValue.increment(1) });
    const w = allWebsites.find(x => x.id === id);
    if (w) {
      w.clicks = (w.clicks || 0) + 1;
      totalClicks++;
    }
  } catch (err) {
    console.error(err);
  }
}

// ─── 留言 ───
async function toggleComments(id) {
  const section = document.getElementById('comments-' + id);
  if (!section) return;
  const isOpen = section.style.display !== 'none';
  section.style.display = isOpen ? 'none' : 'block';
  if (!isOpen) loadComments(id);
}

async function loadComments(id) {
  const list = document.getElementById('comments-list-' + id);
  if (!list) return;
  list.innerHTML = '載入中…';
  try {
    const snapshot = await db.collection('comments')
      .where('websiteId', '==', id)
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get();

    if (snapshot.empty) {
      list.innerHTML = '<div class="comment-item">尚無留言</div>';
      return;
    }

    list.innerHTML = snapshot.docs.map(doc => {
      const c = doc.data();
      const time = c.createdAt?.toDate?.()?.toLocaleString('zh-TW') || '';
      return `<div class="comment-item"><strong>${escapeHtml(c.author || '匿名')}</strong> ${escapeHtml(c.content)} <span style="font-size:0.75rem;color:#999">${time}</span></div>`;
    }).join('');
  } catch (err) {
    list.innerHTML = '<div class="comment-item">載入留言失敗</div>';
    console.error(err);
  }
}

async function addComment(id) {
  const input = document.getElementById('comment-input-' + id);
  if (!input || !input.value.trim()) return;
  const content = input.value.trim();
  input.value = '';

  try {
    await db.collection('comments').add({
      websiteId: id,
      author: '匿名',
      content,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    // Increment commentCount
    const ref = db.collection('websites').doc(id);
    await ref.update({ commentCount: firebase.firestore.FieldValue.increment(1) });
    const w = allWebsites.find(x => x.id === id);
    if (w) w.commentCount = (w.commentCount || 0) + 1;

    loadComments(id);
    showToast('留言已送出');
  } catch (err) {
    console.error(err);
    showToast('留言失敗，請稍後再試');
  }
}

// ─── 提交新網址 ───
function setupSubmitForm() {
  submitToggle.addEventListener('click', () => {
    submitForm.classList.toggle('open');
  });

  submitCategory.addEventListener('change', () => {
    if (submitCategory.value === '__custom__') {
      const custom = prompt('請輸入自訂分類名稱：');
      if (custom && custom.trim()) {
        const opt = document.createElement('option');
        opt.value = custom.trim();
        opt.textContent = custom.trim();
        opt.selected = true;
        submitCategory.insertBefore(opt, submitCategory.lastElementChild);
      } else {
        submitCategory.value = '';
      }
    }
  });

  submitBtn.addEventListener('click', submitNewUrl);
}

async function submitNewUrl() {
  const name = submitName.value.trim();
  const url = submitUrl.value.trim();
  const category = submitCategory.value;
  const city = submitCity.value.trim();
  const tags = submitTags.value.split(/[,，、]/).map(t => t.trim()).filter(Boolean);
  const desc = submitDesc.value.trim();

  if (!name || !url || !category) {
    submitMessage.textContent = '請填寫網站名稱、網址、分類（必填）';
    submitMessage.style.color = 'var(--danger)';
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = '送出中…';

  try {
    await db.collection('websites').add({
      name,
      url,
      category,
      city,
      tags,
      description: desc,
      likes: 0,
      dislikes: 0,
      clicks: 0,
      commentCount: 0,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    submitMessage.textContent = '✅ 已送出，待管理員審核後上架';
    submitMessage.style.color = 'var(--success)';
    submitName.value = '';
    submitUrl.value = '';
    submitCategory.value = '';
    submitCity.value = '';
    submitTags.value = '';
    submitDesc.value = '';

    // Refresh data
    setTimeout(() => loadData(), 1000);
  } catch (err) {
    submitMessage.textContent = '送出失敗：' + err.message;
    submitMessage.style.color = 'var(--danger)';
    console.error(err);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = '送出審核';
  }
}

// ─── 匯出資料 ───
function setupExport() {
  exportBtn.addEventListener('click', e => {
    e.preventDefault();
    exportData();
  });
}

function exportData() {
  if (!allWebsites.length) {
    showToast('沒有資料可匯出');
    return;
  }
  const data = JSON.stringify(allWebsites.map(w => ({
    name: w.name,
    url: w.url,
    category: w.category,
    tags: w.tags,
    description: w.description,
    city: w.city,
    likes: w.likes || 0,
    dislikes: w.dislikes || 0,
    clicks: w.clicks || 0
  })), null, 2);

  const blob = new Blob([data], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `政府網站資料_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  showToast('資料已匯出');
}

// ─── 工具函式 ───
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function showToast(msg) {
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), 2500);
}

// Expose to global for inline onclick
window.addComment = addComment;
window.selectCategory = selectCategory;
