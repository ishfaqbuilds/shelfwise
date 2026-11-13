// ===== Process a stock command =====
const ctx = $('Route & Parse').first().json;
const chatId = ctx.chatId;
const text = ctx.text || '';
const EXPIRY_WARNING_DAYS = 30;

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const fmtShort = (d) => `${d.getDate()} ${MONTHS[d.getMonth()]}`;
const fmt = (d) => `${fmtShort(d)}, ${d.getFullYear()}`;

// Current stock from the sheet
const stock = $input.all()
  .map(i => i.json)
  .filter(r => String(r.Medicine || '').trim())
  .map(r => ({
    row: r.row_number,
    name: String(r.Medicine).trim(),
    qty: Number(r.Quantity) || 0,
    min: Number(r.MinStock) || 0,
    reorder: Number(r.ReorderQty) || 0,
    supplier: String(r.Supplier || '').trim(),
    phone: String(r.SupplierPhone || '').trim(),
    exp: r.ExpiryDate
  }));

const updates = {};   // Medicine -> fields to change
const appends = [];   // new medicines
const deletes = [];   // rows to remove

// Find a medicine: exact name first, then partial match
const find = (q) => {
  const n = String(q).toLowerCase().trim();
  if (!n) return [];
  const exact = stock.filter(s => s.name.toLowerCase() === n);
  return exact.length ? exact : stock.filter(s => s.name.toLowerCase().includes(n));
};

// "napa 10, seclo 5" -> [{q:'napa', n:10}, {q:'seclo', n:5}]
const parseItems = (s) => s.split(/[,\n]+/).map(x => x.trim()).filter(Boolean).map(part => {
  const m = part.match(/^(.*\S)\s+(\d+)$/);
  return m ? { q: m[1], n: parseInt(m[2], 10), raw: part } : { q: part, n: NaN, raw: part };
});

// One clear match, or an explanation why not
const pick = (q) => {
  const m = find(q);
  if (m.length === 0) return { err: `❌ Not found: ${esc(q)}` };
  if (m.length > 1) return { err: `⚠️ "${esc(q)}" matches: ${m.slice(0, 5).map(x => esc(x.name)).join(', ')}. Be more specific.` };
  return { item: m[0] };
};

// Clean a phone number and restore the leading 0 Sheets drops
const cleanPhone = (p) => {
  let d = String(p || '').replace(/\D/g, '');
  if (d.length === 10 && d.startsWith('1')) d = '0' + d;
  if (d.length === 13 && d.startsWith('880')) d = '0' + d.slice(3);
  return d;
};

// Find a supplier by name: exact first, then partial
const pickSupplier = (q) => {
  const names = [...new Set(stock.map(s => s.supplier).filter(Boolean))];
  const n = String(q).toLowerCase().trim();
  let m = names.filter(x => x.toLowerCase() === n);
  if (!m.length) m = names.filter(x => x.toLowerCase().includes(n));
  if (m.length === 0) return { err: `❌ No supplier named: ${esc(q)}. See /suppliers` };
  if (m.length > 1) return { err: `⚠️ "${esc(q)}" matches: ${m.slice(0, 5).map(esc).join(', ')}. Be more specific.` };
  return { name: m[0] };
};

const HELP =
`📋 <b>Commands</b>
/stock napa — check one medicine
/stock — list all
/sold napa 10, seclo 5 — record sales
/received napa 50 — record a delivery
/setmin napa 30 — change minimum stock
/setreorder napa 50 — change order quantity (0 = auto)
/new Name | Qty | Min | Supplier | Phone | Expiry | Reorder
/suppliers — list suppliers and numbers
/setsupplier napa | Square Rep | 017... — change a medicine's supplier
/supplierphone Square Rep | 017... — change number (all their items)
/renamesupplier Old Name | New Name — rename everywhere
/delete napa — remove a medicine
/report — low stock &amp; expiry now`;

