// Site-wide quality pass (Task 16 + 16a): every page at four widths (console and
// request hygiene, no sideways scroll, images, labels, one h1, heading order,
// internal links, unique ids), the SEO head (titles, descriptions, Open Graph,
// robots, favicon, sitemap.xml, robots.txt, JSON-LD), keyboard reach on home,
// hero media priority, a touch-target audit (44px on a coarse pointer), the
// floating WhatsApp button never covering a control, and the shared-shell
// fixes deferred by the page reviews (B3-B11).
const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { pageUrl, collectErrors, routeConfig, TEST_WHATSAPP } = require('./helpers');

const ROOT = path.resolve(__dirname, '..', '..');
const PAGES = fs.readdirSync(ROOT).filter((f) => f.endsWith('.html')).map((f) => f.slice(0, -5)).sort();
const NOT_IN_SITEMAP = ['404', 'admin', 'styleguide', 'order-confirmation'];
const ORIGIN = 'https://example.com/';
const WIDTHS = [320, 375, 768, 1280];
const QUERY = { product: '?id=mn-01' };

const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const attr = (html, re) => { const m = re.exec(html); return m ? m[1] : null; };
const metaName = (html, name) => attr(html, new RegExp('<meta\\s+name="' + name + '"\\s+content="([^"]*)"', 'i'));
const metaProp = (html, prop) => attr(html, new RegExp('<meta\\s+property="' + prop + '"\\s+content="([^"]*)"', 'i'));
const decode = (s) => String(s).replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"');

// Records every <img>/<video> as it is inserted (before a missing file swaps it
// for the placeholder), so the media rules are checked on the real markup.
function recordMedia() {
  window.__media = [];
  const seen = new WeakSet();
  const rec = (n) => {
    if (!n || n.nodeType !== 1) return;
    const list = n.matches('img, video') ? [n] : Array.from(n.querySelectorAll('img, video'));
    list.forEach((m) => {
      if (seen.has(m)) return;
      seen.add(m);
      const a = (k) => m.getAttribute(k);
      window.__media.push({ tag: m.tagName.toLowerCase(), src: a('src'), alt: a('alt'), width: a('width'), height: a('height'),
        loading: a('loading'), fetchpriority: a('fetchpriority'), preload: a('preload'), slot: a('data-slot') });
    });
  };
  new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach(rec))).observe(document, { childList: true, subtree: true });
}

// Seed through the real store from a neutral page.
async function seed(page, fn, arg) {
  await page.goto(pageUrl('styleguide'));
  return page.evaluate(({ fn, arg }) => {
    try { localStorage.clear(); } catch (e) {}
    return (0, eval)('(' + fn + ')')(arg);
  }, { fn: fn.toString(), arg });
}

async function settle(page) {
  await page.waitForLoadState('load');
  await page.waitForSelector('#site-header', { state: 'attached' });
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
}

// ============================================================ every page x width

