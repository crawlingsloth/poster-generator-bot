#!/bin/bash
# Comprehensive debug script to check the entire poster generation flow

echo "🔍 Debugging Poster Generation Flow"
echo "===================================="
echo ""

CHAT_ID="418289202"
DATE="2026-01-16"

echo "1️⃣ Checking database - Chat assignment"
echo "---------------------------------------"
node -e "
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
(async () => {
  const { data } = await supabase
    .from('poster_gen__chats')
    .select('chat_id, assigned_template_id, template:assigned_template_id(id, name, storage_path)')
    .eq('chat_id', ${CHAT_ID})
    .single();
  console.log(JSON.stringify(data, null, 2));
})();
"
echo ""

echo "2️⃣ Checking storage - Template content"
echo "---------------------------------------"
node -e "
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
(async () => {
  const { data } = await supabase.storage
    .from('poster-assets')
    .download('templates/1768241787752.html');
  const content = await data.text();
  const title = content.match(/<title>(.*?)<\/title>/)?.[1];
  const hasEmojis = content.includes('🥐') || content.includes('🌾');
  const hasStars = content.includes('★');
  console.log('Template title:', title);
  console.log('Has emojis:', hasEmojis);
  console.log('Has stars:', hasStars);
  console.log('Content length:', content.length);
})();
"
echo ""

echo "3️⃣ Testing production endpoint"
echo "-------------------------------"
curl -s -X POST https://poster-generator-bot.onrender.com/api/posters/generate \
  -H "Content-Type: application/json" \
  -d "{\"chatId\":\"${CHAT_ID}\",\"date\":\"${DATE}\",\"templateData\":{\"time\":\"3pm\",\"items\":[\"Tuna Bun\"]},\"debug\":true}" \
  | head -100
echo ""
echo ""

echo "4️⃣ Checking if Render has latest code"
echo "---------------------------------------"
echo "Looking for debug mode support (should return HTML)..."
echo "If you see JSON above instead of HTML, Render hasn't deployed latest code yet"
echo ""

echo "5️⃣ Testing message parsing"
echo "---------------------------"
node test-telegram-webhook.js | grep -A 1 "Test 3:"
echo ""

echo "✅ Debug complete!"
echo ""
echo "Next steps:"
echo "- If Render shows JSON (not HTML), wait for Render to redeploy"
echo "- Check Render dashboard for deployment status"
echo "- Check Render logs for [POST /api/posters/generate] messages"
