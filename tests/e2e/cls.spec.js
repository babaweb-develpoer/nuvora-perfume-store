// Cumulative layout shift (Task 17b): every public page, at three widths, must
// stay under CLS 0.05 measured from navigation start. That includes the shell
// (header, the optional notice strip, footer) that ui.js injects after parsing, and content
// that page scripts render into containers. Nothing here excludes the header
// injection.
//
// Deterministic: Google Fonts requests are aborted so the result never depends on
// the network; state (cart, order) is seeded in an init script, i.e. before any
// page script runs, so seeding itself cannot shift anything. ui.js (which injects
// the shell and, with the page scripts after it, renders the content) is served
// after a short delay: on file:// the parser otherwise often finishes before the
// first paint and hides the problem, while on a real network the browser paints
// the empty page first. The delay makes that worst case the one under test.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { pageUrl, root } = require('./helpers');

const BUDGET = 0.05;
const SLOW_SCRIPT_MS = 400;
const KEY = 'maison_demo_v1';
const WIDTHS = [
  { name: '375', width: 375, height: 812 },
  { name: '768', width: 768, height: 1024 },
  { name: '1280', width: 1280, height: 800 },
];

const ORDER = {
  number: 'ORD-123456',
  createdAt: '2026-10-10T09:30:00.000Z',
  status: 'Confirmed',
  customer: {
    name: 'Ayesha Khan', phone: '03001234567', email: 'ayesha@example.com',
    province: 'Punjab', city: 'Lahore', address: 'House 4, Street 9, Gulberg III', notes: '',
  },
  lines: [{ productId: 'mn-01', ml: 50, qty: 1, gift: false }, { productId: 'au-01', ml: 30, qty: 2, gift: false }],
  totals: { subtotal: 36400, giftWrap: 0, discount: 0, delivery: 0, total: 36400 },
  code: '',
};

const CART = [{ productId: 'mn-01', ml: 50, qty: 1, gift: false }, { productId: 'au-01', ml: 30, qty: 1, gift: false }];

// name = html file, query = optional query string, state = what to seed into storage
const PAGES = [
  { name: 'index' },
  { name: 'shop' },
  { name: 'product', query: '?id=mn-01' },
  { name: 'cart', state: { cart: CART } },
  { name: 'checkout', state: { cart: CART } },
  { name: 'wishlist', state: { wishlist: ['mn-01', 'au-01', 'vn-02'] } },
  { name: 'track-order' },
  { name: 'scent-quiz' },
  { name: 'brands' },
  { name: 'about' },
  { name: 'contact' },
  { name: 'faq' },
  { name: 'shipping-returns' },
  { name: 'fragrance-guide' },
  { name: '404' },
  { name: 'order-confirmation', query: '?order=' + ORDER.number, state: { orders: [ORDER] } },
  { name: 'admin' },
];

