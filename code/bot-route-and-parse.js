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
    reply: `👋 This Is A Private Assistant For Registered Shops Only.\n\nYour chat ID: <code>${chatId}</code>\nSend this number to Ishfaq Builds to get access.\nOnce you're added, send /start again to get your dashboard link.`
  } }];
}

return [{ json: {
  registered: true,
  chatId,
  text,
  sheetId: String(client.SheetID).trim(),
  client: String(client.ClientName || '').trim(),
  key: String(client.Key || '').trim()
} }];
