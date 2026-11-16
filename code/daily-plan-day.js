// ===== Settings =====
const ADMIN_CHAT_ID = 'PASTE_YOUR_CHAT_ID';           // your Telegram chat ID (daily payment summary)
const REMIND_DAYS = [3, 1, 0, -1, -3, -7];    // remind owners 3 and 1 days before, on the day, then 1, 3, 7 days late

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' });
const dayDiff = (d) => Math.round((Date.parse(d + 'T00:00:00Z') - Date.parse(today + 'T00:00:00Z')) / 86400000);
const nice = (d) => { const [y, m, dd] = d.split('-').map(Number); return dd + ' ' + MONTHS[m - 1]; };
const taka = (n) => n === '' || n === null || n === undefined || isNaN(Number(n)) ? '' : '৳' + Number(n).toLocaleString('en-IN');
const on = (v) => !['OFF', 'NO', 'FALSE'].includes(String(v || 'ON').trim().toUpperCase());

const clients = $('Read Clients').all().map(i => i.json).filter(c => String(c.ClientName || '').trim());
const payments = $input.all().map(i => i.json).filter(p => String(p.PaymentID || '').trim());

// ---- 9AM stock alerts: one entry per stock sheet, sent to users with Alerts ON ----
const shops = new Map();
for (const c of clients) {
  const sheet = String(c.SheetID || '').trim();
  const chat = String(c.ChatID || '').trim();
  if (!sheet || !chat) continue;
  if (String(c.Active || 'YES').trim().toUpperCase() === 'NO') continue;
  if (!on(c.Alerts)) continue;
  const s = shops.get(sheet) || { sheetId: sheet, shop: String(c.ClientName).trim(), chatIds: [] };
  if (!s.chatIds.includes(chat)) s.chatIds.push(chat);
  shops.set(sheet, s);
}

// ---- Payment reminders to owners, plus a summary for you ----
const payMessages = [];
const overdue = [], dueSoon = [];
for (const p of payments) {
  const status = String(p.Status || 'Due').trim();
  const date = String(p.PaymentDate || '').trim();
  if (status === 'Paid' || status === 'Cancelled' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
  const d = dayDiff(date);
  const name = String(p.ClientName).trim();
  const amt = taka(p.Amount);
  if (d < 0) overdue.push({ name, date, d, amt }); else if (d <= 7) dueSoon.push({ name, date, d, amt });
  if (!REMIND_DAYS.includes(d)) continue;
  const owners = clients.filter(c => String(c.ClientName).trim() === name && String(c.Active || 'YES').trim().toUpperCase() !== 'NO'
    && /^owner$/i.test(String(c.Role || '').trim()) && String(c.ChatID || '').trim());
  const when = d > 1 ? 'In ' + d + ' Days' : d === 1 ? 'Tomorrow' : d === 0 ? 'Today' : (-d) + (d === -1 ? ' Day' : ' Days') + ' Late';
  const title = d < 0 ? '⚠️ <b>Payment Overdue</b>' : '💳 <b>Payment Reminder</b>';
  const msg = title + '\n\nShop: ' + esc(name) + (amt ? '\nAmount: ' + amt : '') + '\nDue: ' + nice(date) + ' (' + when + ')\n\n'
    + (d < 0 ? 'Please Pay Soon To Keep ShelfWise Running.' : 'Thank You For Using ShelfWise!') + '\nQuestions? Contact Ishfaq Builds.';
  owners.forEach(o => payMessages.push({ chatId: String(o.ChatID).trim(), message: msg }));
}
if (ADMIN_CHAT_ID && (overdue.length || dueSoon.length)) {
  let m = '💳 <b>Payments (' + nice(today) + ')</b>\n';
  if (overdue.length) {
    overdue.sort((a, b) => a.d - b.d);
    m += '\n🔴 <b>Overdue [' + overdue.length + ']</b>\n' + overdue.map((x, i) => (i + 1) + '. ' + esc(x.name) + (x.amt ? ' · ' + x.amt : '') + ' · ' + (-x.d) + 'd late').join('\n') + '\n';
  }
  if (dueSoon.length) {
    dueSoon.sort((a, b) => a.d - b.d);
    m += '\n🟡 <b>Due In 7 Days [' + dueSoon.length + ']</b>\n' + dueSoon.map((x, i) => (i + 1) + '. ' + esc(x.name) + (x.amt ? ' · ' + x.amt : '') + ' · ' + (x.d === 0 ? 'today' : nice(x.date))).join('\n');
  }
  payMessages.push({ chatId: ADMIN_CHAT_ID, message: m.slice(0, 4000) });
}

return [{ json: { shops: [...shops.values()], payMessages } }];
