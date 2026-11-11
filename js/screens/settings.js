/* settings.js — الإعدادات (نسخة أولية) + شاشات قيد البرمجة */
(function () {
  'use strict';
  const { db, state, $ } = KP;

  KP.screens.settings = {
    title: 'الإعدادات',
    render(el) {
      const archived = state.items.filter((it) => it.is_archived).length;
      el.innerHTML = `
        <section class="stack">
          <h2 class="h3">البيانات</h2>
          <div class="card list">
            <a class="row" href="#groups"><div class="row-main"><b>المجموعات</b></div><span class="muted">${state.categories.length} مجموعة</span><span class="chev" aria-hidden="true">‹</span></a>
            <div class="row"><div class="row-main"><b>الأصناف المؤرشفة</b><span>بتبين بقائمة المواد (قريباً)</span></div><span class="muted">${archived}</span></div>
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
        <p class="note">إعدادات المحل ونصوص رسالة الواتساب جاية مع مرحلة الواتساب.</p>
        <button id="s-logout" class="btn btn-ghost btn-block btn-danger-outline" type="button">تسجيل الخروج</button>`;
      $('s-dark').addEventListener('click', () => {
        KP.setTheme(!KP.isDark());
        $('s-dark').setAttribute('aria-checked', KP.isDark());
      });
      $('s-logout').addEventListener('click', () => db.auth.signOut());
    }
  };

  const soon = (title) => ({ title, render(el) { el.innerHTML = '<div class="placeholder">هالشاشة قيد البرمجة، جاية بالمراحل الجاية.</div>'; } });
  KP.screens.items = KP.screens.items || soon('المواد');
  KP.screens.prices = KP.screens.prices || soon('تعديل الأسعار');
  KP.screens.whatsapp = KP.screens.whatsapp || soon('إرسال قائمة أسعار');
})();
