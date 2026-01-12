const {join} = require('path');

/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
  cacheDirectory: join(__dirname, '.cache', 'puppeteer'),
  // Skip Chromium download in production since we install Chrome via render-build.sh
  skipDownload: process.env.NODE_ENV === 'production',
};
