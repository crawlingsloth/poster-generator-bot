#!/usr/bin/env node

const express = require("express");
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const BackgroundManager = require("./lib/background-manager");
const ImageProcessor = require("./lib/image-processor");

const app = express();
const PORT = process.env.PORT || 3333;

// Create directories if they don't exist
['uploads/backgrounds', 'uploads/thumbnails', 'lib'].forEach(dir => {
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
    cb(null, path.join(__dirname, 'uploads', 'backgrounds'));
  },
  filename: (req, file, cb) => {
    const id = Date.now().toString();
    const ext = path.extname(file.originalname);
    cb(null, `${id}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only PNG and JPG images are allowed'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
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
    dateObject: tomorrow
  };
}

// Function to get date components from a provided date
function getDateComponents(dateString) {
  let date;

  // Try to parse DD-MM-YYYY format
  if (dateString.includes('-') && dateString.split('-').length === 3) {
    const parts = dateString.split('-');
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
    throw new Error('Invalid date provided');
  }

  return {
    month: date.toLocaleDateString("en-US", { month: "long" }),
    day: date.toLocaleDateString("en-US", { weekday: "long" }),
    date: date.getDate(),
    year: date.getFullYear(),
    dateObject: date
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

  let calendarHTML = '';

  // Add empty cells for days before the first day of the month
  for (let i = 0; i < startingDayOfWeek; i++) {
    calendarHTML += '<div class="cal-day empty"></div>';
  }

  // Add cells for each day of the month
  for (let day = 1; day <= daysInMonth; day++) {
    const currentDate = new Date(year, month, day);
    const dayOfWeek = currentDate.getDay();

    let classes = 'cal-day';

    // Highlight specific days of the week
    if (highlightDays.includes(dayOfWeek)) {
      classes += ' highlighted';
    }

    // Mark today
    if (day === todayDate) {
      classes += ' today';
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
    const dateComponents = date ? getDateComponents(date) : getTomorrowDateComponents();

    // Generate calendar for the month
    const calendarDate = dateComponents.dateObject || new Date(dateComponents.year, new Date(`${dateComponents.month} 1, ${dateComponents.year}`).getMonth(), dateComponents.date);
    const calendarYear = calendarDate.getFullYear();
    const calendarMonth = calendarDate.getMonth();
    const calendarMonthName = calendarDate.toLocaleDateString("en-US", { month: "long" });
    const calendarHTML = generateCalendar(calendarYear, calendarMonth, dateComponents.date);

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
      `Generating PNG for ${date ? 'provided' : 'tomorrow\'s'} date: ${dateComponents.day}, ${dateComponents.month} ${dateComponents.date}, ${dateComponents.year}`,
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

// Serve admin interface
app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "admin.html"));
});

// Static file serving for uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// List all backgrounds
app.get('/api/backgrounds', (req, res) => {
  try {
    const backgrounds = bgManager.listBackgrounds();
    res.json(backgrounds);
  } catch (error) {
    console.error('Error listing backgrounds:', error);
    res.status(500).json({ error: 'Failed to list backgrounds' });
  }
});

// Upload new background
app.post('/api/backgrounds/upload', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const file = req.file;
    const id = path.basename(file.filename, path.extname(file.filename));
    const ext = path.extname(file.filename);

    // Create thumbnail
    await ImageProcessor.createThumbnail(file.path, id, ext);

    // Add to state
    const background = bgManager.addBackground({
      id,
      filename: file.filename,
      originalName: file.originalname,
      mimeType: file.mimetype,
      fileSize: file.size
    });

    console.log(`Background uploaded: ${file.originalname} (ID: ${id})`);
    res.json({ success: true, background });
  } catch (error) {
    console.error('Error uploading background:', error);
    res.status(500).json({ error: error.message });
  }
});

// Select active background
app.post('/api/backgrounds/select', (req, res) => {
  try {
    const { backgroundId } = req.body;

    if (!backgroundId) {
      return res.status(400).json({ error: 'backgroundId is required' });
    }

    bgManager.setActiveBackground(backgroundId);
    console.log(`Active background changed to: ${backgroundId}`);
    res.json({ success: true });
  } catch (error) {
    console.error('Error selecting background:', error);
    res.status(400).json({ error: error.message });
  }
});

// Delete background
app.delete('/api/backgrounds/:id', (req, res) => {
  try {
    const { id } = req.params;
    bgManager.deleteBackground(id);
    console.log(`Background deleted: ${id}`);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting background:', error);
    res.status(400).json({ error: error.message });
  }
});

// Preview background
app.post('/api/backgrounds/:id/preview', async (req, res) => {
  try {
    const { id } = req.params;
    const { message, date } = req.body;

    // Get the specific background URL without setting it as active
    const state = bgManager.loadState();
    const background = state.backgrounds.find(bg => bg.id === id);

    if (!background) {
      return res.status(404).json({ error: 'Background not found' });
    }

    const ext = path.extname(background.filename);
    const backgroundUrl = `file://${path.join(__dirname, 'uploads', 'backgrounds', `${id}${ext}`)}`;

    // Read the template HTML
    const templatePath = path.join(__dirname, "index.html");
    let htmlContent = fs.readFileSync(templatePath, "utf8");

    // Get date components - use provided date or default to tomorrow
    const dateComponents = date ? getDateComponents(date) : getTomorrowDateComponents();

    // Generate calendar for the month
    const calendarDate = dateComponents.dateObject || new Date(dateComponents.year, new Date(`${dateComponents.month} 1, ${dateComponents.year}`).getMonth(), dateComponents.date);
    const calendarYear = calendarDate.getFullYear();
    const calendarMonth = calendarDate.getMonth();
    const calendarMonthName = calendarDate.toLocaleDateString("en-US", { month: "long" });
    const calendarHTML = generateCalendar(calendarYear, calendarMonth, dateComponents.date);

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

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on 0.0.0.0:${PORT}`);
  console.log(`POST /generate - Generate PNG (accepts optional 'date' and 'message' in body)`);
  console.log(`  Example: { "date": "2025-10-27", "message": "Custom message" }`);
  console.log(`  Defaults to tomorrow's date if no date provided`);
  console.log(`GET /health - Health check`);
  console.log(`GET /admin - Background manager interface`);
});
