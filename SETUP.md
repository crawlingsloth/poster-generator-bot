# DMMA Poster Bot Setup Guide

Complete setup guide for the DMMA Poster Generator Telegram Bot with Supabase.

## Architecture Overview

- **Supabase**: Database + Storage + Edge Functions
- **Express Server** (Local): HTML-to-PNG rendering using Puppeteer
- **Telegram Bot**: User interface via Telegram

## Prerequisites

1. Node.js 18+ installed
2. Supabase account and project
3. Telegram Bot Token (you have: `YOUR_BOT_TOKEN`)
4. Supabase CLI installed: `npm install -g supabase`

## Step 1: Supabase Setup

### 1.1 Create Supabase Project

1. Go to https://supabase.com
2. Create a new project
3. Note your project URL and service role key

### 1.2 Create Storage Bucket

1. In Supabase Dashboard → Storage
2. Create a new bucket named `poster-assets`
3. Make it **public**
4. Configure policies to allow public read access:

```sql
-- Allow public read access
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'poster-assets' );

-- Allow authenticated uploads
CREATE POLICY "Authenticated Upload"
ON storage.objects FOR INSERT
WITH CHECK ( bucket_id = 'poster-assets' AND auth.role() = 'authenticated' );
```

### 1.3 Run Database Schema

1. In Supabase Dashboard → SQL Editor
2. Copy and paste the contents of `supabase-schema.sql`
3. Run the script
4. Verify tables are created:
   - `poster_gen__templates`
   - `poster_gen__backgrounds`
   - `poster_gen__chats`
   - `poster_gen__cached_posters`

## Step 2: Local Express Server Setup

### 2.1 Install Dependencies

```bash
npm install
```

### 2.2 Configure Environment Variables

Create a `.env` file in the project root:

```env
PORT=3333

# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key-here

# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=YOUR_BOT_TOKEN
TELEGRAM_WEBHOOK_URL=https://your-project.supabase.co/functions/v1/telegram-webhook

# Local Express Server URL (for rendering)
RENDERER_URL=http://localhost:3333
```

### 2.3 Start the Server

```bash
npm start
```

The server will run on `http://localhost:3333`.

### 2.4 Expose Local Server (for Telegram webhook to reach it)

If running locally, you need to expose your server using a tunnel:

**Option A: Using ngrok**
```bash
ngrok http 3333
```

**Option B: Using Cloudflare Tunnel**
```bash
cloudflared tunnel --url http://localhost:3333
```

Note the public URL (e.g., `https://abc123.ngrok.io`) and update `RENDERER_URL` in the Edge Function environment.

## Step 3: Deploy Supabase Edge Function

### 3.1 Login to Supabase CLI

```bash
supabase login
```

### 3.2 Link to Your Project

```bash
supabase link --project-ref your-project-ref
```

### 3.3 Set Environment Secrets

```bash
# Set Telegram bot token
supabase secrets set TELEGRAM_BOT_TOKEN=YOUR_BOT_TOKEN

# Set renderer URL (your ngrok/cloudflare tunnel URL)
supabase secrets set RENDERER_URL=https://your-tunnel-url.ngrok.io

# Supabase URL and key are automatically available
```

### 3.4 Deploy Edge Function

```bash
supabase functions deploy telegram-webhook
```

### 3.5 Get Function URL

The webhook URL will be:
```
https://your-project.supabase.co/functions/v1/telegram-webhook
```

## Step 4: Configure Telegram Webhook

### 4.1 Set Webhook

Run this command (replace with your Edge Function URL):

```bash
curl -X POST "https://api.telegram.org/botYOUR_BOT_TOKEN/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://your-project.supabase.co/functions/v1/telegram-webhook"}'
```

### 4.2 Verify Webhook

```bash
curl "https://api.telegram.org/botYOUR_BOT_TOKEN/getWebhookInfo"
```

## Step 5: Migrate Existing Backgrounds to Supabase

If you have existing backgrounds in the local `uploads/backgrounds` folder:

```bash
curl -X POST http://localhost:3333/api/backgrounds/migrate-to-supabase
```

