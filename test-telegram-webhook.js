#!/usr/bin/env node
/**
 * Unit tests for Telegram webhook message parsing
 */

// Copy the parseDate and parseTemplateData functions from the webhook
function parseDate(dateStr) {
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

function parseTemplateData(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);

  if (lines.length === 0) {
    return { date: null, templateData: {} };
  }

  // First line should be the date
  const date = parseDate(lines[0]);

  // Parse remaining lines as key: value pairs
  const templateData = {};

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const colonIndex = line.indexOf(':');

    if (colonIndex > 0) {
      const key = line.substring(0, colonIndex).trim();
      const value = line.substring(colonIndex + 1).trim();

      // Handle comma-separated lists
      if (value.includes(',')) {
        templateData[key] = value.split(',').map(v => v.trim());
      } else {
        templateData[key] = value;
      }
    }
  }

  return { date, templateData };
}

// Test cases
const tests = [
  {
    name: "Simple date only (DD-MM-YYYY)",
    input: "15-01-2025",
    expected: {
      date: "2025-01-15",
      templateData: {}
    }
  },
  {
    name: "Date with time",
    input: "15-01-2025\ntime: 3pm",
    expected: {
      date: "2025-01-15",
      templateData: { time: "3pm" }
    }
  },
  {
    name: "Date with time and items (comma-separated)",
    input: "15-01-2025\ntime: 3pm\nitems: Tuna Bun, Creme Bun",
    expected: {
      date: "2025-01-15",
      templateData: {
        time: "3pm",
        items: ["Tuna Bun", "Creme Bun"]
      }
    }
  },
  {
    name: "Date with multiple items",
    input: "15-01-2025\ntime: 3pm\nitems: Tuna Bun, Creme Bun, Chocolate Bun",
    expected: {
      date: "2025-01-15",
      templateData: {
        time: "3pm",
        items: ["Tuna Bun", "Creme Bun", "Chocolate Bun"]
      }
    }
  },
  {
    name: "Date with extra whitespace",
    input: "  15-01-2025  \n  time: 3pm  \n  items: Tuna Bun, Creme Bun  ",
    expected: {
      date: "2025-01-15",
      templateData: {
        time: "3pm",
        items: ["Tuna Bun", "Creme Bun"]
      }
    }
  },
  {
    name: "YYYY-MM-DD format",
    input: "2025-01-15\ntime: 4pm",
    expected: {
      date: "2025-01-15",
      templateData: { time: "4pm" }
    }
  },
  {
    name: "Invalid date format",
    input: "invalid-date\ntime: 3pm",
    expected: {
      date: null,
      templateData: { time: "3pm" }
    }
  },
  {
    name: "Empty input",
    input: "",
    expected: {
      date: null,
      templateData: {}
    }
  },
  {
    name: "Multiple custom fields",
    input: "15-01-2025\ntime: 3pm\nitems: Tuna Bun, Creme Bun\nlocation: BLVQ\nnote: Fresh daily",
    expected: {
      date: "2025-01-15",
      templateData: {
        time: "3pm",
        items: ["Tuna Bun", "Creme Bun"],
        location: "BLVQ",
        note: "Fresh daily"
      }
    }
  }
];

// Run tests
console.log("🧪 Running Telegram Webhook Parse Tests\n");

let passed = 0;
let failed = 0;

tests.forEach((test, index) => {
  console.log(`Test ${index + 1}: ${test.name}`);
  console.log(`Input: ${JSON.stringify(test.input)}`);

  const result = parseTemplateData(test.input);

  const resultStr = JSON.stringify(result);
  const expectedStr = JSON.stringify(test.expected);

  if (resultStr === expectedStr) {
    console.log("✅ PASS");
    passed++;
  } else {
    console.log("❌ FAIL");
    console.log("Expected:", expectedStr);
    console.log("Got:     ", resultStr);
    failed++;
  }
  console.log("");
});

console.log("═".repeat(50));
console.log(`Results: ${passed} passed, ${failed} failed`);

if (failed > 0) {
  process.exit(1);
}