for (const name of PAGES) {
  for (const width of WIDTHS) {
    test(`page quality: ${name} @${width}`, async ({ page }) => {
      const errors = collectErrors(page);
      await page.addInitScript(recordMedia);
      await page.setViewportSize({ width, height: 900 });
      await page.goto(pageUrl(name) + (QUERY[name] || ''));
      await settle(page);

      const r = await page.evaluate(() => {
        const out = {};
        const doc = document.documentElement;
        out.scroll = { sw: doc.scrollWidth, iw: window.innerWidth };
        out.lang = doc.getAttribute('lang');
        out.h1 = document.querySelectorAll('h1').length;

        // Heading levels never skip downward (hidden headings are not in the outline).
        const levels = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'))
          .filter((h) => h.getClientRects().length > 0)
          .map((h) => ({ level: Number(h.tagName[1]), text: h.textContent.trim().slice(0, 40) }));
        out.skips = [];
        let prev = 0;
        levels.forEach((h) => { if (h.level > prev + 1) out.skips.push('h' + prev + ' -> h' + h.level + ' "' + h.text + '"'); prev = h.level; });

        // Every form field has an accessible name from a label or ARIA.
        out.unlabelled = Array.from(document.querySelectorAll(
          'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]), select, textarea'))
          .filter((f) => {
            const fromLabels = f.labels && Array.from(f.labels).some((l) => l.textContent.trim());
            const aria = (f.getAttribute('aria-label') || '').trim();
            const by = (f.getAttribute('aria-labelledby') || '').split(/\s+/).filter(Boolean)
              .some((id) => { const n = document.getElementById(id); return n && n.textContent.trim(); });
            return !(fromLabels || aria || by || (f.getAttribute('title') || '').trim());
          }).map((f) => f.outerHTML.slice(0, 120));

        // Unique ids.
        const counts = {};
        document.querySelectorAll('[id]').forEach((n) => { counts[n.id] = (counts[n.id] || 0) + 1; });
        out.dupIds = Object.keys(counts).filter((k) => counts[k] > 1);

        // Internal references.
        out.refs = [];
        document.querySelectorAll('a[href]').forEach((a) => out.refs.push(a.getAttribute('href')));
        document.querySelectorAll('link[href]').forEach((l) => out.refs.push(l.getAttribute('href')));
        document.querySelectorAll('script[src]').forEach((s) => out.refs.push(s.getAttribute('src')));

        out.themeColor = !!document.querySelector('meta[name="theme-color"]');
        out.icon = (document.querySelector('link[rel="icon"]') || { getAttribute: () => null }).getAttribute('href');
        out.media = window.__media || [];
        return out;
      });

      expect.soft(errors, 'console errors / failed requests').toEqual([]);
      expect.soft(r.scroll.sw, 'horizontal scroll at ' + width).toBeLessThanOrEqual(r.scroll.iw);
      expect.soft(r.lang).toBe('en');
      expect.soft(r.h1, 'exactly one h1').toBe(1);
      expect.soft(r.skips, 'heading levels skipped').toEqual([]);
      expect.soft(r.unlabelled, 'form fields without a label').toEqual([]);
      expect.soft(r.dupIds, 'duplicate ids').toEqual([]);
      expect.soft(r.themeColor).toBe(true);
      expect.soft(r.icon).toBe('assets/img/favicon.svg');

      const broken = r.refs.filter((h) => h && !/^(https?:|mailto:|tel:|#|data:)/i.test(h) && !/^assets\/(img|video)\//.test(h))
        .map((h) => h.split('#')[0].split('?')[0]).filter((f) => f && !fs.existsSync(path.join(ROOT, decodeURIComponent(f))));
      expect.soft(broken, 'internal links that do not resolve').toEqual([]);

      const badMedia = r.media.filter((m) => m.tag === 'img' && m.src).filter((m) =>
        m.alt === null || !m.width || !m.height || !(m.loading === 'lazy' || m.fetchpriority === 'high'));
      expect.soft(badMedia, 'img needs alt, width, height and lazy loading (or fetchpriority=high for the hero)').toEqual([]);
      const badVideo = r.media.filter((m) => m.tag === 'video' && !['metadata', 'none'].includes(m.preload));
      expect.soft(badVideo, 'video preload').toEqual([]);
    });
  }
}

// ================================================ populated state, narrow phones

const POPULATED = [
  { name: 'cart', page: 'cart' },
  { name: 'checkout', page: 'checkout' },
  { name: 'order-confirmation', page: 'order-confirmation', query: (ctx) => '?order=' + ctx.order },
  { name: 'shop (active filter)', page: 'shop', query: () => '?q=rose&genders=women' },
  { name: 'wishlist (3 items)', page: 'wishlist' }
];

for (const width of [320, 360, 375]) {
  test(`no sideways scroll with a populated bag, order, filters and wishlist @${width}`, async ({ page }) => {
    const errors = collectErrors(page);
    await page.setViewportSize({ width, height: 800 });
    const order = await seed(page, () => {
      const fill = () => {
        Shop.store.addToCart('mn-01', 50, 1, true);
        Shop.store.addToCart('au-01', 30, 2, false);
        Shop.store.setCode('WELCOME10');
      };
      fill();
      const t = Shop.pricing.cartTotals(Shop.store.getCart(), Shop.products, Shop.config, Shop.store.getCode());
      const o = Shop.store.placeOrder({ name: 'Sana Malik', phone: '03001234567', email: '', province: 'Punjab', city: 'Lahore', address: 'House 12, Street 4, DHA Phase 5', notes: '' },
        Shop.store.getCart(), { subtotal: t.subtotal, giftWrap: t.giftWrap, discount: t.discount, delivery: t.delivery, total: t.total });
      Shop.store.updateOrderStatus(o.number, 'Confirmed');
      fill();
      ['mn-01', 'vn-01', 'sr-02'].forEach((id) => Shop.store.toggleWishlist(id));
      return o.number;
    });
    const problems = [];
    for (const s of POPULATED) {
      await page.goto(pageUrl(s.page) + (s.query ? s.query({ order }) : ''));
      await settle(page);
      await page.waitForTimeout(150);
      const r = await page.evaluate(() => {
        const w = window.innerWidth;
        const over = [];
        document.querySelectorAll('body *').forEach((n) => {
          const b = n.getBoundingClientRect();
          if (b.width && b.right > w + 0.5) over.push(n.tagName.toLowerCase() + '.' + String(n.className).trim().split(/\s+/).join('.') + ' ' + Math.round(b.right));
        });
        return { sw: document.documentElement.scrollWidth, iw: w, over: over.slice(0, 6), ledger: !!document.querySelector('.bag-ledger') };
      });
      if (r.sw > r.iw) problems.push(s.name + ': scrollWidth ' + r.sw + ' > ' + r.iw + ' ' + r.over.join(', '));
      if (/cart|checkout|confirmation/.test(s.name) && !r.ledger) problems.push(s.name + ': not populated (no ledger)');
    }
    expect(problems).toEqual([]);
    expect(errors).toEqual([]);
  });
}

// =============================================================== SEO: the heads

test('seo: unique titles and descriptions (<= 160 chars) with Open Graph on every page', () => {
  const titles = {};
  const descs = {};
  for (const name of PAGES) {
    const html = read(name + '.html');
    const title = attr(html, /<title>([^<]*)<\/title>/i);
    const desc = metaName(html, 'description');
    expect(title, name + ' title').toBeTruthy();
    expect(desc, name + ' description').toBeTruthy();
    expect(decode(desc).length, name + ' description length').toBeLessThanOrEqual(160);
    expect(decode(desc).length, name + ' description length').toBeGreaterThanOrEqual(50);
    expect(titles[title], 'duplicate title ' + title).toBeUndefined();
    expect(descs[desc], 'duplicate description on ' + name).toBeUndefined();
    titles[title] = name;
    descs[desc] = name;
    expect(metaProp(html, 'og:title'), name + ' og:title').toBeTruthy();
    expect(metaProp(html, 'og:description'), name + ' og:description').toBeTruthy();
    expect(metaProp(html, 'og:image'), name + ' og:image').toMatch(/^https:\/\//);
    expect(metaName(html, 'theme-color'), name + ' theme-color').toBeTruthy();
    expect(html, name + ' favicon').toContain('<link rel="icon" href="assets/img/favicon.svg" type="image/svg+xml">');
    expect(html, name + ' lang').toMatch(/<html lang="en">/);
  }
  expect(read('docs/page-template.html')).toContain('<link rel="icon" href="assets/img/favicon.svg" type="image/svg+xml">');
});

test('seo: private and utility pages are noindex', () => {
  for (const name of NOT_IN_SITEMAP) {
    expect(metaName(read(name + '.html'), 'robots'), name).toBe('noindex');
  }
});

test('seo: the favicon is a small SVG monogram', () => {
  const svg = read('assets/img/favicon.svg');
  expect(svg).toMatch(/^<svg[^>]+viewBox=/);
  expect(svg).toContain('>M<');
  expect(svg.length).toBeLessThan(2000);
});

test('seo: sitemap.xml lists every indexable page with absolute URLs and lastmod', () => {
  const xml = read('sitemap.xml');
  expect(xml).toMatch(/^<\?xml version="1.0" encoding="UTF-8"\?>/);
  expect(xml).toMatch(/<!--[\s\S]*example\.com[\s\S]*-->/);
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const lastmods = [...xml.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].map((m) => m[1]);
  expect(lastmods.length).toBe(locs.length);
  lastmods.forEach((d) => expect(d).toMatch(/^\d{4}-\d{2}-\d{2}$/));
  locs.forEach((l) => expect(l.startsWith(ORIGIN)).toBe(true));
  const listed = [...new Set(locs.map((l) => (l === ORIGIN ? 'index' : l.slice(ORIGIN.length).split('?')[0].replace(/\.html$/, ''))))].sort();
  // Every product has its own URL.
  const ids = require(path.join(ROOT, 'assets/js/products.js')).map((p) => p.id);
  ids.forEach((id) => expect(locs).toContain(ORIGIN + 'product.html?id=' + id));
  // Indexable = not one of the four utility pages and not marked noindex.
  const indexable = PAGES.filter((p) => !NOT_IN_SITEMAP.includes(p) && metaName(read(p + '.html'), 'robots') !== 'noindex').sort();
  expect(listed).toEqual(indexable);
  NOT_IN_SITEMAP.forEach((p) => expect(listed).not.toContain(p));
});

test('seo: robots.txt points at the sitemap and keeps private pages out', () => {
  const txt = read('robots.txt');
  expect(txt).toContain('Sitemap: https://example.com/sitemap.xml');
  ['/admin.html', '/styleguide.html', '/order-confirmation.html'].forEach((p) => expect(txt).toContain('Disallow: ' + p));
  expect(txt).toMatch(/User-agent: \*/);
});

test('seo: home carries Organization and WebSite JSON-LD from Shop.config', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto(pageUrl('index'));
  await settle(page);
  const data = await page.evaluate(() => ({
    blocks: Array.from(document.querySelectorAll('script[type="application/ld+json"]')).map((s) => JSON.parse(s.textContent)),
    name: Shop.config.shopName
  }));
  const types = data.blocks.map((b) => b['@type']);
  expect(types).toContain('Organization');
  expect(types).toContain('WebSite');
  const org = data.blocks.find((b) => b['@type'] === 'Organization');
  expect(org.name).toBe(data.name);
  expect(org.url).toBe(ORIGIN);
  expect(org.logo).toBe(ORIGIN + 'assets/img/favicon.svg');
  expect(errors).toEqual([]);
});

test('seo: product and FAQ JSON-LD still parse', async ({ page }) => {
  await page.goto(pageUrl('product') + '?id=mn-01');
  await settle(page);
  const p = await page.evaluate(() => Array.from(document.querySelectorAll('script[type="application/ld+json"]')).map((s) => JSON.parse(s.textContent)['@type']));
  expect(p).toContain('Product');
  await page.goto(pageUrl('faq'));
  await settle(page);
  const f = await page.evaluate(() => Array.from(document.querySelectorAll('script[type="application/ld+json"]')).map((s) => JSON.parse(s.textContent)['@type']));
  expect(f).toContain('FAQPage');
});

// ======================================================== keyboard and the hero

test('keyboard: the main CTA on home is reached within 12 Tab presses at 1280', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(pageUrl('index'));
  await settle(page);
  let reached = false;
  for (let i = 0; i < 12 && !reached; i++) {
    await page.keyboard.press('Tab');
    reached = await page.evaluate(() => !!document.activeElement && document.activeElement.matches('.home-hero__actions .btn--primary'));
  }
  expect(reached).toBe(true);
});

test('performance: the home hero still is eager with fetchpriority=high, the loop preloads metadata only', async ({ page }) => {
  await page.addInitScript(recordMedia);
  await page.goto(pageUrl('index'));
  await settle(page);
  const media = await page.evaluate(() => window.__media);
  const hero = media.find((m) => m.slot === 'hero-1');
  expect(hero).toBeTruthy();
  expect(hero.loading).toBe('eager');
  expect(hero.fetchpriority).toBe('high');
  const video = media.find((m) => m.tag === 'video' && m.slot === 'hero-video');
  expect(video.preload).toBe('metadata');
});

test('performance: a video that falls back to its poster keeps dimensions and lazy loading', async ({ page }) => {
  await page.addInitScript(recordMedia);
  await page.goto(pageUrl('index'));
  await settle(page);
  // Simulate a failed video whose poster exists: the poster <img> must be well-formed.
  const poster = await page.evaluate(() => {
    const host = document.createElement('div');
    host.innerHTML = '<span class="media"><video data-slot="t-video" poster="assets/img/none.jpg" width="1200" height="675" aria-label="Test loop"></video></span>';
    document.querySelector('main').appendChild(host);
    host.querySelector('video').dispatchEvent(new Event('error'));
    const img = host.querySelector('img');
    return img ? { width: img.getAttribute('width'), height: img.getAttribute('height'), loading: img.getAttribute('loading') } : null;
  });
  if (poster) {
    expect(poster.width).toBe('1200');
    expect(poster.height).toBe('675');
    expect(poster.loading).toBe('lazy');
  }
  const rec = await page.evaluate(() => window.__media.filter((m) => m.slot === 'poster-t-video'));
  expect(rec.length).toBe(1);
  expect(rec[0].width).toBe('1200');
  expect(rec[0].loading).toBe('lazy');
});

// ================================================================ wishlist outline

test('wishlist: with saved items the outline goes h1 -> h2 "Saved fragrances" -> h3 cards', async ({ page }) => {
  await seed(page, (ids) => ids.forEach((id) => Shop.store.toggleWishlist(id)), ['mn-01', 'vn-01']);
  await page.goto(pageUrl('wishlist'));
  await settle(page);
  await page.waitForSelector('.wl-item');
  const levels = await page.evaluate(() => Array.from(document.querySelectorAll('main h1, main h2, main h3'))
    .filter((h) => h.getClientRects().length > 0).map((h) => h.tagName + ':' + h.textContent.trim()));
  expect(levels[0]).toMatch(/^H1:Your wishlist/);
  expect(levels[1]).toBe('H2:Saved fragrances');
  expect(levels[2]).toMatch(/^H3:/);
});

// ============================================================ B1: touch targets

const MIN = 44;

// Every state worth auditing: each page as it loads, plus the overlays and
// filtered states that reveal more controls.
const TOUCH_STATES = PAGES.map((name) => ({ name, page: name, query: () => QUERY[name] || '' }))
  .concat([
    { name: 'shop (filtered)', page: 'shop', query: () => '?q=rose&genders=women' },
    { name: 'shop (filter sheet)', page: 'shop', query: () => '?q=rose&genders=women', act: async (page) => { await page.locator('[data-open-filters]').click(); await page.waitForTimeout(50); } },
    { name: 'drawer', page: 'index', act: async (page) => { await page.evaluate(() => Shop.ui.openCart()); } },
    { name: 'search overlay', page: 'index', act: async (page) => { await page.locator('.site-header__search').click(); } },
    { name: 'menu', page: 'index', act: async (page) => { await page.locator('.site-header__menu-btn').click(); } },
    { name: 'scent-quiz (step 1)', page: 'scent-quiz', act: async (page) => { await page.locator('[data-qz-begin]').click(); } },
    { name: 'track-order (result)', page: 'track-order', act: async (page, ctx) => {
      await page.getByLabel('Order number', { exact: true }).fill(ctx.order);
      await page.getByLabel('Mobile number used at checkout', { exact: true }).fill('03001234567');
      await page.getByRole('button', { name: /^track order$/i }).click();
      await page.waitForSelector('[data-track-result]');
    } },
    { name: 'order-confirmation (order)', page: 'order-confirmation', query: (ctx) => '?order=' + ctx.order }
  ]);

function auditTargets(min) {
  const SEL = 'a[href], button, input:not([type="hidden"]), select, textarea, summary, [role="button"], [tabindex]';
  const out = [];
  const describe = (n) => n.tagName.toLowerCase() + (n.className && typeof n.className === 'string' ? '.' + n.className.trim().split(/\s+/).join('.') : '') +
    ' "' + (n.getAttribute('aria-label') || n.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 30) + '"';
  document.querySelectorAll(SEL).forEach((n) => {
    if (n.hasAttribute('tabindex') && Number(n.getAttribute('tabindex')) < 0 && !n.matches('a[href], button, input, select, textarea, summary, [role="button"]')) return;
    if (!n.getClientRects().length || n.closest('[inert], [hidden]')) return;
    const cs = getComputedStyle(n);
    if (cs.visibility === 'hidden' || cs.pointerEvents === 'none') return;
    const r = n.getBoundingClientRect();
    if (r.width <= 2 || r.height <= 2) return; // visually hidden (sr-only)
    if (n.matches('.skip-link') && document.activeElement !== n) return;
    if (n.matches('.ad-chart__hit')) return; // documented exception: table view available
    if (n.tagName === 'A' && cs.display.indexOf('inline') === 0) {
      // WCAG 2.5.8 inline exception: a link inside a run of sentence text.
      const p = n.parentElement;
      const text = Array.from(p.childNodes).some((c) => c.nodeType === 3 && c.textContent.trim());
      if (text && p.matches('p, li, dd, span, small, label, td')) return;
    }
    if (n.tagName === 'A') {
      // Stretched link: an absolutely positioned ::after covers its card, which is the real target.
      const after = getComputedStyle(n, '::after');
      if (after.content !== 'none' && after.position === 'absolute' && n.offsetParent) {
        const c = n.offsetParent.getBoundingClientRect();
        if (c.width >= min && c.height >= min && after.inset !== 'auto' && parseFloat(after.width) >= min) return;
      }
    }
    if (n.matches('input[type="checkbox"], input[type="radio"]')) {
      const wrap = n.closest('label') || (n.labels && n.labels[0]);
      if (wrap) { const w = wrap.getBoundingClientRect(); if (w.width >= min && w.height >= min) return; }
    }
    if (r.width < min - 0.5 || r.height < min - 0.5) out.push(describe(n) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
  });
  return out;
}

test.describe('touch targets (375x812, coarse pointer)', () => {
  // Reduced motion: overlays are measured open, not mid-animation.
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 375, height: 812 }, reducedMotion: 'reduce' });

  test('every visible control is at least 44x44 (inline text links and documented exceptions aside)', async ({ page }) => {
    test.setTimeout(180000);
    const order = await seed(page, () => {
      Shop.store.addToCart('mn-01', 50, 1, false);
      const t = Shop.pricing.cartTotals(Shop.store.getCart(), Shop.products, Shop.config, '');
      const o = Shop.store.placeOrder({ name: 'Sana Malik', phone: '03001234567', email: '', province: 'Punjab', city: 'Lahore', address: 'House 12, Street 4, DHA', notes: '' },
        Shop.store.getCart(), { subtotal: t.subtotal, giftWrap: 0, discount: 0, delivery: t.delivery, total: t.total });
      Shop.store.addToCart('mn-01', 50, 1, false);
      Shop.store.addToCart('au-01', 30, 2, true);
      ['mn-01', 'vn-01', 'sr-02'].forEach((id) => Shop.store.toggleWishlist(id));
      return o.number;
    });
    const ctx = { order };
    expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true);
    const all = [];
    for (const s of TOUCH_STATES) {
      await page.goto(pageUrl(s.page) + (s.query ? s.query(ctx) : ''));
      await settle(page);
      if (s.act) await s.act(page, ctx);
      await page.waitForTimeout(80);
      const found = await page.evaluate(auditTargets, MIN);
      found.forEach((f) => all.push(s.name + ': ' + f));
    }
    console.log('touch-target violations: ' + all.length + '\n' + all.join('\n'));
    expect(all).toEqual([]);
  });
});

