# Running the System for Multiple Pharmacies

**Half of the system already handles multiple pharmacies.** The Telegram stock bot serves everyone from one workflow. Only the **morning alerts** need a decision. The real limit as you grow isn't n8n; it's **your onboarding and data-entry time** for each new pharmacy.

---

## 1. What already scales, and what doesn't

| Part | Multi-pharmacy today? | How |
|---|---|---|
| Google service account | ✅ Yes | One credential. Each pharmacy's sheet is shared with its email |
| Telegram bot | ✅ Yes | One bot, with a private chat per person |
| **Telegram Stock Bot workflow** | ✅ Yes | One workflow. The `Clients` sheet maps each chat ID to a pharmacy's sheet |
| Stock sheets | ✅ Yes | One spreadsheet per pharmacy, copied from the template |
| **Stock Alerts workflow** | ⚠️ One copy per pharmacy | Each copy holds one sheet ID and one chat ID |

So, for every new pharmacy you currently:

1. copy the template sheet,
2. add rows to the Clients sheet, and
3. **duplicate the alert workflow.**

Step 3 is fine for a few pharmacies, and painful beyond that.

---

## 2. Two stages

| Stage | Pharmacies | Alerts setup |
|---|---|---|
| **Stage 1** | 1–4 | Duplicate the alert workflow per pharmacy (works today, no changes) |
| **Stage 2** | 5+ | One **master alert workflow** that loops through the Clients sheet |

**Why switch at about 5:** with 5 copies, every fix or format change has to be made 5 times. With one master workflow, you make it once.

---

## 3. Change to make now: upgrade the Clients sheet

Add these columns now, even in Stage 1. The stock bot ignores columns it doesn't use, so nothing breaks.

| Column | Example | Purpose |
|---|---|---|
| `ClientName` | Rahim Pharmacy | Pharmacy name (existing) |
| `ChatID` | 5820000000 | This person's Telegram ID (existing) |
| `SheetID` | 1abcDEF… | Their pharmacy's stock sheet (existing) |
| `Active` | YES | `NO` blocks the bot for this person (existing) |
| **`Role`** | Owner / Staff | Who this person is |
| **`Alerts`** | YES / NO | Whether this person gets the 9AM report. Usually owners only |
| **`Phone`** | 01700000000 | Their phone, for your records. Format as Plain text |
| **`PaidUntil`** | 2026-12-31 | Billing tracking |
| **`Notes`** | Started 13 Nov | Anything else |

**Example: one pharmacy with an owner and two staff**

| ClientName | ChatID | SheetID | Active | Role | Alerts |
|---|---|---|---|---|---|
| Rahim Pharmacy | 5820000000 | 1abc… | YES | Owner | YES |
| Rahim Pharmacy | 6110000000 | 1abc… | YES | Staff | NO |
| Rahim Pharmacy | 6220000000 | 1abc… | YES | Staff | NO |
| Karim Medical | 7330000000 | 9xyz… | YES | Owner | YES |

This sheet is now your **single list of every client and user.**

---

## 4. Stage 1 setup (1–4 pharmacies)

### 4.1 Naming conventions (keep everything findable)

| Item | Name format |
|---|---|
| Stock sheet | `[Pharmacy] – Stock` |
| Alert workflow | `[Pharmacy] – Stock Alerts` |
| Clients sheet rows | Exact same `ClientName` for every person at that pharmacy |

In n8n, keep the **master** alert workflow as `TEMPLATE – Stock Alerts`. Always duplicate from the template, never from another client's copy.

### 4.2 Adding a pharmacy

1. **Sheet:** go to `TEMPLATE – Stock` → **File → Make a copy** → name it `[Pharmacy] – Stock`. Share it with the service account email and the owner's Gmail as Editor. Copy the sheet ID.
2. **Telegram:** the owner and staff open the bot and tap **Start**. The bot replies with each person's chat ID.
3. **Clients sheet:** add one row per person (Role, Alerts, and so on).
4. **Alerts:** duplicate `TEMPLATE – Stock Alerts`, paste the sheet ID into both Sheets nodes, paste the owner's chat ID into Send Telegram Alert, then click **Execute** and **Publish**.
5. **Data:** enter their stock, starting with the fast movers. Set MinStock with the owner.

**Several owners or partners at one pharmacy:** in Stage 1, add a second Telegram node to that pharmacy's alert copy with the second chat ID. Stage 2 handles this automatically through the `Alerts` column.

