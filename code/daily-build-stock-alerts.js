// ===== Build each shop's 9AM stock report =====
const EXPIRY_WARNING_DAYS = 30;
const shops = $('Shops').all().map(i => i.json);
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' });
const today = Date.parse(todayStr + 'T00:00:00Z');
const [ty, tm, td] = todayStr.split('-').map(Number);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const fixPhone = (p) => {
  let s = String(p || '').replace(/\D/g, '');
  if (s.length === 10 && s.startsWith('1')) s = '0' + s;
  if (s.length === 13 && s.startsWith('880')) s = '0' + s.slice(3);
  return s;
};

// Put each stock row back with the shop it was read for
const rowsByShop = shops.map(() => []);
for (const it of $input.all()) {
  const pi = Array.isArray(it.pairedItem) ? it.pairedItem[0] : it.pairedItem;
  const idx = pi && typeof pi.item === 'number' ? pi.item : (typeof pi === 'number' ? pi : null);
  if (idx === null || idx === undefined) {
    if (shops.length > 1) throw new Error('Could not tell which shop a stock row belongs to. No alerts sent, to avoid mixing shops.');
    rowsByShop[0].push(it.json); continue;
  }
  if (it.json && it.json.error) continue;   // that shop's sheet failed to load; others still get alerts
  if (rowsByShop[idx]) rowsByShop[idx].push(it.json);
}

const out = [];
shops.forEach((shop, i) => {
  const low = [], expiring = [];
  for (const r of rowsByShop[i]) {
    const name = String(r.Medicine || '').trim();
    if (!name) continue;
    const qty = Number(r.Quantity) || 0, min = Number(r.MinStock) || 0;
    if (qty <= min) low.push({ name, qty, order: Number(r.ReorderQty) || Math.max(min * 2 - qty, 1),
      supplier: String(r.Supplier || 'Unknown supplier').trim(), phone: fixPhone(r.SupplierPhone) });
    const e = String(r.ExpiryDate || '').trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(e)) {
      const days = Math.round((Date.parse(e + 'T00:00:00Z') - today) / 86400000);
      if (days <= EXPIRY_WARNING_DAYS) { const [, m, d] = e.split('-').map(Number); expiring.push({ name, days, short: d + ' ' + MONTHS[m - 1] }); }
    }
  }
  if (!low.length && !expiring.length) return;

  let msg = `📦 <b>Stock Report · ${esc(shop.shop)} (${td} ${MONTHS[tm - 1]}, ${ty})</b>\n`;
  if (low.length) {
    msg += `\n🔴 <b>Order Today [${low.length}]</b>\n`;
    const by = {};
    for (const p of low) (by[p.supplier] = by[p.supplier] || []).push(p);
    Object.entries(by).forEach(([supplier, items], k) => {
      if (k > 0) msg += `\n`;
      msg += `<b>Supplier: ${esc(supplier)}</b>\n`;
      if (items[0].phone) msg += `Sup. Num: ${items[0].phone}\n`;
      items.forEach((p, j) => { msg += `${j + 1}. ${esc(p.name)}: ${p.qty} left → order ${p.order}\n`; });
    });
  }
  if (expiring.length) {
    expiring.sort((a, b) => a.days - b.days);
    msg += low.length ? `-------------------------------------\n` : `\n`;
    msg += `⚠️ <b>Expiring Soon [${expiring.length}]</b>\n`;
    expiring.forEach((e, k) => {
      const when = e.days < 0 ? `EXPIRED ${-e.days} days ago (${e.short})` : e.days === 0 ? `expires today (${e.short})` : `${e.days} days (${e.short})`;
      msg += `${k + 1}. ${esc(e.name)}: ${when}\n`;
    });
  }
  if (msg.length > 4000) msg = msg.slice(0, 3950) + '\n…list cut off, see your dashboard';
  shop.chatIds.forEach(chatId => out.push({ json: { chatId, message: msg } }));
});
return out;