for (const w of WIDTHS) {
  for (const p of PAGES) {
    test(`cls: ${p.name} at ${w.name}px stays under ${BUDGET}`, async ({ page }) => {
      await page.setViewportSize({ width: w.width, height: w.height });
      await page.route(/fonts\.googleapis\.com|fonts\.gstatic\.com/, (route) => route.abort());
      await page.route(/\/assets\/js\/ui\.js$/, async (route) => {
        const body = fs.readFileSync(path.join(root, 'assets', 'js', 'ui.js'), 'utf8');
        await new Promise((r) => setTimeout(r, SLOW_SCRIPT_MS));
        await route.fulfill({ status: 200, contentType: 'application/javascript', body });
      });

      const state = JSON.stringify(Object.assign({ cart: [], wishlist: [], reviews: [], orders: [], code: '' }, p.state || {}));
      await page.addInitScript(({ key, state }) => {
        try { localStorage.setItem(key, state); } catch (e) { /* ignore */ }
        window.__cls = { total: 0, shifts: [] };
        const describe = (n) => {
          if (!n) return '?';
          if (n.nodeType !== 1) return '#' + n.nodeName;
          const id = n.id ? '#' + n.id : '';
          const cls = n.className && typeof n.className === 'string' ? '.' + n.className.trim().split(/\s+/).join('.') : '';
          return n.nodeName.toLowerCase() + id + cls;
        };
        new PerformanceObserver((list) => {
          for (const e of list.getEntries()) {
            if (e.hadRecentInput) continue;
            window.__cls.total += e.value;
            window.__cls.shifts.push({
              t: Math.round(e.startTime),
              v: +e.value.toFixed(4),
              nodes: (e.sources || []).map((s) => describe(s.node) + ' ' + Math.round(s.previousRect.y) + '->' + Math.round(s.currentRect.y)),
            });
          }
        }).observe({ type: 'layout-shift', buffered: true });
      }, { key: KEY, state });

      await page.goto(pageUrl(p.name) + (p.query || ''), { waitUntil: 'load' });
      await page.waitForTimeout(1200);

      const cls = await page.evaluate(() => window.__cls);
      const detail = cls.shifts.map((s) => `  t=${s.t}ms value=${s.v} ${s.nodes.join(' | ')}`).join('\n');
      expect(cls.total, `CLS ${cls.total.toFixed(4)} on ${p.name} at ${w.name}px:\n${detail}`).toBeLessThan(BUDGET);
    });
  }
}

// ---------------------------------------------------------------------------
// config.js ships with demoBanner: false (the notice strip is opt-in). These
// serve config.js with the strip switched on or off, so both layouts stay covered.

async function routeBanner(page, on) {
  await page.route(/\/assets\/js\/config\.js$/, async (route) => {
    const src = fs.readFileSync(path.join(root, 'assets', 'js', 'config.js'), 'utf8');
    if (!/demoBanner:\s*(true|false)/.test(src)) throw new Error('config.js no longer contains "demoBanner: true|false"');
    const body = src.replace(/demoBanner:\s*(true|false)/, 'demoBanner: ' + on);
    await route.fulfill({ status: 200, contentType: 'application/javascript', body });
  });
}

test('cls: config.js ships with the notice strip off (demoBanner: false)', () => {
  const src = fs.readFileSync(path.join(root, 'assets', 'js', 'config.js'), 'utf8');
  expect(src).toMatch(/demoBanner:\s*false/);
});

// The reservation for the shell must equal the real header + banner, at every
// width (the header is 64px under 900px and 76px from 900px; the banner is a
// fixed-height token), or the swap itself would shift the page.

