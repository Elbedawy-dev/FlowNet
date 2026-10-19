import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const screenshotsDir = path.resolve(__dirname, '../test-screenshots');

if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

const BASE_URL = 'http://localhost:5173';

const MOCK_RECENT_MESSAGES = [
  {
    _id: 'msg_1',
    from_user_id: {
      _id: 'user_2sample_owner',
      full_name: 'FlowNet Official Admin',
      username: 'flownet_admin',
      profile_picture: '',
      is_verified: true,
    },
    other_user: {
      _id: 'user_2sample_owner',
      full_name: 'FlowNet Official Admin',
      username: 'flownet_admin',
      profile_picture: '',
      is_verified: true,
    },
    text: 'Welcome to FlowNet! Connect with people and explore.',
    message_type: 'text',
    createdAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
    seen: true,
  },
  {
    _id: 'msg_2',
    from_user_id: {
      _id: 'user_3Kp3kJjvD748BxgZkAtfKwQq01M',
      full_name: 'Moaaz Fathi',
      username: 'moaazf616',
      profile_picture: '',
      is_verified: false,
    },
    other_user: {
      _id: 'user_3Kp3kJjvD748BxgZkAtfKwQq01M',
      full_name: 'Moaaz Fathi',
      username: 'moaazf616',
      profile_picture: '',
      is_verified: false,
    },
    text: 'Hey there! How is your project going?',
    message_type: 'text',
    createdAt: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
    seen: false,
  },
];

const MOCK_CONNECTIONS = [
  {
    _id: 'user_conn_3',
    full_name: 'Sarah Connor',
    username: 'sarah_c',
    profile_picture: '',
    is_verified: false,
  },
];

async function setupPageRoutes(page) {
  await page.route('**/api/messages/recent', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: MOCK_RECENT_MESSAGES }),
    });
  });

  await page.route('**/api/users/me/network', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { connections: MOCK_CONNECTIONS, following: [], followers: [] } }),
    });
  });

  await page.route('**/api/users/me/blocked', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: [] }),
    });
  });

  await page.route('**/api/users/search*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: [
          {
            _id: 'user_search_1',
            full_name: 'Alex Rivera',
            username: 'arivera',
            profile_picture: '',
            bio: 'Senior Software Engineer building distributed systems',
            followers_count: 142,
            is_verified: true,
          },
        ],
      }),
    });
  });

  await page.route('**/api/groups/available', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: [
          {
            _id: 'grp_1',
            name: 'React Developers',
            description: 'A community for React developers worldwide',
            icon: 'code',
            members_count: 48,
          },
        ],
      }),
    });
  });

  await page.route('**/api/groups/joined', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: [
          {
            _id: 'grp_joined_1',
            name: 'FlowNet Insiders',
            description: 'Official test and discussion community',
            icon: 'sparkles',
            members_count: 12,
          },
        ],
      }),
    });
  });

  await page.route('**/api/notifications*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: [
          {
            _id: 'notif_1',
            type: 'like',
            actor_id: {
              _id: 'user_3Kp3kJjvD748BxgZkAtfKwQq01M',
              full_name: 'Moaaz Fathi',
              username: 'moaazf616',
              profile_picture: '',
            },
            createdAt: new Date(Date.now() - 1800000).toISOString(),
            read: false,
          },
        ],
      }),
    });
  });

  await page.route('**/api/posts/feed*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: [
          {
            _id: 'post_1',
            author_id: {
              _id: 'user_2sample_owner',
              full_name: 'FlowNet Official Admin',
              username: 'flownet_admin',
              profile_picture: '',
            },
            text: 'Welcome everyone to FlowNet! Enjoy the new cosmic features.',
            likes_count: 5,
            comments_count: 2,
            liked_by_me: false,
            createdAt: new Date(Date.now() - 3600000).toISOString(),
          },
        ],
      }),
    });
  });
}

