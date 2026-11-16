// ===== Admin: read data or plan a change =====
const DASHBOARD_URL = 'https://YOUR-N8N-DOMAIN/webhook/shelfwise';
const req = $('Login').first().json;
const action = req.action;
const d = req.data || {};
const clients = $('Read Clients').all().map(i => i.json).filter(r => String(r.ClientName || '').trim());
const payments = $input.all().map(i => i.json).filter(r => String(r.PaymentID || '').trim());

const out = { clientUpdates: [], clientAdds: [], paymentUpdates: [], paymentAdds: [] };
const done = (response) => [{ json: { ...out, response } }];
const fail = (msg) => [{ json: { clientUpdates: [], clientAdds: [], paymentUpdates: [], paymentAdds: [], response: { ok: false, error: msg } } }];
const text = (v, max) => String(v ?? '').replace(/[\r\n\t]/g, ' ').trim().slice(0, max || 120);
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' });
const addMonth = (s) => {
  const [y, m, day] = s.split('-').map(Number);
  const ny = m === 12 ? y + 1 : y, nm = m === 12 ? 1 : m + 1;
  const last = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
  return ny + '-' + String(nm).padStart(2, '0') + '-' + String(Math.min(day, last)).padStart(2, '0');
};
const nextId = (rows, field, prefix, extra) => {
  const n = rows.map(r => parseInt(String(r[field] || '').replace(/\D/g, ''), 10)).filter(x => !isNaN(x));
  return prefix + String((n.length ? Math.max(...n) : 0) + 1 + (extra || 0)).padStart(3, '0');
};
const newKey = () => {
  const a = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  let s = '';
  const c = globalThis.crypto;
  if (c && c.getRandomValues) { const b = new Uint32Array(24); c.getRandomValues(b); for (const x of b) s += a[x % a.length]; }
  else { for (let i = 0; i < 24; i++) s += a[Math.floor(Math.random() * a.length)]; }
  return s;
};
const phone = (v) => {
  let x = String(v || '').replace(/\D/g, '');
  if (x.length === 10 && x.startsWith('1')) x = '0' + x;
  if (x.length === 13 && x.startsWith('880')) x = '0' + x.slice(3);
  return x;
};

if (action === 'load') {
  return done({
    ok: true, today,
    clients: clients.map(c => ({
      ID: text(c.ID, 20), ClientName: text(c.ClientName), ChatID: text(c.ChatID, 20), SheetID: text(c.SheetID, 100),
      Active: String(c.Active || 'YES').trim().toUpperCase() === 'NO' ? 'NO' : 'YES', Role: text(c.Role, 30),
      Alerts: text(c.Alerts, 10), Phone: phone(c.Phone), Notes: text(c.Notes, 200),
      Link: String(c.Key || '').trim().length >= 16 ? DASHBOARD_URL + '?key=' + String(c.Key).trim() : ''
    })),
    payments: payments.map(p => ({
      PaymentID: text(p.PaymentID, 20), ClientName: text(p.ClientName), PaymentDate: text(p.PaymentDate, 10),
      Amount: p.Amount === '' || p.Amount === null || p.Amount === undefined || isNaN(Number(p.Amount)) ? null : Number(p.Amount),
      Status: text(p.Status, 20) || 'Due', PaidOn: text(p.PaidOn, 10), Notes: text(p.Notes, 200)
    }))
  });
}

if (action === 'client.save') {
  const name = text(d.ClientName).replace(/\s+/g, ' ');
  if (!name) return fail('Enter the shop name.');
  const chat = String(d.ChatID || '').trim();
  if (chat && !/^-?\d{5,20}$/.test(chat)) return fail('Chat ID must be numbers only.');
  const sheet = String(d.SheetID || '').trim();
  if (sheet && !/^[A-Za-z0-9_-]{20,100}$/.test(sheet)) return fail('Sheet ID looks wrong. Copy it from the sheet URL.');
  const row = {
    ClientName: name, ChatID: chat, SheetID: sheet,
    Active: String(d.Active).toUpperCase() === 'NO' ? 'NO' : 'YES',
    Role: text(d.Role, 30) || 'Owner',
    Alerts: String(d.Alerts).toUpperCase() === 'OFF' ? 'OFF' : 'ON',
    Phone: phone(d.Phone), Notes: text(d.Notes, 200)
  };
  const existing = d.ID ? clients.find(c => String(c.ID).trim() === String(d.ID).trim()) : null;
  if (existing) {
    out.clientUpdates.push({ ID: String(existing.ID).trim(), ...row });
    const oldName = String(existing.ClientName).trim();
    const othersKeepOld = clients.some(c => c !== existing && String(c.ClientName).trim() === oldName);
    if (oldName !== name && !othersKeepOld) {
      payments.filter(p => String(p.ClientName).trim() === oldName).forEach(p => out.paymentUpdates.push({ PaymentID: String(p.PaymentID).trim(), ClientName: name }));
    }
    return done({ ok: true, message: 'Saved ' + name });
  }
  out.clientAdds.push({ ...row, Key: '', ID: nextId(clients, 'ID', 'C') });
  return done({ ok: true, message: 'Added ' + name });
}

