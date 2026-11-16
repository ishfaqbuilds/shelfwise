// ===== Admin password (change this, 12+ characters) =====
const ADMIN_PASSWORD = 'CHANGE-ME';

const body = $('Admin API').first().json.body || {};
let p = {};
try { p = typeof body.payload === 'string' ? JSON.parse(body.payload) : (body.payload || body); } catch (e) { p = {}; }
const ok = ADMIN_PASSWORD !== 'CHANGE-ME' && ADMIN_PASSWORD.length >= 12 && String(p.password || '') === ADMIN_PASSWORD;
if (!ok) return [{ json: { ok: false, response: { ok: false, error: ADMIN_PASSWORD === 'CHANGE-ME' ? 'Set your admin password in the Login node first.' : 'Wrong password.' } } }];
return [{ json: { ok: true, action: String(p.action || 'load'), data: p.data || {} } }];
