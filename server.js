#!/usr/bin/env node

require("dotenv").config();

const express = require("express");
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const cron = require("node-cron");
const BackgroundManager = require("./lib/background-manager");
const ImageProcessor = require("./lib/image-processor");
const supabase = require("./lib/supabase");

const app = express();
const PORT = process.env.PORT || 3333;

// Create directories if they don't exist
["uploads/backgrounds", "uploads/thumbnails", "lib"].forEach((dir) => {
  const dirPath = path.join(__dirname, dir);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
});

// Initialize background manager
const bgManager = new BackgroundManager();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "uploads", "backgrounds"));
  },
  filename: (req, file, cb) => {
    const id = Date.now().toString();
    const ext = path.extname(file.originalname);
    cb(null, `${id}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ["image/png", "image/jpeg", "image/jpg"];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only PNG and JPG images are allowed"), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// Middleware to parse JSON bodies
app.use(express.json());

// Function to generate PNG from HTML
async function generatePNG(htmlContent) {
  const tempHtmlPath = path.join(__dirname, "temp-ticket.html");
  const tempPngPath = path.join(__dirname, "temp-output.png");

  try {
    // Write the HTML content to a temp file
    fs.writeFileSync(tempHtmlPath, htmlContent);

    // Execute the html-to-png.js script
    const scriptPath = path.join(__dirname, "html-to-png.js");
    execSync(`node "${scriptPath}" "${tempHtmlPath}" "${tempPngPath}"`, {
      cwd: __dirname,
    });

    // Read the generated PNG
    const pngBuffer = fs.readFileSync(tempPngPath);

    return pngBuffer;
  } finally {
    // Clean up temp files
    if (fs.existsSync(tempHtmlPath)) {
      //fs.unlinkSync(tempHtmlPath);
    }
    if (fs.existsSync(tempPngPath)) {
      //fs.unlinkSync(tempPngPath);
    }
  }
}

// Function to get tomorrow's date formatted
function getTomorrowDate() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const options = {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  };

  return tomorrow.toLocaleDateString("en-US", options);
}

// Function to get tomorrow's date components
function getTomorrowDateComponents() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  return {
    month: tomorrow.toLocaleDateString("en-US", { month: "long" }),
    day: tomorrow.toLocaleDateString("en-US", { weekday: "long" }),
    date: tomorrow.getDate(),
    year: tomorrow.getFullYear(),
    dateObject: tomorrow,
  };
}

// Function to get date components from a provided date
function getDateComponents(dateString) {
  let date;

  // Try to parse DD-MM-YYYY format
  if (dateString.includes("-") && dateString.split("-").length === 3) {
    const parts = dateString.split("-");
    // Check if it's DD-MM-YYYY format (day > 12 or month <= 12 with day being first)
    if (parts[0].length <= 2 && parts[1].length <= 2 && parts[2].length === 4) {
      // DD-MM-YYYY format
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed in JavaScript
      const year = parseInt(parts[2], 10);
      date = new Date(year, month, day);
    } else {
      // Fall back to default Date parsing (for YYYY-MM-DD, etc.)
      date = new Date(dateString);
    }
  } else {
    // Fall back to default Date parsing
    date = new Date(dateString);
  }

  // Check if date is valid
  if (isNaN(date.getTime())) {
    throw new Error("Invalid date provided");
  }

  return {
    month: date.toLocaleDateString("en-US", { month: "long" }),
    day: date.toLocaleDateString("en-US", { weekday: "long" }),
    date: date.getDate(),
    year: date.getFullYear(),
    dateObject: date,
  };
}

// Function to generate calendar HTML for a given month/year
// Highlights Monday (1), Tuesday (2), Thursday (4), and Saturday (6)
function generateCalendar(year, month, todayDate) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startingDayOfWeek = firstDay.getDay(); // 0 = Sunday, 1 = Monday, etc.

  const highlightDays = [1, 2, 4, 6]; // Monday, Tuesday, Thursday, Saturday

  let calendarHTML = "";

  // Add empty cells for days before the first day of the month
  for (let i = 0; i < startingDayOfWeek; i++) {
    calendarHTML += '<div class="cal-day empty"></div>';
  }

  // Add cells for each day of the month
  for (let day = 1; day <= daysInMonth; day++) {
    const currentDate = new Date(year, month, day);
    const dayOfWeek = currentDate.getDay();

    let classes = "cal-day";

    // Highlight specific days of the week
    if (highlightDays.includes(dayOfWeek)) {
      classes += " highlighted";
    }

    // Mark today
    if (day === todayDate) {
      classes += " today";
    }

    calendarHTML += `<div class="${classes}">${day}</div>`;
  }

  return calendarHTML;
}

// API endpoint to generate image
app.post("/generate", async (req, res) => {
  try {
    console.log("Received request to generate image");
    const { message, date } = req.body;

    // Get active background URL
    const backgroundUrl = bgManager.getActiveBackgroundUrl();

    // Read the template HTML
    const templatePath = path.join(__dirname, "index.html");
    let htmlContent = fs.readFileSync(templatePath, "utf8");

    // Get date components - use provided date or default to tomorrow
    const dateComponents = date
      ? getDateComponents(date)
      : getTomorrowDateComponents();

    // Generate calendar for the month
    const calendarDate =
      dateComponents.dateObject ||
      new Date(
        dateComponents.year,
        new Date(
          `${dateComponents.month} 1, ${dateComponents.year}`,
        ).getMonth(),
        dateComponents.date,
      );
    const calendarYear = calendarDate.getFullYear();
    const calendarMonth = calendarDate.getMonth();
    const calendarMonthName = calendarDate.toLocaleDateString("en-US", {
      month: "long",
    });
    const calendarHTML = generateCalendar(
      calendarYear,
      calendarMonth,
      dateComponents.date,
    );

    // Replace background URL first
    htmlContent = htmlContent.replace("{{BACKGROUND_URL}}", backgroundUrl);

    // Replace placeholders in HTML
    htmlContent = htmlContent.replace("{{MONTH}}", dateComponents.month);
    htmlContent = htmlContent.replace("{{YEAR}}", dateComponents.year);
    htmlContent = htmlContent.replace("{{DATE}}", dateComponents.date);
    htmlContent = htmlContent.replace("{{DAY}}", dateComponents.day);

    // Replace calendar placeholders
    htmlContent = htmlContent.replace("{{CALENDAR_MONTH}}", calendarMonthName);
    htmlContent = htmlContent.replace("{{CALENDAR_YEAR}}", calendarYear);
    htmlContent = htmlContent.replace("{{CALENDAR_DAYS}}", calendarHTML);

    if (message) {
      htmlContent = htmlContent.replace("{{MESSAGE}}", message);
    }

    console.log(
      `Generating PNG for ${date ? "provided" : "tomorrow's"} date: ${dateComponents.day}, ${dateComponents.month} ${dateComponents.date}, ${dateComponents.year}`,
    );

    // Generate the PNG
    const pngBuffer = await generatePNG(htmlContent);

    // Send the image as response
    res.set({
      "Content-Type": "image/png",
      "Content-Length": pngBuffer.length,
    });
    res.send(pngBuffer);

    console.log("PNG generated and sent successfully");
  } catch (error) {
    console.error("Error generating image:", error);
    res.status(500).json({ error: "Failed to generate image" });
  }
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Serve admin interface (old version)
app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "admin.html"));
});

// Serve new admin interface
app.get("/admin-v2", (req, res) => {
  res.sendFile(path.join(__dirname, "admin-v2.html"));
});

// Static file serving for uploads
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// List all backgrounds (updated to use Supabase)
app.get("/api/backgrounds", async (req, res) => {
  try {
    if (!supabase) {
      // Fallback to old system if Supabase not configured
      const backgrounds = bgManager.listBackgrounds();
      return res.json(backgrounds);
    }

    const { data, error } = await supabase
      .from("poster_gen__backgrounds")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    res.json({ backgrounds: data || [] });
  } catch (error) {
    console.error("Error listing backgrounds:", error);
    res.status(500).json({ error: "Failed to list backgrounds" });
  }
});

// Upload new background (updated to use Supabase)
app.post(
  "/api/backgrounds/upload",
  upload.single("image"),
  async (req, res) => {
    try {
      if (!supabase) {
        return res.status(500).json({ error: "Supabase not configured" });
      }

      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const file = req.file;
      const fileBuffer = fs.readFileSync(file.path);

      // Upload to Supabase Storage
      const storagePath = `backgrounds/${file.filename}`;
      const { error: uploadError } = await supabase.storage
        .from("poster-assets")
        .upload(storagePath, fileBuffer, {
          contentType: file.mimetype,
          upsert: false,
        });

      if (uploadError) {
        throw new Error(`Storage upload failed: ${uploadError.message}`);
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("poster-assets")
        .getPublicUrl(storagePath);

      // Insert into database
      const { data, error } = await supabase
        .from("poster_gen__backgrounds")
        .insert({
          name: file.originalname,
          storage_path: storagePath,
          thumbnail_url: urlData.publicUrl,
          is_active: true,
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Database insert failed: ${error.message}`);
      }

      // Clean up local file
      fs.unlinkSync(file.path);

      console.log(`Background uploaded to Supabase: ${file.originalname}`);
      res.json({ success: true, background: data });
    } catch (error) {
      console.error("Error uploading background:", error);
      res.status(500).json({ error: error.message });
    }
  },
);

