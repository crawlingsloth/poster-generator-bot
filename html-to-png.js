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
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--disable-gpu",
      "--window-size=1080,1550",
    ],
    // Use Puppeteer's bundled Chrome in all environments
  });

  try {
    const page = await browser.newPage();

    // Set viewport for better quality (portrait orientation)
    await page.setViewport({
      width: 1080,
      height: 1550,
      deviceScaleFactor: 2, // Higher resolution
    });

    // Load the HTML file
    const htmlContent = fs.readFileSync(htmlPath, "utf8");

    // Use setContent instead of goto to allow external resources to load properly
    await page.setContent(htmlContent, {
      waitUntil: "networkidle0",
    });

    // Wait for fonts to load (especially important for Dhivehi/Thaana script)
    await page.evaluateHandle('document.fonts.ready');

    // Wait for all images to load
    await page.evaluate(() => {
      return Promise.all(
        Array.from(document.images)
          .filter(img => !img.complete)
          .map(img => new Promise(resolve => {
            img.onload = resolve;
            img.onerror = resolve; // Continue even if image fails to load
          }))
      );
    });

    await new Promise(resolve => setTimeout(resolve, 1000)); // Additional safety wait

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