// ======================================================= B2: WhatsApp button

const FAB_VIEWPORTS = [
  { width: 1280, height: 720 }, { width: 1280, height: 900 }, { width: 1440, height: 900 }, { width: 1024, height: 768 },
  { width: 768, height: 1024 }, { width: 375, height: 667 }, { width: 375, height: 812 }
];

function fabCheck() {
  const f = document.querySelector('.whatsapp-float');
  if (!f) return { shown: false, hits: ['no fab'] };
  const cs = getComputedStyle(f);
  const shown = cs.display !== 'none' && cs.visibility !== 'hidden' && parseFloat(cs.opacity) > 0.05 && cs.pointerEvents !== 'none';
  if (!shown) return { shown, hits: [] };
  const fr = f.getBoundingClientRect();
  const SEL = 'a[href], button, input:not([type="hidden"]), select, textarea, summary, [role="button"], [tabindex]:not([tabindex="-1"]), label:has(input[type="radio"], input[type="checkbox"])';
  const hits = [];
  document.querySelectorAll(SEL).forEach((n) => {
    if (n === f || f.contains(n) || !n.getClientRects().length || n.closest('[inert], [hidden]')) return;
    const s = getComputedStyle(n);
    if (s.visibility === 'hidden' || s.pointerEvents === 'none') return;
    const r = n.getBoundingClientRect();
    if (r.width <= 2 || r.height <= 2) return;
    if (r.right <= fr.left || r.left >= fr.right || r.bottom <= fr.top || r.top >= fr.bottom) return;
    hits.push(n.tagName.toLowerCase() + '.' + String(n.className).trim().split(/\s+/).join('.') + ' "' + (n.textContent || '').trim().slice(0, 24) + '"');
  });
  return { shown, hits, box: { x: Math.round(fr.x), y: Math.round(fr.y), w: Math.round(fr.width) } };
}

