import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const screenshotsDir = path.resolve(__dirname, '../test-screenshots/groups');

if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

const BASE_URL = 'http://localhost:5173';

async function runGroupUITests() {
  console.log('\n========================================================');
  console.log('🖥️ Starting FlowNet Frontend Group UI & Visual Verification');
  console.log('========================================================\n');

  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  });
  let totalTests = 0;
  let passedTests = 0;

  function assert(condition, message) {
    totalTests++;
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passedTests++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
    }
  }

  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });
    const page = await context.newPage();

    await page.addInitScript(() => {
      localStorage.setItem('test_mock_user', 'true');
      localStorage.setItem('flownet_lang', 'ar');
      localStorage.setItem('flownet_theme', JSON.stringify({ palette: 'cosmic', mode: 'dark' }));
    });

    // Collect console errors
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // ----------------------------------------------------
    // TEST 1: Available Groups Page (Desktop 1280px - Dark)
    // ----------------------------------------------------
    console.log('--- Test 1: Desktop 1280px Available Groups (Dark Mode) ---');
    await page.goto(`${BASE_URL}/groups`);
    await page.evaluate(() => {
      localStorage.setItem('flownet_theme', JSON.stringify({ palette: 'cosmic', mode: 'dark' }));
      localStorage.setItem('flownet_lang', 'ar');
      document.documentElement.classList.add('dark');
      document.documentElement.setAttribute('data-mode', 'dark');
      document.documentElement.setAttribute('dir', 'rtl');
    });
    await page.reload();
    await page.waitForTimeout(1000);

    // Verify "+ إنشاء مجموعة" button exists
    const createBtn = await page.$('button:has-text("إنشاء مجموعة")');
    assert(createBtn !== null, 'Prominent "+ إنشاء مجموعة" button is rendered on Available page');

    // Screenshot Available page dark
    await page.screenshot({ path: path.join(screenshotsDir, 'available_1280_dark_ar.png') });

    // Open Create Modal
    if (createBtn) {
      await createBtn.click();
      await page.waitForTimeout(500);

      // Check modal inputs and preview
      const modal = await page.$('div:has-text("إنشاء مجموعاتك +")');
      assert(modal !== null, 'Create Group Modal opened on button click');

      // Check 8 icon picker buttons
      const iconButtons = await page.$$('div.grid-cols-4 button');
      assert(iconButtons.length >= 8, `Icon picker renders all 8 icons (found: ${iconButtons.length})`);

      // Screenshot modal
      await page.screenshot({ path: path.join(screenshotsDir, 'create_modal_dark_ar.png') });

      // Close modal
      const closeBtn = await page.$('button[aria-label="إلغاء"], button[aria-label="Cancel"]');
      if (closeBtn) await closeBtn.click();
      await page.waitForTimeout(400);
    }

    // ----------------------------------------------------
    // TEST 2: Available Groups Page (Desktop 1280px - Light)
    // ----------------------------------------------------
    console.log('\n--- Test 2: Desktop 1280px Available Groups (Light Mode) ---');
    await page.evaluate(() => {
      localStorage.setItem('flownet_theme', JSON.stringify({ palette: 'cosmic', mode: 'light' }));
      document.documentElement.classList.remove('dark');
      document.documentElement.setAttribute('data-mode', 'light');
    });
    await page.reload();
    await page.waitForTimeout(1000);

    const hasCard = await page.$('.bg-app-card');
    assert(hasCard !== null, 'App cards styled properly with light theme tokens');
    await page.screenshot({ path: path.join(screenshotsDir, 'available_1280_light_ar.png') });

    // ----------------------------------------------------
    // TEST 3: Mobile 360px Viewport (Light and Dark)
    // ----------------------------------------------------
    console.log('\n--- Test 3: Mobile 360px Responsive Verification ---');
    await page.setViewportSize({ width: 360, height: 740 });
    await page.reload();
    await page.waitForTimeout(1000);

    const isOverflowingLight = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth + 2;
    });
    assert(!isOverflowingLight, 'No horizontal overflow at 360px mobile width (Light Mode)');
    await page.screenshot({ path: path.join(screenshotsDir, 'available_360_light_ar.png') });

    // Switch to dark mode mobile
    await page.evaluate(() => {
      localStorage.setItem('flownet_theme', JSON.stringify({ palette: 'cosmic', mode: 'dark' }));
      document.documentElement.classList.add('dark');
      document.documentElement.setAttribute('data-mode', 'dark');
    });
    await page.reload();
    await page.waitForSelector('.bg-app-card, h1', { timeout: 10000 });
    await page.waitForTimeout(500);

    const isOverflowingDark = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth + 2;
    });
    assert(!isOverflowingDark, 'No horizontal overflow at 360px mobile width (Dark Mode)');
    await page.screenshot({ path: path.join(screenshotsDir, 'available_360_dark_ar.png') });

    // ----------------------------------------------------
    // TEST 4: My Groups Page (/groups/joined)
    // ----------------------------------------------------
    console.log('\n--- Test 4: My Groups Page (/groups/joined) ---');
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${BASE_URL}/groups/joined`);
    await page.waitForTimeout(1000);

    const joinedTitle = await page.$('h1:has-text("مجموعاتي")');
    assert(joinedTitle !== null, 'Joined groups header rendered in Arabic');
    await page.screenshot({ path: path.join(screenshotsDir, 'joined_1280_dark_ar.png') });

    // ----------------------------------------------------
    // TEST 5: Raw i18n Key Leak Check
    // ----------------------------------------------------
    console.log('\n--- Test 5: Raw i18n Translation Key Leaks Check ---');
    const leakCheck = await page.evaluate(() => {
      const text = document.body.innerText;
      const keyPattern = /\b(groups|common|messages|notifications|profile)\.[a-zA-Z0-9_]+\b/g;
      return text.match(keyPattern) || [];
    });
    assert(leakCheck.length === 0, `No raw i18n keys leaked in DOM (leaks: ${leakCheck.length})`);

    // ----------------------------------------------------
    // TEST 6: English LTR Verification
    // ----------------------------------------------------
    console.log('\n--- Test 6: English LTR Direction & Strings ---');
    await page.goto(`${BASE_URL}/groups`);
    await page.evaluate(() => {
      localStorage.setItem('flownet_lang', 'en');
      document.documentElement.setAttribute('dir', 'ltr');
    });
    await page.reload();
    await page.waitForTimeout(1000);

    const createBtnEn = await page.$('button:has-text("Create Group")');
    assert(createBtnEn !== null, 'Prominent "+ Create Group" button rendered in English');
    await page.screenshot({ path: path.join(screenshotsDir, 'available_1280_light_en.png') });
  } catch (err) {
    console.error('Browser test error:', err);
  } finally {
    await browser.close();
    console.log('\n========================================================');
    console.log(`📊 UI Test Results: ${passedTests}/${totalTests} PASSED`);
    console.log('========================================================\n');
  }
}

runGroupUITests();
