#!/usr/bin/env node
/**
 * Test script for POST /api/posters/generate endpoint
 *
 * Usage:
 *   node test-generate-endpoint.js <server-url> <chat-id> <date> [templateData-json]
 *
 * Examples:
 *   node test-generate-endpoint.js http://localhost:3333 418289202 2026-01-13
 *   node test-generate-endpoint.js https://poster-generator-bot.onrender.com 418289202 2026-01-13 '{"time":"3pm","items":["Tuna Bun","Creme Bun"]}'
 */

const https = require('https');
const http = require('http');

// Parse command line arguments
const [,, serverUrl, chatId, date, templateDataJson] = process.argv;

if (!serverUrl || !chatId || !date) {
  console.error('Usage: node test-generate-endpoint.js <server-url> <chat-id> <date> [templateData-json]');
  console.error('Example: node test-generate-endpoint.js http://localhost:3333 418289202 2026-01-13');
  process.exit(1);
}

// Parse templateData if provided
let templateData = null;
if (templateDataJson) {
  try {
    templateData = JSON.parse(templateDataJson);
  } catch (e) {
    console.error('Error parsing templateData JSON:', e.message);
    process.exit(1);
  }
}

// Prepare request body
const requestBody = {
  chatId,
  date,
};

if (templateData) {
  requestBody.templateData = templateData;
}

const bodyString = JSON.stringify(requestBody);

console.log('🧪 Testing POST /api/posters/generate');
console.log('📍 Server:', serverUrl);
console.log('📦 Request body:', JSON.stringify(requestBody, null, 2));
console.log('');

// Parse URL
const url = new URL(serverUrl);
const isHttps = url.protocol === 'https:';
const httpModule = isHttps ? https : http;

// Make request
const options = {
  hostname: url.hostname,
  port: url.port || (isHttps ? 443 : 80),
  path: '/api/posters/generate',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(bodyString),
  },
};

const startTime = Date.now();

const req = httpModule.request(options, (res) => {
  const duration = Date.now() - startTime;

  console.log('📊 Response Status:', res.statusCode);
  console.log('⏱️  Duration:', duration, 'ms');
  console.log('📋 Headers:', JSON.stringify(res.headers, null, 2));
  console.log('');

  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('📄 Response Body:');
    try {
      const parsed = JSON.parse(data);
      console.log(JSON.stringify(parsed, null, 2));

      if (res.statusCode === 200 && parsed.posterUrl) {
        console.log('');
        console.log('✅ SUCCESS! Poster generated at:', parsed.posterUrl);
      } else if (parsed.error) {
        console.log('');
        console.log('❌ ERROR:', parsed.error);
      }
    } catch (e) {
      console.log(data);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Request failed:', error.message);
  process.exit(1);
});

req.write(bodyString);
req.end();
