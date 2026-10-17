// Portfolio framing (final fix wave): the site is a developer's showcase of a
// fictional store called Nuvora. Nothing user-facing may say "demo", call itself
// illustrative or show an example.com address; contact details are fictional and
// non-functional (no WhatsApp number, so no wa.me link anywhere); the footer
// always carries the concept-store notice, and so does every form that takes
// personal details. Also: header fit at phone widths, the optional credit and
// "Behind the build" row, JSON-LD escaping, and the gift-wrap price label.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { pageUrl, collectErrors, routeConfig, root } = require('./helpers');

const KEY = 'maison_demo_v1';
const PAGES = fs.readdirSync(root).filter((f) => f.endsWith('.html')).map((f) => f.slice(0, -5)).sort();
const NOTICE = 'Concept store: orders and messages are not delivered.';
const BANNED = [/\bdemo\b/i, /illustrative/i, /example\.com/i, /Maison Demo/i];

const ORDER = {
  number: 'ORD-482913',
  createdAt: '2026-10-16T09:30:00.000Z', // a Friday
  status: 'Placed',
  customer: { name: 'Sana Malik', phone: '03001234567', email: '', province: 'Punjab', city: 'Lahore', address: 'House 12, Street 4', notes: '' },
  lines: [{ productId: 'mn-01', ml: 50, qty: 1, gift: false }],
  totals: { subtotal: 12400, giftWrap: 0, discount: 0, delivery: 0, total: 12400 },
  code: '',
};

// The rendered pages, with the state that makes them show their real content.
const RENDERED = PAGES.map((name) => {
  if (name === 'product') return { name, query: '?id=mn-01' };
  if (name === 'order-confirmation') return { name, query: '?order=' + ORDER.number, state: { orders: [ORDER] } };
  if (name === 'cart' || name === 'checkout') return { name, state: { cart: [{ productId: 'mn-01', ml: 50, qty: 1, gift: false }] } };
  return { name };
});

async function seed(page, state) {
  const blob = JSON.stringify(Object.assign({ cart: [], wishlist: [], reviews: [], orders: [], code: '' }, state || {}));
  await page.addInitScript(({ key, blob }) => { try { localStorage.setItem(key, blob); } catch (e) { /* ignore */ } }, { key: KEY, blob });
}

function banned(text) {
  return BANNED.filter((re) => re.test(text)).map((re) => {
    const m = re.exec(text);
    return re + ' -> "' + text.slice(Math.max(0, m.index - 40), m.index + 40).replace(/\s+/g, ' ') + '"';
  });
}

// ------------------------------------------------------------- visible text

test('portfolio: no page source has "demo", "illustrative", "Maison Demo" or example.com in visible text, titles or descriptions', () => {
  const problems = [];
  for (const name of PAGES) {
    const html = fs.readFileSync(path.join(root, name + '.html'), 'utf8');
    const head = (/<head[\s\S]*?<\/head>/i.exec(html) || [''])[0];
    const title = (/<title>([^<]*)<\/title>/i.exec(head) || [, ''])[1];
    if (!/(\| Nuvora$|^Nuvora \|)/.test(title)) problems.push(name + ': title "' + title + '" does not carry the Nuvora name');
    const metas = [];
    head.replace(/<meta\s+(?:name|property)="(description|og:title|og:description|og:site_name)"\s+content="([^"]*)"/gi, (m, k, v) => { metas.push(k + '=' + v); return m; });
    if (!/og:site_name=Nuvora/.test(metas.join('\n'))) problems.push(name + ': og:site_name is not Nuvora');
    banned([title].concat(metas).join('\n')).forEach((b) => problems.push(name + ' head: ' + b));
    // body text: drop comments, scripts, tags and attribute values (placeholders keep example.com)
    const body = html.replace(/^[\s\S]*?<body[^>]*>/i, '').replace(/<!--[\s\S]*?-->/g, '').replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, ' ');
    banned(body).forEach((b) => problems.push(name + ' body: ' + b));
    if (/wa\.me/.test(html)) problems.push(name + ': a wa.me link in the page source');
  }
  expect(problems).toEqual([]);
});

test('portfolio: static pages with JavaScript off show no banned words', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.route(/fonts\.googleapis\.com|fonts\.gstatic\.com/, (r) => r.abort());
  const problems = [];
  for (const name of PAGES) {
    await page.goto(pageUrl(name));
    const text = await page.evaluate(() => document.body.innerText);
    banned(text).forEach((b) => problems.push(name + ': ' + b));
  }
  await context.close();
  expect(problems).toEqual([]);
});

