(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.AILearn = factory();
  }
})(this, function () {
  var THEMES = {
    green: {
      '--primary': '#76B947',
      '--primary-light': '#e8f5e0',
      '--primary-dark': '#5a9a32',
      '--bg': '#F1F5F2',
      '--dark': '#2D2D2D',
      '--card': '#FFFFFF',
      '--text': '#2D2D2D',
      '--text-secondary': '#6B7280',
      '--border': '#E5E7EB',
      '--border-light': '#F3F4F6'
    },
    dark: {
      '--primary': '#38BDF8',
      '--primary-light': '#0E7490',
      '--primary-dark': '#7DD3FC',
      '--bg': '#0F172A',
      '--dark': '#1E293B',
      '--card': '#1E293B',
      '--text': '#E2E8F0',
      '--text-secondary': '#94A3B8',
      '--border': '#334155',
      '--border-light': '#334155'
    },
    fresh: {
      '--primary': '#0284C7',
      '--primary-light': '#E0F2FE',
      '--primary-dark': '#075985',
      '--bg': '#F0F9FF',
      '--dark': '#0C4A6E',
      '--card': '#FFFFFF',
      '--text': '#0F172A',
      '--text-secondary': '#64748B',
      '--border': '#BAE6FD',
      '--border-light': '#E0F2FE'
    }
  };

  function filterSelected(allIds, selectedIds) {
    return allIds.filter(function (id) { return selectedIds.indexOf(id) !== -1; });
  }

  function pageNext(current, selected) {
    var i = selected.indexOf(current);
    if (i === -1 || i === selected.length - 1) return current;
    return selected[i + 1];
  }

  function pagePrev(current, selected) {
    var i = selected.indexOf(current);
    if (i <= 0) return current;
    return selected[i - 1];
  }

  function progressPct(selectedIds, completedIds) {
    if (selectedIds.length === 0) return 0;
    var done = selectedIds.filter(function (id) { return completedIds.indexOf(id) !== -1; }).length;
    return Math.round((done / selectedIds.length) * 100);
  }

  function scoreResult(correct, total) {
    var pct = total === 0 ? 0 : Math.round((correct / total) * 100);
    var label = pct === 100 ? '滿分！' : (pct >= 60 ? '及格' : '再練習');
    return { pct: pct, label: label };
  }

  function themeVars(name) {
    return THEMES[name] || THEMES.green;
  }

  return {
    THEMES: THEMES,
    themeVars: themeVars,
    filterSelected: filterSelected,
    pageNext: pageNext,
    pagePrev: pagePrev,
    progressPct: progressPct,
    scoreResult: scoreResult
  };
});