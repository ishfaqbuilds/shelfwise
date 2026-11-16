// Read the change sent by the dashboard and find the shop for its key
const body = $('Save Webhook').first().json.body || {};
let p = {};
try { p = typeof body.payload === 'string' ? JSON.parse(body.payload) : (body.payload || body); } catch (e) { p = {}; }
const key = String(p.key || '').trim();
const rows = $input.all().map(i => i.json);
const row = key.length >= 16 ? rows.find(r =>
  String(r.Key || '').trim() === key &&
  String(r.Active || 'YES').trim().toUpperCase() !== 'NO' &&
  String(r.SheetID || '').trim()
) : null;
if (!row) return [{ json: { found: false, response: { ok: false, error: 'This link is not valid or has been paused.' } } }];
return [{ json: { found: true, sheetId: String(row.SheetID).trim(), action: String(p.action || ''), item: p.item || {} } }];
