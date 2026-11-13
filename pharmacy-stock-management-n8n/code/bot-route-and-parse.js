// Who sent the message, and which pharmacy do they belong to?
const msg = $('Telegram Trigger').first().json.message || {};
const chatId = String((msg.chat && msg.chat.id) || '');
const text = String(msg.text || '').trim();

const clients = $input.all().map(i => i.json);
const client = clients.find(c =>
  String(c.ChatID || '').trim() === chatId &&
  String(c.Active || 'YES').trim().toUpperCase() !== 'NO'
);

if (!client || !String(client.SheetID || '').trim()) {
  return [{ json: {
    registered: false,
    chatId,
    reply: `👋 This bot is for registered pharmacies only.\n\nYour chat ID: <code>${chatId}</code>\nSend this number to your service provider to get access.`
  } }];
}

return [{ json: {
  registered: true,
  chatId,
  text,
  sheetId: String(client.SheetID).trim(),
  client: String(client.ClientName || '').trim()
} }];
