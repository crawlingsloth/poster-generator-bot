# DMMA Poster Generator Bot

Automated Telegram bot for generating DMMA event posters with custom dates, templates, and backgrounds. Built with Express, Supabase, and Telegram Bot API.

## Features

- 🤖 **Telegram Bot Integration** - Users request posters via Telegram
- 📅 **Date-based Generation** - Generate posters for any date
- 🎨 **Multiple Templates** - Support for multiple HTML templates
- 🖼️ **Background Management** - Assign different backgrounds per chat
- 👥 **Multi-chat Support** - Each Telegram group gets custom template + background
- 💾 **Smart Caching** - Pre-generate and cache posters for instant delivery
- 📊 **Admin Panel** - Web-based control panel for managing everything
- ☁️ **Supabase Integration** - Cloud database and storage
- 🚀 **Batch Generation** - Pre-generate posters for months in advance

## Quick Start

Get up and running in 5 minutes:

👉 **[QUICKSTART.md](./QUICKSTART.md)** 👈

## Documentation

- **[QUICKSTART.md](./QUICKSTART.md)** - Get running in 5 minutes (start here!)
- **[SETUP.md](./SETUP.md)** - Complete deployment guide
- **[IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md)** - Architecture overview

## Architecture

```
Telegram User → Supabase Edge Function → Express Server → Puppeteer → PNG
                       ↓                        ↓
                  PostgreSQL              Supabase Storage
                  (metadata)              (posters, templates)
```

## User Flow

1. **User sends `/start`** → Bot generates approval code
2. **Admin approves** → Assigns template + background
3. **User sends date** → Bot generates/fetches poster → Sends PNG
4. **Cached posters** → Instant delivery on subsequent requests

## Tech Stack

- **Backend**: Express.js (Node.js)
- **Database**: Supabase (PostgreSQL)
- **Storage**: Supabase Storage
- **Serverless**: Supabase Edge Functions (Deno)
- **Rendering**: Puppeteer (HTML → PNG)
- **Bot**: Telegram Bot API
- **Frontend**: Vanilla JS (Admin Panel)

## Prerequisites

- Node.js 18+
- Supabase account (free tier works)
- Telegram bot token
- ngrok or similar (for local testing)

## Installation

```bash
# Clone repository
cd /home/eshan/production/services/dmma-posting-bot

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your Supabase credentials

# Start server
npm start
```

## Admin Panel

Access at `http://localhost:3333/admin-v2`

**Tabs:**
- 🗣️ **Chat Management** - Approve chats, assign templates/backgrounds
- 📄 **Templates** - Upload and manage HTML templates
- 🖼️ **Backgrounds** - Upload and manage background images
- 🚀 **Poster Generation** - Batch generate posters

## API Endpoints

### Templates
```
POST   /api/templates/upload
GET    /api/templates
DELETE /api/templates/:id
```

### Chats
```
GET    /api/chats
POST   /api/chats/approve
POST   /api/chats/:chatId/assign-template
POST   /api/chats/:chatId/assign-background
```

### Posters
```
POST   /api/posters/generate
POST   /api/posters/batch-generate
GET    /api/posters/:chatId/:date
```

## Database Schema

All tables use `poster_gen__` prefix:

- `poster_gen__templates` - HTML templates
- `poster_gen__backgrounds` - Background images
- `poster_gen__chats` - Telegram chats with approval codes
- `poster_gen__cached_posters` - Generated poster cache

See `supabase-schema.sql` for full schema.

## Template Placeholders

Your HTML templates can use these placeholders:

- `{{DATE}}` - Day of month (15)
- `{{DAY}}` - Day name (Monday)
- `{{MONTH}}` - Month name (January)
- `{{YEAR}}` - Year (2025)
- `{{BACKGROUND_URL}}` - Background image URL
- `{{CALENDAR_MONTH}}` - Calendar month name
- `{{CALENDAR_YEAR}}` - Calendar year
- `{{CALENDAR_DAYS}}` - Calendar grid HTML

## Environment Variables

```env
PORT=3333
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=your-service-key
TELEGRAM_BOT_TOKEN=your-bot-token
RENDERER_URL=http://localhost:3333
```

## Deployment

### Express Server
Deploy to:
- Render (recommended for free tier)
- Railway
- Fly.io
- Any Node.js hosting

### Edge Function
```bash
supabase functions deploy telegram-webhook
```

### Set Telegram Webhook
```bash
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -d '{"url": "https://your-project.supabase.co/functions/v1/telegram-webhook"}'
```

## Usage Example

### For Users (Telegram)
```
User: /start
Bot:  👋 Welcome! Your approval code is: ABC12345
      Share this with the admin to get approved.

[After admin approval]

User: 15-01-2025
Bot:  [Sends generated poster PNG]
```

### For Admins (Web Panel)
1. Open `http://localhost:3333/admin-v2`
2. Approve chat with code ABC12345
3. Assign template and background
4. Optionally batch-generate 3 months of posters
5. Monitor usage

## Storage Structure

```
poster-assets/
├── templates/         # HTML template files
├── backgrounds/       # Background images
└── posters/
    └── {chat_id}/     # Generated posters per chat
        └── {date}.png
```

## Security

- ✅ Row Level Security (RLS) enabled on all tables
- ✅ Service role key kept secret
- ✅ File upload validation (type, size)
- ✅ Admin panel runs locally only
- ❌ TODO: Add authentication to admin panel for production

## Performance

- **Cached poster**: ~50ms (direct Supabase fetch)
- **New poster**: ~2-3s (Puppeteer rendering)
- **Batch generation**: ~90 posters in ~5-10 minutes

## Troubleshooting

See [QUICKSTART.md](./QUICKSTART.md#troubleshooting) for common issues.

## Contributing

This is a private project for DMMA. For modifications:

1. Test locally first
2. Update documentation
3. Commit with clear messages
4. Deploy carefully (database migrations are one-way)

## License

Private - DMMA Internal Use Only

## Support

- Check documentation in this repo
- Review Supabase logs for Edge Function issues
- Check Express server logs for rendering issues
- Verify Telegram webhook status: `/getWebhookInfo`

## Roadmap

- [ ] Add admin panel authentication
- [ ] Support for multiple languages
- [ ] Analytics dashboard
- [ ] Auto-cleanup old cached posters
- [ ] Template preview in admin panel
- [ ] User feedback collection
- [ ] Rate limiting per chat

---

**Built with ❤️ for DMMA**

For questions, check the documentation files or review the code comments.
