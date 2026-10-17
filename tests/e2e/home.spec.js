// Home page (Task 8): section order, hero video contract, trust strip, category
// tiles, bestsellers, quiz teaser, house showcase, gift banner, testimonials,
// newsletter (validates, stores nothing, sends nothing), header overlay,
// layout, heading outline and keyboard reach.
const { test, expect } = require('@playwright/test');
const { pageUrl, collectErrors } = require('./helpers');

const MOBILE = { width: 375, height: 812 };
const TABLET = { width: 768, height: 1024 };
const DESKTOP = { width: 1280, height: 900 };

const SECTION_ORDER = [
  'hero', 'trust', 'categories', 'bestsellers', 'quiz', 'houses', 'gift', 'testimonials', 'newsletter',
];

// Records every hero <video> as soon as it is inserted: missing media files make
// ui.js swap the video for its poster/placeholder, so we capture the markup first.
function recordVideos() {
  window.__videos = [];
  const seen = new Set();
  const grab = (root) => {
    if (!root || root.nodeType !== 1) return;
    const list = root.matches('video') ? [root] : Array.from(root.querySelectorAll('video'));
    list.forEach((v) => {
      if (seen.has(v)) return;
      seen.add(v);
      window.__videos.push({
        slot: v.getAttribute('data-slot'),
        inHero: !!v.closest('[data-section="hero"]'),
        muted: v.hasAttribute('muted'),
        playsinline: v.hasAttribute('playsinline'),
        loop: v.hasAttribute('loop'),
        autoplay: v.hasAttribute('autoplay'),
        preload: v.getAttribute('preload'),
        poster: v.getAttribute('poster'),
      });
    });
  };
  new MutationObserver((muts) => {
    muts.forEach((m) => m.addedNodes.forEach(grab));
  }).observe(document, { childList: true, subtree: true });
}

async function open(page, viewport = DESKTOP) {
  const errors = collectErrors(page);
  await page.addInitScript(recordVideos);
  await page.setViewportSize(viewport);
  await page.goto(pageUrl('index'));
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForSelector('header.site-header');
  await page.waitForSelector('[data-section="bestsellers"] .product-card');
  return errors;
}

const section = (page, name) => page.locator(`[data-section="${name}"]`);

test('home sections render in order and the body is set up for an overlay header', async ({ page }) => {
  const errors = await open(page);
  await expect(page.locator('body')).toHaveAttribute('data-nav', 'home');
  await expect(page.locator('body')).toHaveAttribute('data-header', 'overlay');
  const order = await page.locator('main#main [data-section]').evaluateAll((els) =>
    els.map((e) => e.getAttribute('data-section')));
  expect(order).toEqual(SECTION_ORDER);
  // every section is a labelled landmark-ish region
  for (const name of SECTION_ORDER) {
    const s = section(page, name);
    await expect(s).toHaveCount(1);
    const labelled = await s.evaluate((el) => !!(el.getAttribute('aria-labelledby') || el.getAttribute('aria-label')));
    expect(labelled, name + ' has an accessible label').toBe(true);
  }
  expect(errors).toEqual([]);
});

test('hero: single h1, no eyebrow above it, primary and secondary CTAs', async ({ page }) => {
  const errors = await open(page);
  await expect(page.locator('h1')).toHaveCount(1);
  const h1 = section(page, 'hero').locator('h1');
  await expect(h1).toBeVisible();
  await expect(h1).toHaveText(/\S{3,}/);
  // nothing (no kicker / pill / eyebrow) directly above the headline
  const prev = await h1.evaluate((el) => {
    const p = el.previousElementSibling;
    return p ? p.outerHTML : null;
  });
  expect(prev).toBeNull();
  await expect(section(page, 'hero').locator('.eyebrow, .section-heading__eyebrow')).toHaveCount(0);

  const primary = section(page, 'hero').locator('a.btn--primary');
  await expect(primary).toHaveAttribute('href', 'shop.html');
  await expect(primary).toHaveText(/Shop the collection/i);
  await expect(section(page, 'hero').locator('a[href="scent-quiz.html"]')).toHaveText(/Find your scent/i);
  expect(errors).toEqual([]);
});

