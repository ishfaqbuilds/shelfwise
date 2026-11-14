# Telegram Stock Bot (n8n): Build Guide

This workflow lets pharmacy staff manage stock by sending messages to a Telegram bot. For example, `/sold napa 2` reduces Napa's stock by 2 in their Google Sheet, and the bot replies with the new count.

One workflow serves **every** client. It looks up who sent the message in a **Clients** sheet, then reads and writes that pharmacy's own stock sheet.

**Files**

- `workflows/pharmacy-stock-bot.json`: the finished workflow, ready to import
- `code/bot-*.js`: the code for each Code node, used when building by hand
- `templates/clients-template.csv`: the Clients sheet
- `templates/stock-sheet-template.csv`: a pharmacy's stock sheet

**Before you start, you need:**

- The Google Service Account credential in n8n (see `google-cloud-console.md`)
- A Telegram bot and its credential in n8n (see `pharmacy-stock-management.md`, section 3.1)
- At least one stock sheet, shared with the service account email as Editor

---

## 1. How it works

```
Telegram Trigger → Read Clients → Route & Parse → Registered?
                                                    ├ true  → Read Stock → Process Command
                                                    │                        ├→ Split Updates   → Update Stock
                                                    │                        ├→ Split New Items → Add New Medicine
                                                    │                        ├→ Split Deletes   → Delete Medicine Row
                                                    │                        └→ Send Reply
                                                    └ false → Reply: Not Registered
```

1. **Telegram Trigger** receives every message sent to the bot.
2. **Read Clients** loads the Clients sheet.
3. **Route & Parse** finds the sender's chat ID in that sheet and gets their pharmacy's sheet ID.
4. **Registered?** passes unknown senders to a reply that shows them their chat ID ("This Is A Private Assistant For Registered Shops Only…").
5. **Read Stock** loads that pharmacy's Stock tab.
6. **Process Command** works out what to change and writes the reply text.
7. **The three Split nodes** turn the changes into rows, and the Sheets nodes write them.
8. **Send Reply** answers the user.

**Rules that never change:**

- **A Telegram bot can only feed one workflow** (one webhook per bot). Never duplicate this workflow per client. Add clients as rows in the Clients sheet instead. Alert workflows are fine, because they only *send* messages.
- **Medicine names must be unique** within each Stock tab. Updates match rows by the `Medicine` column.
- **Don't rename sheet columns or tabs.** Always start new clients from the template.

---

## 2. Create the Clients sheet (one time)

1. Create a Google Sheet called `Admin – Clients`.
2. Go to **File → Import → Upload → `clients-template.csv` → Replace current sheet**, and rename the tab **`Clients`**.
3. Share it with the service account email as **Editor**.
4. Copy the sheet ID from the URL (between `/d/` and `/edit`).

| ClientName | ChatID | SheetID | Active | Role | Alerts | Phone | PaidUntil | Notes |
|---|---|---|---|---|---|---|---|---|
| Al Modina Pharmacy | 5820000000 | 1abcDEF... | YES | Owner | YES | 01700000000 | 2026-12-31 | Paid cash |
| Al Modina Pharmacy | 6110000000 | 1abcDEF... | YES | Staff | NO | 01800000000 | 2026-12-31 | Counter staff |

- **One row per person.** Several staff of the same pharmacy share the same `SheetID`.
- **Used by the bot:** `ClientName`, `ChatID`, `SheetID`, `Active`. `Active` = `NO` blocks that person, and a blank value counts as active.
- **Your records only (the bot ignores them):** `Role` (Owner/Staff), `Alerts` (YES/NO, for the future master alert workflow), `Phone`, `PaidUntil` (YYYY-MM-DD), `Notes`.
- Format the **Phone** column as **Plain text** so the leading 0 stays.
- **Don't rename or reorder** the first four columns. You can add more columns to the right.

---

## 3. Option A: Import the finished workflow (fast)

1. In n8n, click **+ → Workflow → ⋯ → Import from File → `pharmacy-stock-bot.json`**.
2. In the 3 Telegram nodes, choose your Telegram credential.
3. In the 5 Google Sheets nodes, choose your service account credential.
4. In **Read Clients**, paste the Clients sheet ID.
5. **Check these, because imports sometimes lose them:**
   - In **Update Stock**, **Add New Medicine** and **Delete Medicine Row**, Sheet must be **By Name: `Stock`**.
   - In **Update Stock**, set **Map Automatically** and **Column to match on: Medicine**. If that field is missing, use the trick in step 4.11.
   - In **Add New Medicine**, set **Map Automatically**.
   - In **Update Stock** and **Add New Medicine**, set **Options → Cell Format → Let n8n format**.
