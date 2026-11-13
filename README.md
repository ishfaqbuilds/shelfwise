# Pharmacy Stock Management Workflow (n8n)

Stock management for small pharmacies using **n8n**, **Google Sheets** and **Telegram**. There's nothing to install for the pharmacy: they use a Google Sheet and a Telegram chat.

## Features

**📦 Daily stock alerts** (one workflow per pharmacy)

- Sends one Telegram message every morning at 9AM.
- Lists medicines at or below minimum stock, grouped by supplier, with the supplier's number and how many to order.
- Lists medicines expiring within 30 days, or already expired.
- Writes a dated purchase list back to Google Sheets.
- Stays silent when nothing needs attention.

**💬 Telegram stock bot** (one workflow for all pharmacies)

- Staff update stock by chat: `/sold napa 10, seclo 5` or `/received napa 50`.
- They can check stock, add or delete medicines, and set minimum and reorder amounts.
- They can manage suppliers and their phone numbers.
- Partial names work (`napa` finds `Napa 500mg`), and the bot asks when a name is ambiguous.
- Only registered users can edit. Each person is mapped to their pharmacy's sheet.

## How it works

```
STOCK ALERTS (per pharmacy)
Every Morning 9AM → Read Stock Sheet → Analyze Stock & Build Report
                                          ├→ Send Telegram Alert
                                          └→ Split Purchase List → Save to Purchase List Sheet

TELEGRAM STOCK BOT (all pharmacies)
Telegram Trigger → Read Clients → Route & Parse → Registered?
                                                    ├ true  → Read Stock → Process Command → Update / Add / Delete rows + Send Reply
                                                    └ false → Reply: Not Registered (shows the sender's chat ID)
```

## Repository structure

```
├── README.md
├── workflows/
│   ├── pharmacy-stock-alerts.json     # import into n8n (daily alerts)
│   └── pharmacy-stock-bot.json        # import into n8n (Telegram stock bot)
├── templates/
│   ├── stock-sheet-template.csv       # pharmacy "Stock" tab (sample data)
│   ├── purchase-list-template.csv     # pharmacy "Purchase List" tab (headers)
│   └── clients-template.csv           # your admin "Clients" sheet
├── code/                              # Code-node scripts, for building by hand
│   ├── alerts-analyze-stock.js
│   ├── alerts-split-purchase-list.js
│   ├── bot-route-and-parse.js
│   ├── bot-process-command.js
│   ├── bot-split-updates.js
│   ├── bot-split-new-items.js
│   └── bot-split-deletes.js
└── docs/
    ├── google-cloud-console.md        # Google project, APIs, service account
    ├── pharmacy-stock-management.md   # main guide: alerts, sheets, onboarding, bot management
    ├── telegram-stock-bot.md          # stock bot: node-by-node build guide and commands
    └── multi-pharmacy-setup.md        # running the system for many pharmacies
```

## Requirements

- n8n, self-hosted or Cloud (tested on n8n 2.x, self-hosted)
- A Google Cloud project with the **Google Sheets API** and **Google Drive API** enabled
- A Google **service account** with a JSON key
- A Telegram bot created with **@BotFather**

Everything except hosting is free.

## Quick start

1. **Google:** follow [`docs/google-cloud-console.md`](docs/google-cloud-console.md).
2. **Telegram bot and alerts:** follow [`docs/pharmacy-stock-management.md`](docs/pharmacy-stock-management.md), section 3.
3. **Stock bot:** follow [`docs/telegram-stock-bot.md`](docs/telegram-stock-bot.md).
4. **Each new pharmacy:** follow the onboarding checklist in `pharmacy-stock-management.md`, section 5. For scaling, see [`docs/multi-pharmacy-setup.md`](docs/multi-pharmacy-setup.md).
5. **More than one pharmacy:** read [`docs/multi-pharmacy-setup.md`](docs/multi-pharmacy-setup.md).

Each guide gives two options: **import** the ready workflow, or **build it by hand** node by node using the scripts in `code/`.

**Source of truth:** the workflow JSON files. The `code/` scripts are copies of the Code nodes. If you change code in n8n, re-export the workflow and update the matching file in `code/`.

## Bot commands

| Command | Action |
|---|---|
| `/stock napa` · `/stock` | Check one medicine · list all |
| `/sold napa 10, seclo 5` | Record sales |
| `/received napa 50` | Record a delivery |
| `/setmin napa 30` · `/setreorder napa 50` | Set minimum · set order quantity (`0` = auto) |
| `/new Name \| Qty \| Min \| Supplier \| Phone \| Expiry \| Reorder` | Add a medicine |
| `/delete napa` → `/delete Napa 500mg YES` | Delete, with confirmation |
| `/report` | Low stock and expiry right now |
| `/suppliers` · `/setsupplier` · `/supplierphone` · `/renamesupplier` | Manage suppliers |

## Security

This repository contains **no credentials**. The workflows use placeholders: `PASTE_YOUR_GOOGLE_SHEET_ID_HERE`, `PASTE_OWNER_TELEGRAM_CHAT_ID` and `PASTE_CLIENTS_SHEET_ID`.

- Never commit your service account key, Telegram bot token or n8n encryption key.
- If a secret leaks, revoke the token with `/revoke` in BotFather, or delete the key in Google Cloud and create a new one.

## Roadmap

- [x] Daily low-stock and expiry alerts
- [x] Telegram stock management bot
- [ ] Master alert workflow driven by the Clients sheet (one workflow instead of one per pharmacy)
- [ ] WhatsApp alerts
- [ ] Sales history log

---

Built by **Ishfaq Builds**.