test('hero headline and CTAs are visible without scrolling on a 1366x768 laptop', async ({ page }) => {
  await open(page, { width: 1366, height: 768 });
  const box = await section(page, 'hero').locator('a.btn--primary').boundingBox();
  const h1 = await section(page, 'hero').locator('h1').boundingBox();
  expect(h1.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(768);
});

test('hero video is muted, inline, looping, metadata-only with a poster, over a hero-1 fallback', async ({ page }) => {
  await open(page);
  const vids = await page.evaluate(() => window.__videos.filter((v) => v.inHero));
  expect(vids.length).toBe(1);
  const v = vids[0];
  expect(v.slot).toBe('hero-video');
  expect(v.muted).toBe(true);
  expect(v.playsinline).toBe(true);
  expect(v.loop).toBe(true);
  expect(v.preload).toBe('metadata');
  expect(v.poster).toBe('assets/img/poster-hero-video.jpg');
  expect(v.autoplay).toBe(true);
  // hero-1 sits behind the video as the still fallback
  await expect(section(page, 'hero').locator('.media')).toHaveCount(2);
  const layers = await section(page, 'hero').locator('.media').evaluateAll((els) =>
    els.map((m) => (m.parentElement.getAttribute('data-media'))));
  expect(layers).toEqual(['hero-1', 'hero-video']);
});

test('hero video honours reduced motion: poster only, no autoplay', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page);
  const vids = await page.evaluate(() => window.__videos.filter((v) => v.inHero));
  expect(vids.length).toBe(1);
  expect(vids[0].autoplay).toBe(false);
  expect(vids[0].poster).toBe('assets/img/poster-hero-video.jpg');
});

test('trust strip has four promises including the configured free-delivery threshold', async ({ page }) => {
  await open(page);
  const items = section(page, 'trust').locator('li');
  await expect(items).toHaveCount(4);
  const threshold = await page.evaluate(() => Shop.util.formatPKR(Shop.config.freeDeliveryThreshold));
  await expect(section(page, 'trust')).toContainText(threshold);
  await expect(section(page, 'trust')).toContainText(/authentic/i);
  await expect(section(page, 'trust')).toContainText(/cash on delivery/i);
  await expect(section(page, 'trust')).toContainText(/7-day/i);
  // each promise carries a crisp inline svg icon
  await expect(section(page, 'trust').locator('li svg')).toHaveCount(4);
});

test('four category tiles link to the filtered shop', async ({ page }) => {
  await open(page);
  const hrefs = await section(page, 'categories').locator('a[href^="shop.html"]').evaluateAll((els) =>
    els.map((a) => a.getAttribute('href')));
  expect(hrefs).toEqual([
    'shop.html?genders=men',
    'shop.html?genders=women',
    'shop.html?genders=unisex',
    'shop.html?q=gift',
  ]);
  await expect(section(page, 'categories').locator('.media')).toHaveCount(4);
});

for (const [label, vp] of [['375', MOBILE], ['1280', DESKTOP]]) {
  test(`category tile titles stay on one line in the lower 30% of the tile at ${label}`, async ({ page }) => {
    await open(page, vp);
    await page.evaluate(() => document.fonts.ready);
    const tiles = await section(page, 'categories').locator('.home-tile').evaluateAll((els) => els.map((tile) => {
      const title = tile.querySelector('h3');
      const t = title.getBoundingClientRect();
      const r = tile.getBoundingClientRect();
      return {
        text: title.textContent.trim(),
        height: t.height,
        lineHeight: parseFloat(getComputedStyle(title).lineHeight),
        top: t.top - r.top, bottom: t.bottom - r.top, left: t.left - r.left, right: t.right - r.left,
        tileH: r.height, tileW: r.width,
      };
    }));
    expect(tiles.map((t) => t.text)).toEqual(['Men', 'Women', 'Unisex & Oud', 'Gifts']);
    for (const t of tiles) {
      expect(t.height, `${t.text} is one line`).toBeLessThanOrEqual(1.4 * t.lineHeight);
      expect(t.top, `${t.text} sits in the lower 30%`).toBeGreaterThanOrEqual(0.7 * t.tileH);
      expect(t.bottom).toBeLessThanOrEqual(t.tileH);
      expect(t.left).toBeGreaterThanOrEqual(0);
      expect(t.right, `${t.text} fits inside its tile`).toBeLessThanOrEqual(t.tileW);
    }
  });
}