### 4.3 Changing the alert format later (Stage 1)

You have to paste the new code into **every** pharmacy's alert copy. Keep a checklist, because missing one means that client gets the old format. This is the main reason to move to Stage 2.

---

## 5. Stage 2: the master alert workflow (5+ pharmacies)

### 5.1 What changes

| Before (Stage 1) | After (Stage 2) |
|---|---|
| One alert workflow per pharmacy | **One** alert workflow for all |
| Sheet ID and chat ID typed into each copy | Both read from the **Clients** sheet |
| Adding a pharmacy means duplicating a workflow | Adding a pharmacy means **adding a row** |
| A format change means editing every copy | A format change means editing **one** node |
| Pausing a pharmacy means unpublishing its copy | Pausing means setting `Active` or `Alerts` to `NO` |

### 5.2 How the master workflow works

```
Every Morning 9AM
  → Read Clients
  → Group by Pharmacy (Code: one item per SheetID, with every chat ID where Alerts = YES)
  → Loop Over Items (one pharmacy at a time)
      → Read Stock (sheet ID from the current item)
      → Analyze Stock & Build Report (adds the pharmacy name to the title)
      → Send Telegram Alert (to each owner chat ID)
      → Split Purchase List → Save to Purchase List Sheet
      → back to Loop
```

**Important settings:**

- **On Error → Continue** on Read Stock, Send Telegram Alert and Save to Purchase List. One broken sheet or blocked chat must not stop the other pharmacies' alerts.
- **Error log:** failed pharmacies get written to an `Errors` tab in the Clients spreadsheet, or sent to *your* chat, so you know who missed their report.

### 5.3 Switching over safely

1. Build or import the master workflow, and test it with only **your own** test pharmacy set to `Alerts = YES`.
2. Turn on `Alerts = YES` for the real owners.
3. On the same day, **unpublish every per-pharmacy alert copy.** Otherwise owners get two reports.
4. Keep the old copies for a week, then delete them.

The importable master workflow is on the roadmap. It will be built when you reach about 4 pharmacies, using the Clients columns from section 3.

---

## 6. Limits: how far this setup goes

| Limit | Value | When it matters |
|---|---|---|
| Google Sheets API requests | [Likely] about 60 reads and 60 writes per minute for the service account, since it counts as one user | Each bot message uses about 2 reads. All alerts fire in the same minute, so at about 25 or more pharmacies, stagger alert times (9:00, 9:01…) or add a short wait in the master loop |
| Telegram sending | about 30 messages per second per bot | Not an issue at this scale |
| One bot for everyone | One webhook per bot | Never duplicate the bot workflow. Branded per-client bots need a small trigger-only workflow each, passing messages to the shared logic, and should be a paid tier |
| One sheet per pharmacy | Google Sheets handles 10,000+ rows easily | Purchase List grows daily; archive yearly |
| Your VPS | A small Hostinger VPS runs both workflows easily | Watch memory if you add many more workflows |
| **Your time** | Data entry plus support for each pharmacy | **The real limit.** Charge a setup fee |

---

## 7. Running the business side

- **Client records:** the Clients sheet (`PaidUntil`, `Phone`, `Notes`) is your customer list.
- **Late payment:** set `Active = NO` (bot) and `Alerts = NO` (Stage 2), or unpublish their alert copy (Stage 1). Their sheet stays theirs. Agree this in writing up front.
- **Support:** "No reply from the bot means nothing was saved" should be in every staff guide.
- **Backups:** download both workflows after every change. Keep the n8n encryption key in a password manager, because losing it breaks every client at once.
- **Staff turnover:** when a staff member leaves, set their row to `Active = NO`. They can't edit stock anymore, even though they still have the chat.

---

## 8. Quick checklist per new pharmacy

- [ ] Sheet copied from the template, named `[Pharmacy] – Stock`
- [ ] Shared with the service account email and the owner (Editor)
- [ ] SupplierPhone column formatted as Plain text in both tabs
- [ ] Owner and staff tapped **Start** on the bot; chat IDs collected
- [ ] Rows added to the Clients sheet (Role, Alerts, PaidUntil)
- [ ] **Stage 1:** alert workflow duplicated, IDs set, executed, published
- [ ] **Stage 2:** nothing to do in n8n
- [ ] Staff sent `/help` and see their pharmacy name
- [ ] Stock entered (fast movers first), MinStock set with the owner
- [ ] Staff guide handed over
