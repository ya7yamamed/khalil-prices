/* prices.js — جدول تعديل الأسعار السريع */
(function () {
  'use strict';
  const { db, state, esc, normalize, fmtPrice, fmtTyping, parseNum, CURRENCIES, $ } = KP;

  const f = { q: '', main: '', sub: '' };
  let edits = {}; // id → { buy: 'نص', sale: 'نص' }

  const orig = (it, k) => fmtPrice(k === 'buy' ? it.purchase_price : it.sale_price, it.currency).replace('—', '');
  const valueOf = (it, k) => (edits[it.id] && edits[it.id][k] !== undefined ? edits[it.id][k] : orig(it, k));
  const numOrig = (it, k) => (k === 'buy' ? it.purchase_price : it.sale_price);
  const fieldChanged = (it, k) => {
    if (!edits[it.id] || edits[it.id][k] === undefined) return false;
    const a = parseNum(edits[it.id][k]), b = numOrig(it, k) === null ? null : Number(numOrig(it, k));
    return a !== b;
  };
  const rowChanged = (it) => fieldChanged(it, 'buy') || fieldChanged(it, 'sale');
  const changedItems = () => state.items.filter((it) => !it.is_archived && rowChanged(it));

  function visible() {
    const nq = normalize(f.q);
    let ids = null;
    if (f.sub) ids = new Set([f.sub]);
    else if (f.main) ids = new Set([f.main, ...KP.subCategories(f.main).map((s) => s.id)]);
    return state.items
      .filter((it) => !it.is_archived && (!ids || ids.has(it.category_id)) && (!nq || it.name_norm.includes(nq)))
      .sort((a, b) => KP.categoryPath(a.category_id).localeCompare(KP.categoryPath(b.category_id), 'ar') || a.name.localeCompare(b.name, 'ar'));
  }

  function rowHtml(it) {
    const ch = rowChanged(it);
    const cur = CURRENCIES[it.currency];
    const buy = parseNum(valueOf(it, 'buy')), sale = parseNum(valueOf(it, 'sale'));
    const loss = buy !== null && sale !== null && sale < buy;
    let meta = `${esc(it.unit)} · <span class="${cur.cls}">${cur.short}</span>`;
    if (ch) {
      const was = [];
      if (fieldChanged(it, 'buy')) was.push('ش ' + orig(it, 'buy'));
      if (fieldChanged(it, 'sale')) was.push('م ' + orig(it, 'sale'));
      meta = `<span class="was">كان: <span class="num">${was.join(' · ') || '—'}</span></span>`;
    }
    return `<div class="ptable-row ${ch ? 'changed' : ''}" data-id="${it.id}">
      <div class="ptable-name"><b>${esc(it.name)}</b><span>${meta}</span></div>
      <input class="pinput ${fieldChanged(it, 'buy') ? 'edited' : ''}" data-k="buy" type="text" inputmode="decimal" dir="ltr" autocomplete="off" aria-label="سعر الشراء: ${esc(it.name)}" value="${esc(valueOf(it, 'buy'))}">
      <input class="pinput ${fieldChanged(it, 'sale') ? 'edited' : ''} ${loss ? 'input-error' : ''}" data-k="sale" type="text" inputmode="decimal" dir="ltr" autocomplete="off" aria-label="سعر المبيع: ${esc(it.name)}" value="${esc(valueOf(it, 'sale'))}">
    </div>`;
  }

  function chipsHtml() {
    const mains = KP.mainCategories();
    const subs = f.main ? KP.subCategories(f.main) : [];
    return `<div class="chips scroll-x">
        <button class="chip ${!f.main ? 'on' : ''}" data-main="">الكل</button>
        ${mains.map((m) => `<button class="chip ${f.main === m.id ? 'on' : ''}" data-main="${m.id}">${esc(m.name)}</button>`).join('')}
      </div>
      ${subs.length ? `<div class="chips scroll-x">
        <button class="chip chip-sm ${!f.sub ? 'on-soft' : ''}" data-sub="">كل ${esc(KP.categoryById(f.main).name)}</button>
        ${subs.map((s) => `<button class="chip chip-sm ${f.sub === s.id ? 'on-soft' : ''}" data-sub="${s.id}">${esc(s.name)}</button>`).join('')}
      </div>` : ''}`;
  }

  function render(el) {
    if (f.main && !KP.categoryById(f.main)) { f.main = ''; f.sub = ''; }
    el.innerHTML = `
      <div class="toolbar card stack">
        <label class="search">
          <svg aria-hidden="true" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
          <span class="sr-only">بحث</span>
          <input id="p-q" type="search" placeholder="ابحث عن صنف…" value="${esc(f.q)}" autocomplete="off">
        </label>
        <div id="p-chips" class="stack-sm">${chipsHtml()}</div>
      </div>
      <section class="card list ptable">
        <div class="ptable-head"><span>الصنف</span><span>شراء</span><span>مبيع</span></div>
        <div id="p-rows"></div>
      </section>
      <div class="savebar">
        <button id="p-undo" class="btn btn-ghost" type="button">تراجع</button>
        <button id="p-save" class="btn btn-accent" type="button">حفظ الكل (<span id="p-n" class="num">0</span>)</button>
      </div>`;

    const rowsEl = $('p-rows');
    function refreshRows() {
      const list = visible();
      rowsEl.innerHTML = list.length ? list.map(rowHtml).join('')
        : `<div class="placeholder">${state.items.length ? 'ما في أصناف بهالفلتر.' : 'لسا ما في أصناف.'}</div>`;
      updateCount();
    }
    function updateCount() {
      const n = changedItems().length;
      $('p-n').textContent = n;
      $('p-save').disabled = !n;
      $('p-undo').disabled = !n;
    }
    refreshRows();

    // الكتابة: تنسيق فوري + تحديث حالة السطر بدون إعادة رسم الحقل
    rowsEl.addEventListener('input', (e) => {
      const inp = e.target.closest('.pinput');
      if (!inp) return;
      const row = inp.closest('.ptable-row');
      const it = state.items.find((x) => x.id === row.dataset.id);
      inp.value = fmtTyping(inp.value, CURRENCIES[it.currency].decimals);
      edits[it.id] = Object.assign({}, edits[it.id], { [inp.dataset.k]: inp.value });
      // تحديث مظهر السطر فقط
      const tmp = document.createElement('div');
      tmp.innerHTML = rowHtml(it);
      const fresh = tmp.firstElementChild;
      row.className = fresh.className;
      row.querySelector('.ptable-name').innerHTML = fresh.querySelector('.ptable-name').innerHTML;
      row.querySelectorAll('.pinput').forEach((x, i) => { x.className = fresh.querySelectorAll('.pinput')[i].className; });
      updateCount();
    });
    // Enter ينقل للحقل التالي
    rowsEl.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' || !e.target.classList.contains('pinput')) return;
      e.preventDefault();
      const all = [...rowsEl.querySelectorAll('.pinput')];
      const next = all[all.indexOf(e.target) + 1];
      if (next) { next.focus(); next.select(); } else e.target.blur();
    });
    rowsEl.addEventListener('focusin', (e) => { if (e.target.classList.contains('pinput')) e.target.select(); });

    let t;
    $('p-q').addEventListener('input', (e) => { clearTimeout(t); t = setTimeout(() => { f.q = e.target.value; refreshRows(); }, 120); });
    $('p-chips').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if ('main' in b.dataset) { f.main = b.dataset.main; f.sub = ''; }
      else if ('sub' in b.dataset) f.sub = b.dataset.sub;
      $('p-chips').innerHTML = chipsHtml();
      refreshRows();
    });

    $('p-undo').addEventListener('click', () => {
      if (!window.confirm('إلغاء كل التعديلات اللي ما انحفظت؟')) return;
      edits = {};
      refreshRows();
    });

    $('p-save').addEventListener('click', async () => {
      const list = changedItems();
      if (!list.length) return;
      const btn = $('p-save');
      btn.disabled = true; btn.textContent = 'جاري الحفظ…';
      const results = await Promise.all(list.map((it) => {
        const payload = {};
        if (fieldChanged(it, 'buy')) payload.purchase_price = parseNum(edits[it.id].buy);
        if (fieldChanged(it, 'sale')) payload.sale_price = parseNum(edits[it.id].sale);
        return db.from('items').update(payload).eq('id', it.id).then((r) => ({ it, error: r.error }));
      }));
      const failed = results.filter((r) => r.error);
      results.filter((r) => !r.error).forEach((r) => delete edits[r.it.id]);
      try { await KP.loadAll(); } catch (e) { /* يتحدث لاحقاً */ }
      if (failed.length) KP.toast('ما انحفظ ' + failed.length + ' صنف: ' + KP.errorText(failed[0].error), 'error');
      else KP.toast('انحفظت أسعار ' + results.length + ' صنف ✓');
      render(el);
    });

    // تحذير قبل مغادرة الشاشة مع تعديلات غير محفوظة
    KP.leaveGuard = () => {
      if (!changedItems().length) return true;
      if (window.confirm('في ' + changedItems().length + ' تعديل ما انحفظ. بدك تطلع وتلغيهم؟')) { edits = {}; return true; }
      return false;
    };
  }

  window.addEventListener('beforeunload', (e) => {
    if (location.hash.startsWith('#prices') && changedItems().length) { e.preventDefault(); e.returnValue = ''; }
  });

  KP.screens.prices = { title: 'تعديل الأسعار', render, ready: true };
})();