const FAB_STATES = [
  { name: 'home', url: 'index' },
  { name: 'shop', url: 'shop' },
  { name: 'product', url: 'product', query: '?id=mn-01' },
  { name: 'cart', url: 'cart', cart: true },
  { name: 'checkout', url: 'checkout', cart: true },
  { name: 'quiz step 1', url: 'scent-quiz', act: async (page) => { await page.locator('[data-qz-begin]').click(); } },
  { name: 'quiz step 5', url: 'scent-quiz', act: async (page) => {
    await page.locator('[data-qz-begin]').click();
    for (let i = 0; i < 4; i++) {
      await page.locator('[data-qz-view="step"] input[type="radio"]').first().check();
      await page.locator('[data-qz-next]').click();
    }
  } },
  { name: 'contact', url: 'contact' },
  { name: 'faq', url: 'faq' },
  { name: 'track-order', url: 'track-order' }
];

// The button is "Message us" (contact.html) by default and WhatsApp once a number is
// set; same box either way, but pages differ (the contact page shows other cards), so
// the pages whose layout depends on the number also run with one.
const FAB_WA_STATES = ['product', 'checkout', 'contact', 'faq'];

test.describe('WhatsApp button never covers a control', () => {
  test.use({ reducedMotion: 'reduce' });

  for (const s of FAB_STATES.concat(FAB_STATES.filter((x) => FAB_WA_STATES.includes(x.name)).map((x) => Object.assign({}, x, { wa: true })))) {
    test(`fab: ${s.name}${s.wa ? ' (with a WhatsApp number)' : ''}`, async ({ page }) => {
      test.setTimeout(120000);
      if (s.wa) await routeConfig(page, { whatsapp: TEST_WHATSAPP });
      const errors = collectErrors(page);
      const problems = [];
      for (const vp of FAB_VIEWPORTS) {
        await page.setViewportSize(vp);
        await seed(page, (withCart) => { if (withCart) Shop.store.addToCart('mn-01', 50, 1, false); }, !!s.cart);
        await page.goto(pageUrl(s.url) + (s.query || ''));
        await settle(page);
        if (s.act) await s.act(page);
        for (const at of [0, 0.25, 0.5, 0.75, 1]) {
          await page.evaluate((k) => window.scrollTo({ top: k * (document.documentElement.scrollHeight - innerHeight), behavior: 'instant' }), at);
          await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 30)))));
          const c = await page.evaluate(fabCheck);
          if (c.hits.length) problems.push(vp.width + 'x' + vp.height + ' @' + at + ' ' + JSON.stringify(c.box) + ': ' + c.hits.join(', '));
        }
      }
      expect(problems).toEqual([]);
      expect(errors).toEqual([]);
    });
  }

  for (const [mode, overrides, label] of [['default', {}, 'Message us'], ['WhatsApp', { whatsapp: TEST_WHATSAPP }, /WhatsApp/]]) test(`fab (${mode}): visible and reachable on a plain content page at rest, 48px on desktop, labelled with a focus ring`, async ({ page }) => {
    await routeConfig(page, overrides);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(pageUrl('about'));
    await settle(page);
    const fab = page.locator('a.whatsapp-float');
    await expect(fab).toBeVisible();
    expect((await page.evaluate(fabCheck)).shown).toBe(true);
    await expect(fab).toHaveAttribute('aria-label', label);
    const box = await fab.boundingBox();
    expect(Math.round(box.width)).toBe(48);
    await fab.focus();
    const outline = await fab.evaluate((n) => getComputedStyle(n).outlineStyle);
    expect(outline).not.toBe('none');
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(pageUrl('about'));
    await settle(page);
    await expect(fab).toBeVisible();
    expect((await fab.boundingBox()).width).toBeGreaterThanOrEqual(44);
  });
});