// Select active background
app.post("/api/backgrounds/select", (req, res) => {
  try {
    const { backgroundId } = req.body;

    if (!backgroundId) {
      return res.status(400).json({ error: "backgroundId is required" });
    }

    bgManager.setActiveBackground(backgroundId);
    console.log(`Active background changed to: ${backgroundId}`);
    res.json({ success: true });
  } catch (error) {
    console.error("Error selecting background:", error);
    res.status(400).json({ error: error.message });
  }
});

// Delete background
app.delete("/api/backgrounds/:id", (req, res) => {
  try {
    const { id } = req.params;
    bgManager.deleteBackground(id);
    console.log(`Background deleted: ${id}`);
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting background:", error);
    res.status(400).json({ error: error.message });
  }
});

// Preview background
app.post("/api/backgrounds/:id/preview", async (req, res) => {
  try {
    const { id } = req.params;
    const { message, date } = req.body;

    // Get the specific background URL without setting it as active
    const state = bgManager.loadState();
    const background = state.backgrounds.find((bg) => bg.id === id);

    if (!background) {
      return res.status(404).json({ error: "Background not found" });
    }

    const ext = path.extname(background.filename);
    const backgroundUrl = `file://${path.join(__dirname, "uploads", "backgrounds", `${id}${ext}`)}`;

    // Read the template HTML
    const templatePath = path.join(__dirname, "index.html");
    let htmlContent = fs.readFileSync(templatePath, "utf8");

    // Get date components - use provided date or default to tomorrow
    const dateComponents = date
      ? getDateComponents(date)
      : getTomorrowDateComponents();

    // Generate calendar for the month
    const calendarDate =
      dateComponents.dateObject ||
      new Date(
        dateComponents.year,
        new Date(
          `${dateComponents.month} 1, ${dateComponents.year}`,
        ).getMonth(),
        dateComponents.date,
      );
    const calendarYear = calendarDate.getFullYear();
    const calendarMonth = calendarDate.getMonth();
    const calendarMonthName = calendarDate.toLocaleDateString("en-US", {
      month: "long",
    });
    const calendarHTML = generateCalendar(
      calendarYear,
      calendarMonth,
      dateComponents.date,
    );

    // Replace background URL
    htmlContent = htmlContent.replace("{{BACKGROUND_URL}}", backgroundUrl);

    // Replace placeholders
    htmlContent = htmlContent.replace("{{MONTH}}", dateComponents.month);
    htmlContent = htmlContent.replace("{{YEAR}}", dateComponents.year);
    htmlContent = htmlContent.replace("{{DATE}}", dateComponents.date);
    htmlContent = htmlContent.replace("{{DAY}}", dateComponents.day);

    // Replace calendar placeholders
    htmlContent = htmlContent.replace("{{CALENDAR_MONTH}}", calendarMonthName);
    htmlContent = htmlContent.replace("{{CALENDAR_YEAR}}", calendarYear);
    htmlContent = htmlContent.replace("{{CALENDAR_DAYS}}", calendarHTML);

    if (message) {
      htmlContent = htmlContent.replace("{{MESSAGE}}", message);
    }

    console.log(`Generating preview for background: ${id}`);

    // Generate the PNG
    const pngBuffer = await generatePNG(htmlContent);

    // Send the image as response
    res.set({
      "Content-Type": "image/png",
      "Content-Length": pngBuffer.length,
    });
    res.send(pngBuffer);

    console.log("Preview PNG generated successfully");
  } catch (error) {
    console.error("Error generating preview:", error);
    res.status(500).json({ error: "Failed to generate preview" });
  }
});