const firstSpace = text.search(/\s/);
const cmd = (firstSpace === -1 ? text : text.slice(0, firstSpace)).toLowerCase().replace(/@.*$/, '');
const rest = firstSpace === -1 ? '' : text.slice(firstSpace).trim();

let reply = '';

switch (cmd) {
  case '/start':
  case '/help':
    reply = `👋 <b>${esc(ctx.client || 'Welcome')}</b>\n\n${HELP}`;
    break;

  case '/stock': {
    if (!rest) {
      if (!stock.length) { reply = 'Stock list is empty. Add items with /new'; break; }
      const sorted = [...stock].sort((a, b) => a.name.localeCompare(b.name));
      const lines = sorted.slice(0, 100).map((s, i) => `${i + 1}. ${esc(s.name)}: ${s.qty}${s.qty <= s.min ? ' 🔴' : ''}`);
      reply = `📦 <b>All Stock [${stock.length}]</b>\n${lines.join('\n')}`;
      if (stock.length > 100) reply += `\n…and ${stock.length - 100} more. Search with /stock name`;
    } else {
      const m = find(rest);
      reply = m.length
        ? m.slice(0, 15).map(s => `${s.qty <= s.min ? '🔴' : '🟢'} <b>${esc(s.name)}</b>: ${s.qty} left (min ${s.min}, reorder ${s.reorder || 'auto'})`).join('\n')
        : `❌ Not found: ${esc(rest)}`;
    }
    break;
  }

  case '/sold':
  case '/received': {
    const items = parseItems(rest);
    if (!items.length) { reply = `Usage: ${cmd} napa 10, seclo 5`; break; }
    const lines = [];
    for (const it of items) {
      if (isNaN(it.n) || it.n <= 0) { lines.push(`❓ Couldn't read: ${esc(it.raw)} (format: name qty)`); continue; }
      const p = pick(it.q);
      if (p.err) { lines.push(p.err); continue; }
      const s = p.item;
      const old = s.qty;
      let warn = '';
      if (cmd === '/sold') {
        if (it.n > old) { s.qty = 0; warn = ` (only had ${old})`; }
        else s.qty = old - it.n;
      } else {
        s.qty = old + it.n;
      }
      updates[s.name] = { ...(updates[s.name] || { Medicine: s.name }), Quantity: s.qty };
      lines.push(`✅ ${esc(s.name)}: ${old} → ${s.qty}${warn}${s.qty <= s.min ? ' 🔴 low' : ''}`);
    }
    reply = `${cmd === '/sold' ? '🧾 <b>Sold</b>' : '📥 <b>Received</b>'}\n${lines.join('\n')}`;
    break;
  }

  case '/setmin': {
    const items = parseItems(rest);
    if (!items.length) { reply = 'Usage: /setmin napa 30'; break; }
    const lines = [];
    for (const it of items) {
      if (isNaN(it.n) || it.n < 0) { lines.push(`❓ Couldn't read: ${esc(it.raw)}`); continue; }
      const p = pick(it.q);
      if (p.err) { lines.push(p.err); continue; }
      const s = p.item;
      const old = s.min;
      s.min = it.n;
      updates[s.name] = { ...(updates[s.name] || { Medicine: s.name }), MinStock: s.min };
      lines.push(`✅ ${esc(s.name)}: min ${old} → ${s.min}`);
    }
    reply = `⚙️ <b>Minimum stock</b>\n${lines.join('\n')}`;
    break;
  }

  case '/setreorder': {
    const items = parseItems(rest);
    if (!items.length) { reply = 'Usage: /setreorder napa 50  (0 = automatic)'; break; }
    const lines = [];
    for (const it of items) {
      if (isNaN(it.n) || it.n < 0) { lines.push(`❓ Couldn't read: ${esc(it.raw)}`); continue; }
      const p = pick(it.q);
      if (p.err) { lines.push(p.err); continue; }
      const s = p.item;
      const old = s.reorder || 'auto';
      s.reorder = it.n;
      updates[s.name] = { ...(updates[s.name] || { Medicine: s.name }), ReorderQty: it.n === 0 ? '' : it.n };
      lines.push(`✅ ${esc(s.name)}: reorder ${old} → ${it.n === 0 ? 'auto' : it.n}`);
    }
    reply = `🛒 <b>Reorder quantity</b>\n${lines.join('\n')}`;
    break;
  }

  case '/suppliers': {
    const map = {};
    for (const s of stock) {
      if (!s.supplier) continue;
      map[s.supplier] = map[s.supplier] || { phone: cleanPhone(s.phone), count: 0 };
      map[s.supplier].count++;
    }
    const names = Object.keys(map).sort((a, b) => a.localeCompare(b));
    reply = names.length
      ? `🏢 <b>Suppliers [${names.length}]</b>\n` + names.map((n, i) => `${i + 1}. ${esc(n)}${map[n].phone ? ' -&gt; ' + map[n].phone : ''}`).join('\n')
      : 'No suppliers saved yet.';
    break;
  }

  case '/setsupplier': {
    const [q, supplier, phone] = rest.split('|').map(x => x.trim());
    if (!q || !supplier) { reply = 'Usage:\n/setsupplier napa | Square Rep | 01700000002\n(phone is optional)'; break; }
    const p = pick(q);
    if (p.err) { reply = p.err; break; }
    const s = p.item;
    // Reuse the saved number if this supplier already exists and no phone was given
    const known = stock.find(x => x.supplier.toLowerCase() === supplier.toLowerCase() && x.phone);
    const newPhone = phone ? cleanPhone(phone) : (known ? cleanPhone(known.phone) : cleanPhone(s.phone));
    const old = s.supplier || 'none';
    s.supplier = supplier; s.phone = newPhone;
    updates[s.name] = { ...(updates[s.name] || { Medicine: s.name }), Supplier: supplier, SupplierPhone: newPhone };
    reply = `✅ <b>${esc(s.name)}</b>\nSupplier: ${esc(old)} → ${esc(supplier)}${newPhone ? `\nSup. Num: ${newPhone}` : ''}`;
    break;
  }

  case '/supplierphone': {
    const [q, phone] = rest.split('|').map(x => x.trim());
    if (!q || !phone) { reply = 'Usage:\n/supplierphone Square Rep | 01700000002'; break; }
    const newPhone = cleanPhone(phone);
    if (newPhone.length < 6) { reply = '⚠️ That number looks wrong. Example: 01700000002'; break; }
    const sp = pickSupplier(q);
    if (sp.err) { reply = sp.err; break; }
    const items = stock.filter(x => x.supplier === sp.name);
    for (const s of items) {
      s.phone = newPhone;
      updates[s.name] = { ...(updates[s.name] || { Medicine: s.name }), SupplierPhone: newPhone };
    }
    reply = `✅ <b>${esc(sp.name)}</b>\nSup. Num: ${newPhone}\nUpdated on ${items.length} item${items.length === 1 ? '' : 's'}`;
    break;
  }

  case '/renamesupplier': {
    const [q, newName] = rest.split('|').map(x => x.trim());
    if (!q || !newName) { reply = 'Usage:\n/renamesupplier Square Rep | Square Pharma'; break; }
    const sp = pickSupplier(q);
    if (sp.err) { reply = sp.err; break; }
    const items = stock.filter(x => x.supplier === sp.name);
    for (const s of items) {
      s.supplier = newName;
      updates[s.name] = { ...(updates[s.name] || { Medicine: s.name }), Supplier: newName };
    }
    reply = `✅ Supplier renamed\n${esc(sp.name)} → <b>${esc(newName)}</b>\nUpdated on ${items.length} item${items.length === 1 ? '' : 's'}`;
    break;
  }

  case '/new': {
    const f = rest.split('|').map(x => x.trim());
    const [name, qty, min, supplier = '', phone = '', expiry = '', reorder = ''] = f;
    if (!name || qty === undefined || min === undefined || isNaN(Number(qty)) || isNaN(Number(min))) {
      reply = 'Usage:\n/new Name | Qty | Min | Supplier | Phone | Expiry | Reorder\nOnly Name, Qty and Min are required.\nExample:\n/new Napa 500mg | 100 | 20 | Beximco Rep | 01700000001 | 2027-06-30 | 50';
      break;
    }
    if (stock.some(s => s.name.toLowerCase() === name.toLowerCase())) {
      reply = `⚠️ ${esc(name)} already exists. Use /received to add stock.`;
      break;
    }
    if (reorder && isNaN(Number(reorder))) {
      reply = '⚠️ Reorder must be a number, e.g. 50';
      break;
    }
    if (expiry && !/^\d{4}-\d{2}-\d{2}$/.test(expiry)) {
      reply = '⚠️ Expiry must be YYYY-MM-DD, e.g. 2027-06-30';
      break;
    }
    appends.push({
      Medicine: name,
      Quantity: Number(qty),
      MinStock: Number(min),
      ReorderQty: reorder ? Number(reorder) : '',
      Supplier: supplier,
      SupplierPhone: phone,
      ExpiryDate: expiry
    });
    reply = `✅ Added <b>${esc(name)}</b>: ${Number(qty)} in stock (min ${Number(min)}, reorder ${reorder ? Number(reorder) : 'auto'})`;
    break;
  }

  case '/delete': {
    const confirm = /\s+yes$/i.test(rest);
    const q = rest.replace(/\s+yes$/i, '').trim();
    if (!q) { reply = 'Usage: /delete napa'; break; }
    const p = pick(q);
    if (p.err) { reply = p.err; break; }
    const s = p.item;
    if (!confirm) {
      reply = `Delete <b>${esc(s.name)}</b> (${s.qty} in stock)?\nTo confirm, send:\n/delete ${esc(s.name)} YES`;
    } else {
      deletes.push({ row_number: s.row });
      reply = `🗑 Deleted <b>${esc(s.name)}</b>`;
    }
    break;
  }

  case '/report': {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const low = stock.filter(s => s.qty <= s.min);
    const exp = [];
    for (const s of stock) {
      if (!s.exp) continue;
      const d = new Date(s.exp);
      if (isNaN(d.getTime())) continue;
      d.setHours(0, 0, 0, 0);
      const days = Math.round((d - today) / 86400000);
      if (days <= EXPIRY_WARNING_DAYS) exp.push({ name: s.name, days, d });
    }
    exp.sort((a, b) => a.days - b.days);
    reply = `📦 <b>Stock Report (${fmt(today)})</b>\n`;
    if (!low.length && !exp.length) { reply += '\n✅ Nothing low or expiring.'; break; }
    if (low.length) {
      reply += `\n🔴 <b>Low Stock [${low.length}]</b>\n` +
        low.map((s, i) => `${i + 1}. ${esc(s.name)}: ${s.qty} left (min ${s.min})`).join('\n') + '\n';
    }
    if (exp.length) {
      reply += `\n⚠️ <b>Expiring Soon [${exp.length}]</b>\n` +
        exp.map((e, i) => `${i + 1}. ${esc(e.name)}: ${e.days < 0 ? `EXPIRED ${-e.days} days ago` : e.days === 0 ? 'expires today' : `${e.days} days`} (${fmtShort(e.d)})`).join('\n');
    }
    break;
  }

  default:
    reply = `🤔 I didn't understand that. Send /help for commands.`;
}

if (reply.length > 4000) reply = reply.slice(0, 3950) + '\n…cut off';

return [{ json: { chatId, reply, updates: Object.values(updates), appends, deletes } }];
