#!/bin/bash

# DMMA Poster Bot - Quick Deploy Script
# This script helps you deploy to Render quickly

echo "🚀 DMMA Poster Bot - Render Deployment"
echo "======================================"
echo ""

# Check if git is initialized
if [ ! -d .git ]; then
    echo "📦 Initializing Git repository..."
    git init
    git add .
    git commit -m "Initial commit - DMMA Poster Bot"
    echo "✅ Git initialized"
else
    echo "✅ Git repository exists"
fi

echo ""
echo "📋 Pre-deployment Checklist:"
echo ""
echo "Before deploying, make sure you have:"
echo "  1. ✅ Render CLI installed and authenticated"
echo "  2. ✅ Supabase project created"
echo "  3. ✅ Database schema run (supabase-schema.sql)"
echo "  4. ✅ Supabase storage bucket 'poster-assets' created"
echo ""
read -p "Have you completed all the above? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Please complete the checklist first!"
    echo "   See RENDER_DEPLOYMENT.md for details"
    exit 1
fi

echo ""
echo "🔐 You'll need these values after deployment:"
echo ""
echo "SUPABASE_URL (from Supabase Dashboard → Settings → API):"
read -p "Enter SUPABASE_URL: " SUPABASE_URL

echo ""
echo "SUPABASE_SERVICE_KEY (from Supabase Dashboard → Settings → API → service_role):"
read -p "Enter SUPABASE_SERVICE_KEY: " SUPABASE_SERVICE_KEY

echo ""
echo "📤 Deploying to Render..."
echo ""

# Deploy using render.yaml
render deploy

echo ""
echo "✅ Deployment initiated!"
echo ""
echo "⏳ Waiting for deployment to complete..."
echo "   This may take 3-5 minutes..."
echo ""
echo "📊 You can monitor progress:"
echo "   • Run: render logs"
echo "   • Or visit: https://dashboard.render.com"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📝 NEXT STEPS:"
echo ""
echo "1. Wait for deployment to complete"
echo ""
echo "2. Get your Render URL from:"
echo "   https://dashboard.render.com"
echo "   (Should be like: https://dmma-poster-bot.onrender.com)"
echo ""
echo "3. Set environment variables:"
echo "   render env set SUPABASE_URL=\"$SUPABASE_URL\""
echo "   render env set SUPABASE_SERVICE_KEY=\"$SUPABASE_SERVICE_KEY\""
echo "   render env set TELEGRAM_BOT_TOKEN=\"YOUR_BOT_TOKEN\""
echo ""
echo "4. Update Supabase Edge Function:"
echo "   supabase secrets set RENDERER_URL=https://YOUR-APP.onrender.com"
echo "   supabase functions deploy telegram-webhook"
echo ""
echo "5. Set Telegram webhook:"
echo "   curl -X POST \"https://api.telegram.org/botYOUR_BOT_TOKEN/setWebhook\" \\"
echo "     -H \"Content-Type: application/json\" \\"
echo "     -d '{\"url\": \"https://YOUR-PROJECT.supabase.co/functions/v1/telegram-webhook\"}'"
echo ""
echo "6. Test your bot!"
echo "   • Telegram → /start"
echo "   • Should receive approval code"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📖 Full guide: RENDER_DEPLOYMENT.md"
echo ""
