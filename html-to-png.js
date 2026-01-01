#!/usr/bin/env node

const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

async function htmlToPng(htmlPath, outputPath) {
  // Check if HTML file exists
  if (!fs.existsSync(htmlPath)) {
    console.error(`Error: HTML file not found at ${htmlPath}`);
    process.exit(1);
  }

  console.log(`Converting ${htmlPath} to PNG...`);

  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();

    // Set viewport for better quality (portrait orientation)
    await page.setViewport({
      width: 1080,
      height: 1400,
      deviceScaleFactor: 2, // Higher resolution
    });

    // Load the HTML file
    const htmlContent = fs.readFileSync(htmlPath, "utf8");
    const htmlUrl = `file://${path.resolve(htmlPath)}`;

    await page.goto(htmlUrl, {
      waitUntil: "networkidle0",
    });

    // Wait for fonts to load (especially important for Dhivehi/Thaana script)
    await page.evaluateHandle('document.fonts.ready');
    await new Promise(resolve => setTimeout(resolve, 1000)); // Additional safety wait for non-Latin fonts

    // Take screenshot
    await page.screenshot({
      path: outputPath,
      type: "png",
      fullPage: false,
    });

    console.log(`✓ PNG saved to ${outputPath}`);
  } catch (error) {
    console.error("Error converting HTML to PNG:", error);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const htmlPath = args[0] || "index.html";
const outputPath = args[1] || "output.png";

htmlToPng(htmlPath, outputPath);
