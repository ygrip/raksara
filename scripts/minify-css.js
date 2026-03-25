const fs = require('fs');
const path = require('path');

// Read original CSS
const cssPath = path.join(__dirname, '../web/styles.css');
const css = fs.readFileSync(cssPath, 'utf-8');

// Simple but effective minification
let minified = css
  // Remove comments
  .replace(/\/\*[\s\S]*?\*\//g, '')
  // Remove newlines
  .replace(/\n/g, ' ')
  // Remove multiple spaces
  .replace(/\s+/g, ' ')
  // Remove space before {
  .replace(/\s+{/g, '{')
  // Remove space after {
  .replace(/{\s+/g, '{')
  // Remove space before }
  .replace(/\s+}/g, '}')
  // Remove space after ,
  .replace(/,\s+/g, ',')
  // Remove space before :
  .replace(/\s+:/g, ':')
  // Remove space after :
  .replace(/:\s+/g, ':')
  // Remove space before ;
  .replace(/\s+;/g, ';')
  // Remove space after ;
  .replace(/;\s+/g, ';')
  // Remove trailing spaces
  .trim();

// Write minified version
const outPath = path.join(__dirname, '../web/styles.min.css');
fs.writeFileSync(outPath, minified, 'utf-8');

const originalSize = css.length;
const minifiedSize = minified.length;
const savings = ((1 - minifiedSize/originalSize) * 100).toFixed(2);

console.log(`✓ CSS Minification complete!`);
console.log(`  Original: ${(originalSize/1024).toFixed(2)} KB`);
console.log(`  Minified: ${(minifiedSize/1024).toFixed(2)} KB`);
console.log(`  Savings: ${savings}%`);
console.log(`  Output: web/styles.min.css`);