for (const width of [320, 375, 600, 768, 899, 900, 1024, 1280, 1920]) {
  test(`cls: banner on: the shell reservation equals the real header and banner at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route(/fonts\.googleapis\.com|fonts\.gstatic\.com/, (route) => route.abort());
    await routeBanner(page, true);
    let release;
    const gate = new Promise((r) => { release = r; });
    await page.route(/\/assets\/js\/ui\.js$/, async (route) => {
      await gate;
      await route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(path.join(root, 'assets', 'js', 'ui.js'), 'utf8') });
    });
    const nav = page.goto(pageUrl('about'), { waitUntil: 'commit' });
    await page.waitForSelector('main#main', { state: 'attached' });
    await nav.catch(() => {});
    // Shell not mounted yet: where does the content start?
    const before = await page.evaluate(() => ({
      ready: document.body.classList.contains('shell-ready'),
      top: Math.round(document.getElementById('main').getBoundingClientRect().top * 10) / 10,
    }));
    expect(before.ready).toBe(false);
    release();
    await page.waitForFunction(() => document.body.classList.contains('shell-ready'));
    const after = await page.evaluate(() => ({
      top: Math.round(document.getElementById('main').getBoundingClientRect().top * 10) / 10,
      header: document.getElementById('site-header').getBoundingClientRect().height,
      banner: document.getElementById('demo-banner').getBoundingClientRect().height,
    }));
    expect(after.top).toBe(before.top);
    expect(after.banner).toBeCloseTo(36.2, 1);
    expect(after.header).toBe(width >= 900 ? 76 : 64);
    // the strip shows the concept notice on one line, never cut off
    const strip = await page.evaluate(() => {
      const b = document.getElementById('demo-banner');
      return { text: b.innerText.trim(), sw: b.scrollWidth, cw: b.clientWidth };
    });
    expect(strip.text).toMatch(/Orders and messages are not delivered\.$/);
    expect(strip.text).not.toMatch(/demo|illustrative/i);
    expect(strip.sw, 'strip text fits').toBeLessThanOrEqual(strip.cw);
  });
}

// ---------------------------------------------------------------------------
// Task 17d: demoBanner switches the strip. With it off (the default), the shell
// reservation must drop the banner height (config.js tags <html class="no-banner">
// before first paint), or every page jumps up by 36px and shows a blank band.

const NO_BANNER_PAGES = [
  { name: 'index' },
  { name: 'shop' },
  { name: 'product', query: '?id=mn-01' },
  { name: 'cart', state: { cart: [{ productId: 'mn-01', ml: 50, qty: 1, gift: false }] } },
  { name: 'faq' },
];

for (const w of [WIDTHS[0], WIDTHS[2]]) {
  for (const p of NO_BANNER_PAGES) {
    test(`cls: demoBanner off: ${p.name} at ${w.name}px stays under ${BUDGET}`, async ({ page }) => {
      await page.setViewportSize({ width: w.width, height: w.height });
      await page.route(/fonts\.googleapis\.com|fonts\.gstatic\.com/, (route) => route.abort());
      await routeBanner(page, false);
      await page.route(/\/assets\/js\/ui\.js$/, async (route) => {
        const body = fs.readFileSync(path.join(root, 'assets', 'js', 'ui.js'), 'utf8');
        await new Promise((r) => setTimeout(r, SLOW_SCRIPT_MS));
        await route.fulfill({ status: 200, contentType: 'application/javascript', body });
      });
      const state = JSON.stringify(Object.assign({ cart: [], wishlist: [], reviews: [], orders: [], code: '' }, p.state || {}));
      await page.addInitScript(({ key, state }) => {
        try { localStorage.setItem(key, state); } catch (e) { /* ignore */ }
        window.__cls = { total: 0, shifts: [] };
        new PerformanceObserver((list) => {
          for (const e of list.getEntries()) {
            if (e.hadRecentInput) continue;
            window.__cls.total += e.value;
            window.__cls.shifts.push({ t: Math.round(e.startTime), v: +e.value.toFixed(4), n: (e.sources||[]).map(s=>(s.node&&s.node.className||s.node&&s.node.nodeName)+' '+Math.round(s.previousRect.y)+'->'+Math.round(s.currentRect.y)) });
          }
        }).observe({ type: 'layout-shift', buffered: true });
      }, { key: KEY, state });

      await page.goto(pageUrl(p.name) + (p.query || ''), { waitUntil: 'load' });
      await page.waitForTimeout(1200);

      expect(await page.evaluate(() => !document.getElementById('demo-banner'))).toBe(true);
      const cls = await page.evaluate(() => window.__cls);
      expect(cls.total, `CLS ${cls.total.toFixed(4)} with the banner off on ${p.name} at ${w.name}px: ${JSON.stringify(cls.shifts)}`).toBeLessThan(BUDGET);
      // The unfixed 36px jump scores 0.025 to 0.043, i.e. it can sneak under the 0.05 budget
      // on its own; so also require that no shift involves the shell or the page frame.
      const shell = cls.shifts.filter((sh) => sh.n.some((n) => /^(MAIN|header|site-header|demo-banner|skip-link|BODY|HTML)/i.test(n)));
      expect(shell, 'the shell swap must not shift anything').toEqual([]);
    });
  }
}

for (const width of [375, 1280]) {
  test(`cls: demoBanner off: main does not move when the shell mounts at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route(/fonts\.googleapis\.com|fonts\.gstatic\.com/, (route) => route.abort());
    await routeBanner(page, false);
    let release;
    const gate = new Promise((r) => { release = r; });
    await page.route(/\/assets\/js\/ui\.js$/, async (route) => {
      await gate;
      await route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(path.join(root, 'assets', 'js', 'ui.js'), 'utf8') });
    });
    const nav = page.goto(pageUrl('about'), { waitUntil: 'commit' });
    await page.waitForSelector('main#main', { state: 'attached' });
    await nav.catch(() => {});
    const top = () => page.evaluate(() => Math.round(document.getElementById('main').getBoundingClientRect().top * 10) / 10);
    const before = { ready: await page.evaluate(() => document.body.classList.contains('shell-ready')), top: await top() };
    expect(before.ready).toBe(false);
    // The reservation is the header alone: 64 under 900px, 76 from 900px.
    expect(before.top).toBe(width >= 900 ? 76 : 64);
    release();
    await page.waitForFunction(() => document.body.classList.contains('shell-ready'));
    expect(await top()).toBe(before.top);
    expect(await page.evaluate(() => document.documentElement.classList.contains('no-banner'))).toBe(true);
  });
}

