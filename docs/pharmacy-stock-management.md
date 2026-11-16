# ShelfWise: Main Guide

Four workflows, one Admin sheet. Every shop is just rows in that sheet.

| Workflow | File | Does |
|---|---|---|
| **Bot** | `shelfwise-bot.json` | Telegram commands (`/sold`, `/received`, `/dashboard`…) |
| **Web** | `shelfwise-web.json` | Each client's web dashboard |
| **Daily** | `shelfwise-daily.json` | 9AM stock alerts + payment reminders |
| **Admin** | `shelfwise-admin.json` | Your private admin panel |

**Order:** `google-cloud-console.md` → sections 1–4 here → onboard shops (section 5).

---

## 1. Sheets

### Admin sheet (one, yours)

Import `admin-clients-template.xlsx` (or the two CSVs) into a Google Sheet with two tabs. Share it with the service account email as **Editor**.

**`Clients`**: one row per person.

`ClientName, ChatID, SheetID, Active, Role, Alerts, Phone, Notes, Key, ID`

| Column | Meaning |
|---|---|
| `ClientName` | Shop name. Same for everyone in that shop |
| `ChatID` | Their Telegram chat ID |
| `SheetID` | The shop's stock sheet ID |
| `Active` | `NO` blocks bot, dashboard and alerts |
| `Role` | `Owner` or `Staff`. Payment reminders go to Owners |
| `Alerts` | `YES` / `NO` for the 9AM stock alert |
| `Key` | Dashboard key. The bot fills it on `/start`. Clear it to revoke the link |
| `ID` | `C001`, `C002`… (the admin panel adds these) |

**`Payments`**: one row per bill.

`PaymentID, ClientName, PaymentDate, Amount, Status, PaidOn, Notes`

- `Status`: `Due`, `Paid`, `Overdue` or `Cancelled`.
- Dates are `YYYY-MM-DD`. Format `PaymentDate` and `PaidOn` as dates with data validation **Is valid date** to get a calendar on double click.
- Format `ChatID`, `SheetID`, `Phone` and `Key` as **Plain text**.

### Stock sheet (one per shop)

Tab **`Stock`**: `Medicine, Quantity, MinStock, ReorderQty, Supplier, SupplierPhone, ExpiryDate`

- Make a `TEMPLATE – Stock` from `stock-sheet-template.csv`. When importing, untick **Convert text to numbers, dates, and formulas**.
- `SupplierPhone` → **Plain text**. `ExpiryDate` → `YYYY-MM-DD`. Medicine names unique.

---

## 2. Telegram Bot

1. **@BotFather** → `/newbot` → pick name and username (hard to change later).
2. Copy the token **only** into n8n: **Credentials → Telegram API**.
3. `/setcommands`:

```
stock - Check stock
sold - Record sales
received - Record a delivery
report - Low stock and expiry now
dashboard - Web dashboard link
suppliers - List suppliers
help - All commands
```

---

## 3. Import The Workflows

For **each** of the four JSON files: **+ → Workflow → ⋯ → Import from File**. Then:

1. Every **Google Sheets** node: credential = service account. Wherever the Document shows `PASTE_CLIENTS_SHEET_ID`, paste your Admin sheet ID. Stock nodes use an expression (`{{ … sheetId }}`). Leave those.
2. Every **Telegram** node: your Telegram credential.
3. Replace `YOUR-N8N-DOMAIN` with your n8n domain:
   - **Bot** → **Process Command** → `DASHBOARD_URL`
   - **Admin** → **Admin Plan** → `DASHBOARD_URL`
4. **Daily** → **Plan Day** → `ADMIN_CHAT_ID`: your own chat ID (daily payment summary).
5. **Admin** → **Login** → `ADMIN_PASSWORD`: 12+ characters. It refuses to log in until you change it.
6. **⋯ → Settings → Timezone**: your timezone (e.g. Asia/Dhaka) on every workflow.
7. Click **Publish** on all four.

**Links:**

| | URL |
|---|---|
| Client dashboard | `https://YOUR-N8N-DOMAIN/webhook/shelfwise?key=KEY` (sent by the bot) |
| Admin panel | `https://YOUR-N8N-DOMAIN/webhook/shelfwise-admin` (yours only) |

---

## 4. What Each Workflow Does

