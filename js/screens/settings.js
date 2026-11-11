/* settings.js — الإعدادات */
(function () {
  'use strict';
  const { db, state, esc, $ } = KP;

  KP.screens.settings = {
    title: 'الإعدادات',
    render(el) {
      const s = state.settings || {};
      const archived = state.items.filter((it) => it.is_archived).length;
      el.innerHTML = `
        <form id="s-form" class="stack" novalidate>
          <h2 class="h3">بيانات المحل</h2>
          <section class="card stack">
            <div class="field"><label for="s-shop">اسم المحل</label>
              <input id="s-shop" class="input" type="text" value="${esc(s.shop_name)}" autocomplete="off"></div>
            <div class="field"><label for="s-manager">المدير</label>
              <input id="s-manager" class="input" type="text" value="${esc(s.manager_name)}" autocomplete="off"></div>
            <div class="field"><label for="s-phone">رقم الواتساب (بالصيغة الدولية)</label>
              <input id="s-phone" class="input" type="tel" dir="ltr" placeholder="963912345678" value="${esc(s.whatsapp_phone)}" autocomplete="off">
              <small class="note">بيطلع آخر رسالة الأسعار كرابط بيفتح محادثة واتساب مباشرة. اكتبه بلا + وبلا صفر البداية، مثلاً 963912345678.</small></div>
          </section>

          <h2 class="h3">رسالة الواتساب</h2>
          <section class="card stack">
            <div class="field"><label for="s-header">نص الترحيب (أول سطر)</label>
              <input id="s-header" class="input" type="text" value="${esc(s.wa_header)}" autocomplete="off"></div>
            <div class="field"><label for="s-footer">نص الختام (آخر سطر)</label>
              <input id="s-footer" class="input" type="text" value="${esc(s.wa_footer)}" autocomplete="off"></div>
            <div class="field"><label for="s-limit">أقصى طول للرسالة الوحدة (حرف)</label>
              <input id="s-limit" class="input" type="number" dir="ltr" min="500" max="60000" step="100" value="${esc(s.wa_split_limit)}">
              <small class="note">إذا القائمة أطول من هيك بتتقسّم لعدة رسائل. 3,500 مريحة للقراءة على الموبايل.</small></div>
          </section>
          <div id="s-msg" class="hidden" role="alert"></div>
          <button id="s-save" class="btn btn-accent btn-block" type="submit">حفظ الإعدادات</button>
        </form>

        <section class="stack">
          <h2 class="h3">البيانات</h2>
          <div class="card list">
            <a class="row" href="#groups"><div class="row-main"><b>المجموعات</b></div><span class="muted">${state.categories.length}</span><span class="chev" aria-hidden="true">‹</span></a>
            <button class="row" id="s-archived" type="button"><div class="row-main"><b>الأصناف المؤرشفة</b></div><span class="muted">${archived}</span><span class="chev" aria-hidden="true">‹</span></button>
            <button class="row" id="s-xlsx" type="button"><div class="row-main"><b>تصدير كل الأصناف</b><span>ملف Excel فيه الشراء والمبيع والملاحظات</span></div><span class="muted">Excel</span></button>
            <button class="row" id="s-reload" type="button"><div class="row-main"><b>تحديث البيانات</b><span>${state.offline ? 'عم تشوف نسخة محفوظة بلا نت' : 'جيب آخر نسخة من الداتابيز'}</span></div></button>
          </div>
        </section>

        <section class="stack">
          <h2 class="h3">المظهر</h2>
          <div class="card list">
            <button id="s-dark" class="switch-row row" role="switch" aria-checked="${KP.isDark()}" type="button">
              <span>الوضع الليلي</span><span class="switch"><span></span></span>
            </button>
          </div>
        </section>

        <button id="s-logout" class="btn btn-ghost btn-block btn-danger-outline" type="button">تسجيل الخروج</button>
        <p class="note" style="text-align: center">مخزن الخليل — تطبيق الأسعار · إصدار ${KP.VERSION}</p>`;

      $('s-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const msg = $('s-msg');
        msg.className = 'hidden';
        const limit = parseInt($('s-limit').value, 10);
        if (!(limit >= 500 && limit <= 60000)) { msg.className = 'alert alert-danger'; msg.textContent = 'طول الرسالة لازم يكون بين 500 و 60,000.'; return; }
        const payload = {
          shop_name: $('s-shop').value.trim() || 'مخزن الخليل',
          manager_name: $('s-manager').value.trim(),
          whatsapp_phone: $('s-phone').value.replace(/\D/g, '').replace(/^00/, ''),
          wa_header: $('s-header').value.trim(),
          wa_footer: $('s-footer').value.trim(),
          wa_split_limit: limit,
          updated_at: new Date().toISOString()
        };
        const btn = $('s-save');
        btn.disabled = true; btn.textContent = 'جاري الحفظ…';
        const { error } = await db.from('settings').update(payload).eq('id', 1);
        btn.disabled = false; btn.textContent = 'حفظ الإعدادات';
        if (error) { msg.className = 'alert alert-danger'; msg.textContent = KP.errorText(error); return; }
        try { await KP.loadAll(); } catch (err) { /* لاحقاً */ }
        KP.toast('انحفظت الإعدادات ✓');
        KP.screens.settings.render(el);
      });

      $('s-archived').addEventListener('click', () => {
        Object.assign(KP.itemsFilter, { archived: true, q: '', main: '', sub: '', cur: '' });
        KP.go('#items');
      });
      $('s-xlsx').addEventListener('click', () => KP.exportExcel(state.items.filter((it) => !it.is_archived), 'كل الأصناف'));
      $('s-reload').addEventListener('click', async () => {
        try {
          await KP.loadAll();
          if (state.offline) KP.toast('ما في نت، عم تشوف آخر نسخة محفوظة', 'error');
          else KP.toast('تحدّثت البيانات ✓');
        } catch (e) { KP.toast(KP.errorText(e), 'error'); }
        KP.screens.settings.render(el);
      });
      $('s-dark').addEventListener('click', () => {
        KP.setTheme(!KP.isDark());
        $('s-dark').setAttribute('aria-checked', KP.isDark());
      });
      $('s-logout').addEventListener('click', () => {
        if (window.confirm('تسجيل الخروج؟')) { KP.clearCache(); db.auth.signOut(); }
      });
    }
  };
})();