6. Go to section 5 (Test and publish).

---

## 4. Option B: Build it by hand, node by node

Create a new workflow and name it `Pharmacy - Telegram Stock Bot (All Clients)`.

### 4.1 Telegram Trigger

- **Add node:** Telegram → **On message**
- **Credential:** your bot
- **Trigger On:** Message

### 4.2 Read Clients

- **Add node:** Google Sheets → **Get row(s) in sheet**
- **Authentication:** Service Account. **Credential:** `n8n-bot`
- **Document:** By ID, then paste the Clients sheet ID
- **Sheet:** By Name, `Clients`
- **Settings tab:** turn **Always Output Data** ON

### 4.3 Route & Parse

- **Add node:** Code
- **Mode:** Run Once for All Items. **Language:** JavaScript
- **Name it exactly** `Route & Parse`. Later nodes refer to this name.
- **Code:** paste `code/bot-route-and-parse.js`

### 4.4 Registered?

- **Add node:** If
- **Condition:** value `{{ $json.registered }}` (drag it in or type it as an expression), type **Boolean**, operator **is true**

### 4.5 Reply: Not Registered (connect to the **false** output)

- **Add node:** Telegram → **Send a text message**
- **Chat ID:** `{{ $json.chatId }}`
- **Text:** `{{ $json.reply }}`
- **Additional Fields:**
  - **Parse Mode:** HTML
  - **Append n8n Attribution:** off

### 4.6 Read Stock (connect to the **true** output)

- **Add node:** Google Sheets → **Get row(s) in sheet**
- **Authentication:** Service Account
- **Document:** By ID. Switch to **Expression** and enter `{{ $json.sheetId }}`
- **Sheet:** By Name, `Stock`
- **Settings tab:** turn **Always Output Data** ON

### 4.7 Process Command

- **Add node:** Code (Run Once for All Items)
- **Code:** paste `code/bot-process-command.js`
- **Output:** `{ chatId, reply, updates[], appends[], deletes[] }`

### 4.8 The three Split nodes (each connected to Process Command)

| Node name | Code file |
|---|---|
| Split Updates | `code/bot-split-updates.js` |
| Split New Items | `code/bot-split-new-items.js` |
| Split Deletes | `code/bot-split-deletes.js` |

Each one returns nothing when there's nothing to do, so the Sheets node after it simply doesn't run.

### 4.9 Delete Medicine Row (after Split Deletes)

- **Add node:** Google Sheets → **Delete rows or columns from sheet**
- **Document:** By ID, as an expression: `{{ $('Route & Parse').first().json.sheetId }}`
- **Sheet:** By Name, `Stock`
- **To Delete:** Rows
- **Start Row Number:** `{{ $json.row_number }}`
- **Number of Rows to Delete:** 1

### 4.10 Add New Medicine (after Split New Items)

- **Add node:** Google Sheets → **Append row in sheet**
- **Document:** the same expression as 4.9
- **Sheet:** By Name, `Stock`
- **Mapping Column Mode:** Map Automatically
- **Options → Cell Format:** Let n8n format. This keeps the leading 0 in phone numbers.

### 4.11 Update Stock (after Split Updates)

- **Add node:** Google Sheets → **Update row in sheet**
- **Sheet:** By Name, `Stock`
- **Mapping Column Mode:** Map Automatically
- **Column to match on:** Medicine
- **Options → Cell Format:** Let n8n format
- **Document:** the same expression as 4.9. Set it up in this order:
  1. Set Document to **Fixed** and paste a **real** stock sheet ID.
  2. Wait for the **Column to match on** field to appear, then choose **Medicine**.
  3. Switch Document back to **Expression** and enter `{{ $('Route & Parse').first().json.sheetId }}`.
  4. Confirm that **Medicine** is still selected.

  n8n can't load columns from an expression, so the match field only appears while a real ID is in place.

### 4.12 Send Reply (connected to Process Command)

- **Add node:** Telegram → **Send a text message**
- **Chat ID:** `{{ $json.chatId }}`
- **Text:** `{{ $json.reply }}`
- **Additional Fields:**
  - **Parse Mode:** HTML
  - **Append n8n Attribution:** off
- **Place it at the bottom of the canvas,** below the three Split nodes. n8n runs branches top to bottom, so the reply only goes out after the sheet writes succeed.

### 4.13 Settings

