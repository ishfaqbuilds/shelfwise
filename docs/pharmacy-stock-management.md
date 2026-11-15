# Pharmacy Stock Management (n8n): Main Guide

This system has **two workflows**:

| Workflow | What it does | Copies |
|---|---|---|
| **Stock Alerts** (`pharmacy-stock-alerts.json`) | Sends the owner a 9AM Telegram report of low stock and expiring items, and writes a purchase list | **One per client** |
| **Telegram Stock Bot** (`pharmacy-stock-bot.json`) | Staff update stock by chat (`/sold`, `/received`, …) | **One for all clients**. See `telegram-stock-bot.md` |

**Setup order:**

1. `google-cloud-console.md`: the service account
2. This guide, section 3: the Telegram bot, sheet template and alert workflow
3. `telegram-stock-bot.md`: the stock bot
4. This guide, section 5: onboarding each client

---

## 1. The alert message

```
📦 Stock Report (12 Nov, 2026)

🔴 Order Today [3]
Supplier: Beximco Rep
Sup. Num: 01700000001
1. Napa 500mg: 8 left → order 50

Supplier: Square Rep
Sup. Num: 01700000002
1. Fexo 120mg: 4 left → order 20
2. Ace Plus: 12 left → order 60
-------------------------------------
⚠️ Expiring Soon [2]
1. Losectil 20mg: 13 days (25 Nov)
2. Seclo 20mg: 19 days (1 Dec)
```

- **Low** means `Quantity ≤ MinStock`.
- **Order amount** comes from `ReorderQty`. If that's blank, it's calculated as `MinStock × 2 − Quantity`.
- **Expiring** means within 30 days (change `EXPIRY_WARNING_DAYS` in the code). Already-expired items show as `EXPIRED X days ago`.
- If nothing is low or expiring, **no message is sent**.

---

## 2. Sheet structure (every client)

One spreadsheet per pharmacy, with two tabs. Tab names and headers must match **exactly**.

**Tab `Stock`** (`templates/stock-sheet-template.csv`)

`Medicine, Quantity, MinStock, ReorderQty, Supplier, SupplierPhone, ExpiryDate`

- `ExpiryDate` must be **YYYY-MM-DD**.
- Format the `SupplierPhone` column as **Plain text** (**Format → Number → Plain text**) so the leading 0 stays.
- Medicine names must be unique.

**Tab `Purchase List`** (`templates/purchase-list-template.csv`)

`Date, Medicine, Current, MinStock, OrderQty, Supplier, SupplierPhone`

- The alert workflow adds dated rows here every day. Format `SupplierPhone` as Plain text here too.

**Admin sheet `Clients`** (`templates/clients-template.csv`, one for your whole business)

`ClientName, ChatID, SheetID, Active, Role, Alerts, Phone, PaidUntil, Notes`

- The stock bot uses the first four columns. The rest are your records. See `telegram-stock-bot.md`.

---

## 3. One-time setup

### 3.1 Create the Telegram bot

1. Open **@BotFather** (blue tick), tap **Start**, and send `/newbot`.
2. Enter the display name (for example `ShelfWise`) and a username ending in `bot`. Pick the username carefully: it's hard to change, and every client's `t.me/…` link depends on it. Avoid numbers like `builds7_bot`.
3. Copy the **token**. It goes **only** into n8n, never into chat or GitHub.
4. In n8n, go to **Credentials → Create credential → Telegram API**, paste the token, and click **Save**.

One bot serves **all** clients, and each person has a private chat with it.

### 3.2 Create the template sheet

1. Create a Google Sheet in your Gmail and import `stock-sheet-template.csv`. In the import dialog, untick **"Convert text to numbers, dates, and formulas"**. Rename the tab `Stock`.
2. Add a `Purchase List` tab and import `purchase-list-template.csv` into it, or type the headers.
3. Set the **SupplierPhone** column to **Plain text** in both tabs.
4. Test the workflows with the sample rows. Afterwards, delete the medicine rows but **keep the headers**, and name the sheet `TEMPLATE – Stock`.

### 3.3 Alert workflow, Option A: import

1. In n8n, click **+ → Workflow → ⋯ → Import from File → `pharmacy-stock-alerts.json`**.
2. **Read Stock Sheet:** choose the service account credential and paste the sheet ID. Sheet: By Name `Stock`.
3. **Save to Purchase List Sheet:** use the same credential and sheet ID. Sheet: `Purchase List`. Set **Mapping Column Mode → Map Automatically** and **Options → Cell Format → Let n8n format**.
4. **Send Telegram Alert:** choose the Telegram credential and paste the owner's **chat ID**.
5. Click **Execute Workflow**. All nodes should turn green and a message should arrive.
6. Click **Publish** to turn on the daily 9AM run.

### 3.4 Alert workflow, Option B: build it by hand

| # | Node | Settings |
|---|---|---|
| 1 | **Schedule Trigger**: `Every Morning 9AM` | Interval: Days. Hour: 9 |
| 2 | **Google Sheets → Get row(s)**: `Read Stock Sheet` | Service Account. Document By ID. Sheet By Name `Stock` |
| 3 | **Code**: `Analyze Stock & Build Report` | Run Once for All Items. Paste `code/alerts-analyze-stock.js` |
| 4 | **Telegram → Send a text message**: `Send Telegram Alert` | Chat ID: owner's ID. Text: `{{ $json.message }}`. Parse Mode HTML. Attribution off |
| 5 | **Code**: `Split Purchase List` | Paste `code/alerts-split-purchase-list.js` |
| 6 | **Google Sheets → Append row**: `Save to Purchase List Sheet` | Sheet `Purchase List`. Map Automatically. Cell Format: Let n8n format |

