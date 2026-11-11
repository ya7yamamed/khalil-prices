/* items.js — قائمة المواد: بحث، فلترة، ترتيب، تصدير */
(function () {
  'use strict';
  const { state, esc, normalize, fmtPrice, fmtDate, CURRENCIES, $ } = KP;

  // الفلاتر تبقى محفوظة طول الجلسة
  const f = { q: '', main: '', sub: '', cur: '', archived: false, sort: 'alpha' };
  KP.itemsFilter = f;

  const SORTS = { alpha: 'أبجدي', price: 'السعر', updated: 'آخر تحديث' };

  function filtered() {
    const nq = normalize(f.q);
    let ids = null;
    if (f.sub) ids = new Set([f.sub]);
    else if (f.main) ids = new Set([f.main, ...KP.subCategories(f.main).map((s) => s.id)]);
    return state.items.filter((it) =>
      it.is_archived === f.archived &&
      (!ids || ids.has(it.category_id)) &&
      (!f.cur || it.currency === f.cur) &&
      (!nq || it.name_norm.includes(nq)));
  }

  // ترتيب المجموعات كما يظهر بشاشة المجموعات
  function catOrderKey(catId) {
    const c = KP.categoryById(catId);
    if (!c) return [9999, 9999];
    if (!c.parent_id) return [c.sort_order, -1];
    const p = KP.categoryById(c.parent_id);
    return [p ? p.sort_order : 9999, c.sort_order];
  }

  function rowHtml(it) {
    const cur = CURRENCIES[it.currency];
    return `<a class="row" href="#item/${encodeURIComponent(it.id)}">
      <div class="row-main">
        <b>${esc(it.name)}</b>
        <span>${esc(it.unit)} · ${fmtDate(it.price_updated_at)}${f.sort !== 'alpha' ? ' · ' + esc(KP.categoryPath(it.category_id)) : ''}</span>
      </div>
      <div class="row-price">
        <b><span class="num">${fmtPrice(it.sale_price, it.currency)}</span> <small class="${cur.cls}">${cur.short}</small></b>
        <span class="muted small">ش: <span class="num">${fmtPrice(it.purchase_price, it.currency)}</span></span>
      </div>
    </a>`;
  }

  function listHtml(list) {
    if (!list.length) {
      return `<div class="placeholder">${state.items.length ? 'ما في أصناف بهالبحث أو الفلتر.' : 'لسا ما في أصناف. اكبس + لتضيف أول صنف.'}</div>`;
    }
    if (f.sort === 'alpha') {
      // كتل حسب المجموعة/الفرعية
      const groups = new Map();
      [...list].sort((a, b) => {
        const ka = catOrderKey(a.category_id), kb = catOrderKey(b.category_id);
        return ka[0] - kb[0] || ka[1] - kb[1] || a.name.localeCompare(b.name, 'ar');
      }).forEach((it) => {
        if (!groups.has(it.category_id)) groups.set(it.category_id, []);
        groups.get(it.category_id).push(it);
      });
      return [...groups.entries()].map(([catId, items]) => `
        <section class="card list">
          <div class="list-head"><span>${esc(KP.categoryPath(catId))}</span><span>${items.length} صنف</span></div>
          ${items.map(rowHtml).join('')}
        </section>`).join('');
    }
    const sorted = [...list].sort(f.sort === 'price'
      ? (a, b) => a.currency.localeCompare(b.currency) || (b.sale_price ?? -1) - (a.sale_price ?? -1)
      : (a, b) => b.price_updated_at.localeCompare(a.price_updated_at));
    if (f.sort === 'price') {
      // السعر يترتب ضمن كل عملة على حدة
      const byCur = {};
      sorted.forEach((it) => (byCur[it.currency] = byCur[it.currency] || []).push(it));
      return Object.entries(byCur).map(([c, items]) => `
        <section class="card list">
          <div class="list-head"><span>${CURRENCIES[c].name} — من الأغلى للأرخص</span><span>${items.length}</span></div>
          ${items.map(rowHtml).join('')}
        </section>`).join('');
    }
    return `<section class="card list">${sorted.map(rowHtml).join('')}</section>`;
  }

  function chipsHtml() {
    const mains = KP.mainCategories();
    const subs = f.main ? KP.subCategories(f.main) : [];
    return `
      <div class="chips scroll-x" role="group" aria-label="المجموعات">
        <button class="chip ${!f.main ? 'on' : ''}" data-main="">الكل</button>
        ${mains.map((m) => `<button class="chip ${f.main === m.id ? 'on' : ''}" data-main="${m.id}">${esc(m.name)}</button>`).join('')}
      </div>
      ${subs.length ? `<div class="chips scroll-x" role="group" aria-label="الفرعيات">
        <button class="chip chip-sm ${!f.sub ? 'on-soft' : ''}" data-sub="">كل ${esc(KP.categoryById(f.main).name)}</button>
        ${subs.map((s) => `<button class="chip chip-sm ${f.sub === s.id ? 'on-soft' : ''}" data-sub="${s.id}">${esc(s.name)}</button>`).join('')}
      </div>` : ''}`;
  }

  function render(el, catParam) {
    if (catParam !== undefined) {
      const c = KP.categoryById(catParam);
      if (c) { f.main = c.parent_id || c.id; f.sub = c.parent_id ? c.id : ''; }
      history.replaceState(null, '', '#items');
    }
    if (f.main && !KP.categoryById(f.main)) { f.main = ''; f.sub = ''; }

    el.innerHTML = `
      <div class="toolbar card stack">
        <label class="search">
          <svg aria-hidden="true" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
          <span class="sr-only">بحث عن صنف</span>
          <input id="i-q" type="search" placeholder="ابحث عن صنف…" value="${esc(f.q)}" autocomplete="off">
        </label>
        <div id="i-chips" class="stack-sm">${chipsHtml()}</div>
        <div class="filters">
          <label class="mini-select"><span class="sr-only">الترتيب</span>
            <select id="i-sort">${Object.entries(SORTS).map(([k, v]) => `<option value="${k}" ${f.sort === k ? 'selected' : ''}>ترتيب: ${v}</option>`).join('')}</select>
          </label>
          <label class="mini-select"><span class="sr-only">العملة</span>
            <select id="i-cur"><option value="">كل العملات</option>${Object.entries(CURRENCIES).map(([k, c]) => `<option value="${k}" ${f.cur === k ? 'selected' : ''}>${c.label}</option>`).join('')}</select>
          </label>
          <button id="i-arch" class="chip chip-sm ${f.archived ? 'on' : ''}" type="button" aria-pressed="${f.archived}">المؤرشف</button>
        </div>
      </div>
      <div class="count-row"><span id="i-count"></span>
        <button id="i-xlsx" class="link-btn" type="button">
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>
          تصدير Excel</button>
      </div>
      <div id="i-list" class="stack"></div>`;

    function refreshList() {
      const list = filtered();
      $('i-count').textContent = list.length + (f.archived ? ' صنف مؤرشف' : ' صنف');
      $('i-list').innerHTML = listHtml(list);
    }
    refreshList();

    let t;
    $('i-q').addEventListener('input', (e) => { clearTimeout(t); t = setTimeout(() => { f.q = e.target.value; refreshList(); }, 120); });
    $('i-chips').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if ('main' in b.dataset) { f.main = b.dataset.main; f.sub = ''; }
      else if ('sub' in b.dataset) f.sub = b.dataset.sub;
      $('i-chips').innerHTML = chipsHtml();
      refreshList();
    });
    $('i-sort').addEventListener('change', (e) => { f.sort = e.target.value; refreshList(); });
    $('i-cur').addEventListener('change', (e) => { f.cur = e.target.value; refreshList(); });
    $('i-arch').addEventListener('click', (e) => {
      f.archived = !f.archived;
      e.currentTarget.classList.toggle('on', f.archived);
      e.currentTarget.setAttribute('aria-pressed', f.archived);
      refreshList();
    });
    $('i-xlsx').addEventListener('click', () => {
      const title = f.sub ? KP.categoryPath(f.sub) : f.main ? KP.categoryById(f.main).name : 'كل الأصناف';
      KP.exportExcel(filtered(), title);
    });
  }

  KP.screens.items = { title: 'المواد', render, ready: true };
})();