// ==============================================
// TEMPLATE MANAGEMENT ENDPOINTS
// ==============================================

// Configure multer for template uploads
const templateStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, "uploads", "templates");
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const id = Date.now().toString();
    cb(null, `${id}.html`);
  },
});

const templateUpload = multer({
  storage: templateStorage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "text/html") {
      cb(null, true);
    } else {
      cb(new Error("Only HTML files are allowed"), false);
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

// Upload HTML template
app.post(
  "/api/templates/upload",
  templateUpload.single("template"),
  async (req, res) => {
    try {
      if (!supabase) {
        return res.status(500).json({ error: "Supabase not configured" });
      }

      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const { name } = req.body;
      if (!name) {
        return res.status(400).json({ error: "Template name is required" });
      }

      const file = req.file;
      const fileBuffer = fs.readFileSync(file.path);

      // Upload to Supabase Storage
      const storagePath = `templates/${file.filename}`;
      const { error: uploadError } = await supabase.storage
        .from("poster-assets")
        .upload(storagePath, fileBuffer, {
          contentType: "text/html",
          upsert: false,
        });

      if (uploadError) {
        throw new Error(`Storage upload failed: ${uploadError.message}`);
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("poster-assets")
        .getPublicUrl(storagePath);

      // Insert into database
      const { data, error } = await supabase
        .from("poster_gen__templates")
        .insert({
          name,
          storage_path: storagePath,
          preview_url: urlData.publicUrl,
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Database insert failed: ${error.message}`);
      }

      // Clean up local file
      fs.unlinkSync(file.path);

      console.log(`Template uploaded: ${name}`);
      res.json({ success: true, template: data });
    } catch (error) {
      console.error("Error uploading template:", error);
      res.status(500).json({ error: error.message });
    }
  },
);

// List all templates
app.get("/api/templates", async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ error: "Supabase not configured" });
    }

    const { data, error } = await supabase
      .from("poster_gen__templates")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    res.json({ templates: data || [] });
  } catch (error) {
    console.error("Error listing templates:", error);
    res.status(500).json({ error: error.message });
  }
});

// Delete template
app.delete("/api/templates/:id", async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ error: "Supabase not configured" });
    }

    const { id } = req.params;

    // Get template details
    const { data: template, error: fetchError } = await supabase
      .from("poster_gen__templates")
      .select("storage_path")
      .eq("id", id)
      .single();

    if (fetchError) throw fetchError;

    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from("poster-assets")
      .remove([template.storage_path]);

    if (storageError) {
      console.warn("Storage deletion warning:", storageError.message);
    }

    // Delete from database
    const { error: deleteError } = await supabase
      .from("poster_gen__templates")
      .delete()
      .eq("id", id);

    if (deleteError) throw deleteError;

    console.log(`Template deleted: ${id}`);
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting template:", error);
    res.status(500).json({ error: error.message });
  }
});

// ==============================================
// CHAT MANAGEMENT ENDPOINTS
// ==============================================

// List all chats
app.get("/api/chats", async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ error: "Supabase not configured" });
    }

    const { data, error } = await supabase
      .from("poster_gen__chats")
      .select(
        `
        *,
        template:assigned_template_id(id, name),
        background:assigned_background_id(id, name)
      `,
      )
      .order("created_at", { ascending: false });

    if (error) throw error;

    res.json({ chats: data || [] });
  } catch (error) {
    console.error("Error listing chats:", error);
    res.status(500).json({ error: error.message });
  }
});

// Approve chat by code
app.post("/api/chats/approve", async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ error: "Supabase not configured" });
    }

    const { approvalCode } = req.body;

    if (!approvalCode) {
      return res.status(400).json({ error: "Approval code is required" });
    }

    const { data, error } = await supabase
      .from("poster_gen__chats")
      .update({ is_approved: true, approved_at: new Date().toISOString() })
      .eq("approval_code", approvalCode.toUpperCase())
      .select()
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return res.status(404).json({ error: "Invalid approval code" });
      }
      throw error;
    }

    console.log(`Chat approved: ${data.chat_id}`);
    res.json({ success: true, chat: data });
  } catch (error) {
    console.error("Error approving chat:", error);
    res.status(500).json({ error: error.message });
  }
});

// Assign template to chat
app.post("/api/chats/:chatId/assign-template", async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ error: "Supabase not configured" });
    }

    const { chatId } = req.params;
    const { templateId } = req.body;

    if (!templateId) {
      return res.status(400).json({ error: "Template ID is required" });
    }

    const { data, error } = await supabase
      .from("poster_gen__chats")
      .update({ assigned_template_id: templateId })
      .eq("chat_id", chatId)
      .select()
      .single();

    if (error) throw error;

    console.log(`Template ${templateId} assigned to chat ${chatId}`);
    res.json({ success: true, chat: data });
  } catch (error) {
    console.error("Error assigning template:", error);
    res.status(500).json({ error: error.message });
  }
});

// Assign background to chat
app.post("/api/chats/:chatId/assign-background", async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ error: "Supabase not configured" });
    }

    const { chatId } = req.params;
    const { backgroundId } = req.body;

    if (!backgroundId) {
      return res.status(400).json({ error: "Background ID is required" });
    }

    const { data, error } = await supabase
      .from("poster_gen__chats")
      .update({ assigned_background_id: backgroundId })
      .eq("chat_id", chatId)
      .select()
      .single();

    if (error) throw error;

    console.log(`Background ${backgroundId} assigned to chat ${chatId}`);
    res.json({ success: true, chat: data });
  } catch (error) {
    console.error("Error assigning background:", error);
    res.status(500).json({ error: error.message });
  }
});

// ==============================================
// POSTER GENERATION WITH SUPABASE STORAGE
// ==============================================

// Helper function to replace custom template placeholders
function replaceCustomPlaceholders(htmlContent, customData) {
  if (!customData || typeof customData !== 'object') {
    return htmlContent;
  }

  let result = htmlContent;

  // Replace each custom placeholder
  for (const [key, value] of Object.entries(customData)) {
    const placeholder = `{{${key.toUpperCase()}}}`;

    // Handle arrays - format as comma-separated list or HTML list
    if (Array.isArray(value)) {
      // Check if template wants HTML list format
      const htmlListPlaceholder = `{{${key.toUpperCase()}:LIST}}`;
      if (result.includes(htmlListPlaceholder)) {
        const listItems = value.map(item => `<li>${item}</li>`).join('');
        result = result.replace(htmlListPlaceholder, listItems);
      }

      // Replace regular placeholder with comma-separated string
      const commaList = value.join(', ');
      result = result.replace(new RegExp(placeholder, 'g'), commaList);
    } else {
      // Handle regular values (strings, numbers, etc.)
      result = result.replace(new RegExp(placeholder, 'g'), String(value));
    }
  }

  return result;
}

// Helper function to upload poster to Supabase Storage
async function uploadPosterToStorage(pngBuffer, chatId, date) {
  if (!supabase) {
    throw new Error("Supabase not configured");
  }

  const storagePath = `posters/${chatId}/${date}.png`;

  const { error: uploadError } = await supabase.storage
    .from("poster-assets")
    .upload(storagePath, pngBuffer, {
      contentType: "image/png",
      upsert: true,
    });

  if (uploadError) {
    throw new Error(`Storage upload failed: ${uploadError.message}`);
  }

  const { data: urlData } = supabase.storage
    .from("poster-assets")
    .getPublicUrl(storagePath);

  return { storagePath, publicUrl: urlData.publicUrl };
}

// Preview poster for specific chat and date (without saving to cache)
app.post("/api/posters/preview", async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ error: "Supabase not configured" });
    }

    const { chatId, date, templateData } = req.body;

    if (!chatId) {
      return res.status(400).json({ error: "Chat ID is required" });
    }

    // Get chat details with template and background
    const { data: chat, error: chatError } = await supabase
      .from("poster_gen__chats")
      .select(
        `
        *,
        template:assigned_template_id(id, name, storage_path),
        background:assigned_background_id(id, name, storage_path)
      `,
      )
      .eq("chat_id", chatId)
      .single();

    if (chatError) throw chatError;

    if (!chat.is_approved) {
      return res.status(403).json({ error: "Chat is not approved" });
    }

    if (!chat.template || !chat.background) {
      return res
        .status(400)
        .json({ error: "Chat must have template and background assigned" });
    }

    // Get date components
    const dateComponents = date
      ? getDateComponents(date)
      : getTomorrowDateComponents();

    // Download template from Supabase Storage
    const { data: templateFile, error: templateError } = await supabase.storage
      .from("poster-assets")
      .download(chat.template.storage_path);

    if (templateError) throw templateError;

    let htmlContent = await templateFile.text();

    // Download background and get public URL
    const { data: bgUrlData } = supabase.storage
      .from("poster-assets")
      .getPublicUrl(chat.background.storage_path);

    // Replace placeholders
    const calendarDate = dateComponents.dateObject;
    const calendarYear = calendarDate.getFullYear();
    const calendarMonth = calendarDate.getMonth();
    const calendarMonthName = calendarDate.toLocaleDateString("en-US", {
      month: "long",
    });
    const calendarHTML = generateCalendar(
      calendarYear,
      calendarMonth,
      dateComponents.date,
    );

    htmlContent = htmlContent.replace("{{BACKGROUND_URL}}", bgUrlData.publicUrl);
    htmlContent = htmlContent.replace("{{MONTH}}", dateComponents.month);
    htmlContent = htmlContent.replace("{{YEAR}}", dateComponents.year);
    htmlContent = htmlContent.replace("{{DATE}}", dateComponents.date);
    htmlContent = htmlContent.replace("{{DAY}}", dateComponents.day);
    htmlContent = htmlContent.replace("{{CALENDAR_MONTH}}", calendarMonthName);
    htmlContent = htmlContent.replace("{{CALENDAR_YEAR}}", calendarYear);
    htmlContent = htmlContent.replace("{{CALENDAR_DAYS}}", calendarHTML);

    // Replace custom template data
    if (templateData) {
      htmlContent = replaceCustomPlaceholders(htmlContent, templateData);
    }

    console.log(`Generating preview for chat ${chatId}`);

    // Generate PNG
    const pngBuffer = await generatePNG(htmlContent);

    // Send the image as response (no caching)
    res.set({
      "Content-Type": "image/png",
      "Content-Length": pngBuffer.length,
    });
    res.send(pngBuffer);

    console.log("Preview PNG generated successfully");
  } catch (error) {
    console.error("Error generating preview:", error);
    res.status(500).json({ error: error.message });
  }
});

// Generate poster for specific chat and date
app.post("/api/posters/generate", async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ error: "Supabase not configured" });
    }

    const { chatId, date, templateData } = req.body;

    console.log(`[POST /api/posters/generate] Request received:`, { chatId, date, hasTemplateData: !!templateData });

    if (!chatId) {
      return res.status(400).json({ error: "Chat ID is required" });
    }

    // Get chat details with template and background
    const { data: chat, error: chatError } = await supabase
      .from("poster_gen__chats")
      .select(
        `
        *,
        template:assigned_template_id(id, name, storage_path),
        background:assigned_background_id(id, name, storage_path)
      `,
      )
      .eq("chat_id", chatId)
      .single();

    if (chatError) throw chatError;

    console.log(`[POST /api/posters/generate] Chat details:`, {
      chatId: chat.chat_id,
      templateId: chat.assigned_template_id,
      templateName: chat.template?.name,
      templatePath: chat.template?.storage_path,
      backgroundId: chat.assigned_background_id,
      backgroundPath: chat.background?.storage_path
    });

    if (!chat.is_approved) {
      return res.status(403).json({ error: "Chat is not approved" });
    }

    if (!chat.template || !chat.background) {
      return res
        .status(400)
        .json({ error: "Chat must have template and background assigned" });
    }

    // Get date components
    const dateComponents = date
      ? getDateComponents(date)
      : getTomorrowDateComponents();

    const posterDate = `${dateComponents.year}-${String(dateComponents.dateObject.getMonth() + 1).padStart(2, "0")}-${String(dateComponents.date).padStart(2, "0")}`;

    // Download template from Supabase Storage
    console.log(`[POST /api/posters/generate] Downloading template from:`, chat.template.storage_path);
    const { data: templateFile, error: templateError } = await supabase.storage
      .from("poster-assets")
      .download(chat.template.storage_path);

    if (templateError) throw templateError;

    let htmlContent = await templateFile.text();
    console.log(`[POST /api/posters/generate] Template downloaded, length:`, htmlContent.length, `First 100 chars:`, htmlContent.substring(0, 100));

    // Download background and get public URL
    const { data: bgUrlData } = supabase.storage
      .from("poster-assets")
      .getPublicUrl(chat.background.storage_path);

    // Replace placeholders
    const calendarDate = dateComponents.dateObject;
    const calendarYear = calendarDate.getFullYear();
    const calendarMonth = calendarDate.getMonth();
    const calendarMonthName = calendarDate.toLocaleDateString("en-US", {
      month: "long",
    });
    const calendarHTML = generateCalendar(
      calendarYear,
      calendarMonth,
      dateComponents.date,
    );

    htmlContent = htmlContent.replace("{{BACKGROUND_URL}}", bgUrlData.publicUrl);
    htmlContent = htmlContent.replace("{{MONTH}}", dateComponents.month);
    htmlContent = htmlContent.replace("{{YEAR}}", dateComponents.year);
    htmlContent = htmlContent.replace("{{DATE}}", dateComponents.date);
    htmlContent = htmlContent.replace("{{DAY}}", dateComponents.day);
    htmlContent = htmlContent.replace("{{CALENDAR_MONTH}}", calendarMonthName);
    htmlContent = htmlContent.replace("{{CALENDAR_YEAR}}", calendarYear);
    htmlContent = htmlContent.replace("{{CALENDAR_DAYS}}", calendarHTML);

    // Replace custom template data
    if (templateData) {
      htmlContent = replaceCustomPlaceholders(htmlContent, templateData);
      console.log(`[POST /api/posters/generate] Applied custom template data`);
    }

    // Debug mode: return HTML instead of PNG if debug=true
    if (req.body.debug === true) {
      console.log(`[POST /api/posters/generate] DEBUG MODE - returning HTML`);
      return res.send(htmlContent);
    }

    // Generate PNG
    const pngBuffer = await generatePNG(htmlContent);

    // Upload to Supabase Storage
    const { storagePath, publicUrl } = await uploadPosterToStorage(
      pngBuffer,
      chatId,
      posterDate,
    );

    // Cache in database
    const { error: cacheError } = await supabase
      .from("poster_gen__cached_posters")
      .upsert(
        {
          chat_id: chatId,
          poster_date: posterDate,
          storage_path: storagePath,
          template_id: chat.template.id,
          background_id: chat.background.id,
        },
        { onConflict: "chat_id,poster_date" },
      );

    if (cacheError) {
      console.warn("Cache insert warning:", cacheError.message);
    }

    console.log(`Poster generated for chat ${chatId}, date ${posterDate}`);
    res.json({
      success: true,
      posterUrl: publicUrl,
      storagePath,
      date: posterDate,
    });
  } catch (error) {
    console.error("Error generating poster:", error);
    res.status(500).json({ error: error.message });
  }
});

// Batch generate posters for next N months
app.post("/api/posters/batch-generate", async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ error: "Supabase not configured" });
    }

    const { chatId, months = 3 } = req.body;

    if (!chatId) {
      return res.status(400).json({ error: "Chat ID is required" });
    }

    // Get chat details
    const { data: chat, error: chatError } = await supabase
      .from("poster_gen__chats")
      .select(
        `
        *,
        template:assigned_template_id(id, name, storage_path),
        background:assigned_background_id(id, name, storage_path)
      `,
      )
      .eq("chat_id", chatId)
      .single();

    if (chatError) throw chatError;

    if (!chat.is_approved) {
      return res.status(403).json({ error: "Chat is not approved" });
    }

    if (!chat.template || !chat.background) {
      return res
        .status(400)
        .json({ error: "Chat must have template and background assigned" });
    }

    // Download template
    const { data: templateData, error: templateError } = await supabase.storage
      .from("poster-assets")
      .download(chat.template.storage_path);

    if (templateError) throw templateError;

    const templateContent = await templateData.text();

    // Get background public URL
    const { data: bgUrlData } = supabase.storage
      .from("poster-assets")
      .getPublicUrl(chat.background.storage_path);

    // Generate dates for next N months
    const today = new Date();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + months);

    const generated = [];
    const errors = [];

    for (
      let d = new Date(today);
      d <= endDate;
      d.setDate(d.getDate() + 1)
    ) {
      try {
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

        // Check if already cached with current template/background
        const { data: existing } = await supabase
          .from("poster_gen__cached_posters")
          .select("id, template_id, background_id")
          .eq("chat_id", chatId)
          .eq("poster_date", dateStr)
          .single();

        if (existing) {
          // Check if template/background matches
          if (
            existing.template_id === chat.template.id &&
            existing.background_id === chat.background.id
          ) {
            console.log(`Skipping ${dateStr} - already cached with current template/background`);
            continue;
          } else {
            console.log(`Regenerating ${dateStr} - template or background changed`);
          }
        }

        // Get date components
        const dateComponents = {
          month: d.toLocaleDateString("en-US", { month: "long" }),
          day: d.toLocaleDateString("en-US", { weekday: "long" }),
          date: d.getDate(),
          year: d.getFullYear(),
          dateObject: new Date(d),
        };

        // Prepare HTML
        let htmlContent = templateContent;
        const calendarYear = d.getFullYear();
        const calendarMonth = d.getMonth();
        const calendarMonthName = d.toLocaleDateString("en-US", {
          month: "long",
        });
        const calendarHTML = generateCalendar(
          calendarYear,
          calendarMonth,
          dateComponents.date,
        );

        htmlContent = htmlContent.replace("{{BACKGROUND_URL}}", bgUrlData.publicUrl);
        htmlContent = htmlContent.replace("{{MONTH}}", dateComponents.month);
        htmlContent = htmlContent.replace("{{YEAR}}", dateComponents.year);
        htmlContent = htmlContent.replace("{{DATE}}", dateComponents.date);
        htmlContent = htmlContent.replace("{{DAY}}", dateComponents.day);
        htmlContent = htmlContent.replace(
          "{{CALENDAR_MONTH}}",
          calendarMonthName,
        );
        htmlContent = htmlContent.replace("{{CALENDAR_YEAR}}", calendarYear);
        htmlContent = htmlContent.replace("{{CALENDAR_DAYS}}", calendarHTML);

        // Generate PNG
        const pngBuffer = await generatePNG(htmlContent);

        // Upload to storage
        const { storagePath } = await uploadPosterToStorage(
          pngBuffer,
          chatId,
          dateStr,
        );

        // Cache in database (upsert to replace if exists)
        await supabase.from("poster_gen__cached_posters").upsert(
          {
            chat_id: chatId,
            poster_date: dateStr,
            storage_path: storagePath,
            template_id: chat.template.id,
            background_id: chat.background.id,
          },
          { onConflict: "chat_id,poster_date" }
        );

        generated.push(dateStr);
        console.log(`Generated poster for ${dateStr}`);
      } catch (error) {
        errors.push({ date: dateStr, error: error.message });
        console.error(`Error generating poster for ${dateStr}:`, error);
      }
    }

    res.json({
      success: true,
      generated: generated.length,
      errors: errors.length,
      details: { generated, errors },
    });
  } catch (error) {
    console.error("Error batch generating posters:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get poster for chat and date (from cache or generate)
app.get("/api/posters/:chatId/:date", async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ error: "Supabase not configured" });
    }

    const { chatId, date } = req.params;

    // Get current chat settings to validate cache
    const { data: chat, error: chatError } = await supabase
      .from("poster_gen__chats")
      .select("assigned_template_id, assigned_background_id")
      .eq("chat_id", chatId)
      .single();

    if (chatError) throw chatError;

    // Check cache first - must match current template and background
    const { data: cached, error: cacheError } = await supabase
      .from("poster_gen__cached_posters")
      .select("storage_path, template_id, background_id")
      .eq("chat_id", chatId)
      .eq("poster_date", date)
      .single();

    if (!cacheError && cached) {
      // Validate that cached poster uses current template/background
      if (
        cached.template_id === chat.assigned_template_id &&
        cached.background_id === chat.assigned_background_id
      ) {
        // Cache is valid - return it
        const { data: urlData } = supabase.storage
          .from("poster-assets")
          .getPublicUrl(cached.storage_path);

        console.log(`Returning cached poster for ${chatId}/${date}`);
        return res.json({ success: true, posterUrl: urlData.publicUrl, cached: true });
      } else {
        // Cache is stale (template/background changed) - regenerate
        console.log(`Cache stale for ${chatId}/${date} - template or background changed`);
      }
    }

    // Not cached, generate on-demand
    console.log(`Poster not cached for ${chatId}/${date}, generating...`);

    // Trigger generation
    const generateRes = await fetch(
      `http://localhost:${PORT}/api/posters/generate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId, date }),
      },
    );

    const result = await generateRes.json();

    if (!generateRes.ok) {
      throw new Error(result.error || "Failed to generate poster");
    }

    res.json({ ...result, cached: false });
  } catch (error) {
    console.error("Error getting poster:", error);
    res.status(500).json({ error: error.message });
  }
});

// Migrate backgrounds to Supabase
app.post("/api/backgrounds/migrate-to-supabase", async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ error: "Supabase not configured" });
    }

    const backgrounds = bgManager.listBackgrounds();
    const migrated = [];
    const errors = [];

    for (const bg of backgrounds.backgrounds) {
      try {
        const ext = path.extname(bg.filename);
        const filePath = path.join(
          __dirname,
          "uploads",
          "backgrounds",
          `${bg.id}${ext}`,
        );
        const fileBuffer = fs.readFileSync(filePath);

        // Upload to Supabase Storage
        const storagePath = `backgrounds/${bg.id}${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("poster-assets")
          .upload(storagePath, fileBuffer, {
            contentType: bg.mimeType,
            upsert: true,
          });

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: urlData } = supabase.storage
          .from("poster-assets")
          .getPublicUrl(storagePath);

        // Insert into database
        const { error: dbError } = await supabase
          .from("poster_gen__backgrounds")
          .insert({
            name: bg.originalName,
            storage_path: storagePath,
            thumbnail_url: urlData.publicUrl,
            is_active: bg.isActive,
          });

        if (dbError) throw dbError;

        migrated.push(bg.id);
        console.log(`Migrated background: ${bg.id}`);
      } catch (error) {
        errors.push({ id: bg.id, error: error.message });
        console.error(`Error migrating background ${bg.id}:`, error);
      }
    }

    res.json({
      success: true,
      migrated: migrated.length,
      errors: errors.length,
      details: { migrated, errors },
    });
  } catch (error) {
    console.error("Error migrating backgrounds:", error);
    res.status(500).json({ error: error.message });
  }
});

// ==============================================
// CLEANUP OLD POSTERS
// ==============================================

// Function to cleanup old posters (older than 3 days)
async function cleanupOldPosters() {
  try {
    if (!supabase) {
      console.log("Skipping cleanup - Supabase not configured");
      return { deleted: 0, errors: 0 };
    }

    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    const cutoffDate = threeDaysAgo.toISOString().split("T")[0]; // YYYY-MM-DD

    console.log(`\n🧹 Starting cleanup of posters older than ${cutoffDate}...`);

    // Get all posters older than 3 days
    const { data: oldPosters, error: fetchError } = await supabase
      .from("poster_gen__cached_posters")
      .select("id, storage_path, poster_date, chat_id")
      .lt("poster_date", cutoffDate);

    if (fetchError) throw fetchError;

    if (!oldPosters || oldPosters.length === 0) {
      console.log("✓ No old posters to clean up");
      return { deleted: 0, errors: 0 };
    }

    console.log(`Found ${oldPosters.length} old posters to delete`);

    let deleted = 0;
    let errors = 0;

    for (const poster of oldPosters) {
      try {
        // Delete from storage
        const { error: storageError } = await supabase.storage
          .from("poster-assets")
          .remove([poster.storage_path]);

        if (storageError) {
          console.warn(
            `Storage deletion warning for ${poster.storage_path}:`,
            storageError.message
          );
        }

        // Delete from database
        const { error: dbError } = await supabase
          .from("poster_gen__cached_posters")
          .delete()
          .eq("id", poster.id);

        if (dbError) throw dbError;

        deleted++;
        console.log(`Deleted poster: ${poster.chat_id}/${poster.poster_date}`);
      } catch (error) {
        errors++;
        console.error(
          `Error deleting poster ${poster.chat_id}/${poster.poster_date}:`,
          error.message
        );
      }
    }

    console.log(
      `✓ Cleanup complete: ${deleted} deleted, ${errors} errors\n`
    );
    return { deleted, errors };
  } catch (error) {
    console.error("Error during cleanup:", error);
    return { deleted: 0, errors: 1, error: error.message };
  }
}

// Manual cleanup endpoint (for testing)
app.post("/api/posters/cleanup", async (req, res) => {
  try {
    const result = await cleanupOldPosters();
    res.json({ success: true, ...result });
  } catch (error) {
    console.error("Error running cleanup:", error);
    res.status(500).json({ error: error.message });
  }
});

// Schedule cleanup to run every day at midnight (00:00)
cron.schedule("0 0 * * *", () => {
  console.log("⏰ Running scheduled cleanup job...");
  cleanupOldPosters();
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`\n🚀 DMMA Poster Generator Server`);
  console.log(`================================`);
  console.log(`Server running on http://0.0.0.0:${PORT}`);
  console.log(`\n📊 Admin Panels:`);
  console.log(`  http://localhost:${PORT}/admin-v2 - New Admin Panel (Recommended)`);
  console.log(`  http://localhost:${PORT}/admin - Legacy Background Manager`);
  console.log(`\n🔌 API Endpoints:`);
  console.log(`  Template Management:`);
  console.log(`    POST /api/templates/upload - Upload HTML template`);
  console.log(`    GET  /api/templates - List all templates`);
  console.log(`    DELETE /api/templates/:id - Delete template`);
  console.log(`\n  Chat Management:`);
  console.log(`    GET  /api/chats - List all chats`);
  console.log(`    POST /api/chats/approve - Approve chat by code`);
  console.log(`    POST /api/chats/:chatId/assign-template - Assign template`);
  console.log(`    POST /api/chats/:chatId/assign-background - Assign background`);
  console.log(`\n  Poster Generation:`);
  console.log(`    POST /api/posters/preview - Preview poster (no caching)`);
  console.log(`    POST /api/posters/generate - Generate single poster`);
  console.log(`    POST /api/posters/batch-generate - Batch generate (N months)`);
  console.log(`    POST /api/posters/cleanup - Cleanup old posters (manual)`);
  console.log(`    GET  /api/posters/:chatId/:date - Get poster (cached/generate)`);
  console.log(`\n  Background Management:`);
  console.log(`    POST /api/backgrounds/upload - Upload background image`);
  console.log(`    GET  /api/backgrounds - List all backgrounds`);
  console.log(`    POST /api/backgrounds/migrate-to-supabase - Migrate to Supabase`);
  console.log(`\n  Legacy:`);
  console.log(`    POST /generate - Generate PNG with custom date/message`);
  console.log(`    GET  /health - Health check`);
  console.log(`\n⏰ Scheduled Jobs:`);
  console.log(`    Cleanup old posters - Runs daily at midnight (00:00)`);
  console.log(`    Removes posters older than 3 days from storage`);
  console.log(`\n✅ Server ready! Check SETUP.md for deployment instructions.\n`);
});
