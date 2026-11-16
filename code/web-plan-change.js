// Check the change, then plan the sheet write
const ctx = $('Find Shop (Save)').first().json;
const action = ctx.action;
const it = ctx.item || {};
const stock = $input.all().map(i => i.json).filter(r => String(r.Medicine || '').trim());

const text = (v, max) => String(v ?? '').replace(/[\r\n\t]/g, ' ').trim().slice(0, max);
const whole = (v) => (v === '' || v === null || v === undefined) ? null : (/^\d+$/.test(String(v).trim()) ? Number(v) : NaN);
const phone = (p) => {
  let d = String(p || '').replace(/\D/g, '');
  if (d.length === 10 && d.startsWith('1')) d = '0' + d;
  if (d.length === 13 && d.startsWith('880')) d = '0' + d.slice(3);
  return d;
};
const fail = (msg) => [{ json: { updates: [], appends: [], deletes: [], response: { ok: false, error: msg } } }];

// Same medicine = same letters and numbers, ignoring case, spaces, dots and dashes
const norm = (s) => String(s || '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
const name = text(it.Medicine, 100).replace(/\s+/g, ' ');
if (!name) return fail('Enter the medicine name.');
const matches = stock.filter(r => norm(r.Medicine) === norm(name));
if (matches.length > 1) return fail('"' + String(matches[0].Medicine).trim() + '" appears ' + matches.length + ' times in your sheet. Delete the extra row in Google Sheets first.');
const existing = matches[0];

if (action === 'delete') {
  if (!existing) return fail(name + ' was not found. Tap Refresh.');
  return [{ json: { updates: [], appends: [], deletes: [{ row_number: existing.row_number }], response: { ok: true } } }];
}

if (action === 'sold' || action === 'received') {
  if (!existing) return fail(name + ' was not found. Tap Refresh.');
  const amount = whole(it.Amount);
  if (!amount || isNaN(amount)) return fail('Enter how many, 1 or more.');
  const before = Number(existing.Quantity) || 0;
  const after = action === 'sold' ? Math.max(0, before - amount) : before + amount;
  const note = action === 'sold' && amount > before ? ' (only had ' + before + ')' : '';
  return [{ json: { updates: [{ Medicine: String(existing.Medicine).trim(), Quantity: after }], appends: [], deletes: [],
    response: { ok: true, message: String(existing.Medicine).trim() + ': ' + before + ' → ' + after + note } } }];
}

const qty = whole(it.Quantity), min = whole(it.MinStock), reo = whole(it.ReorderQty);
if (qty === null || isNaN(qty)) return fail('Quantity must be a whole number, 0 or more.');
if (min === null || isNaN(min)) return fail('Min Stock must be a whole number, 0 or more.');
if (isNaN(reo)) return fail('Reorder Qty must be a whole number, or left empty for auto.');
const expiry = text(it.ExpiryDate, 10);
if (expiry && !/^\d{4}-\d{2}-\d{2}$/.test(expiry)) return fail('Expiry must be a date like 2027-06-30.');

const row = {
  Medicine: existing ? String(existing.Medicine).trim() : name,
  Quantity: qty,
  MinStock: min,
  ReorderQty: reo === null ? '' : reo,
  Supplier: text(it.Supplier, 100),
  SupplierPhone: phone(it.SupplierPhone),
  ExpiryDate: expiry
};

if (action === 'update') {
  if (!existing) return fail(name + ' was not found. Tap Refresh.');
  return [{ json: { updates: [row], appends: [], deletes: [], response: { ok: true } } }];
}
if (action === 'add') {
  if (existing) return fail('"' + String(existing.Medicine).trim() + '" already exists. Edit it instead.');
  return [{ json: { updates: [], appends: [row], deletes: [], response: { ok: true } } }];
}
return fail('Unknown action.');
