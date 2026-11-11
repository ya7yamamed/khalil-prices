/* whatsapp-builder.js — بناء نص قائمة الأسعار وتقسيمه لعدة رسائل
 * منطق صافٍ بدون واجهة، حتى نقدر نختبره لحاله.
 */
(function () {
  'use strict';
  const SEP = '━━━━━━━━━━━━━━';

  function dateLine(d) {
    const day = d.toLocaleDateString('ar-SY-u-nu-latn', { weekday: 'long' });
    const dd = String(d.getDate()).padStart(2, '0'), mm = String(d.getMonth() + 1).padStart(2, '0');
    return day + ' ' + dd + '/' + mm + '/' + d.getFullYear();
  }

  // sections: [{ title, lines: ['▫️ ...'] }]
  function buildSections(items, KP) {
    const orderKey = (catId) => {
      const c = KP.categoryById(catId);
      if (!c) return [9999, 9999, ''];
      const p = c.parent_id ? KP.categoryById(c.parent_id) : null;
      return p ? [p.sort_order, c.sort_order, p.name] : [c.sort_order, -1, c.name];
    };
    const sorted = [...items].sort((a, b) => {
      const ka = orderKey(a.category_id), kb = orderKey(b.category_id);
      return ka[0] - kb[0] || ka[2].localeCompare(kb[2], 'ar') || ka[1] - kb[1] || a.name.localeCompare(b.name, 'ar', { numeric: true });
    });
    const sections = [];
    sorted.forEach((it) => {
      const title = KP.categoryPath(it.category_id);
      let s = sections[sections.length - 1];
      if (!s || s.title !== title) { s = { title, lines: [] }; sections.push(s); }
      const cur = KP.CURRENCIES[it.currency].short;
      s.lines.push('▫️ ' + it.name + (it.unit ? ' (' + it.unit + ')' : '') + ': ' + KP.fmtPrice(it.sale_price, it.currency) + ' ' + cur);
    });
    return sections;
  }

  /* يرجع مصفوفة نصوص الرسائل.
   * opts: { title, settings, date, limit }
   */
  function buildMessages(items, KP, opts) {
    const s = opts.settings || {};
    const limit = Math.max(500, opts.limit || s.wa_split_limit || 3500);
    const hasSyp = items.some((it) => it.currency === 'SYP_OLD');
    const manager = (s.manager_name || '').trim();
    const phone = String(s.whatsapp_phone || '').replace(/\D/g, '');

    const headerLines = [
      '🌟 *' + (s.wa_header || 'أهلاً وسهلاً بكم') + '* 🌟',
      manager ? 'بإدارة ' + manager : null,
      '',
      '📋 *قائمة الأسعار – ' + opts.title + '*',
      '📅 ' + dateLine(opts.date || new Date())
    ].filter((l) => l !== null);

    const footerLines = [SEP];
    if (hasSyp) footerLines.push('⚠️ الأسعار بالليرة السورية القديمة');
    if (phone) {
      footerLines.push('📞 للطلب تواصل مع ' + (manager || 'المحل') + ' واتساب:');
      footerLines.push('https://wa.me/' + phone);
    }
    if (s.wa_footer) footerLines.push(s.wa_footer);

    const sections = buildSections(items, KP);
    const RESERVE = 16; // سطر الترقيم "📄 (1/12)"

    // تعبئة جشعة سطراً بسطر، بدون قطع صنف، مع تكرار عنوان القسم عند القطع
    const msgs = [];
    let cur = headerLines.join('\n') + '\n' + SEP;
    const len = (t) => [...t].length;
    const flush = () => { msgs.push(cur); cur = ''; };
    const add = (line) => {
      const next = cur ? cur + '\n' + line : line;
      if (len(next) + RESERVE > limit && cur) { flush(); return false; }
      cur = next;
      return true;
    };

    sections.forEach((sec) => {
      const hdr = '🔸 *' + sec.title + '*';
      // إذا ما في مكان للعنوان + أول صنف، ابدأ رسالة جديدة
      if (cur && len(cur + '\n\n' + hdr + '\n' + sec.lines[0]) + RESERVE > limit) flush();
      if (cur) cur += (cur.endsWith(SEP) ? '\n' : '\n\n') + hdr;
      else cur = hdr;
      sec.lines.forEach((line) => {
        // add بيبعت الرسالة إذا امتلأت؛ عندها نكمل القسم برسالة جديدة بعنوان "(تابع)"
        if (!add(line)) cur = hdr + ' (تابع)\n' + line;
      });
    });

    const footer = footerLines.join('\n');
    if (cur && len(cur + '\n' + footer) + RESERVE <= limit) cur += '\n' + footer;
    else { if (cur) flush(); cur = footer; }
    flush();

    if (msgs.length > 1) {
      return msgs.map((m, i) => {
        const tag = '📄 (' + (i + 1) + '/' + msgs.length + ')';
        // الترقيم بعد الترويسة بالأولى، وبأول سطر بالباقي
        return i === 0 ? m.replace(SEP, tag + '\n' + SEP) : tag + '\n' + m;
      });
    }
    return msgs;
  }

  const api = { buildMessages, buildSections, dateLine };
  if (typeof window !== 'undefined') window.KPWhatsApp = api;
  if (typeof module !== 'undefined') module.exports = api;
})();
