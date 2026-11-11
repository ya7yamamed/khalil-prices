/* whatsapp.js — إرسال قائمة أسعار: اختيار المحتوى، المعاينة، التقسيم، النسخ */
(function () {
  'use strict';
  const { state, esc, normalize, $ } = KP;

  const MODES = [
    ['all', 'كل الأصناف'], ['group', 'مجموعة'], ['sub', 'فرعية'],
    ['multi', 'عدة مجموعات'], ['pick', 'أصناف محددة'], ['recent', 'آخر التحديثات']
  ];
  const sel = { mode: 'group', group: '', sub: '', multi: new Set(), pick: new Set(), since: '', pickQ: '' };
  let copied = new Set();

  const sendable = () => state.items.filter((it) => !it.is_archived && it.sale_price !== null);
  const idsOf = (mainId) => new Set([mainId, ...KP.subCategories(mainId).map((s) => s.id)]);
  const isoDay = (d) => d.toISOString().slice(0, 10);

  function selection() {
    const items = sendable();
    switch (sel.mode) {
      case 'all': return { items, title: 'كل الأصناف' };
      case 'group': {
        const c = KP.categoryById(sel.group);
        if (!c) return { items: [], title: '' };
        const ids = idsOf(c.id);
        return { items: items.filter((it) => ids.has(it.category_id)), title: c.name };
      }
      case 'sub': {
        const c = KP.categoryById(sel.sub);
        if (!c) return { items: [], title: '' };
        return { items: items.filter((it) => it.category_id === c.id), title: KP.categoryPath(c.id) };
      }
      case 'multi': {
        const mains = KP.mainCategories().filter((m) => sel.multi.has(m.id));
        const ids = new Set(mains.flatMap((m) => [...idsOf(m.id)]));
        return { items: items.filter((it) => ids.has(it.category_id)), title: mains.map((m) => m.name).join('، ') };
      }
      case 'pick': return { items: items.filter((it) => sel.pick.has(it.id)), title: 'أصناف مختارة' };
      case 'recent': {
        const since = sel.since ? new Date(sel.since + 'T00:00:00') : new Date(Date.now() - 7 * 864e5);
        const d = since.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' });
        return { items: items.filter((it) => new Date(it.price_updated_at) >= since), title: 'الأسعار الجديدة من ' + d };
      }
    }
    return { items: [], title: '' };
  }

  function pickerHtml() {
    const mains = KP.mainCategories();
    if (sel.mode === 'all') return '';
    if (sel.mode === 'group') {
      if (!sel.group && mains[0]) sel.group = mains[0].id;
      return `<label class="field"><span class="label">المجموعة</span>
        <select id="w-group" class="input">${mains.map((m) => `<option value="${m.id}" ${m.id === sel.group ? 'selected' : ''}>${esc(m.name)} (${KP.countInCategory(m.id)})</option>`).join('')}</select></label>`;
    }
    if (sel.mode === 'sub') {
      const subs = state.categories.filter((c) => c.parent_id);
      if (!subs.length) return '<p class="note">ما في مجموعات فرعية لهلق.</p>';
      if (!subs.some((s) => s.id === sel.sub)) sel.sub = subs[0].id;
      return `<label class="field"><span class="label">الفرعية</span>
        <select id="w-sub" class="input">${subs.map((s) => `<option value="${s.id}" ${s.id === sel.sub ? 'selected' : ''}>${esc(KP.categoryPath(s.id))}</option>`).join('')}</select></label>`;
    }
    if (sel.mode === 'multi') {
      return `<div class="checks" id="w-multi">${mains.map((m) => `
        <label class="check"><input type="checkbox" value="${m.id}" ${sel.multi.has(m.id) ? 'checked' : ''}><span>${esc(m.name)}</span><small class="muted">${KP.countInCategory(m.id)}</small></label>`).join('')}</div>`;
    }
    if (sel.mode === 'pick') {
      const nq = normalize(sel.pickQ);
      const list = sendable().filter((it) => !nq || it.name_norm.includes(nq)).sort((a, b) => a.name.localeCompare(b.name, 'ar'));
      return `<label class="search search-light"><span class="sr-only">بحث</span>
          <input id="w-pickq" type="search" placeholder="ابحث وحدد الأصناف…" value="${esc(sel.pickQ)}" autocomplete="off"></label>
        <div class="note">محدد: <b class="num">${sel.pick.size}</b> ${sel.pick.size ? '· <button type="button" class="link-btn" id="w-clear">إلغاء التحديد</button>' : ''}</div>
        <div class="checks checks-scroll" id="w-pick">${list.slice(0, 200).map((it) => `
          <label class="check"><input type="checkbox" value="${it.id}" ${sel.pick.has(it.id) ? 'checked' : ''}><span>${esc(it.name)}</span><small class="muted">${esc(KP.categoryPath(it.category_id))}</small></label>`).join('') || '<p class="note">ما في نتائج.</p>'}</div>`;
    }
    if (sel.mode === 'recent') {
      if (!sel.since) sel.since = isoDay(new Date(Date.now() - 7 * 864e5));
      return `<label class="field"><span class="label">الأصناف اللي تغيّر سعرها من تاريخ</span>
        <input id="w-since" class="input" type="date" dir="ltr" value="${sel.since}" max="${isoDay(new Date())}"></label>`;
    }
    return '';
  }

  async function copyText(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); return true; }
    } catch (e) { /* نجرب الطريقة القديمة */ }
    const ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    ta.remove();
    return ok;
  }

  function render(el) {
    el.innerHTML = `
      <div class="chips scroll-x" role="radiogroup" aria-label="شو بدك تبعت" id="w-modes">
        ${MODES.map(([k, v]) => `<button class="chip ${sel.mode === k ? 'on' : ''}" role="radio" aria-checked="${sel.mode === k}" data-mode="${k}">${v}</button>`).join('')}
      </div>
      <section class="card stack" id="w-picker"></section>
      <div id="w-out" class="stack"></div>`;

    const picker = $('w-picker');
    function drawPicker() {
      const html = pickerHtml();
      picker.innerHTML = html;
      picker.classList.toggle('hidden', !html);
    }

    function drawOut() {
      const { items, title } = selection();
      const out = $('w-out');
      if (!items.length) {
        out.innerHTML = `<div class="placeholder">${sel.mode === 'multi' ? 'اختار مجموعة وحدة على الأقل.' : sel.mode === 'pick' ? 'حدد الأصناف اللي بدك تبعتها.' : 'ما في أصناف إلها سعر مبيع بهالاختيار.'}</div>`;
        return;
      }
      const msgs = KPWhatsApp.buildMessages(items, KP, { title, settings: state.settings });
      copied = new Set([...copied].filter((i) => i < msgs.length));
      const warnPhone = !(state.settings && String(state.settings.whatsapp_phone || '').replace(/\D/g, ''));
      out.innerHTML = `
        ${warnPhone ? '<div class="alert alert-warn"><span>رقم واتساب المحل مو محطوط، فالرابط ما رح يطلع آخر الرسالة. <a href="#settings" style="text-decoration: underline">حطه من الإعدادات</a></span></div>' : ''}
        ${msgs.length > 1 ? `<div class="alert alert-warn" role="status"><span>القائمة كبيرة (<span class="num">${items.length}</span> صنف)، تقسّمت لـ <span class="num">${msgs.length}</span> رسائل. انسخ كل وحدة والصقها بمحادثة الزبون بالترتيب.</span></div>
          <div class="progress"><span>التقدّم</span><div class="bar"><div style="width: ${Math.round(copied.size / msgs.length * 100)}%"></div></div><b class="num">${copied.size}/${msgs.length}</b></div>`
          : `<p class="note"><span class="num">${items.length}</span> صنف برسالة وحدة.</p>`}
        ${msgs.map((m, i) => `
          <section class="card list">
            <div class="list-head"><span>${msgs.length > 1 ? 'الرسالة ' + (i + 1) + ' من ' + msgs.length : 'الرسالة'}</span><span><span class="num">${[...m].length.toLocaleString('en-US')}</span> حرف</span></div>
            <div class="wa-preview">${esc(m)}</div>
            <div class="wa-actions">
              <button class="btn ${copied.has(i) ? 'btn-done' : 'btn-navy'}" data-copy="${i}" type="button">${copied.has(i) ? '✓ تم النسخ' : 'نسخ الرسالة'}</button>
              ${navigator.share ? `<button class="btn btn-ghost" data-share="${i}" type="button" aria-label="مشاركة الرسالة ${i + 1}">مشاركة</button>` : ''}
            </div>
          </section>`).join('')}`;
      out.onclick = async (e) => {
        const c = e.target.closest('[data-copy]'), s = e.target.closest('[data-share]');
        if (c) {
          const i = +c.dataset.copy;
          if (await copyText(msgs[i])) { copied.add(i); KP.toast('انتسخت الرسالة ' + (msgs.length > 1 ? (i + 1) : '') + ' ✓'); drawOut(); }
          else KP.toast('ما زبط النسخ، حدد النص بإيدك', 'error');
        } else if (s) {
          const i = +s.dataset.share;
          try { await navigator.share({ text: msgs[i] }); copied.add(i); drawOut(); } catch (err) { /* المستخدم لغى */ }
        }
      };
    }

    function refresh() { copied = new Set(); drawPicker(); drawOut(); }

    $('w-modes').addEventListener('click', (e) => {
      const b = e.target.closest('[data-mode]');
      if (!b) return;
      sel.mode = b.dataset.mode;
      $('w-modes').querySelectorAll('[data-mode]').forEach((x) => {
        x.classList.toggle('on', x === b);
        x.setAttribute('aria-checked', x === b);
      });
      refresh();
    });
    picker.addEventListener('change', (e) => {
      const t = e.target;
      if (t.id === 'w-group') sel.group = t.value;
      else if (t.id === 'w-sub') sel.sub = t.value;
      else if (t.id === 'w-since') sel.since = t.value;
      else if (t.closest('#w-multi')) t.checked ? sel.multi.add(t.value) : sel.multi.delete(t.value);
      else if (t.closest('#w-pick')) { t.checked ? sel.pick.add(t.value) : sel.pick.delete(t.value); copied = new Set(); drawOut(); updatePickCount(); return; }
      copied = new Set();
      drawOut();
    });
    function updatePickCount() {
      const n = picker.querySelector('.note b');
      if (n) n.textContent = sel.pick.size;
    }
    let t;
    picker.addEventListener('input', (e) => {
      if (e.target.id !== 'w-pickq') return;
      clearTimeout(t);
      t = setTimeout(() => {
        sel.pickQ = e.target.value;
        drawPicker();
        const q = $('w-pickq'); q.focus(); q.setSelectionRange(q.value.length, q.value.length);
      }, 200);
    });
    picker.addEventListener('click', (e) => {
      if (e.target.id === 'w-clear') { sel.pick.clear(); drawPicker(); drawOut(); }
    });

    refresh();
  }

  KP.screens.whatsapp = { title: 'إرسال قائمة أسعار', render, ready: true };
})();
