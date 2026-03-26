#!/usr/bin/env node
/**
 * clean-test-content.js
 *
 * Removes the synthetic test-pagination directory created by duplicate-test-content.js.
 *
 * Usage: node scripts/clean-test-content.js
 */

"use strict";

const fs = require("fs");
const path = require("path");

const TARGET = path.join(__dirname, "..", "web", "content", "blog", "test-pagination");

if (!fs.existsSync(TARGET)) {
  console.log("Nothing to clean — test-pagination directory not found.");
  process.exit(0);
}

fs.rmSync(TARGET, { recursive: true, force: true });
console.log("✓ Removed web/content/blog/test-pagination/");
console.log("  Run 'npm run build' to rebuild metadata.");
