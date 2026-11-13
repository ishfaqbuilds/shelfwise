# Google Cloud Console Setup (Service Account for n8n)

Use this guide to set up Google Sheets access for n8n from **any** Google account.

---

## 0. Before you start

- **Check which account you're signed in with** (top-right profile picture). If you have several Google accounts open, the URL shows `authuser=1`, `authuser=2`, etc.
- **Personal Gmail account:** the project usually has **no organization**, so key creation works straight away.
- **Account with its own domain (Google Workspace / Cloud Identity):** the project sits inside an **organization**, and Google blocks service account keys by default. You'll need step 4.
- Everything here is **free**. No billing account or card is needed.

---

## 1. Create a project

1. Go to `console.cloud.google.com`.
2. Click the **project picker** (top left), then **New project**.
3. Name it, for example `n8n Google Integrations`.
4. **Location:**
   - Personal Gmail: choose **No organization**.
   - Your own organization: choose your organization.
5. Click **Create**, then select the new project in the picker.

---

## 2. Enable the APIs

1. Go to **APIs & Services → Library**.
2. Search for **Google Sheets API** and click **Enable**.
3. Search for **Google Drive API** and click **Enable**. The n8n Sheets node needs both.

Add other APIs the same way if you need them later (Gmail, Calendar, Docs).

---

## 3. Create the service account

1. Go to **IAM & Admin → Service Accounts → Create service account**.
2. Name it `n8n-bot`, then click **Create and continue**.
3. Skip the optional role steps and click **Done**.
4. Copy the service account email. It looks like:
   `n8n-bot@PROJECT-ID.iam.gserviceaccount.com`

---

## 4. If key creation is blocked (organizations only)

You'll see: **"Service account key creation is disabled"** (policy `iam.disableServiceAccountKeyCreation`).

**A. Give yourself the role**

1. In the project picker, select the **organization** (not the project).
2. Go to **IAM & Admin → IAM → Grant access**.
3. Under Principal, enter your admin email.
4. Under Role, choose **Organization Policy Administrator**, then click **Save**.

**B. Turn the block off for this project only**

1. Switch the picker back to your **project**.
2. Go to **IAM & Admin → Organization Policies**.
3. Search for `iam.disableServiceAccountKeyCreation` and open it.
4. Click **Manage policy**, choose **Override parent's policy**, then **Add a rule**.
5. Set **Enforcement: Off**, then click **Set policy**.
6. Wait about 2 minutes before creating the key.

---

## 5. Create the JSON key

1. Go to **Service Accounts → n8n-bot → Keys**.
2. Click **Add key → Create new key → JSON → Create**.
3. The file downloads **once only**. If you lose it, delete the old key and create a new one.

---

## 6. Add the key to n8n

1. In n8n, go to **Overview → Credentials → Create credential**, and choose **Google Service Account API**.
2. Fill in the fields:
   - **Service Account Email:** the `client_email` value from the JSON file
   - **Private Key:** the `private_key` value, from `-----BEGIN PRIVATE KEY-----` to `-----END PRIVATE KEY-----` (the `\n` characters are fine)
   - **Region:** Global
   - Leave the toggles off.
3. Click **Save** and look for **"Connection tested successfully"**.
4. Rename the credential `n8n-bot` (click the title).
5. **Delete the JSON file** from your computer and empty the Trash.

In each Google Sheets node, set **Authentication → Service Account** and choose this credential.

---

## 7. Give the bot access to a sheet

1. Open the Google Sheet and click **Share**.
2. Paste the **bot email** (`...iam.gserviceaccount.com`).
3. Set it to **Editor**, untick **Notify people**, and click **Share**.

The bot can only see sheets that are shared with it. To cut off access, remove the bot email from the sheet.

---

## 8. Security rules

- The private key goes **only into n8n**. Never put it in chat, WhatsApp, GitHub or email.
- **If a key leaks:** go to **Service Accounts → n8n-bot → Keys**, click the trash icon on that key, create a new key, and update the n8n credential.
- Create sheets in **your own Gmail**, not with the service account. Service accounts have little or no Drive storage.

---

## 9. Optional: OAuth client (only for Gmail or Calendar later)

A service account **cannot** read a personal Gmail inbox or calendar. For that, use OAuth:

1. Go to **Google Auth Platform → Branding**. Fill in the app name, support email and developer contact email. **Don't upload a logo**, because that forces verification.
2. Under **Audience**, choose **External** and add your email as a test user.
3. Under **Clients → Create client → Web application**, add the redirect URI from n8n's credential screen:
   `https://YOUR-N8N-DOMAIN/rest/oauth2-credential/callback`
4. Paste the Client ID and Client Secret into n8n, then click **Sign in with Google**.
5. **Testing mode expires tokens every 7 days.** Fix this under **Audience → Publish app**. Publishing needs the Branding page completed, including a home page and privacy policy link on your domain.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| "Key creation is disabled" | Follow step 4. |
| n8n: "not found" or "permission denied" | Share the sheet with the bot email as Editor. |
| Credential fails | Check that the email is the **bot email**, not your Gmail, and that the key is from the same service account. |
| "API has not been used / is disabled" | Enable the Sheets and Drive APIs (step 2) in the **same project**. |
| Key format error | Re-copy `private_key` exactly, including the BEGIN and END lines. |
