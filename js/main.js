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
      $('screen').innerHTML = '<div class="alert alert-danger">ما قدرت أحمّل البيانات. تأكد من النت وحدّث الصفحة.</div>';
      return;
    }
    route();
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
  window.addEventListener('hashchange', route);
})();