// ======================================================== B3: header badges

test('badges: the bag badge counts charged bottles; the wishlist badge counts known products', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto(pageUrl('styleguide'));
  await page.evaluate(() => {
    localStorage.setItem('maison_demo_v1', JSON.stringify({
      cart: [
        { productId: 'mn-01', ml: 50, qty: 2, gift: false },
        { productId: 'zz-99', ml: 50, qty: 4, gift: false },
        { productId: 'au-03', ml: 30, qty: 3, gift: false }
      ],
      wishlist: ['mn-01', 'vn-01', 'sr-02', 'zz-01', 'nope'],
      orders: [], reviews: [], code: ''
    }));
  });
  await page.goto(pageUrl('cart'));
  await settle(page);
  await page.waitForSelector('[data-bag-count]');
  const title = (await page.locator('[data-bag-count]').textContent()).replace(/\D/g, '');
  await expect(page.locator('[data-cart-count]')).toHaveText(title);
  await expect(page.locator('[data-cart-count]')).toHaveText('2');
  await expect(page.locator('.site-header__cart')).toHaveAttribute('aria-label', 'Bag, 2 items');
  await expect(page.locator('[data-wish-count]')).toHaveText('3');
  expect(errors).toEqual([]);
});

// =========================================================== B4: reveal safety

