/* groups.js — إنشاء وإدارة المجموعات والفرعيات */
(function () {
  'use strict';
  const { db, state, esc, normalize, $ } = KP;

  let isSub = false;

  function siblingsOf(parentId) {
    return state.categories
      .filter((c) => (c.parent_id || null) === (parentId || null))
      .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, 'ar'));
  }

  function rowHtml(c, isChild, index, total) {
    const count = KP.countInCategory(c.id, true);
    const subs = isChild ? 0 : KP.subCategories(c.id).length;
    const meta = count + ' صنف' + (subs ? ' · ' + subs + ' فرعيات' : '');
    return `
      <div class="tree-row ${isChild ? 'tree-child' : ''}">
        <div class="row-main">
          <b>${esc(c.name)}</b>
          <span>${meta}</span>
        </div>
        <div class="row-actions">
          <button class="icon-sm" data-act="up" data-id="${c.id}" aria-label="لفوق: ${esc(c.name)}" ${index === 0 ? 'disabled' : ''}>
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 15l6-6 6 6"/></svg>
          </button>
          <button class="icon-sm" data-act="down" data-id="${c.id}" aria-label="لتحت: ${esc(c.name)}" ${index === total - 1 ? 'disabled' : ''}>
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
          </button>
          <button class="icon-sm" data-act="rename" data-id="${c.id}" aria-label="تعديل اسم: ${esc(c.name)}">
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>
          </button>
          <button class="icon-sm icon-danger" data-act="delete" data-id="${c.id}" aria-label="حذف: ${esc(c.name)}">
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>
          </button>
        </div>
      </div>`;
  }

  function treeHtml() {
    const mains = siblingsOf(null);
    if (!mains.length) return '<div class="placeholder">لسا ما في مجموعات.</div>';
    return mains.map((m, i) => {
      const subs = siblingsOf(m.id);
      return rowHtml(m, false, i, mains.length) + subs.map((s, j) => rowHtml(s, true, j, subs.length)).join('');
    }).join('');
  }

  async function refresh(el) {
    try { await KP.loadAll(); } catch (e) { KP.toast(KP.errorText(e), 'error'); }
    render(el);
  }

  async function create(el) {
    const name = $('g-name').value.trim();
    const parentId = isSub ? $('g-parent').value : null;
    const msg = $('g-msg');
    msg.className = 'hidden';
    if (!name) { msg.className = 'alert alert-danger'; msg.textContent = 'اكتب اسم المجموعة.'; return; }
    if (isSub && !parentId) { msg.className = 'alert alert-danger'; msg.textContent = 'اختار المجموعة الأم.'; return; }
    const n = normalize(name);
    if (siblingsOf(parentId).some((c) => normalize(c.name) === n)) {
      msg.className = 'alert alert-danger'; msg.textContent = 'في مجموعة بنفس الاسم بنفس المكان.'; return;
    }
    const sort = siblingsOf(parentId).reduce((mx, c) => Math.max(mx, c.sort_order), -1) + 1;
    const btn = $('g-create');
    btn.disabled = true;
    const { error } = await db.from('categories').insert({ name, parent_id: parentId, sort_order: sort });
    btn.disabled = false;
    if (error) { msg.className = 'alert alert-danger'; msg.textContent = KP.errorText(error); return; }
    KP.toast('انعملت المجموعة ✓');
    await refresh(el);
  }

  async function move(el, id, dir) {
    const c = KP.categoryById(id);
    const sibs = siblingsOf(c.parent_id);
    const i = sibs.findIndex((s) => s.id === id);
    const j = i + dir;
    if (j < 0 || j >= sibs.length) return;
    [sibs[i], sibs[j]] = [sibs[j], sibs[i]];
    // إعادة ترقيم كل الإخوة لتفادي تساوي الترتيب
    const results = await Promise.all(sibs.map((s, k) => db.from('categories').update({ sort_order: k }).eq('id', s.id)));
    const err = results.find((r) => r.error);
    if (err) KP.toast(KP.errorText(err.error), 'error');
    await refresh(el);
  }

  async function rename(el, id) {
    const c = KP.categoryById(id);
    const name = (window.prompt('الاسم الجديد للمجموعة:', c.name) || '').trim();
    if (!name || name === c.name) return;
    const { error } = await db.from('categories').update({ name }).eq('id', id);
    if (error) { KP.toast(KP.errorText(error), 'error'); return; }
    KP.toast('تعدّل الاسم ✓');
    await refresh(el);
  }

  async function remove(el, id) {
    const c = KP.categoryById(id);
    const subs = KP.subCategories(id).length;
    const items = KP.countInCategory(id, true);
    if (subs) { window.alert('هالمجموعة فيها ' + subs + ' فرعيات. احذفهم أو انقلهم أول.'); return; }
    if (items) { window.alert('هالمجموعة فيها ' + items + ' صنف (مع المؤرشف). انقل الأصناف لمجموعة تانية أو احذفهم أول.'); return; }
    if (!window.confirm('أكيد بدك تحذف مجموعة "' + c.name + '"؟')) return;
    const { error } = await db.from('categories').delete().eq('id', id);
    if (error) { KP.toast(KP.errorText(error), 'error'); return; }
    KP.toast('انحذفت المجموعة');
    await refresh(el);
  }

  function render(el) {
    const mains = siblingsOf(null);
    el.innerHTML = `
      <section class="card stack" aria-label="مجموعة جديدة">
        <h2 class="h2">مجموعة جديدة</h2>
        <div class="field">
          <label for="g-name">الاسم</label>
          <input id="g-name" class="input" type="text" placeholder="مثلاً: موالح" autocomplete="off">
        </div>
        <button id="g-sub" class="switch-row" role="switch" aria-checked="${isSub}" type="button" ${mains.length ? '' : 'disabled'}>
          <span>مجموعة فرعية تحت مجموعة تانية</span>
          <span class="switch"><span></span></span>
        </button>
        <div class="field ${isSub && mains.length ? '' : 'hidden'}" id="g-parent-wrap">
          <label for="g-parent">المجموعة الأم</label>
          <select id="g-parent" class="input">
            ${mains.map((m) => `<option value="${m.id}">${esc(m.name)}</option>`).join('')}
          </select>
        </div>
        <div id="g-msg" class="hidden" role="alert"></div>
        <button id="g-create" class="btn btn-accent btn-block" type="button">إنشاء المجموعة</button>
      </section>

      <section class="card list" aria-label="المجموعات الحالية">
        <div class="list-head"><span>المجموعات الحالية</span><span>${state.categories.length}</span></div>
        <div id="g-tree">${treeHtml()}</div>
      </section>

      <p class="note">المجموعة اللي فيها أصناف أو فرعيات ما بتنحذف إلا بعد ما تفضّيها.</p>`;

    $('g-sub').addEventListener('click', () => {
      isSub = !isSub;
      $('g-sub').setAttribute('aria-checked', isSub);
      $('g-parent-wrap').classList.toggle('hidden', !isSub);
    });
    $('g-create').addEventListener('click', () => create(el));
    $('g-name').addEventListener('keydown', (e) => { if (e.key === 'Enter') create(el); });
    $('g-tree').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-act]');
      if (!b || b.disabled) return;
      const { act, id } = b.dataset;
      if (act === 'up') move(el, id, -1);
      else if (act === 'down') move(el, id, 1);
      else if (act === 'rename') rename(el, id);
      else if (act === 'delete') remove(el, id);
    });
  }

  KP.screens.groups = { title: 'المجموعات', render };
})();
