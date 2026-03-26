#!/usr/bin/env node
/**
 * duplicate-test-content.js
 *
 * Generates synthetic blog posts under web/content/blog/test-pagination/
 * to test pagination, sort, and search functionality.
 *
 * Usage: node scripts/duplicate-test-content.js [count=40]
 */

"use strict";

const fs = require("fs");
const path = require("path");

const COUNT = parseInt(process.argv[2] || "40", 10);
const OUT_DIR = path.join(__dirname, "..", "web", "content", "blog", "test-pagination");
const SOURCE_DIR = path.join(__dirname, "..", "web", "content", "blog");

// Collect real posts as templates (skip test-pagination subdir)
const sources = fs
  .readdirSync(SOURCE_DIR)
  .filter((f) => f.endsWith(".md"))
  .map((f) => path.join(SOURCE_DIR, f));

if (!sources.length) {
  console.error("No source .md files found in web/content/blog/");
  process.exit(1);
}

fs.mkdirSync(OUT_DIR, { recursive: true });

const TAGS = ["test", "pagination", "demo", "engineering", "thoughts"];
const CATEGORIES = ["Engineering", "Misc", "Demo"];

let created = 0;
for (let i = 1; i <= COUNT; i++) {
  const template = fs.readFileSync(sources[(i - 1) % sources.length], "utf-8");
  const dateOffset = i * 3; // days ago
  const d = new Date(Date.now() - dateOffset * 86400000);
  const isoDate = d.toISOString().slice(0, 10);
  const tag = TAGS[i % TAGS.length];
  const category = CATEGORIES[i % CATEGORIES.length];
  const slug = `test-dupe-${i}`;
  const title = `Test Post ${i} — Pagination Demo`;

  // Replace frontmatter
  const updated = template
    .replace(/^---[\s\S]*?---/m, () =>
      [
        "---",
        `title: "${title}"`,
        `date: ${isoDate}`,
        `tags: [${tag}, test]`,
        `category: ${category}`,
        `slug: ${slug}`,
        `summary: "This is synthetic test post number ${i} used to validate pagination."`,
        "---",
      ].join("\n"),
    )
    // Append a distinct footer so each post has unique content
    .trimEnd() + `\n\n> _Synthetic test post #${i} — safe to delete._\n`;

  const outFile = path.join(OUT_DIR, `${slug}.md`);
  fs.writeFileSync(outFile, updated, "utf-8");
  created++;
}

console.log(`✓ Created ${created} test posts in web/content/blog/test-pagination/`);
console.log("  Run 'npm run build' to rebuild metadata, then check /blog/dir/test-pagination.");
console.log("  When done: node scripts/clean-test-content.js");