test('reveal: a .reveal node injected after load becomes visible without calling reveal()', async ({ page }) => {
  await page.goto(pageUrl('about'));
  await settle(page);
  expect(await page.evaluate(() => document.documentElement.classList.contains('js-reveal'))).toBe(true);
  await page.evaluate(() => {
    const n = document.createElement('div');
    n.className = 'reveal';
    n.id = 'late-reveal';
    n.innerHTML = '<p class="reveal" id="late-inner">Late content</p>';
    document.querySelector('main').prepend(n);
    window.scrollTo(0, 0);
  });
  await expect(page.locator('#late-reveal')).toHaveClass(/is-visible/);
  await expect(page.locator('#late-inner')).toHaveClass(/is-visible/);
});

// ========================================================= B5: focus fallback

test('product card: a focus ring fallback exists for browsers without :has()', () => {
  const css = read('assets/css/components.css');
  expect(css).toMatch(/@supports not selector\(:has\(\*\)\)\s*\{[^}]*\.product-card__link:focus-visible\s*\{[^}]*outline:/);
});

// ============================================================ B6: live region

test('drawer: quantity changes are announced once each through one stable live region', async ({ page }) => {
  await seed(page, () => Shop.store.addToCart('mn-01', 50, 1, false));
  await page.goto(pageUrl('index'));
  await settle(page);
  await page.evaluate(() => Shop.ui.openCart());
  const drawer = page.locator('#cart-drawer');
  await expect(drawer.locator('[data-drawer-content] [aria-live]')).toHaveCount(0);
  const live = drawer.locator('[data-drawer-live]');
  await expect(live).toHaveAttribute('aria-live', 'polite');
  await live.evaluate((n) => { n.__stable = true; });
  const name = await page.evaluate(() => Shop.products.find((p) => p.id === 'mn-01').name);
  await drawer.getByRole('button', { name: 'Increase quantity' }).click();
  await expect(live).toHaveText('Quantity of ' + name + ' is now 2');
  await drawer.getByRole('button', { name: 'Increase quantity' }).click();
  await expect(live).toHaveText('Quantity of ' + name + ' is now 3');
  await drawer.getByRole('button', { name: 'Decrease quantity' }).click();
  await expect(live).toHaveText('Quantity of ' + name + ' is now 2');
  expect(await live.evaluate((n) => n.__stable === true && document.contains(n))).toBe(true);
});