This will upload all backgrounds to Supabase Storage and insert records into the database.

## Step 6: Upload Templates

### 6.1 Upload Template via API

Upload your existing `index.html` template:

```bash
curl -X POST http://localhost:3333/api/templates/upload \
  -F "template=@index.html" \
  -F "name=DMMA Default Template"
```

### 6.2 List Templates

```bash
curl http://localhost:3333/api/templates
```

## Step 7: Using the Bot

### 7.1 User Flow

1. User opens Telegram and searches for your bot
2. User sends `/start`
3. Bot generates an approval code (e.g., `ABC12345`)
4. User shares code with admin (you)

### 7.2 Admin Approval (via Admin Panel)

1. Open `http://localhost:3333/admin`
2. View pending chats
3. Approve chat using the code
4. Assign a template to the chat
5. Assign a background to the chat

### 7.3 Admin Approval (via API)

```bash
# Approve chat
curl -X POST http://localhost:3333/api/chats/approve \
  -H "Content-Type: application/json" \
  -d '{"approvalCode": "ABC12345"}'

# Get chat list to find chat_id
curl http://localhost:3333/api/chats

# Assign template
curl -X POST http://localhost:3333/api/chats/123456789/assign-template \
  -H "Content-Type: application/json" \
  -d '{"templateId": "template-uuid-here"}'

# Assign background
curl -X POST http://localhost:3333/api/chats/123456789/assign-background \
  -H "Content-Type: application/json" \
  -d '{"backgroundId": "background-uuid-here"}'
```

### 7.4 Generate Posters

Once approved and configured, users can send dates:

```
15-01-2025
```

The bot will generate and send the poster.

### 7.5 Batch Generate Posters (Admin)

Pre-generate posters for the next 3 months:

```bash
curl -X POST http://localhost:3333/api/posters/batch-generate \
  -H "Content-Type: application/json" \
  -d '{"chatId": 123456789, "months": 3}'
```

## API Endpoints Reference

### Templates
- `POST /api/templates/upload` - Upload HTML template
- `GET /api/templates` - List all templates
- `DELETE /api/templates/:id` - Delete template

### Backgrounds
- `POST /api/backgrounds/upload` - Upload background image
- `GET /api/backgrounds` - List all backgrounds
- `POST /api/backgrounds/migrate-to-supabase` - Migrate local backgrounds to Supabase

### Chats
- `GET /api/chats` - List all chats (pending and approved)
- `POST /api/chats/approve` - Approve chat by code
- `POST /api/chats/:chatId/assign-template` - Assign template to chat
- `POST /api/chats/:chatId/assign-background` - Assign background to chat

### Posters
- `POST /api/posters/generate` - Generate single poster
- `POST /api/posters/batch-generate` - Batch generate posters for N months
- `GET /api/posters/:chatId/:date` - Get poster (from cache or generate)

## Storage Structure

```
poster-assets/
├── templates/
│   └── 1234567890.html
├── backgrounds/
│   ├── bg-1.jpg
│   └── bg-2.png
└── posters/
    └── 123456789/  (chat_id)
        ├── 2025-01-15.png
        ├── 2025-01-16.png
        └── ...
```

## Troubleshooting

### Webhook not receiving updates
1. Check webhook status: `curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"`
2. Ensure Edge Function is deployed and accessible
3. Check Edge Function logs in Supabase Dashboard

### Poster generation fails
1. Ensure Express server is running
2. Check `RENDERER_URL` is accessible from the internet (use ngrok/cloudflare tunnel)
3. Check server logs for errors

### Template/Background not assigned
1. Verify template/background exists in database
2. Check chat is approved
3. Use API to manually assign

## Security Notes

1. **Never commit `.env` file** - Contains sensitive keys
2. **Protect service role key** - Only use on server-side
3. **Admin panel** - Add authentication before making it public
4. **Rate limiting** - Consider adding rate limits to prevent abuse

## Next Steps

1. Add authentication to admin panel
2. Add user management UI to admin panel
3. Implement webhook verification for Telegram
4. Add more template placeholders
5. Implement poster analytics