- Go to **⋯ → Settings**, set **Timezone** to Asia/Dhaka, and click **Save**.

---

## 5. Test and publish

1. Click **Execute Workflow**. It now listens for **one** message only.
2. Send `/help` to your bot straight away.
3. Repeat steps 1 and 2 for each command in section 6, checking the sheet after each one.
4. Once everything works, click **Publish**. The bot now answers every message.
5. After publishing, check runs in the **Executions** tab.

---

## 6. Command reference

| Command | What it does |
|---|---|
| `/help` or `/start` | Shows the command list, grouped into Stock, Settings and Suppliers |
| `/stock napa` | Shows quantity, minimum and reorder amount |
| `/stock` | Lists all medicines (🔴 = low) |
| `/sold napa 10, seclo 5` | Subtracts stock. Several items are allowed, separated by commas or new lines |
| `/received napa 50` | Adds stock |
| `/setmin napa 30` | Changes the minimum stock |
| `/setreorder napa 50` | Changes the order quantity (`0` = automatic: Min × 2 − Qty) |
| `/new Name \| Qty \| Min \| Supplier \| Phone \| Expiry \| Reorder` | Adds a medicine. Only Name, Qty and Min are required. Expiry uses YYYY-MM-DD |
| `/delete napa` | Asks for confirmation |
| `/delete Napa 500mg YES` | Deletes the medicine |
| `/report` | Shows low stock and expiry right now |
| `/suppliers` | Lists suppliers and their numbers |
| `/setsupplier napa \| Square Rep \| 017...` | Moves one medicine to a supplier (phone is optional) |
| `/supplierphone Square Rep \| 017...` | Changes the number on all of that supplier's items |
| `/renamesupplier Old \| New` | Renames a supplier on all of its items |

**How it behaves:**

- **Partial names work:** `napa` finds `Napa 500mg`. If the name matches several medicines, the bot lists them and asks you to be more specific.
- **Selling more than you have** sets the stock to 0 and the reply notes "Only Had X".
- **Sending a command alone** (`/new`, `/setsupplier`, `/supplierphone`, `/renamesupplier`) replies with its full format and an example.
- **Reply style:** descriptions are in Title Case, while commands and their examples stay lowercase so Telegram keeps them tappable.
- **To change wording:** the unregistered reply lives in `code/bot-route-and-parse.js`. Every other reply, including `/help`, lives in `code/bot-process-command.js`.
- **Unregistered senders** get a reply with their chat ID, which makes onboarding easy.

---

## 7. Adding a client to the bot

1. Create their stock sheet from the template and share it with the service account email.
2. The owner (and any staff) open the bot and send `/start`. The bot replies with their **chat ID**.
3. Add one row per person to the Clients sheet: name, chat ID, sheet ID, `YES`, role, alerts, phone, paid-until date and notes.
4. They send `/help` again and now see their pharmacy name.

You don't need to change anything in n8n.

---

## 8. Keeping phone numbers' leading 0

Google Sheets removes the leading 0 from numbers like `01700000001`. Fix it in two places:

1. **In every sheet:** select the **SupplierPhone** column in both tabs and go to **Format → Number → Plain text**. Typing directly in the sheet now keeps the 0. In an unformatted sheet, type `'017...` with an apostrophe first.
2. **In n8n:** in every node that writes to a sheet, set **Options → Cell Format → Let n8n format**.

When importing a CSV, untick **"Convert text to numbers, dates, and formulas"** in the import dialog.

---

## 9. Troubleshooting

| Problem | Cause | Fix |
|---|---|---|
| No reply at all, and no execution in n8n | The workflow isn't listening | Click **Publish**, or click **Execute** right before sending |
| No reply, but there is an execution | A sheet node failed before Send Reply | Open the execution and click the red node |
| `columns.matchingColumns is required` | Column to match on is missing | Use the Fixed-then-Expression trick in 4.11 |
| `Parameter "Sheet" is required` | The Sheet field was cleared | Set it to By Name: `Stock` |
| "This Is A Private Assistant For Registered Shops Only" | Chat ID isn't in the Clients sheet, or Active is NO | Add or fix their row |
| "Not Found" | The name doesn't match | Check with `/stock` and use part of the exact name |
| "Matches: A, B…" | The name matches several medicines | Type more of the name |
| Leading 0 missing in the sheet | Number formatting | See section 8 |

| A second copy of this workflow was imported | Two Telegram Triggers fight over one bot | Delete the extra copy, then **Unpublish → Publish** the real one |

**No reply means nothing was saved.** Tell staff: try again, or contact you.
