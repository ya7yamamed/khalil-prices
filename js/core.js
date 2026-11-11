/* core.js — الأدوات المشتركة، الاتصال بالداتابيز، والحالة في الذاكرة */
(function () {
  'use strict';

  const cfg = window.APP_CONFIG;
  const db = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_KEY);

  const CURRENCIES = {
    SYP_OLD: { label: 'ل.س قديمة', short: 'ل.س قديمة', name: 'ليرة سورية قديمة', decimals: 0, cls: 'cur-syp' },
    USD: { label: 'دولار $', short: '$', name: 'دولار', decimals: 2, cls: 'cur-usd' },
    TRY: { label: 'تركي ₺', short: '₺', name: 'ليرة تركية', decimals: 2, cls: 'cur-try' }
  };

  // ===== نصوص وأرقام =====
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // نفس منطق normalize_ar في قاعدة البيانات
  const normalize = (s) => String(s ?? '')
    .replace(/[ً-ْـ]/g, '')
    .replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي')
    .replace(/\s+/g, ' ').trim();

  const fmtPrice = (n, currency) => {
    if (n === null || n === undefined || n === '') return '—';
    const d = (CURRENCIES[currency] || CURRENCIES.SYP_OLD).decimals;
    return Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  };

  // تحويل نص الإدخال (مع فواصل) إلى رقم أو null
  const parseNum = (s) => {
    const clean = String(s ?? '').replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[^0-9.]/g, '');
    if (!clean) return null;
    const v = parseFloat(clean);
    return isNaN(v) ? null : v;
  };

  // تنسيق النص أثناء الكتابة: 25000 → 25,000
  const fmtTyping = (s, maxDecimals) => {
    let clean = String(s ?? '').replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[^0-9.]/g, '');
    if (!clean) return '';
    const parts = clean.split('.');
    const head = parts[0] ? Number(parts[0]).toLocaleString('en-US') : '0';
    if (parts.length === 1 || maxDecimals === 0) return head;
    return head + '.' + parts.slice(1).join('').slice(0, maxDecimals);
  };

  const fmtDate = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    const today = new Date();
    const diff = Math.floor((new Date(today.toDateString()) - new Date(d.toDateString())) / 864e5);
    if (diff === 0) return 'اليوم';
    if (diff === 1) return 'مبارح';
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  // ===== تشابه الأسماء =====
  function levenshtein(a, b) {
    if (a === b) return 0;
    const m = a.length, n = b.length;
    if (!m || !n) return m || n;
    let prev = Array.from({ length: n + 1 }, (_, j) => j);
    for (let i = 1; i <= m; i++) {
      const cur = [i];
      for (let j = 1; j <= n; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
      prev = cur;
    }
    return prev[n];
  }

  // يرجع { exact, similar[] } مقارنةً بكل الأصناف (المؤرشفة ضمناً)
  function findDuplicates(name, excludeId) {
    const n = normalize(name);
    if (!n) return { exact: null, similar: [] };
    const others = state.items.filter((it) => it.id !== excludeId);
    const exact = others.find((it) => it.name_norm === n) || null;
    if (exact) return { exact, similar: [] };
    const words = n.split(' ').filter((w) => w.length > 1);
    const similar = others.filter((it) => {
      const o = it.name_norm;
      if (n.length >= 3 && (o.includes(n) || n.includes(o))) return true;
      const ow = o.split(' ');
      const shared = words.filter((w) => ow.includes(w)).length;
      if (words.length >= 2 && shared >= 2) return true;
      return n.length >= 4 && levenshtein(n, o) <= 2;
    }).slice(0, 5);
    return { exact: null, similar };
  }

  // ===== الحالة في الذاكرة =====
  const state = { categories: [], items: [], settings: null, loaded: false };

  async function loadAll() {
    const [cats, items, settings] = await Promise.all([
      db.from('categories').select('*').order('sort_order').order('name'),
      db.from('items').select('*').order('name'),
      db.from('settings').select('*').eq('id', 1).maybeSingle()
    ]);
    const err = cats.error || items.error || settings.error;
    if (err) throw err;
    state.categories = cats.data;
    state.items = items.data;
    state.settings = settings.data;
    state.loaded = true;
    return state;
  }

  const mainCategories = () => state.categories.filter((c) => !c.parent_id);
  const subCategories = (parentId) => state.categories.filter((c) => c.parent_id === parentId);
  const categoryById = (id) => state.categories.find((c) => c.id === id) || null;

  function categoryPath(id) {
    const c = categoryById(id);
    if (!c) return '';
    const p = c.parent_id ? categoryById(c.parent_id) : null;
    return p ? p.name + ' › ' + c.name : c.name;
  }

  // عدد الأصناف داخل مجموعة (مع فرعياتها)
  function countInCategory(id, includeArchived) {
    const ids = new Set([id, ...subCategories(id).map((s) => s.id)]);
    return state.items.filter((it) => ids.has(it.category_id) && (includeArchived || !it.is_archived)).length;
  }

  // الوحدات المستعملة سابقاً مرتبة حسب التكرار
  function knownUnits() {
    const freq = {};
    state.items.forEach((it) => { const u = (it.unit || '').trim(); if (u) freq[u] = (freq[u] || 0) + 1; });
    ['كيس', 'طرد', 'كغ', 'علبة'].forEach((u) => { if (!(u in freq)) freq[u] = 0; });
    return Object.keys(freq).sort((a, b) => freq[b] - freq[a]).slice(0, 8);
  }

  // ===== رسائل قصيرة =====
  let toastTimer;
  function toast(msg, type) {
    let el = document.getElementById('toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast';
      el.setAttribute('role', 'status');
      document.body.appendChild(el);
    }
    el.className = 'toast ' + (type === 'error' ? 'toast-error' : 'toast-ok');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
  }

  // رسالة خطأ مفهومة من خطأ Supabase
  function errorText(error) {
    if (!error) return '';
    if (error.code === '23505') return 'هالاسم موجود من قبل.';
    if (error.code === '23503') return 'ما فيك تحذفها لأنه في أشياء مربوطة فيها.';
    if (error.code === 'P0001') return error.message;
    if (/fetch|network/i.test(error.message || '')) return 'في مشكلة بالنت، جرّب مرة تانية.';
    return 'صار خطأ: ' + (error.message || 'غير معروف');
  }

  window.KP = {
    db, state, CURRENCIES, screens: {},
    esc, normalize, fmtPrice, parseNum, fmtTyping, fmtDate, findDuplicates,
    loadAll, mainCategories, subCategories, categoryById, categoryPath, countInCategory, knownUnits,
    toast, errorText,
    $: (id) => document.getElementById(id)
  };
})();