for (const p of RENDERED) {
  test(`portfolio: ${p.name} rendered at rest shows no banned words and no wa.me link`, async ({ page }) => {
    const errors = collectErrors(page);
    await page.route(/fonts\.googleapis\.com|fonts\.gstatic\.com/, (r) => r.abort());
    await seed(page, p.state);
    await page.goto(pageUrl(p.name) + (p.query || ''));
    await page.waitForSelector('#site-footer', { state: 'attached' });
    await page.waitForLoadState('load');
    await page.waitForTimeout(150);
    // open every accordion so their answers count as visible text
    await page.evaluate(() => document.querySelectorAll('details').forEach((d) => { d.open = true; }));
    const out = await page.evaluate(() => ({
      text: document.body.innerText,
      // the closed menu, search and drawer are part of the page too
      layers: ['site-menu', 'search-overlay', 'cart-drawer'].map((id) => (document.getElementById(id) || { textContent: '' }).textContent).join('\n'),
      title: document.title,
      wa: Array.prototype.map.call(document.querySelectorAll('a[href*="wa.me"], [href*="whatsapp.com"]'), (a) => a.getAttribute('href')),
      fab: (document.querySelector('.whatsapp-float') || {}).outerHTML || '',
    }));
    expect(banned(out.text + '\n' + out.layers + '\n' + out.title)).toEqual([]);
    expect(out.wa, 'no WhatsApp link without a number').toEqual([]);
    if (p.name !== 'admin' && p.name !== 'styleguide') {
      // admin and the style guide have their own heading; every shop page ends with the brand
      expect(out.title).toMatch(/Nuvora/);
    }
    expect(errors).toEqual([]);
  });
}

// ---------------------------------------------------------------- the footer

test('footer: copyright, shop name and the concept notice on every page; no credit while config.credit is empty', async ({ page }) => {
  const year = new Date().getFullYear();
  for (const name of ['index', 'shop', 'contact', '404']) {
    await page.goto(pageUrl(name));
    const copy = page.locator('#site-footer .site-footer__copy');
    await expect(copy).toHaveText('© ' + year + ' Nuvora. ' + NOTICE);
    await expect(copy).toBeVisible();
    await expect(page.locator('#site-footer .site-footer__credit')).toHaveCount(0);
  }
});

test('footer: "Behind the build" links the dashboard and the style guide while showcasePages is true', async ({ page }) => {
  await page.goto(pageUrl('index'));
  expect(await page.evaluate(() => Shop.config.showcasePages)).toBe(true);
  const row = page.locator('#site-footer .site-footer__showcase');
  await expect(row).toContainText('Behind the build');
  await expect(row.locator('a')).toHaveText(['Dashboard', 'Style guide']);
  await expect(row.locator('a').nth(0)).toHaveAttribute('href', 'admin.html');
  await expect(row.locator('a').nth(1)).toHaveAttribute('href', 'styleguide.html');
});

test('footer: showcasePages false removes the row', async ({ page }) => {
  await routeConfig(page, { showcasePages: false });
  await page.goto(pageUrl('index'));
  await expect(page.locator('#site-footer .site-footer__showcase')).toHaveCount(0);
  await expect(page.locator('#site-footer a[href="admin.html"], #site-footer a[href="styleguide.html"]')).toHaveCount(0);
});

test('footer: credit with a name and url is a safe external link; a name alone is plain text', async ({ page }) => {
  await routeConfig(page, { credit: { name: 'A. Developer', url: 'https://portfolio.invalid/' } });
  await page.goto(pageUrl('index'));
  const credit = page.locator('#site-footer .site-footer__credit');
  await expect(credit).toHaveText('Designed and built by A. Developer.');
  const a = credit.locator('a');
  await expect(a).toHaveAttribute('href', 'https://portfolio.invalid/');
  await expect(a).toHaveAttribute('rel', 'noopener noreferrer');
  await expect(a).toHaveAttribute('target', '_blank');

  await page.unroute(/\/assets\/js\/config\.js$/);
  await routeConfig(page, { credit: { name: 'A. Developer', url: '' } });
  await page.goto(pageUrl('index'));
  await expect(credit).toHaveText('Designed and built by A. Developer.');
  await expect(credit.locator('a')).toHaveCount(0);

  await page.unroute(/\/assets\/js\/config\.js$/);
  await routeConfig(page, { credit: { name: '<b>x</b>', url: 'javascript:alert(1)' } });
  await page.goto(pageUrl('index'));
  await expect(credit).toHaveText('Designed and built by <b>x</b>.');
  await expect(credit.locator('a, b')).toHaveCount(0);
});

// ------------------------------------------------- notes where data is typed

const NOTE_PAGES = [
  { name: 'index', sel: '[data-letter-form] [data-concept-note]' },
  { name: 'contact', sel: '.ct-panel [data-concept-note]' },
  { name: 'track-order', sel: '.tk-panel [data-concept-note]' },
  { name: 'checkout', sel: '.co-submit [data-concept-note]', state: { cart: [{ productId: 'mn-01', ml: 50, qty: 1, gift: false }] } },
  { name: 'order-confirmation', query: '?order=' + ORDER.number, sel: '.oc-hero [data-concept-note]', state: { orders: [ORDER] } },
];

