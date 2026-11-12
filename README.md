# Pharmacy Stock Management Workflow (n8n)

Automated daily **low-stock** and **expiry** alerts for pharmacies. Built with n8n, Google Sheets and Telegram.

Every morning, the workflow checks the pharmacy's stock sheet. It then sends the owner **one Telegram message** with:

- medicines at or below minimum stock, grouped by supplier, with suggested order quantities
- medicines expiring within 30 days, or already expired

It also writes a dated **purchase list** back to Google Sheets.

---

## How it works

```
Every Morning 9AM → Read Stock Sheet → Analyze Stock & Build Report
                                          ├→ Send Telegram Alert
                                          └→ Split Purchase List → Save to Purchase List Sheet
```

- If nothing is low or expiring, the workflow stops quietly, so the owner never gets empty messages.
- One Telegram bot serves every client, and each owner has a private chat with it.
- Google access uses a **service account**, so there are no expiring OAuth logins and no dependence on a personal Gmail.

---

## Repository structure

```
├── README.md
├── workflow/
│   └── pharmacy-stock-alerts.json      # import into n8n
├── templates/
│   └── stock-sheet-template.csv        # sample stock data for Google Sheets
└── docs/
    ├── google-cloud-console.md         # service account + API setup
    └── pharmacy-stock-management.md    # full setup, client onboarding, bot management, troubleshooting
```

---

## Requirements

- n8n, self-hosted or Cloud (tested on n8n 2.x, self-hosted)
- A Google Cloud project with the **Google Sheets API** and **Google Drive API** enabled
- A Google **service account** with a JSON key
- A Telegram bot created with **@BotFather**

Everything except hosting is free.

---

## Quick start

1. **Google:** set up the service account by following [`docs/google-cloud-console.md`](docs/google-cloud-console.md).
2. **Sheet:**
   - Import `templates/stock-sheet-template.csv` into a new Google Sheet and name that tab `Stock`.
   - Add a `Purchase List` tab with these headers: `Date, Medicine, Current, MinStock, OrderQty, Supplier, SupplierPhone`.
   - Share the sheet with the service account email as **Editor**.
3. **Telegram:** create a bot with @BotFather. The owner taps **Start** on the bot, and you get their chat ID from @userinfobot.
4. **n8n:**
   - Import `workflow/pharmacy-stock-alerts.json`.
   - In both Google Sheets nodes, set **Authentication → Service Account** and paste the sheet ID.
   - In **Save to Purchase List Sheet**, set **Mapping Column Mode → Map Automatically**.
   - In **Send Telegram Alert**, add the bot token credential and the chat ID.
5. Click **Execute Workflow** to test, then **Publish**.

Full details, per-client onboarding and troubleshooting are in [`docs/pharmacy-stock-management.md`](docs/pharmacy-stock-management.md).

---

## Sheet format (`Stock` tab)

| Medicine | Quantity | MinStock | ReorderQty | Supplier | SupplierPhone | ExpiryDate |
|---|---|---|---|---|---|---|
| Napa 500mg | 8 | 20 | 50 | Supplier A | 01700000001 | 2027-06-30 |

- `ExpiryDate` must use the **YYYY-MM-DD** format.
- If `ReorderQty` is empty, the order quantity is calculated as `MinStock × 2 − Quantity`.

---

## Security

This repository contains **no credentials**. The workflow uses placeholders (`PASTE_YOUR_GOOGLE_SHEET_ID_HERE`, `PASTE_OWNER_TELEGRAM_CHAT_ID`).

- Never commit your service account JSON key, your Telegram bot token, or your n8n encryption key.
- If a secret leaks, revoke the bot token with `/revoke` in BotFather, or delete the key in Google Cloud and create a new one.

---

## Roadmap

- [ ] Telegram stock entry (`/sold Napa 10`, `/received Seclo 50`)
- [ ] Master multi-client workflow driven by a `Clients` sheet
- [ ] WhatsApp alerts

---

Built by **Ishfaq Builds**.