// ============================================================= B7: code casing

test('discount code: a lower-case code with spaces is stored and ordered upper-case', async ({ page }) => {
  await seed(page, () => Shop.store.addToCart('mn-01', 50, 1, false));
  await page.goto(pageUrl('cart'));
  await settle(page);
  const input = page.locator('[data-code-form] input').first();
  await input.fill(' welcome10 ');
  await input.press('Enter');
  await expect.poll(() => page.evaluate(() => Shop.store.getCode())).toBe('WELCOME10');
  const code = await page.evaluate(() => {
    const t = Shop.pricing.cartTotals(Shop.store.getCart(), Shop.products, Shop.config, Shop.store.getCode());
    return Shop.store.placeOrder({ name: 'Sana', phone: '03001234567' }, Shop.store.getCart(), { total: t.total }).code;
  });
  expect(code).toBe('WELCOME10');
});

// ========================================================= B8: checkout bfcache

async function fillCheckout(page) {
  await page.locator('#co-name').fill('Sana Malik');
  await page.locator('#co-phone').fill('03001234567');
  await page.locator('#co-province').selectOption('Punjab');
  await page.locator('#co-city').fill('Lahore');
  await page.locator('#co-address').fill('House 12, Street 4, DHA Phase 5');
}

async function submitAndStay(page) {
  // Stop the navigation to the confirmation page so the submitting state can be inspected.
  await page.evaluate(() => document.addEventListener('submit', () => { window.stop(); }));
  await page.locator('[data-place]').click();
  await expect(page.locator('[data-place]')).toBeDisabled();
}

test('checkout: a bfcache restore after placing the order shows the empty state', async ({ page }) => {
  await seed(page, () => Shop.store.addToCart('mn-01', 50, 1, false));
  await page.goto(pageUrl('checkout'));
  await settle(page);
  await fillCheckout(page);
  const label = await page.locator('[data-place]').textContent();
  await submitAndStay(page);
  expect(await page.evaluate(() => Shop.store.getCart().length)).toBe(0);
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
  await page.waitForLoadState('load');
  await expect(page.locator('[data-checkout-form]')).toBeHidden();
  expect(label).toBeTruthy();
});

test('checkout: a bfcache restore with a bag re-enables the stuck Place order button', async ({ page }) => {
  await seed(page, () => Shop.store.addToCart('mn-01', 50, 1, false));
  await page.goto(pageUrl('checkout'));
  await settle(page);
  await fillCheckout(page);
  await submitAndStay(page);
  await expect(page.locator('[data-place]')).toHaveText(/Placing your order/);
  const total = await page.evaluate(() => {
    Shop.store.addToCart('vn-01', 50, 1, false);
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
    return Shop.util.formatPKR(Shop.pricing.cartTotals(Shop.store.getCart(), Shop.products, Shop.config, Shop.store.getCode()).total);
  });
  const btn = page.locator('[data-place]');
  await expect(btn).toBeEnabled();
  await expect(btn).not.toHaveAttribute('aria-busy', 'true');
  // The label is rebuilt for the bag as it is now.
  await expect(btn).toHaveText('Place order · ' + total);
});