**Connections:** 1 → 2 → 3. Then 3 → 4 and 3 → 5. Then 5 → 6.

**Settings:** go to **⋯ → Settings** and set Timezone to **Asia/Dhaka**.

The Code node returns nothing when there's nothing to report, so the workflow stops quietly.

---

## 4. Telegram Stock Bot

Set it up **once** using `telegram-stock-bot.md`. Clients are added as rows in the Clients sheet. Never duplicate the bot workflow.

---

## 5. Per-client onboarding checklist

**A. Sheet (5 min)**

1. Open `TEMPLATE – Stock`, go to **File → Make a copy**, and name it `[Pharmacy] – Stock`.
2. Share it with the **service account email** as Editor.
3. Share it with the **owner's Gmail** as Editor.
4. Copy the **sheet ID**.

**B. Telegram (5 min, on the owner's phone)**

1. Install Telegram.
2. Open `t.me/YOUR_BOT_USERNAME` and tap **Start**. The bot replies with their **chat ID**.
3. Do the same for any staff who will update stock.

**C. Stock bot access (1 min)**

1. In the **Clients** sheet, add one row per person: name, chat ID, sheet ID, `YES`, role (Owner/Staff), alerts (YES for owner), phone, paid-until date and notes.
2. Each person sends `/help`. They should now see their pharmacy name.

**D. Morning alerts (5 min)**

1. Open the alert workflow, go to **⋯ → Duplicate**, and name it `[Pharmacy] – Stock Alerts`.
2. Paste the new sheet ID into both Google Sheets nodes. Check **Map Automatically** and **Cell Format**.
3. Paste the owner's chat ID into **Send Telegram Alert**.
4. Click **Execute** to confirm the owner receives the message, then click **Publish**.

**E. Data and records**

1. Enter their real stock. Start with the 50–100 fast-moving medicines. You can photograph invoices or their khata and convert them to CSV.
2. Ask the owner to set **MinStock** for the fast movers.
3. Keep `PaidUntil` in the Clients sheet up to date. It's your payment record.

---

## 6. Pausing or removing a client

- **Pause alerts:** open their alert workflow and click **Unpublish**.
- **Pause the bot:** set `Active` to `NO` on their rows in the Clients sheet.
- **Remove completely:** do both of the above, delete their alert workflow, and remove the service account email from their sheet.
- **Never take away the client's own access** to their sheet. Their data stays theirs.

---

## 7. Telegram bot management (BotFather)

| Task | Command |
|---|---|
| New token (if leaked) | `/revoke` → pick the bot → update the Telegram credential in n8n |
| Change display name | `/setname` |
| Profile photo | `/setuserpic` |
| Description / About | `/setdescription`, `/setabouttext` |
| Show the command menu in Telegram | `/setcommands` → paste the list below |
| List bots | `/mybots` |

**Command menu list** (for `/setcommands`):

```
stock - Check stock
sold - Record sales
received - Record a delivery
report - Low stock and expiry now
suppliers - List suppliers
help - All commands
```

### Deleting or replacing the bot

**Deleting the bot stops alerts and the stock bot for every client.** To replace it safely:

1. Create the new bot (3.1) and set its name, description, about text, picture and command menu.
2. **Every client and staff member taps Start on the new bot first.** If you switch before they do, their alerts fail with `chat not found`.
3. In n8n, go to **Overview → Credentials**, open the existing **Telegram** credential, paste the **new token** and click **Save**. Every Telegram node in both workflows uses this one credential, so nothing else changes.
4. Open the **Telegram Stock Bot** workflow and click **Unpublish → Publish**, so Telegram sends messages to the new bot's webhook.
5. Test: send `/help` to the new bot, and run one alert workflow with **Execute**.
6. Chat IDs stay the same, so the Clients sheet and alert workflows need no changes.
7. Wait a day, then send `/deletebot` to BotFather, pick the old bot, and type the confirmation sentence exactly as shown.

---

## 8. VPS protection

1. **Backups:** in Hostinger hPanel, go to **VPS → Backups**. Turn on automatic backups and take a snapshot after big changes.
2. **Encryption key:** run
   ```
   docker exec -it $(docker ps --filter "name=n8n" -q | head -1) cat /home/node/.n8n/config
   ```
   Save the `encryptionKey` value in a password manager. If you lose it, every saved credential becomes unreadable.
3. **Workflow backups:** go to **⋯ → Download** after every change.

---

## 9. Troubleshooting (alerts)

| Error | Fix |
|---|---|
| `chat not found` | The owner must tap **Start** on the bot. Use their chat ID, not the number at the start of the bot token. |
| `can't parse entities` | Remove `<`, `>` or `&` from text you added to the message code. |
| `At least one value has to be added under 'Values to Send'` | Set **Mapping Column Mode → Map Automatically**. |
| Sheets "not found" or "permission denied" | Share the sheet with the service account email as Editor. |
| Phone number missing its 0 | Plain text column, plus **Cell Format → Let n8n format**. |
| Expiry items missing | Use YYYY-MM-DD dates. |
| No 9AM message | Check the workflow is **Published**, check the Executions tab, or there may be nothing low or expiring. |

---

## 10. Security rules

- The bot token, service account key and encryption key never go into chat, WhatsApp or GitHub.
- **Token leaked:** send `/revoke`. **Key leaked:** delete it in Google Cloud and create a new one.
- If you need help, share screenshots with the secrets covered.
