/* home.js — الشاشة الرئيسية */
(function () {
  'use strict';
  const { state, esc, fmtPrice, fmtDate, CURRENCIES } = KP;

  KP.screens.home = {
    title: 'مخزن الخليل',
    render(el) {
      const active = state.items.filter((it) => !it.is_archived);
      const weekAgo = Date.now() - 7 * 864e5;
      const week = active.filter((it) => new Date(it.price_updated_at).getTime() >= weekAgo).length;
      const mains = KP.mainCategories();
      const recent = [...active].sort((a, b) => b.price_updated_at.localeCompare(a.price_updated_at)).slice(0, 5);

      el.innerHTML = `
        <section class="card stats" aria-label="إحصائيات">
          <div><b>${active.length}</b><span>صنف</span></div>
          <div><b>${state.categories.length}</b><span>مجموعة</span></div>
          <div><b style="color: var(--accent-ink)">${week}</b><span>تعدّل هالأسبوع</span></div>
        </section>

        <section class="stack" aria-label="المجموعات">
          <div class="section-head">
            <h2>المجموعات</h2>
            <a href="#groups" class="link-accent">+ مجموعة جديدة</a>
          </div>
          ${mains.length ? `
            <div class="grid-2">
              ${mains.map((c) => {
                const subs = KP.subCategories(c.id).length;
                return `<a class="tile" href="#items/${encodeURIComponent(c.id)}">
                  <b>${esc(c.name)}</b>
                  <span>${KP.countInCategory(c.id)} صنف · ${subs ? subs + ' فرعيات' : 'بلا فرعيات'}</span>
                </a>`;
              }).join('')}
            </div>` : `
            <div class="card empty">
              <p>لسا ما في مجموعات. ابدأ بإنشاء أول مجموعة، مثلاً "موالح".</p>
              <a class="btn btn-accent" href="#groups">إنشاء مجموعة</a>
            </div>`}
        </section>

        <section class="grid-2" aria-label="أدوات">
          <a class="btn btn-navy" href="#prices">
            <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.5"/></svg>
            تعديل الأسعار</a>
          <a class="btn btn-accent" href="#whatsapp">
            <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/></svg>
            إرسال قائمة</a>
        </section>

        ${recent.length ? `
        <section class="stack" aria-label="آخر تحديث">
          <h2 class="h2">آخر تحديث</h2>
          <div class="card list">
            ${recent.map((it) => `
              <a class="row" href="#item/${encodeURIComponent(it.id)}">
                <div class="row-main">
                  <b>${esc(it.name)}</b>
                  <span>${esc(KP.categoryPath(it.category_id))} · ${fmtDate(it.price_updated_at)}</span>
                </div>
                <div class="row-price">
                  <b><span class="num">${fmtPrice(it.sale_price, it.currency)}</span> <small class="${CURRENCIES[it.currency].cls}">${CURRENCIES[it.currency].short}</small></b>
                </div>
              </a>`).join('')}
          </div>
        </section>` : ''}`;
    }
  };
})();