test('hero caption makes no claim about a specific product', async ({ page }) => {
  await open(page);
  await expect(section(page, 'hero').locator('a[href^="product.html"]')).toHaveCount(0);
  await expect(section(page, 'hero').locator('.home-hero__caption a')).toHaveAttribute('href', 'shop.html');
});

test('bestsellers shows exactly the first four bestseller-tagged products in featured order', async ({ page }) => {
  const errors = await open(page);
  const cards = section(page, 'bestsellers').locator('.product-card');
  await expect(cards).toHaveCount(4);
  const ids = await cards.locator('.product-card__link').evaluateAll((els) =>
    els.map((a) => new URL(a.href).searchParams.get('id')));
  const expected = await page.evaluate(() =>
    Shop.catalogue.sortProducts(Shop.products.filter((p) => p.tags.indexOf('bestseller') >= 0), 'featured')
      .slice(0, 4).map((p) => p.id));
  expect(ids).toEqual(expected);
  const tagged = await page.evaluate((list) =>
    list.every((id) => Shop.products.find((p) => p.id === id).tags.indexOf('bestseller') >= 0), ids);
  expect(tagged).toBe(true);
  expect(errors).toEqual([]);
});

test('quiz teaser links to the scent quiz', async ({ page }) => {
  await open(page);
  await expect(section(page, 'quiz').locator('a[href="scent-quiz.html"]')).toHaveCount(1);
  await expect(section(page, 'quiz').locator('h2')).toHaveCount(1);
});

test('house showcase lists the four houses with filtered shop links and counts', async ({ page }) => {
  await open(page);
  const links = section(page, 'houses').locator('a[href^="shop.html?houses="]');
  await expect(links).toHaveCount(4);
  const hrefs = await links.evaluateAll((els) => els.map((a) => a.getAttribute('href')));
  const expected = await page.evaluate(() => {
    const houses = [];
    Shop.products.forEach((p) => { if (houses.indexOf(p.house) < 0) houses.push(p.house); });
    return houses.map((h) => 'shop.html?houses=' + encodeURIComponent(h));
  });
  expect(hrefs).toEqual(expected);
  await expect(section(page, 'houses').locator('h3')).toHaveText(['Maison Noor', 'Velluto Nero', 'Aurelle', 'Sahara Royale']);
  await expect(section(page, 'houses')).toContainText(/3 fragrances/);
});

test('gift banner mentions GIFT15 with the percentage read from config', async ({ page }) => {
  await open(page);
  const pct = await page.evaluate(() => Shop.config.codes.GIFT15.value);
  const banner = section(page, 'gift');
  await expect(banner).toContainText('GIFT15');
  await expect(banner).toContainText(pct + '%');
  await expect(banner.locator('a[href="shop.html?q=gift"]')).toHaveCount(1);
  // S7: the shop link lists every gift-tagged bottle, not boxed sets
  await expect(banner.locator('a[href="shop.html?q=gift"]')).toHaveText('Shop gifts');
  await expect(section(page, 'categories').locator('a[href="shop.html?q=gift"] h3')).toHaveText('Gifts');
  await expect(page.locator('main')).not.toContainText(/gift sets/i);
});

test('three testimonials from customers in Pakistani cities', async ({ page }) => {
  await open(page);
  await expect(section(page, 'testimonials').locator('blockquote')).toHaveCount(3);
  await expect(section(page, 'testimonials').locator('figcaption')).toHaveCount(3);
});

