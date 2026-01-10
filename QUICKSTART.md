# Quick Start Guide

Get your DMMA Poster Bot up and running in 5 minutes!

## Prerequisites

- Node.js 18+ installed
- Supabase account (free tier works!)
- Your Telegram Bot Token: `YOUR_BOT_TOKEN`

## 1. Setup Supabase (5 minutes)

### Create Project
1. Go to https://supabase.com
2. Click "New Project"
3. Name it (e.g., "dmma-poster-bot")
4. Set a strong database password
5. Choose region closest to you
6. Wait ~2 minutes for project to initialize

### Create Storage Bucket
1. In Supabase Dashboard → **Storage**
2. Click "New bucket"
3. Name: `poster-assets`
4. Toggle **Public bucket** ON
5. Click "Create bucket"

### Run Database Schema
1. In Supabase Dashboard → **SQL Editor**
2. Click "New query"
3. Copy entire contents of `supabase-schema.sql`
4. Paste and click "Run"
5. You should see "Success. No rows returned"

### Get API Keys
1. In Supabase Dashboard → **Settings** → **API**
2. Copy **Project URL** (looks like: `https://xxxxx.supabase.co`)
3. Copy **service_role secret** (under "Project API keys")
   - ⚠️ Keep this secret! Never commit to git!

## 2. Configure Local Server (2 minutes)

### Install Dependencies
```bash
cd /home/eshan/production/services/dmma-posting-bot
npm install
```

### Create Environment File
Create `.env` file in project root:

```env
PORT=3333

# Supabase (paste your values)
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key-here

# Telegram (already configured)
TELEGRAM_BOT_TOKEN=YOUR_BOT_TOKEN

# Renderer (leave as-is for now)
RENDERER_URL=http://localhost:3333
```

### Start Server
```bash
npm start
```

You should see:
```
🚀 DMMA Poster Generator Server
================================
Server running on http://0.0.0.0:3333

📊 Admin Panels:
  http://localhost:3333/admin-v2 - New Admin Panel (Recommended)
...
```

## 3. Upload Your First Template (1 minute)

1. Open http://localhost:3333/admin-v2
2. Click **"Templates"** tab
3. Enter template name: "DMMA Default"
4. Click the upload area
5. Select your `index.html` file
6. Click "Upload Template"

✅ Template uploaded to Supabase Storage!

## 4. Migrate Backgrounds (30 seconds)

If you have existing backgrounds in `uploads/backgrounds/`:

```bash
curl -X POST http://localhost:3333/api/backgrounds/migrate-to-supabase
```

Or upload new ones via Admin Panel → Backgrounds tab.

## 5. Deploy Telegram Webhook (3 minutes)

### Option A: Using ngrok (Quick Test)

1. Install ngrok: https://ngrok.com/download
2. Run ngrok:
   ```bash
   ngrok http 3333
   ```
3. Copy the HTTPS URL (e.g., `https://abc123.ngrok-free.app`)
4. Update `.env`:
   ```env
   RENDERER_URL=https://abc123.ngrok-free.app
   ```

### Deploy Edge Function

1. Install Supabase CLI:
   ```bash
   npm install -g supabase
   ```

2. Login:
   ```bash
   supabase login
   ```

3. Link project (get ref from Supabase dashboard URL):
   ```bash
   supabase link --project-ref your-project-ref
   ```

4. Set secrets:
   ```bash
   # Telegram token
   supabase secrets set TELEGRAM_BOT_TOKEN=YOUR_BOT_TOKEN

   # Renderer URL (your ngrok URL)
   supabase secrets set RENDERER_URL=https://abc123.ngrok-free.app
   ```

5. Deploy:
   ```bash
   supabase functions deploy telegram-webhook
   ```

6. Get webhook URL from output (looks like):
   ```
   https://xxxxx.supabase.co/functions/v1/telegram-webhook
   ```

### Set Telegram Webhook

Replace `<WEBHOOK_URL>` with your Edge Function URL:

```bash
curl -X POST "https://api.telegram.org/botYOUR_BOT_TOKEN/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "<WEBHOOK_URL>"}'
```

Verify:
```bash
curl "https://api.telegram.org/botYOUR_BOT_TOKEN/getWebhookInfo"
```

## 6. Test the Bot! (1 minute)

1. Open Telegram
2. Search for your bot
3. Send `/start`
4. Bot replies with approval code (e.g., `ABC12345`)
5. Open http://localhost:3333/admin-v2
6. Click **"Chat Management"** tab
7. See your chat in "Pending Approvals"
8. Click "Approve"
9. Click "Assign" button
10. Select template and background
11. Click "Save Assignments"
12. Go back to Telegram
13. Send a date: `15-01-2025`
14. Bot generates and sends poster! 🎉

## 7. Batch Generate Posters (Optional)

Pre-generate posters for next 3 months:

1. Admin Panel → **"Poster Generation"** tab
2. Select chat from dropdown
3. Set months (default: 3)
4. Click "Batch Generate Posters"
5. Wait for completion
6. Now users get instant responses!

## Architecture Diagram

```
┌─────────────┐
│  Telegram   │
│   User      │
└──────┬──────┘
       │ Sends /start or date
       ↓
┌─────────────────────┐
│  Supabase Edge      │
│  Function (Deno)    │
│  - Handles webhook  │
│  - Manages users    │
│  - Checks cache     │
└──────┬──────────────┘
       │ Requests poster
       ↓
┌─────────────────────┐        ┌──────────────┐
│  Express Server     │◄───────│  Supabase    │
│  (Local/Cloud)      │        │  - Database  │
│  - HTML→PNG         │───────►│  - Storage   │
│  - Puppeteer        │        │  - Cache     │
└─────────────────────┘        └──────────────┘
```

## Next Steps

- **Production Deploy**: Move Express server from local to cloud (Render, Fly.io, Railway)
- **Add Auth**: Secure admin panel with password
- **Multiple Templates**: Create templates for different occasions
- **Analytics**: Track poster generation stats
- **Auto-cleanup**: Delete old cached posters

## Troubleshooting

### Server won't start
- Check if port 3333 is in use: `lsof -i :3333`
- Verify `.env` file exists and has correct values

### Webhook not working
- Ensure ngrok is running
- Check Edge Function logs in Supabase Dashboard
- Verify webhook URL is set: `getWebhookInfo` command

### Poster generation fails
- Check Express server logs
- Ensure Puppeteer dependencies installed
- Verify template has all placeholders

## Support

Questions? Check the full [SETUP.md](./SETUP.md) for detailed documentation.
