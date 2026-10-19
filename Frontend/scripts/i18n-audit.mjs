import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcDir = path.resolve(__dirname, '../src');

// Import translations
import en from '../src/i18n/en.js';
import ar from '../src/i18n/ar.js';

function flattenKeys(obj, prefix = '') {
  let keys = [];
  for (const [k, v] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      keys = keys.concat(flattenKeys(v, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

const enKeys = new Set(flattenKeys(en));
const arKeys = new Set(flattenKeys(ar));

// Walk src directory
function walkDir(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (file !== 'i18n' && file !== 'node_modules' && file !== 'dist') {
        walkDir(fullPath, fileList);
      }
    } else if (file.endsWith('.jsx') || file.endsWith('.js')) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

const srcFiles = walkDir(srcDir);
const usedKeys = new Map(); // key -> Set(files)

const tRegex = /\bt\(\s*['"]([a-zA-Z0-9_.]+)['"]/g;

for (const filePath of srcFiles) {
  const content = fs.readFileSync(filePath, 'utf-8');
  let match;
  while ((match = tRegex.exec(content)) !== null) {
    const key = match[1];
    if (!usedKeys.has(key)) {
      usedKeys.set(key, new Set());
    }
    const relPath = path.relative(srcDir, filePath);
    usedKeys.get(key).add(relPath);
  }
}

console.log('==============================================');
console.log('           FLOWNET i18n AUDIT REPORT          ');
console.log('==============================================\n');
console.log(`Scanned ${srcFiles.length} source files.`);
console.log(`Found ${usedKeys.size} unique i18n keys used in code.`);
console.log(`Defined keys: EN = ${enKeys.size}, AR = ${arKeys.size}\n`);

// 1. Missing in EN
const missingInEn = [];
for (const [key, files] of usedKeys.entries()) {
  if (!enKeys.has(key)) {
    missingInEn.push({ key, files: Array.from(files) });
  }
}

// 2. Missing in AR
const missingInAr = [];
for (const [key, files] of usedKeys.entries()) {
  if (!arKeys.has(key)) {
    missingInAr.push({ key, files: Array.from(files) });
  }
}

// 3. Keys in EN missing in AR
const enMissingInAr = [];
for (const key of enKeys) {
  if (!arKeys.has(key)) {
    enMissingInAr.push(key);
  }
}

// 4. Keys in AR missing in EN
const arMissingInEn = [];
for (const key of arKeys) {
  if (!enKeys.has(key)) {
    arMissingInEn.push(key);
  }
}

// 5. Unused keys
const unusedKeys = [];
for (const key of enKeys) {
  if (!usedKeys.has(key)) {
    unusedKeys.push(key);
  }
}

console.log('--- AUDIT RESULTS ---');
console.log(`1. Keys used in code but missing in EN: ${missingInEn.length}`);
if (missingInEn.length > 0) {
  missingInEn.forEach(({ key, files }) => {
    console.log(`   ❌ ${key} (used in: ${files.join(', ')})`);
  });
}

console.log(`\n2. Keys used in code but missing in AR: ${missingInAr.length}`);
if (missingInAr.length > 0) {
  missingInAr.forEach(({ key, files }) => {
    console.log(`   ❌ ${key} (used in: ${files.join(', ')})`);
  });
}

console.log(`\n3. Keys defined in EN but missing in AR: ${enMissingInAr.length}`);
if (enMissingInAr.length > 0) {
  enMissingInAr.slice(0, 20).forEach((k) => console.log(`   ⚠️ EN has '${k}', but AR does not`));
  if (enMissingInAr.length > 20) console.log(`   ... and ${enMissingInAr.length - 20} more`);
}

console.log(`\n4. Keys defined in AR but missing in EN: ${arMissingInEn.length}`);
if (arMissingInEn.length > 0) {
  arMissingInEn.slice(0, 20).forEach((k) => console.log(`   ⚠️ AR has '${k}', but EN does not`));
  if (arMissingInEn.length > 20) console.log(`   ... and ${arMissingInEn.length - 20} more`);
}

console.log(`\n5. Keys defined in EN but unreferenced in code: ${unusedKeys.length} (Informational)`);

const totalMissing = missingInEn.length + missingInAr.length + enMissingInAr.length + arMissingInEn.length;
console.log('\n==============================================');
if (totalMissing === 0) {
  console.log('✅ AUDIT PASSED: 0 missing keys in EN and AR!');
  process.exit(0);
} else {
  console.log(`❌ AUDIT FAILED: ${totalMissing} total discrepancies found.`);
  process.exit(1);
}
