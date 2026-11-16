// Find the shop for this link's key
const q = $('Data Webhook').first().json.query || {};
const key = String(q.key || '').trim();
const rows = $input.all().map(i => i.json);
const row = key.length >= 16 ? rows.find(r =>
  String(r.Key || '').trim() === key &&
  String(r.Active || 'YES').trim().toUpperCase() !== 'NO' &&
  String(r.SheetID || '').trim()
) : null;
if (!row) return [{ json: { found: false, response: { ok: false, error: 'This link is not valid or has been paused. Contact Ishfaq Builds.' } } }];
return [{ json: { found: true, sheetId: String(row.SheetID).trim(), shop: String(row.ClientName || '').trim() } }];
