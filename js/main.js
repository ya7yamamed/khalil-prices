/* main.js — الدخول، التنقّل بين الشاشات، والثيم */
(function () {
  'use strict';
  const { db, $, screens } = KP;

  // ===== الثيم =====
  function setTheme(dark) {
    if (dark) document.documentElement.dataset.theme = 'dark';
    else delete document.documentElement.dataset.theme;
    try { localStorage.setItem('theme', dark ? 'dark' : 'light'); } catch (e) {}
  }
  KP.setTheme = setTheme;
  KP.isDark = () => document.documentElement.dataset.theme === 'dark';
  $('theme-btn').addEventListener('click', () => setTheme(!KP.isDark()));

  $('today').textContent = new Date().toLocaleDateString('ar-SY-u-nu-latn', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });

  // ===== الدخول =====
  let started = false;
  function showLogin() {
    started = false;
    $('app-view').classList.add('hidden');
    $('login-view').classList.remove('hidden');
  }
  async function showApp() {
    $('login-view').classList.add('hidden');
    $('app-view').classList.remove('hidden');
    if (started) return;
    started = true;
    $('screen').innerHTML = '<div class="placeholder">جاري التحميل…</div>';
    try {
      await KP.loadAll();
    } catch (e) {
      $('screen').innerHTML = '<div class="alert alert-danger">ما قدرت أحمّل البيانات، وما في نسخة محفوظة على هالجهاز. تأكد من النت وحدّث الصفحة.</div>';
      started = false;
      return;
    }
    route();
  }

  // لما يرجع النت: نجيب آخر نسخة ونحدّث الشاشات اللي ما فيها إدخال
  window.addEventListener('online', async () => {
    if (!started) return;
    await KP.loadAll().catch(() => {});
    if (!KP.state.offline) {
      KP.toast('رجع النت ✓ البيانات محدّثة');
      const name = (location.hash || '#home').slice(1).split('/')[0];
      if (['home', 'items', 'settings', 'groups', ''].includes(name)) route();
    }
  });
  window.addEventListener('offline', () => document.body.classList.add('is-offline'));

  // Service Worker: يخلي التطبيق يفتح بلا نت
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }

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
  // الشكل: #name أو #name/param
  const navOf = { home: 'home', items: 'items', 'new-item': 'new-item', item: 'items', prices: 'prices', settings: 'settings', groups: 'settings' };

  function route() {
    if (!KP.state.loaded) return;
    const [name, param] = (location.hash || '#home').slice(1).split('/');
    const screen = screens[name] || screens.home;
    const key = screens[name] ? name : 'home';
    $('page-title').textContent = typeof screen.title === 'function' ? screen.title(param) : screen.title;
    document.querySelectorAll('.nav a').forEach((a) => a.classList.toggle('active', a.dataset.route === navOf[key]));
    window.scrollTo(0, 0);
    screen.render($('screen'), param ? decodeURIComponent(param) : undefined);
  }
  KP.route = route;
  KP.go = (hash) => { if (location.hash === hash) route(); else location.hash = hash; };

  // حارس المغادرة: شاشة فيها تعديلات غير محفوظة بتعرّف KP.leaveGuard
  let lastHash = location.hash, reverting = false;
  window.addEventListener('hashchange', () => {
    if (reverting) { reverting = false; return; }
    if (KP.leaveGuard && !KP.leaveGuard()) {
      reverting = true;
      location.hash = lastHash;
      return;
    }
    KP.leaveGuard = null;
    lastHash = location.hash;
    route();
  });
})();
