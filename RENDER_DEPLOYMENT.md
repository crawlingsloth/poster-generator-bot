# Render Deployment Guide

Complete guide to deploy your DMMA Poster Bot to Render.

## Prerequisites

✅ Render CLI installed and connected
✅ Git repository initialized
✅ Supabase project created with schema

## Step 1: Prepare Repository

### Initialize Git (if not already done)

```bash
cd /home/eshan/production/services/dmma-posting-bot

# Initialize git if needed
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit - DMMA Poster Bot"
```

### Create GitHub Repository (Optional but Recommended)

```bash
# Create repo on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/dmma-posting-bot.git
git branch -M master
git push -u origin master
```

## Step 2: Deploy to Render

### Option A: Deploy via Render CLI

```bash
# Deploy using render.yaml
render deploy
```

The CLI will:
1. Read `render.yaml` configuration
2. Create a new web service
3. Build and deploy your app
4. Provide you with a public URL

### Option B: Deploy via Render Dashboard

1. Go to https://dashboard.render.com
2. Click "New +" → "Web Service"
3. Connect your GitHub repo (or use "Deploy from Git URL")
4. Render will auto-detect `render.yaml`
5. Click "Apply" → "Create Web Service"

## Step 3: Set Environment Variables

After deployment, you need to set environment variables.

### Via Render Dashboard

1. Go to your service → "Environment"
2. Add these variables:

```
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
TELEGRAM_BOT_TOKEN=YOUR_BOT_TOKEN
```

3. Click "Save Changes" (triggers automatic redeploy)

### Via Render CLI

```bash
# Set environment variables
render env set SUPABASE_URL="https://xxxxx.supabase.co"
render env set SUPABASE_SERVICE_KEY="your-service-role-key"
render env set TELEGRAM_BOT_TOKEN="YOUR_BOT_TOKEN"
```

## Step 4: Get Your Render URL

After deployment completes, Render will give you a URL like:

```
https://dmma-poster-bot.onrender.com
```

Copy this URL - you'll need it for the Telegram webhook!

## Step 5: Update Supabase Edge Function

Now that your Express server is publicly accessible, update the Edge Function:

```bash
# Set the Render URL as the renderer endpoint
supabase secrets set RENDERER_URL=https://dmma-poster-bot.onrender.com

# Redeploy Edge Function
supabase functions deploy telegram-webhook
```

## Step 6: Set Telegram Webhook

Point Telegram to your Supabase Edge Function:

```bash
curl -X POST "https://api.telegram.org/botYOUR_BOT_TOKEN/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://YOUR-PROJECT.supabase.co/functions/v1/telegram-webhook"}'
```

Replace `YOUR-PROJECT` with your Supabase project ID.

## Step 7: Verify Deployment

### Test Express Server

```bash
# Health check
curl https://dmma-poster-bot.onrender.com/health

# Should return: {"status":"ok"}
```

### Test Admin Panel

Open in browser:
```
https://dmma-poster-bot.onrender.com/admin-v2
```

### Test Telegram Bot

1. Open Telegram
2. Find your bot
3. Send `/start`
4. Should receive approval code

## Step 8: Upload Initial Data

### Upload Template

```bash
# Using your Render URL
curl -X POST https://dmma-poster-bot.onrender.com/api/templates/upload \
  -F "template=@index.html" \
  -F "name=DMMA Default Template"
```

### Migrate Backgrounds

If you have local backgrounds to migrate:

```bash
curl -X POST https://dmma-poster-bot.onrender.com/api/backgrounds/migrate-to-supabase
```

## Architecture Flow (Production)

```
┌─────────────┐
│  Telegram   │
│    User     │
└──────┬──────┘
       │
       ↓
┌──────────────────────────────┐
│  Supabase Edge Function      │
│  telegram-webhook            │
│  (Cloud - Deno)              │
└──────┬───────────────────────┘
       │
       ↓
┌──────────────────────────────┐
│  Render Web Service          │
│  dmma-poster-bot             │
│  (Cloud - Node.js/Express)   │
│  - HTML → PNG rendering      │
└──────┬───────────────────────┘
       │
       ↓
┌──────────────────────────────┐
│  Supabase                    │
│  - PostgreSQL Database       │
│  - Storage (Templates, etc)  │
└──────────────────────────────┘
```

## Render Free Tier Limitations

- ⏱️ **Spins down after 15 min inactivity** (first request may be slow)
- 💾 **512 MB RAM** (sufficient for Puppeteer)
- ⚡ **Limited CPU** (poster generation may be slower than local)
- 🕐 **750 hours/month** (basically always on)

**Pro tip:** The first request after spin-down takes ~30 seconds. Subsequent requests are fast.

## Monitoring

### View Logs

```bash
# Via CLI
render logs

# Or via dashboard
# Your Service → Logs tab
```

### Check Service Status

```bash
render status
```

## Troubleshooting

### Issue: "Service unavailable"

**Cause:** Render is spinning up (free tier)
**Solution:** Wait 30 seconds, try again

### Issue: "Puppeteer failed to launch"

**Cause:** Missing Chrome dependencies
**Solution:** Puppeteer should auto-install Chromium. Check logs.

### Issue: "Out of memory"

**Cause:** Poster generation uses too much RAM
**Solution:**
- Reduce image quality in Puppeteer
- Upgrade to Render paid plan ($7/month for 2GB RAM)

### Issue: Environment variables not set

```bash
# List current env vars
render env list

# Set missing ones
render env set KEY="value"
```

### Issue: Deployment fails

```bash
# Check build logs
render logs --build

# Common fixes:
# 1. Ensure package.json has all dependencies
# 2. Check Node version compatibility
# 3. Verify render.yaml syntax
```

## Updating Your Deployment

### Push changes

```bash
# Make your changes
git add .
git commit -m "Update feature X"
git push

# Render auto-deploys on push (if connected to GitHub)
```

### Manual redeploy

```bash
render deploy
```

## Security Best Practices

1. ✅ Never commit `.env` file (already in `.gitignore`)
2. ✅ Use environment variables for all secrets
3. ✅ Keep `SUPABASE_SERVICE_KEY` secret
4. ⚠️ Consider adding authentication to admin panel
5. ⚠️ Add rate limiting for public endpoints

## Cost

**Render Free Tier:**
- ✅ Free forever for one web service
- ✅ Perfect for this use case
- ✅ Automatic SSL certificate
- ✅ Custom domain support (optional)

**If you need more:**
- Starter Plan: $7/month (2GB RAM, always on)
- Standard Plan: $25/month (4GB RAM)

## Next Steps

1. ✅ Deploy to Render
2. ✅ Set environment variables
3. ✅ Update Supabase Edge Function with Render URL
4. ✅ Set Telegram webhook
5. ✅ Upload templates and backgrounds
6. ✅ Test the complete flow
7. 🎉 Your bot is live!

## Complete Deployment Checklist

```
□ Git repository initialized
□ Code committed
□ Deployed to Render
□ Environment variables set
□ Render URL obtained
□ Supabase Edge Function updated with Render URL
□ Edge Function redeployed
□ Telegram webhook set
□ Template uploaded
□ Backgrounds uploaded (or migrated)
□ Bot tested with /start
□ Bot tested with date
□ Poster received successfully
□ Admin panel accessible
□ Chat approved via admin panel
□ Template/background assigned
□ Batch generation tested (optional)
```

## Support

- **Render Docs:** https://render.com/docs
- **Render Status:** https://status.render.com
- **View Logs:** `render logs` or dashboard

Your bot is now fully deployed and accessible globally! 🚀