for (const p of NOTE_PAGES) {
  test(`concept note: ${p.name} shows config.conceptNotice where details are typed`, async ({ page }) => {
    await seed(page, p.state);
    await page.goto(pageUrl(p.name) + (p.query || ''));
    const note = page.locator(p.sel);
    await expect(note).toHaveText(NOTICE);
    await note.scrollIntoViewIfNeeded();
    await expect(note).toBeVisible();
  });
}

test('concept note: the product review form says reviews stay in this browser', async ({ page }) => {
  await page.goto(pageUrl('product') + '?id=mn-01');
  await expect(page.locator('[data-review-form] [data-review-note]')).toHaveText('Reviews stay in this browser: no one else sees them.');
});

test('confirmation: a Friday order never shows a Sunday, and the copy matches 3 to 7 working days', async ({ page }) => {
  await seed(page, { orders: [ORDER] });
  await page.goto(pageUrl('order-confirmation') + '?order=' + ORDER.number);
  const range = page.locator('[data-delivery-range]');
  await expect(range).toHaveText(await page.evaluate((iso) => Shop.util.deliveryRange(iso), ORDER.createdAt));
  await expect(range).not.toContainText('Sun');
  await expect(page.locator('.oc-steps')).toContainText('Dispatched in 1 to 2 working days');
  await expect(page.locator('.oc-steps')).toContainText('3 to 7 working days');
});

// ------------------------------------------------------------- header fit

for (const width of [320, 360, 375]) {
  for (const name of ['index', 'shop']) {
    test(`header: the NUVORA wordmark never touches the icons at ${width}px (${name})`, async ({ page }) => {
      await page.setViewportSize({ width, height: 740 });
      await page.goto(pageUrl(name));
      await page.waitForSelector('#site-header');
      await page.evaluate(() => document.fonts.ready);
      const boxes = await page.evaluate(() => {
        const r = (el) => { const b = el.getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top, b: b.bottom, w: b.width }; };
        const brand = document.querySelector('.site-header__brand');
        const range = document.createRange();
        range.selectNodeContents(brand);
        return {
          text: brand.textContent,
          brand: r(brand),
          ink: (() => { const b = range.getBoundingClientRect(); return { l: b.left, r: b.right }; })(),
          menu: r(document.querySelector('.site-header__menu-btn')),
          actions: Array.prototype.map.call(document.querySelectorAll('.site-header__actions .icon-btn'), r),
          sw: document.documentElement.scrollWidth,
          vw: window.innerWidth,
        };
      });
      expect(boxes.text).toBe('Nuvora');
      expect(boxes.sw).toBeLessThanOrEqual(boxes.vw);
      const gapLeft = boxes.ink.l - boxes.menu.r;
      const firstIcon = Math.min.apply(null, boxes.actions.map((a) => a.l));
      const gapRight = firstIcon - boxes.ink.r;
      expect(gapLeft, 'space between the menu button and the wordmark').toBeGreaterThanOrEqual(4);
      expect(gapRight, 'space between the wordmark and the first icon').toBeGreaterThanOrEqual(4);
      expect(boxes.brand.w).toBeGreaterThan(40);
    });
  }
}

// ------------------------------------------------------------------- misc

test('seo: the home JSON-LD escapes "<" so a shop name cannot close the script', async ({ page }) => {
  await routeConfig(page, { shopName: 'N</script><b id="pwn">x</b>' });
  await page.goto(pageUrl('index'));
  const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
  expect(blocks.length).toBeGreaterThanOrEqual(2);
  for (const raw of blocks) {
    expect(raw).not.toContain('<');
    expect(raw).toContain('\\u003c');
  }
  expect(JSON.parse(blocks[0]).name).toBe('N</script><b id="pwn">x</b>');
  await expect(page.locator('#pwn')).toHaveCount(0);
});

test('product: the gift-wrap price says it is per order', async ({ page }) => {
  await page.goto(pageUrl('product') + '?id=mn-01');
  const fee = await page.evaluate(() => Shop.util.formatPKR(Shop.config.giftWrapFee));
  await expect(page.locator('[data-pdp-gift-fee]')).toHaveText('+ ' + fee + ' per order');
});

test('home: the hero still is preloaded and is the image the hero shows', async ({ page }) => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const head = (/<head[\s\S]*?<\/head>/i.exec(html) || [''])[0];
  expect(head).toMatch(/<link rel="preload" as="image" href="assets\/img\/hero-1\.jpg" fetchpriority="high">/);
  await page.goto(pageUrl('index'));
  await expect(page.locator('.home-hero__still img')).toHaveAttribute('src', 'assets/img/hero-1.jpg');
});