test('newsletter: inline error for a bad email, thank-you for a good one, no network, no storage', async ({ page }) => {
  const errors = await open(page);
  const form = section(page, 'newsletter').locator('form');
  const input = form.locator('input[type="email"]');
  const before = await page.evaluate(() => JSON.stringify(Object.assign({}, localStorage)));
  const requests = [];
  // lazy images scrolling into view are fine; anything else (a form post, a fetch, a beacon) is not
  page.on('request', (r) => {
    if (r.resourceType() === 'image' && /\/assets\/img\//.test(r.url())) return;
    requests.push(r.method() + ' ' + r.url());
  });

  // the concept-store notice sits under the field, from config
  const notice = await page.evaluate(() => Shop.config.conceptNotice);
  await expect(form.locator('[data-concept-note]')).toHaveText(notice);
  await expect(form.locator('[data-concept-note]')).toBeVisible();

  await input.fill('not-an-email');
  await form.locator('button[type="submit"]').click();
  await expect(input).toHaveAttribute('aria-invalid', 'true');
  const errId = (await input.getAttribute('aria-describedby')) || '';
  const error = page.locator('#' + errId.split(' ').filter(Boolean).join(', #'));
  await expect(error.filter({ hasText: /email/i })).toBeVisible();

  await input.fill('');
  await input.fill('ayesha@example.pk');
  await form.locator('button[type="submit"]').click();
  await expect(section(page, 'newsletter')).toContainText(/thank you/i);
  await expect(section(page, 'newsletter')).toContainText('Nothing was sent or saved; this is a concept store.');
  await expect(section(page, 'newsletter').locator('form')).toHaveCount(0);

  expect(requests).toEqual([]);
  const after = await page.evaluate(() => JSON.stringify(Object.assign({}, localStorage)));
  expect(after).toBe(before);
  expect(page.url()).toBe(pageUrl('index'));
  expect(errors).toEqual([]);
});

test('header is transparent over the hero and solid once scrolled', async ({ page }) => {
  await open(page);
  const header = page.locator('header.site-header');
  await expect(header).not.toHaveClass(/is-scrolled/);
  const bg = await header.evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(bg).toBe('rgba(0, 0, 0, 0)');
  await page.evaluate(() => window.scrollTo(0, 200));
  await expect(header).toHaveClass(/is-scrolled/);
});

for (const [label, vp] of [['375', MOBILE], ['768', TABLET], ['1280', DESKTOP]]) {
  test(`no horizontal scroll and no errors at ${label}`, async ({ page }) => {
    const errors = await open(page, vp);
    // reveal everything, then measure
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 20)); }
    });
    const { sw, iw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
    expect(sw).toBeLessThanOrEqual(iw);
    expect(errors).toEqual([]);
  });
}

test('heading outline starts at h1 and never skips a level', async ({ page }) => {
  await open(page);
  const levels = await page.locator('main h1, main h2, main h3, main h4, main h5, main h6').evaluateAll((els) =>
    els.map((h) => Number(h.tagName.slice(1))));
  expect(levels[0]).toBe(1);
  for (let i = 1; i < levels.length; i++) {
    expect(levels[i] - levels[i - 1], `heading ${i} (h${levels[i]}) after h${levels[i - 1]}`).toBeLessThanOrEqual(1);
  }
  expect(levels.filter((l) => l === 1).length).toBe(1);
});

test('keyboard: Tab reaches the hero CTA within 8 presses on mobile', async ({ page }) => {
  await open(page, MOBILE);
  let reached = false;
  for (let i = 0; i < 8 && !reached; i++) {
    await page.keyboard.press('Tab');
    reached = await page.evaluate(() => {
      const a = document.activeElement;
      return !!(a && a.matches('[data-section="hero"] a.btn--primary'));
    });
  }
  expect(reached).toBe(true);
});

test('keyboard: on desktop the skip link leads straight to the hero CTA', async ({ page }) => {
  await open(page, DESKTOP);
  await page.keyboard.press('Tab');
  await expect(page.locator('a.skip-link')).toBeFocused();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Tab');
  await expect(section(page, 'hero').locator('a.btn--primary')).toBeFocused();
});