// ========================================================= B9: search URL cap

test('shop: a huge search is capped at 120 characters in the field and the URL', async ({ page }) => {
  const errors = collectErrors(page);
  const long = 'a'.repeat(5000);
  await page.goto(pageUrl('shop') + '?q=' + long);
  await settle(page);
  await expect(page.locator('#shop-q')).toHaveAttribute('maxlength', '120');
  expect((await page.locator('#shop-q').inputValue()).length).toBeLessThanOrEqual(120);
  expect((await page.evaluate(() => location.search)).length).toBeLessThanOrEqual(130);
  await page.locator('#shop-q').evaluate((n, v) => { n.value = v; n.dispatchEvent(new Event('input', { bubbles: true })); }, 'b'.repeat(5000));
  await page.locator('#shop-q').press('Enter');
  await expect.poll(() => page.evaluate(() => location.search.length)).toBeLessThanOrEqual(130);
  expect(await page.evaluate(() => location.search)).toContain('q=bbb');
  await expect(page.locator('#search-q')).toHaveAttribute('maxlength', '120');
  expect(errors).toEqual([]);
});

// ===================================================== B10/B11: track result

test('track: an epoch createdAt hides the placed line and the delivery range; the status heading reads "Status: …"', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto(pageUrl('track-order'));
  await settle(page);
  const number = await page.evaluate(() => {
    Shop.store.addToCart('mn-01', 50, 1, false);
    const o = Shop.store.placeOrder({ name: 'Sana', phone: '03001234567', city: 'Lahore', province: 'Punjab' }, Shop.store.getCart(), { total: 100 });
    const blob = JSON.parse(localStorage.getItem('maison_demo_v1'));
    blob.orders[0].createdAt = new Date(0).toISOString();
    localStorage.setItem('maison_demo_v1', JSON.stringify(blob));
    return o.number;
  });
  await page.reload();
  await settle(page);
  await page.getByLabel('Order number', { exact: true }).fill(number);
  await page.getByLabel('Mobile number used at checkout', { exact: true }).fill('03001234567');
  await page.getByRole('button', { name: /^track order$/i }).click();
  const result = page.locator('[data-track-result]');
  await expect(result).toBeVisible();
  await expect(result.locator('.tk-result__meta')).toHaveCount(0);
  await expect(result.locator('[data-delivery-range]')).toHaveCount(0);
  await expect(result.locator('[data-track-status]')).toHaveText('Placed');
  await expect(page.getByRole('heading', { level: 2, name: 'Status: Placed' })).toBeVisible();
  await expect(result.locator('#tk-status-title')).toHaveText('Status: Placed');
  expect(await result.locator('#tk-status-title .sr-only').textContent()).toBe('Status: ');
  expect(errors).toEqual([]);
});

test('ledger: every rendering of Shop.bag.ledgerHtml carries the shared .bag-ledger class', async ({ page }) => {
  await seed(page, () => Shop.store.addToCart('mn-01', 50, 1, false));
  await page.goto(pageUrl('cart'));
  await settle(page);
  await expect(page.locator('dl.ledger.bag-ledger')).toHaveCount(1);
  const css = read('assets/css/pages.css');
  expect(css).not.toMatch(/:is\(\.page-cart, \.page-checkout, \.page-confirmation, \.page-track\) \.ledger/);
  expect(css).toMatch(/\.bag-ledger \.ledger__row\s*\{/);
});

test('fab: the WhatsApp button never sits on the order totals (data-fab-avoid)', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1280, height: 900 });
  await seed(page, () => Shop.store.addToCart('mn-01', 50, 1, false));
  await page.goto(pageUrl('checkout'));
  await settle(page);
  const ledger = page.locator('dl.bag-ledger');
  await expect(ledger).toHaveAttribute('data-fab-avoid', '');
  for (const at of [0, 0.5, 1]) {
    await page.evaluate((k) => window.scrollTo({ top: k * (document.documentElement.scrollHeight - innerHeight), behavior: 'instant' }), at);
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 30)))));
    const clash = await page.evaluate(() => {
      const f = document.querySelector('.whatsapp-float');
      const cs = getComputedStyle(f);
      if (cs.visibility === 'hidden' || parseFloat(cs.opacity) < 0.05) return false;
      const a = f.getBoundingClientRect();
      const b = document.querySelector('dl.bag-ledger').getBoundingClientRect();
      return !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
    });
    expect(clash, 'fab over the ledger at scroll ' + at).toBe(false);
  }
});

test('confirmation and track share Shop.util.deliveryRange', () => {
  expect(read('assets/js/pages/confirmation.js')).not.toMatch(/function deliveryRange/);
  expect(read('assets/js/pages/track.js')).not.toMatch(/function deliveryRange/);
  expect(read('assets/js/util.js')).toMatch(/deliveryRange/);
});
