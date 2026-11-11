/* Service Worker — يحفظ ملفات التطبيق حتى يفتح بلا نت.
 * ملفات التطبيق: الشبكة أولاً (حتى توصل التحديثات فوراً)، والكاش إذا ما في نت.
 * المكتبات والخطوط الخارجية: الكاش أولاً.
 * طلبات Supabase ما بتمر من هون أبداً.
 */
const CACHE = 'kp-shell-v1';
const SHELL = [
  './', 'index.html', 'manifest.json', 'css/app.css', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png',
  'js/config.js', 'js/core.js', 'js/excel.js', 'js/whatsapp-builder.js', 'js/main.js',
  'js/screens/home.js', 'js/screens/groups.js', 'js/screens/item-form.js', 'js/screens/items.js',
  'js/screens/prices.js', 'js/screens/whatsapp.js', 'js/screens/settings.js'
];
const CDN_HOSTS = ['cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com', 'cdn.sheetjs.com'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    e.respondWith(
      fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      }).catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match('index.html')))
    );
    return;
  }

  if (CDN_HOSTS.includes(url.hostname)) {
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      }))
    );
  }
});