**Bot:** finds the sender in `Clients` → reads their shop's `Stock` → applies the command → replies. Unknown senders get their chat ID back. `/start` and `/dashboard` create a key if missing and send the dashboard link. Details: `telegram-stock-bot.md`.

**Web:** three webhooks.

- `shelfwise` serves the page.
- `shelfwise-data` returns the stock for a key.
- `shelfwise-save` writes changes.

Sold and Received are calculated on the server, so two people clicking at once can't overwrite each other. Names are compared ignoring case and symbols, so duplicates are blocked.

**Daily (9AM):**

- **Stock alert:** one per shop, sent to each person with `Active` ≠ `NO`, `Alerts` = `YES` and a `ChatID`. Nothing low or expiring → no message.
- **Payment reminder:** sent to Owners for open bills on days `3, 1, 0` before and `1, 3, 7` days late. Edit `REMIND_DAYS` in **Plan Day**.
- **Admin summary:** overdue and due in 7 days, sent to `ADMIN_CHAT_ID`.

**Admin:** login → read `Clients` + `Payments` → apply the action → write back. It can:

- Add and edit users.
- Make or remove dashboard keys.
- Add and edit payments.
- Mark a bill **Paid**. This sets `PaidOn` to today and adds next month's `Due` row.
- Cancel or reopen a bill.

---

## 5. Onboard A Shop (10 Minutes)

1. Copy `TEMPLATE – Stock` → name it `[Shop] – Stock` → share with the service account as **Editor** (untick Notify). Copy the sheet ID.
2. Owner and staff open the bot and send `/start`. They get their chat ID and send it to you.
3. Admin panel → **+ User** (or add rows in `Clients`): name, chat ID, sheet ID, `YES`, role, alerts.
4. They send `/start` again → they get their dashboard link.
5. Admin panel → Payments → add their first bill.
6. Enter their stock (start with the 50–100 fast movers) and set `MinStock`.

No n8n changes needed.

**Pause:** `Active` = `NO` on all their rows. **Remove:** also unshare the service account from their sheet. Never take away the shop's own access to its sheet.

---

## 6. The Alert Message

```
📦 Stock Report (12 Nov, 2026)

🔴 Order Today [2]
Supplier: Square Rep
Sup. Num: 01700000002
1. Fexo 120mg: 4 left → order 20
2. Ace Plus: 12 left → order 60
-------------------------------------
⚠️ Expiring Soon [1]
1. Losectil 20mg: 13 days (25 Nov)
```

- **Low:** `Quantity ≤ MinStock`. **Order:** `ReorderQty`, or `MinStock × 2 − Quantity` if blank.
- **Expiring:** within 30 days (`EXPIRY_WARNING_DAYS`).

---

## 7. VPS Protection

1. Turn on automatic VPS backups and take snapshots after big changes.
2. Save n8n's `encryptionKey` in a password manager:
   ```
   docker exec -it $(docker ps --filter "name=n8n" -q | head -1) cat /home/node/.n8n/config
   ```
   Lose it and every saved credential is unreadable.
3. Download each workflow after changes.
4. Moving servers: restore n8n with the same encryption key and point your domain's DNS to the new server. Links keep working.

---

## 8. Troubleshooting

| Problem | Fix |
|---|---|
| `chat not found` | That person never tapped **Start** on the bot |
| Sheets "not found" / "permission denied" | Share the sheet with the service account email as Editor |
| Dashboard says link invalid | `Key` cell empty or `Active` = `NO`. They send `/dashboard` |
| Admin "Set your admin password" | Change `ADMIN_PASSWORD` in **Login** |
| No payment reminders | `PaymentDate` not a real date, or `Status` is Paid/Cancelled |
| No 9AM message | Workflow not published, `Alerts` ≠ `YES`, or nothing to report. Check **Executions** |
| Phone missing its 0 | Plain text column |
| `can't parse entities` | A `<`, `>` or `&` in text you added to a message |

---

## 9. Security

- Bot token, service account key and encryption key never go into chat, WhatsApp or GitHub.
- **Token leaked:** BotFather `/revoke` → update the n8n credential. **Key leaked:** delete it in Google Cloud and make a new one.
- **Dashboard link leaked:** clear that person's `Key`. They send `/dashboard` for a new one.
- Keep the admin link to yourself. Change the password if it ever leaks.
