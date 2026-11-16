// Send this shop's stock to the dashboard
const ctx = $('Find Shop (Data)').first().json;
const n = (v) => (v === null || v === undefined || v === '' || isNaN(Number(v))) ? null : Number(v);
const phone = (p) => {
  let d = String(p || '').replace(/\D/g, '');
  if (d.length === 10 && d.startsWith('1')) d = '0' + d;
  if (d.length === 13 && d.startsWith('880')) d = '0' + d.slice(3);
  return d;
};
const items = $input.all().map(i => i.json)
  .filter(r => String(r.Medicine || '').trim())
  .map(r => ({
    Medicine: String(r.Medicine).trim(),
    Quantity: n(r.Quantity) ?? 0,
    MinStock: n(r.MinStock) ?? 0,
    ReorderQty: n(r.ReorderQty),
    Supplier: String(r.Supplier || '').trim(),
    SupplierPhone: phone(r.SupplierPhone),
    ExpiryDate: String(r.ExpiryDate || '').trim()
  }));
return [{ json: { response: { ok: true, shop: ctx.shop, items } } }];