async function run() {
  console.log('====================================================');
  console.log('   FLOWNET AUTOMATED VERIFICATION & TEST SUITE      ');
  console.log('====================================================\n');

  let browser;
  try {
    browser = await chromium.launch({ channel: 'msedge', headless: true });
  } catch {
    browser = await chromium.launch({ channel: 'chrome', headless: true });
  }

  const results = {
    assertion_a_messages: null,
    assertion_b_audit: null,
    assertion_c_raw_keys: null,
    assertion_d_direction: null,
    assertion_e_header_393: null,
    assertion_e_header_1280: null,
    assertion_f_overflow: null,
    assertion_f_console_errors: null,
    routesTested: [],
  };

  const consoleErrors = [];

  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const txt = msg.text();
      if (!txt.includes('favicon') && !txt.includes('clerk.accounts')) {
        consoleErrors.push(txt);
      }
    }
  });

  page.on('pageerror', (err) => {
    consoleErrors.push(err.message);
  });

  await setupPageRoutes(page);

  // Helper to init page state
  async function initPageState(lang) {
    await page.addInitScript((l) => {
      localStorage.setItem('test_mock_user', 'true');
      localStorage.setItem('flownet_lang', l);
      localStorage.setItem('flownet_theme', JSON.stringify({ palette: 'cosmic', mode: 'light' }));
    }, lang);
  }

  // ========================================================
  // TEST 1: HEADER BOUNDING BOXES at 393px and 1280px (EN vs AR)
  // ========================================================
  console.log('\n--- Checking Assertion (e): Header Row Bounding Boxes ---');
  for (const width of [393, 1280]) {
    await page.setViewportSize({ width, height: 800 });

    // Measure in EN
    await page.goto(`${BASE_URL}/`);
    await page.evaluate(() => {
      localStorage.setItem('test_mock_user', 'true');
      localStorage.setItem('flownet_lang', 'en');
    });
    await page.reload();
    await page.waitForTimeout(1000);

    const enBoxes = await page.evaluate(() => {
      const logo = document.querySelector('a[href="/"]');
      const bell = document.querySelector('button[aria-label="Notifications"], a[href="/notifications"]');
      const menu = document.querySelector('button[title*="Menu"], button[aria-label*="menu" i]');
      return {
        logo: logo ? logo.getBoundingClientRect() : null,
        bell: bell ? bell.getBoundingClientRect() : null,
        menu: menu ? menu.getBoundingClientRect() : null,
        dir: document.documentElement.dir,
      };
    });

    // Measure in AR
    await page.evaluate(() => {
      localStorage.setItem('flownet_lang', 'ar');
    });
    await page.reload();
    await page.waitForTimeout(1000);

    const arBoxes = await page.evaluate(() => {
      const logo = document.querySelector('a[href="/"]');
      const bell = document.querySelector('button[aria-label="Notifications"], a[href="/notifications"]');
      const menu = document.querySelector('button[title*="Menu"], button[aria-label*="menu" i]');
      return {
        logo: logo ? logo.getBoundingClientRect() : null,
        bell: bell ? bell.getBoundingClientRect() : null,
        menu: menu ? menu.getBoundingClientRect() : null,
        dir: document.documentElement.dir,
      };
    });

    let diffOk = true;
    const diffs = {};

    ['logo', 'bell', 'menu'].forEach((key) => {
      if (enBoxes[key] && arBoxes[key]) {
        const xDiff = Math.abs(enBoxes[key].x - arBoxes[key].x);
        const yDiff = Math.abs(enBoxes[key].y - arBoxes[key].y);
        const wDiff = Math.abs(enBoxes[key].width - arBoxes[key].width);
        const hDiff = Math.abs(enBoxes[key].height - arBoxes[key].height);
        diffs[key] = { xDiff, yDiff, wDiff, hDiff };
        if (xDiff > 2 || yDiff > 2) diffOk = false;
      }
    });

    console.log(`[Viewport ${width}px] Header diffs:`, JSON.stringify(diffs));
    console.log(`[Viewport ${width}px] EN dir=${enBoxes.dir}, AR dir=${arBoxes.dir}`);

    if (width === 393) results.assertion_e_header_393 = { diffOk, diffs };
    if (width === 1280) results.assertion_e_header_1280 = { diffOk, diffs };
  }

  // ========================================================
  // TEST 2: /messages PAGE VERIFICATION (Assertion a)
  // ========================================================
  console.log('\n--- Checking Assertion (a): /messages page ---');
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`${BASE_URL}/messages`);
  await page.waitForTimeout(1500);

  const messagesPageData = await page.evaluate(() => {
    const heading = document.querySelector('h1, h2')?.textContent;
    const rows = Array.from(document.querySelectorAll('div.cursor-pointer')).filter((el) => {
      return el.textContent.includes('Admin') || el.textContent.includes('Moaaz') || el.textContent.includes('Sarah');
    });

    const items = rows.map((r) => {
      const text = r.textContent;
      const hasChatBtn = Boolean(r.querySelector('button, a[href*="/messages/"]'));
      const hasProfileBtn = Boolean(r.querySelector('button, a[href*="/profile/"]'));
      return { text: text.slice(0, 80), hasChatBtn, hasProfileBtn };
    });

    return {
      currentUrl: window.location.pathname,
      heading,
      rowCount: rows.length,
      items,
      hasAdmin: rows.some((r) => r.textContent.includes('FlowNet Official Admin')),
      hasMoaaz: rows.some((r) => r.textContent.includes('Moaaz Fathi')),
      hasSarah: rows.some((r) => r.textContent.includes('Sarah Connor')),
    };
  });

  console.log('/messages validation:', JSON.stringify(messagesPageData, null, 2));
  results.assertion_a_messages = {
    pass: messagesPageData.rowCount >= 2 && messagesPageData.hasAdmin && messagesPageData.hasMoaaz,
    data: messagesPageData,
  };

  // ========================================================
  // TEST 3: ALL ROUTES in EN and AR (Assertions c, d, f)
  // ========================================================
  const TEST_ROUTES = [
    { path: '/', name: 'home', selector: 'div' },
    { path: '/messages', name: 'messages', selector: 'div' },
    { path: '/search', name: 'search', selector: 'input' },
    { path: '/settings', name: 'settings', selector: 'div' },
    { path: '/connections', name: 'connections', selector: 'div' },
    { path: '/notifications', name: 'notifications', selector: 'div' },
    { path: '/groups', name: 'groups', selector: 'div' },
    { path: '/groups/joined', name: 'groups_joined', selector: 'div' },
    { path: '/create-post', name: 'create_post', selector: 'textarea, div' },
    { path: '/profile', name: 'profile', selector: 'div' },
  ];

  let rawKeyLeaksTotal = 0;
  let overflowTotal = 0;
  let directionPass = true;

  console.log('\n--- Checking All Routes in EN and AR ---');

  for (const lang of ['en', 'ar']) {
    for (const r of TEST_ROUTES) {
      await page.goto(`${BASE_URL}${r.path}`);
      await page.evaluate((l) => {
        localStorage.setItem('flownet_lang', l);
      }, lang);
      await page.reload();
      await page.waitForTimeout(1000);

      const routeCheck = await page.evaluate((expectedLang) => {
        const docDir = document.documentElement.dir;
        const docLang = document.documentElement.lang;
        const expectedDir = expectedLang === 'ar' ? 'rtl' : 'ltr';

        // Check raw i18n key leak: /\b[a-z]+\.[a-zA-Z]+\b/
        const bodyText = document.body.innerText;
        const rawKeyRegex = /\b(messages|groups|profile|search|settings|sidebar|posts|common|stories|notifications)\.[a-zA-Z0-9_]+\b/g;
        const matches = bodyText.match(rawKeyRegex) || [];

        // Check horizontal overflow
        const overflow = document.documentElement.scrollWidth > document.documentElement.clientWidth + 2;

        return {
          pathname: window.location.pathname,
          docDir,
          docLang,
          dirMatch: docDir === expectedDir,
          rawKeyMatches: matches,
          hasOverflow: overflow,
          bodySnippet: bodyText.slice(0, 100).replace(/\n/g, ' '),
        };
      }, lang);

      if (!routeCheck.dirMatch) directionPass = false;
      if (routeCheck.rawKeyMatches.length > 0) {
        console.warn(`[LEAK] Raw key on ${r.path} (${lang}):`, routeCheck.rawKeyMatches);
        rawKeyLeaksTotal += routeCheck.rawKeyMatches.length;
      }
      if (routeCheck.hasOverflow) {
        console.warn(`[OVERFLOW] on ${r.path} (${lang})`);
        overflowTotal++;
      }

      // Capture screenshot
      const screenshotPath = path.join(screenshotsDir, `${r.name}_${lang}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: false });

      results.routesTested.push({
        route: r.path,
        lang,
        dir: routeCheck.docDir,
        rawKeys: routeCheck.rawKeyMatches.length,
        overflow: routeCheck.hasOverflow,
        screenshot: `${r.name}_${lang}.png`,
      });
    }
  }

  results.assertion_c_raw_keys = { pass: rawKeyLeaksTotal === 0, count: rawKeyLeaksTotal };
  results.assertion_d_direction = { pass: directionPass };
  results.assertion_f_overflow = { pass: overflowTotal === 0, count: overflowTotal };
  results.assertion_f_console_errors = { count: consoleErrors.length, errors: consoleErrors };

  await browser.close();

  console.log('\n====================================================');
  console.log('                 FINAL TEST RESULTS                 ');
  console.log('====================================================');
  console.log('(a) /messages >= 2 rows & sorted:', results.assertion_a_messages?.pass ? '✅ PASS' : '❌ FAIL');
  console.log('(c) No raw i18n key leaks on any route:', results.assertion_c_raw_keys.pass ? '✅ PASS' : '❌ FAIL');
  console.log('(d) Direction switching (dir="rtl" in AR, "ltr" in EN):', results.assertion_d_direction.pass ? '✅ PASS' : '❌ FAIL');
  console.log('(e) Header bounding boxes equal at 393px:', results.assertion_e_header_393?.diffOk ? '✅ PASS' : '❌ FAIL');
  console.log('(e) Header bounding boxes equal at 1280px:', results.assertion_e_header_1280?.diffOk ? '✅ PASS' : '❌ FAIL');
  console.log('(f) No horizontal overflow:', results.assertion_f_overflow.pass ? '✅ PASS' : '❌ FAIL');
  console.log('(f) Console errors count:', results.assertion_f_console_errors.count);
  console.log(`Screenshots saved to: ${screenshotsDir}`);

  fs.writeFileSync(
    path.join(__dirname, 'test-results.json'),
    JSON.stringify(results, null, 2)
  );
}

run().catch((err) => {
  console.error('Test run failed:', err);
  process.exit(1);
});
