/* item-form.js — بطاقة الصنف: إضافة وتعديل، مع فحص التكرار */
(function () {
  'use strict';
  const { db, state, esc, $, CURRENCIES, parseNum, fmtTyping, fmtPrice } = KP;

  // نتذكر آخر اختيارات حتى إدخال عدة أصناف ورا بعض يكون أسرع
  const last = { main: null, sub: '', currency: 'SYP_OLD', unit: '' };

  function render(el, id) {
    const editing = id ? state.items.find((it) => it.id === id) : null;
    if (id && !editing) {
      el.innerHTML = '<div class="placeholder">هالصنف مو موجود، يمكن انحذف.</div>';
      return;
    }
    const mains = KP.mainCategories();
    if (!mains.length) {
      el.innerHTML = `<div class="card empty">
        <p>لازم تعمل مجموعة وحدة على الأقل قبل ما تضيف أصناف.</p>
        <a class="btn btn-accent" href="#groups">إنشاء مجموعة</a></div>`;
      return;
    }

    // القيم الابتدائية
    let mainId, subId;
    if (editing) {
      const c = KP.categoryById(editing.category_id);
      mainId = c && c.parent_id ? c.parent_id : editing.category_id;
      subId = c && c.parent_id ? c.id : '';
    } else {
      mainId = (last.main && KP.categoryById(last.main)) ? last.main : mains[0].id;
      subId = last.sub && KP.categoryById(last.sub) ? last.sub : '';
    }
    let currency = editing ? editing.currency : last.currency;
    const dec = () => CURRENCIES[currency].decimals;

    el.innerHTML = `
      ${editing ? `<p class="note">آخر تحديث للسعر: <span class="num">${KP.fmtDate(editing.price_updated_at)}</span>${editing.is_archived ? ' · <b style="color: var(--accent-ink)">مؤرشف</b>' : ''}</p>` : ''}
      <form id="f" class="stack" novalidate>
        <section class="card stack">
          <div class="field">
            <label for="f-name">اسم الصنف</label>
            <input id="f-name" class="input input-strong" type="text" autocomplete="off" placeholder="مثلاً: بزر شمس محمّص" value="${esc(editing ? editing.name : '')}">
            <div id="f-dup"></div>
          </div>
          <div class="grid-2">
            <div class="field">
              <label for="f-main">المجموعة</label>
              <select id="f-main" class="input">
                ${mains.map((m) => `<option value="${m.id}" ${m.id === mainId ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}
              </select>
            </div>
            <div class="field">
              <label for="f-sub">الفرعية <small class="muted">(اختياري)</small></label>
              <select id="f-sub" class="input"></select>
            </div>
          </div>
          <div class="field">
            <label for="f-unit">الوحدة</label>
            <div class="chips">
              <input id="f-unit" class="input input-unit" type="text" autocomplete="off" value="${esc(editing ? editing.unit : last.unit)}" placeholder="الوحدة">
              <span id="f-units" class="chips"></span>
            </div>
          </div>
        </section>

        <section class="card stack">
          <div class="segmented" role="radiogroup" aria-label="العملة" id="f-cur">
            ${Object.entries(CURRENCIES).map(([k, c]) => `<button type="button" role="radio" data-cur="${k}" aria-checked="${k === currency}">${c.label}</button>`).join('')}
          </div>
          <div class="grid-2">
            <div class="field">
              <label for="f-buy">سعر الشراء</label>
              <input id="f-buy" class="input input-price" type="text" inputmode="decimal" dir="ltr" autocomplete="off" value="${editing && editing.purchase_price !== null ? fmtPrice(editing.purchase_price, currency) : ''}">
            </div>
            <div class="field">
              <label for="f-sale">سعر المبيع</label>
              <input id="f-sale" class="input input-price" type="text" inputmode="decimal" dir="ltr" autocomplete="off" value="${editing && editing.sale_price !== null ? fmtPrice(editing.sale_price, currency) : ''}">
            </div>
          </div>
          <div id="f-margin" class="margin"></div>
        </section>

        <section class="card stack">
          <div class="field">
            <label for="f-notes">ملاحظات</label>
            <textarea id="f-notes" class="input textarea" rows="2" placeholder="مثلاً: المورّد أبو أحمد، بيوصل كل خميس">${esc(editing ? editing.notes : '')}</textarea>
          </div>
        </section>

        <div id="f-msg" class="hidden" role="alert"></div>

        ${editing ? `
        <div class="grid-2">
          <button type="button" id="f-archive" class="btn btn-ghost">${editing.is_archived ? 'استرجاع من الأرشيف' : 'أرشفة'}</button>
          <button type="button" id="f-delete" class="btn btn-ghost btn-danger-outline">حذف نهائي</button>
        </div>` : ''}

        <div class="sticky-save">
          <button id="f-save" class="btn btn-accent btn-block" type="submit">${editing ? 'حفظ التعديلات' : 'حفظ الصنف'}</button>
        </div>
      </form>`;

    const nameEl = $('f-name'), mainEl = $('f-main'), subEl = $('f-sub'), unitEl = $('f-unit');
    const buyEl = $('f-buy'), saleEl = $('f-sale'), saveBtn = $('f-save');
    let blocked = false;

    // ----- الفرعيات -----
    function fillSubs(selected) {
      const subs = KP.subCategories(mainEl.value);
      subEl.innerHTML = '<option value="">— بدون —</option>' + subs.map((s) => `<option value="${s.id}" ${s.id === selected ? 'selected' : ''}>${esc(s.name)}</option>`).join('');
      subEl.disabled = !subs.length;
    }
    fillSubs(subId);
    mainEl.addEventListener('change', () => fillSubs(''));

    // ----- الوحدات -----
    function fillUnits() {
      const cur = unitEl.value.trim();
      $('f-units').innerHTML = KP.knownUnits().map((u) => `<button type="button" class="chip ${u === cur ? 'on' : ''}" data-unit="${esc(u)}">${esc(u)}</button>`).join('');
    }
    fillUnits();
    unitEl.addEventListener('input', fillUnits);
    $('f-units').addEventListener('click', (e) => {
      const b = e.target.closest('[data-unit]');
      if (!b) return;
      unitEl.value = b.dataset.unit;
      fillUnits();
    });

    // ----- فحص التكرار -----
    function checkDup() {
      const { exact, similar } = KP.findDuplicates(nameEl.value, editing && editing.id);
      const box = $('f-dup');
      blocked = !!exact;
      nameEl.classList.toggle('input-error', !!exact);
      nameEl.classList.toggle('input-warn', !exact && similar.length > 0);
      saveBtn.disabled = blocked;
      if (exact) {
        box.innerHTML = `<div class="alert alert-danger dup">
          <span>عندك هالصنف من قبل: <b>${esc(exact.name)}</b>${exact.is_archived ? ' (مؤرشف)' : ''}</span>
          <a href="#item/${encodeURIComponent(exact.id)}">${exact.is_archived ? 'فتحه واسترجاعه' : 'فتحه'}</a></div>`;
      } else if (similar.length) {
        box.innerHTML = `<div class="alert alert-warn">
          <div>في أصناف مشابهة، تأكد قبل ما تضيف:</div>
          <div class="chips">${similar.map((s) => `<a class="chip" href="#item/${encodeURIComponent(s.id)}">${esc(s.name)}${s.is_archived ? ' · مؤرشف' : ''}</a>`).join('')}</div></div>`;
      } else {
        box.innerHTML = '';
      }
    }
    nameEl.addEventListener('input', checkDup);
    checkDup();

    // ----- العملة والأسعار -----
    function updateMargin() {
      const buy = parseNum(buyEl.value), sale = parseNum(saleEl.value);
      const box = $('f-margin');
      saleEl.classList.remove('input-error');
      if (buy === null || sale === null || !buy) { box.className = 'margin'; box.innerHTML = '<span>هامش الربح</span><b>—</b>'; return; }
      const diff = sale - buy, pct = diff / buy * 100;
      const loss = diff < 0;
      saleEl.classList.toggle('input-error', loss);
      box.className = 'margin ' + (loss ? 'margin-loss' : 'margin-ok');
      box.innerHTML = `<span>${loss ? 'تنبيه: المبيع أقل من الشراء' : 'هامش الربح'}</span>
        <b class="num">${fmtPrice(diff, currency)} ${CURRENCIES[currency].short} (${pct.toFixed(1)}%)</b>`;
    }
    function bindPrice(input) {
      input.addEventListener('input', () => {
        input.value = fmtTyping(input.value, dec());
        updateMargin();
      });
    }
    bindPrice(buyEl); bindPrice(saleEl);
    $('f-cur').addEventListener('click', (e) => {
      const b = e.target.closest('[data-cur]');
      if (!b) return;
      currency = b.dataset.cur;
      $('f-cur').querySelectorAll('[data-cur]').forEach((x) => x.setAttribute('aria-checked', x === b));
      buyEl.value = fmtTyping(buyEl.value, dec());
      saleEl.value = fmtTyping(saleEl.value, dec());
      updateMargin();
    });
    updateMargin();

    // ----- الحفظ -----
    function showMsg(text) { const m = $('f-msg'); m.className = 'alert alert-danger'; m.textContent = text; }

    $('f').addEventListener('submit', async (e) => {
      e.preventDefault();
      $('f-msg').className = 'hidden';
      checkDup();
      if (blocked) return;
      const name = nameEl.value.trim();
      if (!name) { showMsg('اكتب اسم الصنف.'); nameEl.focus(); return; }
      const unit = unitEl.value.trim();
      if (!unit) { showMsg('اكتب الوحدة (كيس، طرد، كغ…).'); unitEl.focus(); return; }
      const payload = {
        name,
        category_id: subEl.value || mainEl.value,
        unit,
        currency,
        purchase_price: parseNum(buyEl.value),
        sale_price: parseNum(saleEl.value),
        notes: $('f-notes').value.trim()
      };
      saveBtn.disabled = true; saveBtn.textContent = 'جاري الحفظ…';
      const res = editing
        ? await db.from('items').update(payload).eq('id', editing.id)
        : await db.from('items').insert(payload);
      saveBtn.disabled = false; saveBtn.textContent = editing ? 'حفظ التعديلات' : 'حفظ الصنف';
      if (res.error) { showMsg(KP.errorText(res.error)); return; }

      Object.assign(last, { main: mainEl.value, sub: subEl.value, currency, unit });
      try { await KP.loadAll(); } catch (err) { /* البيانات انحفظت؛ التحديث بيصير بعدين */ }
      if (editing) {
        KP.toast('انحفظت التعديلات ✓');
        KP.go(KP.screens.items.ready ? '#items' : '#home');
      } else {
        KP.toast('انحفظ "' + name + '" ✓ — فيك تضيف التالي');
        render(el); // نموذج فاضي بنفس المجموعة والعملة والوحدة
        $('f-name').focus();
      }
    });

    if (editing) {
      $('f-archive').addEventListener('click', async () => {
        const to = !editing.is_archived;
        const { error } = await db.from('items').update({ is_archived: to }).eq('id', editing.id);
        if (error) { KP.toast(KP.errorText(error), 'error'); return; }
        await KP.loadAll();
        KP.toast(to ? 'انأرشف الصنف' : 'رجع الصنف من الأرشيف ✓');
        render(el, editing.id);
      });
      $('f-delete').addEventListener('click', async () => {
        if (!window.confirm('حذف "' + editing.name + '" نهائياً؟ ما في رجعة.')) return;
        const { error } = await db.from('items').delete().eq('id', editing.id);
        if (error) { KP.toast(KP.errorText(error), 'error'); return; }
        await KP.loadAll();
        KP.toast('انحذف الصنف');
        KP.go('#home');
      });
    }
  }

  KP.screens['new-item'] = { title: 'صنف جديد', render: (el) => render(el) };
  KP.screens.item = { title: 'تعديل صنف', render: (el, id) => render(el, id) };
})();
