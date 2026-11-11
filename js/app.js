/* مخزن الخليل — تطبيق الأسعار
 * المرحلة 2: الهيكل العام (دخول، تنقّل، ثيم، اتصال بالداتابيز).
 * الشاشات الكاملة تُضاف في المراحل التالية.
 */
(function () {
  'use strict';

  const cfg = window.APP_CONFIG;
  const db = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_KEY);
  const $ = (id) => document.getElementById(id);

  // ===== أدوات عامة =====
  const fmtNumber = (n, currency) => {
    const v = Number(n || 0);
    return currency === 'SYP_OLD'
      ? Math.round(v).toLocaleString('en-US')
      : v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };
  const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  window.KP = { db, fmtNumber, escapeHtml };

  // ===== الثيم =====
  function setTheme(dark) {
    if (dark) document.documentElement.dataset.theme = 'dark';
    else delete document.documentElement.dataset.theme;
    try { localStorage.setItem('theme', dark ? 'dark' : 'light'); } catch (e) {}
  }
  $('theme-btn').addEventListener('click', () => setTheme(document.documentElement.dataset.theme !== 'dark'));

  // ===== التاريخ =====
  $('today').textContent = new Date().toLocaleDateString('ar-SY-u-nu-latn', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });

  // ===== الدخول =====
  function showLogin() { $('app-view').classList.add('hidden'); $('login-view').classList.remove('hidden'); }
  function showApp() { $('login-view').classList.add('hidden'); $('app-view').classList.remove('hidden'); route(); }

  $('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = $('login-error');
    err.classList.add('hidden');
    const btn = e.submitter || e.target.querySelector('button');
    btn.disabled = true; btn.textContent = 'جاري الدخول…';
    // اسم المستخدم يتحول داخلياً لإيميل وهمي، لأن Supabase يحتاج إيميل
    const user = $('login-email').value.trim().toLowerCase();
    const email = user.includes('@') ? user : user + '@khalil.local';
    const { error } = await db.auth.signInWithPassword({ email, password: $('login-pass').value });
    btn.disabled = false; btn.textContent = 'دخول';
    if (error) { err.textContent = 'اسم المستخدم أو كلمة السر غلط'; err.classList.remove('hidden'); }
  });

  db.auth.onAuthStateChange((_event, session) => { session ? showApp() : showLogin(); });

  // ===== التنقّل =====
  const routes = {
    home: { title: 'مخزن الخليل', render: renderHome },
    items: { title: 'المواد', render: soon },
    'new-item': { title: 'صنف جديد', render: soon },
    prices: { title: 'تعديل الأسعار', render: soon },
    settings: { title: 'الإعدادات', render: renderSettings }
  };

  function route() {
    const key = (location.hash || '#home').slice(1);
    const r = routes[key] || routes.home;
    $('page-title').textContent = r.title;
    document.querySelectorAll('.nav a').forEach((a) => a.classList.toggle('active', a.dataset.route === key));
    r.render($('screen'));
  }
  window.addEventListener('hashchange', route);

  // ===== الشاشات =====
  async function renderHome(el) {
    el.innerHTML = `
      <section class="card stats" aria-label="إحصائيات">
        <div><b id="st-items">…</b><span>صنف</span></div>
        <div><b id="st-groups">…</b><span>مجموعة</span></div>
        <div><b id="st-week" style="color: var(--accent-ink)">…</b><span>عُدّل هالأسبوع</span></div>
      </section>
      <div id="home-msg"></div>`;
    const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString();
    const [items, groups, week] = await Promise.all([
      db.from('items').select('id', { count: 'exact', head: true }).eq('is_archived', false),
      db.from('categories').select('id', { count: 'exact', head: true }),
      db.from('items').select('id', { count: 'exact', head: true }).gte('price_updated_at', weekAgo)
    ]);
    if (items.error || groups.error || week.error) {
      $('home-msg').innerHTML = '<div class="alert alert-danger">ما قدرت أتصل بالداتابيز. تأكد من النت وجرّب مرة تانية.</div>';
      return;
    }
    $('st-items').textContent = items.count;
    $('st-groups').textContent = groups.count;
    $('st-week').textContent = week.count;
    $('home-msg').innerHTML = '<div class="alert alert-ok">الاتصال بالداتابيز شغّال ✓</div>';
  }

  function renderSettings(el) {
    el.innerHTML = `
      <div class="placeholder">باقي الإعدادات جاية بالمراحل الجاية.</div>
      <button id="logout" class="btn btn-ghost btn-block" style="color: var(--danger); border-color: var(--danger)">تسجيل الخروج</button>`;
    $('logout').addEventListener('click', () => db.auth.signOut());
  }

  function soon(el) {
    el.innerHTML = '<div class="placeholder">هالشاشة قيد البرمجة.</div>';
  }
})();