test('cls: every page loads config.js synchronously in <head>, so <html class="no-banner"> is set before first paint', () => {
  const pages = fs.readdirSync(root).filter((f) => /\.html$/.test(f));
  expect(pages.length).toBeGreaterThan(15);
  for (const f of pages) {
    const src = fs.readFileSync(path.join(root, f), 'utf8');
    const head = (/<head[\s\S]*?<\/head>/i.exec(src) || [''])[0];
    expect(head, f).toMatch(/<script src="assets\/js\/config\.js"><\/script>/);
    expect(src.split('assets/js/config.js').length - 1, f + ' loads config.js once').toBe(1);
  }
});

test('cls: demoBanner on (opt-in) does not tag <html> and still reserves the banner', async ({ page }) => {
  await page.route(/fonts\.googleapis\.com|fonts\.gstatic\.com/, (route) => route.abort());
  await routeBanner(page, true);
  await page.goto(pageUrl('about'));
  expect(await page.evaluate(() => document.documentElement.classList.contains('no-banner'))).toBe(false);
  await expect(page.locator('#demo-banner')).toBeVisible();
});

test('cls: the default config (demoBanner off) tags <html class="no-banner"> and mounts no strip', async ({ page }) => {
  await page.route(/fonts\.googleapis\.com|fonts\.gstatic\.com/, (route) => route.abort());
  await page.goto(pageUrl('about'));
  expect(await page.evaluate(() => document.documentElement.classList.contains('no-banner'))).toBe(true);
  await expect(page.locator('#demo-banner')).toHaveCount(0);
});

test('cls: a throw late in mountShell cannot leave a double gap (shell-ready is set once the header is in)', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.route(/fonts\.googleapis\.com|fonts\.gstatic\.com/, (route) => route.abort());
  await page.route(/\/assets\/js\/ui\.js$/, async (route) => {
    const src = fs.readFileSync(path.join(root, 'assets', 'js', 'ui.js'), 'utf8');
    const body = src.replace(/(\n\s*)watchFab\(\);/, "$1throw new Error('late failure in mountShell');");
    if (body === src) throw new Error('ui.js: watchFab(); call not found');
    await route.fulfill({ status: 200, contentType: 'application/javascript', body });
  });
  page.on('pageerror', () => {});
  await page.goto(pageUrl('about'));
  await page.waitForTimeout(300);
  const r = await page.evaluate(() => ({
    ready: document.body.classList.contains('shell-ready'),
    header: !!document.getElementById('site-header'),
    top: Math.round(document.getElementById('main').getBoundingClientRect().top),
  }));
  expect(r.header).toBe(true);
  expect(r.ready).toBe(true);
  // header (76) once (no strip by default), never plus the reservation as well
  expect(r.top).toBeLessThan(120);
});

test('cls: with JavaScript disabled no blank band is reserved above the content', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  await page.goto(pageUrl('about'));
  const top = await page.evaluate(() => document.getElementById('main').getBoundingClientRect().top).catch(() => null);
  // page.evaluate still works with scripting disabled in the page (it runs via the protocol)
  expect(top).not.toBeNull();
  expect(top).toBeLessThan(20);
  await context.close();
});
