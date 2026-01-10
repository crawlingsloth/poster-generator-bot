// Telegram Bot Webhook Handler
// Deployed as Supabase Edge Function

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RENDERER_URL = Deno.env.get("RENDERER_URL")!; // Your local Express server URL

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    chat: {
      id: number;
      type: string;
      title?: string;
    };
    from: {
      id: number;
      first_name: string;
      username?: string;
    };
    text?: string;
  };
}

// Send message to Telegram
async function sendMessage(chatId: number, text: string) {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "Markdown",
    }),
  });
}

// Send photo to Telegram
async function sendPhoto(chatId: number, photoUrl: string, caption?: string) {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`;
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      photo: photoUrl,
      caption,
    }),
  });
}

// Generate approval code (8 characters)
function generateApprovalCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// Validate date format (DD-MM-YYYY or YYYY-MM-DD)
function parseDate(dateStr: string): string | null {
  // Try DD-MM-YYYY format
  const ddmmyyyyMatch = dateStr.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (ddmmyyyyMatch) {
    const [, day, month, year] = ddmmyyyyMatch;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  // Try YYYY-MM-DD format
  const yyyymmddMatch = dateStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (yyyymmddMatch) {
    const [, year, month, day] = yyyymmddMatch;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  return null;
}

// Handle /start command
async function handleStart(chatId: number, chatTitle?: string) {
  // Check if chat already exists
  const { data: existingChat } = await supabase
    .from("poster_gen__chats")
    .select("approval_code, is_approved")
    .eq("chat_id", chatId)
    .single();

  if (existingChat) {
    if (existingChat.is_approved) {
      await sendMessage(
        chatId,
        "✅ *Your chat is already approved!*\n\nSend me a date in DD-MM-YYYY format to generate a poster.\n\nExample: `15-01-2025`",
      );
    } else {
      await sendMessage(
        chatId,
        `⏳ *Waiting for approval*\n\nYour approval code is: \`${existingChat.approval_code}\`\n\nPlease share this code with the admin to get approved.`,
      );
    }
    return;
  }

  // Create new chat entry
  const approvalCode = generateApprovalCode();
  const { error } = await supabase.from("poster_gen__chats").insert({
    chat_id: chatId,
    chat_name: chatTitle,
    approval_code: approvalCode,
    is_approved: false,
  });

  if (error) {
    console.error("Error creating chat:", error);
    await sendMessage(
      chatId,
      "❌ Sorry, something went wrong. Please try again later.",
    );
    return;
  }

  await sendMessage(
    chatId,
    `👋 *Welcome to DMMA Poster Generator!*\n\nYour approval code is: \`${approvalCode}\`\n\n📋 Please share this code with the admin to get approved.\n\nOnce approved, you can send dates in DD-MM-YYYY format to generate posters!`,
  );
}

// Handle date request
async function handleDateRequest(chatId: number, dateStr: string) {
  // Validate date format
  const parsedDate = parseDate(dateStr);
  if (!parsedDate) {
    await sendMessage(
      chatId,
      "❌ Invalid date format. Please use DD-MM-YYYY format.\n\nExample: `15-01-2025`",
    );
    return;
  }

  // Check if chat is approved
  const { data: chat, error: chatError } = await supabase
    .from("poster_gen__chats")
    .select("is_approved, assigned_template_id, assigned_background_id")
    .eq("chat_id", chatId)
    .single();

  if (chatError || !chat) {
    await sendMessage(
      chatId,
      "❌ Chat not found. Please use /start to register first.",
    );
    return;
  }

  if (!chat.is_approved) {
    await sendMessage(
      chatId,
      "⏳ Your chat is not approved yet. Please wait for admin approval.",
    );
    return;
  }

  if (!chat.assigned_template_id || !chat.assigned_background_id) {
    await sendMessage(
      chatId,
      "⚙️ Your chat doesn't have a template or background assigned yet. Please contact the admin.",
    );
    return;
  }

  // Send "generating" message
  await sendMessage(chatId, "⏳ Generating your poster...");

  try {
    // Request poster from renderer service
    const response = await fetch(`${RENDERER_URL}/api/posters/${chatId}/${parsedDate}`);
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Failed to generate poster");
    }

    // Send poster to user
    await sendPhoto(
      chatId,
      result.posterUrl,
      result.cached ? "📌 Poster (from cache)" : "✨ Fresh poster generated!",
    );
  } catch (error) {
    console.error("Error generating poster:", error);
    await sendMessage(
      chatId,
      "❌ Sorry, failed to generate poster. Please try again or contact the admin.",
    );
  }
}

// Main handler
serve(async (req) => {
  try {
    // Only accept POST requests
    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    const update: TelegramUpdate = await req.json();

    // Handle message
    if (update.message?.text) {
      const chatId = update.message.chat.id;
      const text = update.message.text.trim();
      const chatTitle = update.message.chat.title;

      // Handle /start command
      if (text === "/start") {
        await handleStart(chatId, chatTitle);
      }
      // Handle date request
      else if (text.match(/^\d{1,2}-\d{1,2}-\d{4}$/) || text.match(/^\d{4}-\d{1,2}-\d{1,2}$/)) {
        await handleDateRequest(chatId, text);
      }
      // Unknown command
      else {
        await sendMessage(
          chatId,
          "❓ I don't understand that command.\n\n📅 Send a date in DD-MM-YYYY format to generate a poster.\n\nExample: `15-01-2025`",
        );
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