if (action === 'client.key') {
  const c = clients.find(x => String(x.ID).trim() === String(d.ID || '').trim());
  if (!c) return fail('Client not found. Tap Refresh.');
  if (d.mode === 'remove') { out.clientUpdates.push({ ID: String(c.ID).trim(), Key: '' }); return done({ ok: true, message: 'Link removed. The old link stops working now.' }); }
  out.clientUpdates.push({ ID: String(c.ID).trim(), Key: newKey() });
  return done({ ok: true, message: 'New link made. The old link stops working now.' });
}

if (action === 'payment.save') {
  const name = text(d.ClientName);
  if (!name || !clients.some(c => String(c.ClientName).trim() === name)) return fail('Pick a shop.');
  const date = text(d.PaymentDate, 10);
  if (!isDate(date)) return fail('Pick a payment date.');
  const amt = String(d.Amount ?? '').trim();
  if (amt !== '' && !(/^\d+(\.\d{1,2})?$/.test(amt))) return fail('Amount must be a number, like 1000.');
  const row = { ClientName: name, PaymentDate: date, Amount: amt === '' ? '' : Number(amt), Notes: text(d.Notes, 200) };
  const existing = d.PaymentID ? payments.find(p => String(p.PaymentID).trim() === String(d.PaymentID).trim()) : null;
  if (existing) { out.paymentUpdates.push({ PaymentID: String(existing.PaymentID).trim(), ...row }); return done({ ok: true, message: 'Payment saved' }); }
  out.paymentAdds.push({ PaymentID: nextId(payments, 'PaymentID', 'P'), ...row, Status: 'Due', PaidOn: '' });
  return done({ ok: true, message: 'Payment added' });
}

if (action === 'payment.paid' || action === 'payment.cancel' || action === 'payment.reopen') {
  const p = payments.find(x => String(x.PaymentID).trim() === String(d.PaymentID || '').trim());
  if (!p) return fail('Payment not found. Tap Refresh.');
  const id = String(p.PaymentID).trim();
  if (action === 'payment.cancel') { out.paymentUpdates.push({ PaymentID: id, Status: 'Cancelled' }); return done({ ok: true, message: 'Payment cancelled' }); }
  if (action === 'payment.reopen') { out.paymentUpdates.push({ PaymentID: id, Status: 'Due', PaidOn: '' }); return done({ ok: true, message: 'Marked as due again' }); }
  if (String(p.Status).trim() === 'Paid') return fail('Already marked paid.');
  out.paymentUpdates.push({ PaymentID: id, Status: 'Paid', PaidOn: today });
  let msg = String(p.ClientName).trim() + ' marked paid';
  if (isDate(String(p.PaymentDate).trim())) {
    const next = addMonth(String(p.PaymentDate).trim());
    const already = payments.some(x => String(x.ClientName).trim() === String(p.ClientName).trim() && String(x.PaymentDate).trim() === next && String(x.Status).trim() !== 'Cancelled');
    if (!already) {
      out.paymentAdds.push({ PaymentID: nextId(payments, 'PaymentID', 'P'), ClientName: String(p.ClientName).trim(), PaymentDate: next,
        Amount: p.Amount === '' || p.Amount === null || p.Amount === undefined ? '' : Number(p.Amount), Status: 'Due', PaidOn: '', Notes: '' });
      msg += '. Next payment: ' + next;
    }
  }
  return done({ ok: true, message: msg });
}

return fail('Unknown action.');
