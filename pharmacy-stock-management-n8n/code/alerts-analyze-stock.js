// ===== Settings =====
const EXPIRY_WARNING_DAYS = 30;

const today = new Date();
today.setHours(0, 0, 0, 0);
const todayStr = today.toISOString().slice(0, 10);

// 12 Nov, 2026
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const fmt = (d) => `${d.getDate()} ${MONTHS[d.getMonth()]}, ${d.getFullYear()}`;
// 25 Nov (used in Expiring Soon)
const fmtShort = (d) => `${d.getDate()} ${MONTHS[d.getMonth()]}`;
// Escape text for Telegram HTML
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// Restore the leading 0 that Google Sheets drops (1700000001 -> 01700000001)
const fixPhone = (p) => {
  let s = String(p || '').replace(/\D/g, '');
  if (s.length === 10 && s.startsWith('1')) s = '0' + s;
  if (s.length === 13 && s.startsWith('880')) s = '0' + s.slice(3);
  return s;
};

const low = [];
const expiring = [];

for (const item of $input.all()) {
  const r = item.json;
  const name = String(r.Medicine || '').trim();
  if (!name) continue;

  const qty = Number(r.Quantity) || 0;
  const min = Number(r.MinStock) || 0;

  // Low stock
  if (qty <= min) {
    low.push({
      Date: todayStr,
      Medicine: name,
      Current: qty,
      MinStock: min,
      OrderQty: Number(r.ReorderQty) || Math.max(min * 2 - qty, 1),
      Supplier: String(r.Supplier || 'Unknown supplier').trim(),
      SupplierPhone: fixPhone(r.SupplierPhone)
    });
  }

  // Expiry (ExpiryDate must be YYYY-MM-DD)
  if (r.ExpiryDate) {
    const exp = new Date(r.ExpiryDate);
    if (!isNaN(exp.getTime())) {
      exp.setHours(0, 0, 0, 0);
      const days = Math.round((exp - today) / 86400000);
      if (days <= EXPIRY_WARNING_DAYS) expiring.push({ name, days, exp });
    }
  }
}

// Nothing to report -> stop quietly
if (!low.length && !expiring.length) return [];

let msg = `📦 <b>Stock Report (${fmt(today)})</b>\n`;

if (low.length) {
  msg += `\n🔴 <b>Order Today [${low.length}]</b>\n`;
  const bySupplier = {};
  for (const p of low) (bySupplier[p.Supplier] = bySupplier[p.Supplier] || []).push(p);
  Object.entries(bySupplier).forEach(([supplier, items], i) => {
    if (i > 0) msg += `\n`;
    msg += `<b>Supplier: ${esc(supplier)}</b>\n`;
    if (items[0].SupplierPhone) msg += `Sup. Num: ${items[0].SupplierPhone}\n`;
    items.forEach((p, j) => {
      msg += `${j + 1}. ${esc(p.Medicine)}: ${p.Current} left → order ${p.OrderQty}\n`;
    });
  });
}

if (expiring.length) {
  expiring.sort((a, b) => a.days - b.days);
  // Divider only when both sections are shown
  msg += low.length ? `-------------------------------------\n` : `\n`;
  msg += `⚠️ <b>Expiring Soon [${expiring.length}]</b>\n`;
  expiring.forEach((e, k) => {
    let when;
    if (e.days < 0) when = `EXPIRED ${-e.days} days ago (${fmtShort(e.exp)})`;
    else if (e.days === 0) when = `expires today (${fmtShort(e.exp)})`;
    else when = `${e.days} days (${fmtShort(e.exp)})`;
    msg += `${k + 1}. ${esc(e.name)}: ${when}\n`;
  });
}

// Telegram limit: 4096 characters
if (msg.length > 4000) msg = msg.slice(0, 3950) + '\n…list cut off, see Purchase List sheet';

return [{ json: { message: msg, purchaseList: low } }];
