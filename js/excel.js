/* excel.js — تصدير الأصناف لملف Excel (مكتبة SheetJS تتحمّل وقت الحاجة فقط) */
(function () {
  'use strict';
  const XLSX_URL = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
  let loading = null;

  function loadLib() {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    if (!loading) {
      loading = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = XLSX_URL;
        s.onload = () => resolve(window.XLSX);
        s.onerror = () => { loading = null; reject(new Error('xlsx')); };
        document.head.appendChild(s);
      });
    }
    return loading;
  }

  // صفوف الجدول (تُستعمل أيضاً بالاختبار)
  function buildRows(items) {
    const header = ['المجموعة', 'الفرعية', 'الصنف', 'الوحدة', 'العملة', 'سعر الشراء', 'سعر المبيع', 'هامش الربح', 'آخر تحديث للسعر', 'ملاحظات', 'مؤرشف'];
    const rows = items.map((it) => {
      const c = KP.categoryById(it.category_id);
      const main = c && c.parent_id ? KP.categoryById(c.parent_id) : c;
      const sub = c && c.parent_id ? c : null;
      const buy = it.purchase_price === null ? '' : Number(it.purchase_price);
      const sale = it.sale_price === null ? '' : Number(it.sale_price);
      return [
        main ? main.name : '', sub ? sub.name : '', it.name, it.unit,
        KP.CURRENCIES[it.currency].name, buy, sale,
        buy !== '' && sale !== '' ? Math.round((sale - buy) * 100) / 100 : '',
        new Date(it.price_updated_at).toLocaleDateString('en-GB'),
        it.notes || '', it.is_archived ? 'نعم' : ''
      ];
    });
    return [header, ...rows];
  }

  async function exportExcel(items, title) {
    if (!items.length) { KP.toast('ما في أصناف لتصديرها', 'error'); return; }
    let XLSX;
    try { XLSX = await loadLib(); } catch (e) { KP.toast('ما قدرت حمّل أداة Excel، تأكد من النت.', 'error'); return; }
    const rows = buildRows(items);
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [14, 12, 26, 8, 16, 12, 12, 12, 14, 30, 7].map((w) => ({ wch: w }));
    ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length - 1, c: rows[0].length - 1 } }) };
    const wb = XLSX.utils.book_new();
    wb.Workbook = { Views: [{ RTL: true }] };
    XLSX.utils.book_append_sheet(wb, ws, 'الأسعار');
    const d = new Date();
    const stamp = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    const safe = String(title).replace(/[\\/:*?"<>|›]+/g, '-').replace(/\s+/g, ' ').trim();
    XLSX.writeFile(wb, 'أسعار ' + safe + ' ' + stamp + '.xlsx');
    KP.toast('تصدّر ' + items.length + ' صنف ✓');
  }

  KP.exportExcel = exportExcel;
  KP.buildExcelRows = buildRows;
})();
