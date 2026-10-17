// Media integration (Tasks 17 and 17c): every manifest file is on disk, valid
// and within budget (nothing is missing any more); real media replaces its
// placeholder; anything missing (a file a test breaks on purpose) falls back to a
// readable .ph placeholder with no broken-image icon and no layout shift; videos
// fall back to their poster, then to the placeholder.
const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { pageUrl, collectErrors, KNOWN_MISSING, root } = require('./helpers');
const manifest = require('../../assets/js/media-manifest.js');

const MOBILE = { width: 375, height: 812 };
const DESKTOP = { width: 1280, height: 900 };
const KB = 1024;
const IMAGE_BUDGET = 600 * KB;
const VIDEO_BUDGET = 3 * KB * KB;

// ------------------------------------------------------------------ helpers

/** Width and height from a baseline or progressive JPEG's SOF marker. */
function jpegSize(buf) {
  let i = 2;
  while (i < buf.length) {
    if (buf[i] !== 0xff) { i++; continue; }
    const marker = buf[i + 1];
    const len = buf.readUInt16BE(i + 2);
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
    }
    i += 2 + len;
  }
  return null;
}

function aspectOf(a) {
  const [w, h] = String(a).split(':').map(Number);
  return w / h;
}

/**
 * Point the given slots (every slot when `ids` is 'all') at synthetic missing
 * files the moment media-manifest.js publishes Shop.media, before any page
 * script reads it, so the page renders those slots exactly as it would with
 * the files absent.
 */
async function breakMedia(page, ids) {
  await page.addInitScript((which) => {
    const Shop = window.Shop = window.Shop || {};
    Object.defineProperty(Shop, 'media', {
      configurable: true,
      set(m) {
        Object.keys(m).forEach((id) => {
          const e = m[id];
          const hit = which === 'all' || (Array.isArray(which) && which.includes(id));
          if (hit) e.file = e.file.replace(/[^/]+$/, '__missing-' + id + (e.kind === 'video' ? '.mp4' : '.jpg'));
        });
        Object.defineProperty(Shop, 'media', { value: m, writable: true, configurable: true, enumerable: true });
      },
    });
  }, ids);
}

/**
 * Layout shift (CLS: sum of 'layout-shift' entries without recent input) that
 * happens once the shell has mounted, i.e. while media loads, fails and is
 * swapped. The shell's own first-paint shift (header/demo bar injected by
 * ui.js) is not a media effect: counting starts when shellMounted()
 * resolves.
 */
async function trackCls(page) {
  await page.addInitScript(() => {
    window.__cls = 0;
    window.__clsFrom = Infinity;
    try {
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) {
          if (!e.hadRecentInput && e.startTime >= window.__clsFrom) window.__cls += e.value;
        }
      }).observe({ type: 'layout-shift', buffered: true });
    } catch (e) { /* unsupported */ }
  });
}

async function shellMounted(page) {
  await page.waitForSelector('header.site-header');
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => {
    window.__clsFrom = performance.now();
    r();
  }))));
}

async function seedStore(page) {
  await page.goto(pageUrl('styleguide'));
  await page.evaluate(() => {
    try { localStorage.clear(); } catch (e) {}
    ['mn-01', 'sr-02', 'vn-01'].forEach((id) => Shop.store.toggleWishlist(id));
    Shop.store.addToCart('mn-01', 50, 1);
    Shop.store.addToCart('sr-02', 50, 1);
  });
}

/** Scroll the whole page so lazy media loads (or fails), then settle. */
async function scrollThrough(page) {
  await page.evaluate(async () => {
    // fetch every lazy image now, so a missing file fails (and is swapped) within the test
    document.querySelectorAll('img[loading="lazy"]').forEach((i) => { i.loading = 'eager'; });
    const step = Math.max(200, window.innerHeight * 0.8);
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      window.scrollTo({ top: y, behavior: 'instant' });
      await new Promise((r) => setTimeout(r, 40));
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
  });
  await page.evaluate(() => Promise.all(Array.from(document.images)
    .filter((i) => !i.complete)
    .map((i) => new Promise((r) => { i.addEventListener('load', r); i.addEventListener('error', r); setTimeout(r, 3000); }))));
  await page.waitForTimeout(250);
}

/** Every .media box: is its placeholder showing, or a decoded image/video on top? */
function mediaReport(page) {
  // boxes inside closed UI (the cart drawer) have no size and are skipped
  return page.evaluate(() => Array.from(document.querySelectorAll('.media')).filter((box) => box.getBoundingClientRect().width > 0).map((box) => {
    const r = box.getBoundingClientRect();
    const ph = box.querySelector(':scope > .ph');
    const img = box.querySelector(':scope > img');
    const vid = box.querySelector(':scope > video');
    const visible = (el) => !!el && getComputedStyle(el).display !== 'none' &&
      getComputedStyle(el).visibility !== 'hidden' && el.getBoundingClientRect().width > 0;
    return {
      slot: (img || vid || box).getAttribute('data-slot') || box.parentElement.getAttribute('data-media') || '',
      w: r.width, h: r.height,
      ph: visible(ph),
      phInHiddenHost: !!ph && getComputedStyle(ph).display === 'none',
      brokenImg: !!img && img.complete && img.naturalWidth === 0 && visible(img),
      img: !!img && img.complete && img.naturalWidth > 0,
      video: !!vid,
    };
  }));
}

// ------------------------------------------------------- (d) files on disk

test('KNOWN_MISSING is empty: the owner delivered every manifest file', () => {
  expect(KNOWN_MISSING).toEqual([]);
});

test('every manifest file exists, is a real JPEG/MP4 of the manifest shape and fits the size budget', () => {
  const ids = Object.keys(manifest);
  // 31 content images (hero x2, 12 products, 4 categories, 4 lifestyle, 3 about,
  // 4 banners, 2 gift) + og, 4 posters, 4 videos
  expect(ids.length).toBe(40);
  for (const id of ids) {
    const e = manifest[id];
    const file = path.join(root, e.file);
    expect(fs.existsSync(file), e.file + ' exists').toBe(true);
    const buf = fs.readFileSync(file);
    if (e.kind === 'video') {
      expect(buf.toString('latin1', 4, 8), e.file + ' is MP4').toBe('ftyp');
      expect(buf.length, e.file + ' size').toBeLessThan(VIDEO_BUDGET);
      // faststart: the moov index precedes the media data, so playback starts early
      expect(buf.indexOf('moov'), e.file + ' faststart').toBeLessThan(buf.indexOf('mdat'));
    } else {
      expect([buf[0], buf[1], buf[2]], e.file + ' is JPEG').toEqual([0xff, 0xd8, 0xff]);
      expect(buf.length, e.file + ' size').toBeLessThan(IMAGE_BUDGET);
      const size = jpegSize(buf);
      expect(size, e.file + ' SOF').toBeTruthy();
      // the manifest aspect is the box Shop.ui.media reserves: it must match the file
      expect(Math.abs(size.w / size.h - aspectOf(e.aspect)) / aspectOf(e.aspect), e.file + ' aspect ' + e.aspect)
        .toBeLessThan(0.02);
      expect(Math.max(size.w, size.h), e.file + ' long edge').toBeLessThanOrEqual(2000);
      // products are served at 1600 px at most (the largest product frame is about 800 css px)
      if (/^product-/.test(id)) expect(Math.max(size.w, size.h), e.file + ' product long edge').toBeLessThanOrEqual(1600);
    }
  }
});

test('og.jpg is a 1200x630 social card and every page points og:image at it', () => {
  const size = jpegSize(fs.readFileSync(path.join(root, 'assets/img/og.jpg')));
  expect(size).toEqual({ w: 1200, h: 630 });
  const config = require('../../assets/js/config.js');
  const expected = new URL('assets/img/og.jpg', config.siteUrl).href;
  const pages = fs.readdirSync(root).filter((f) => f.endsWith('.html'));
  expect(pages.length).toBeGreaterThan(10);
  for (const f of pages) {
    const html = fs.readFileSync(path.join(root, f), 'utf8');
    const m = html.match(/<meta property="og:image" content="([^"]+)"/);
    expect(m && m[1], f + ' og:image').toBe(expected);
  }
  expect(fs.existsSync(path.join(root, 'assets/img/favicon.svg'))).toBe(true);
});

// ------------------------------------------- collectErrors tolerance (helpers)

test('collectErrors tolerates synthetic misses only: a made-up missing media file still fails', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto(pageUrl('styleguide'));
  await page.evaluate(() => {
    const add = (src) => new Promise((r) => {
      const i = document.createElement('img');
      i.onload = i.onerror = r;
      i.src = src;
      document.body.appendChild(i);
    });
    return Promise.all([
      add('assets/img/product-mn-02.jpg'), // delivered: loads, nothing to report
      add('assets/img/__missing-probe.jpg'), // synthetic: tolerated
      add('assets/img/not-a-manifest-file.jpg'), // a typo or lost file: must be reported
    ]);
  });
  await page.waitForTimeout(200);
  expect(errors.length).toBeGreaterThan(0);
  expect(errors.every((e) => e.includes('not-a-manifest-file.jpg'))).toBe(true);
  // the delivered photo decoded
  expect(await page.evaluate(() => Array.from(document.images)
    .some((i) => /product-mn-02\.jpg$/.test(i.src) && i.naturalWidth > 0))).toBe(true);
});

// ----------------------------------------- (a) missing media: placeholders

const PAGES = [
  ['index', MOBILE], ['index', DESKTOP],
  ['shop', DESKTOP], ['product.html?id=sr-02', MOBILE], ['product.html?id=mn-01', DESKTOP],
  ['about', MOBILE], ['brands', DESKTOP], ['brands', MOBILE], ['wishlist', DESKTOP], ['cart', MOBILE],
];

for (const [name, vp] of PAGES) {
  test(`no media files: ${name} at ${vp.width} shows placeholders, no broken image, CLS < 0.1`, async ({ page }) => {
    await page.setViewportSize(vp);
    await seedStore(page);
    const errors = collectErrors(page);
    await breakMedia(page, 'all');
    await trackCls(page);
    await page.goto(name.includes('.html') ? pageUrl('index').replace('index.html', name) : pageUrl(name));
    await shellMounted(page);
    await scrollThrough(page);
    const boxes = await mediaReport(page);
    expect(boxes.length).toBeGreaterThan(0);
    for (const b of boxes) {
      expect(b.brokenImg, b.slot + ' broken image').toBe(false);
      expect(b.img, b.slot + ' decoded nothing').toBe(false);
      expect(b.video, b.slot + ' video gone').toBe(false);
      // the hero clip layer deliberately hides its own placeholder: the still's shows instead
      if (!b.phInHiddenHost) {
        expect(b.ph, b.slot + ' placeholder visible').toBe(true);
        expect(b.w * b.h, b.slot + ' placeholder has a box').toBeGreaterThan(0);
      }
    }
    expect(await page.evaluate(() => window.__cls)).toBeLessThan(0.1);
    expect(errors).toEqual([]);
  });
}

test('missing product photos show the named placeholder (and only those cards do)', async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  const errors = collectErrors(page);
  await breakMedia(page, ['product-sr-02', 'product-au-01']);
  await page.goto(pageUrl('shop'));
  await page.waitForSelector('.product-card');
  await scrollThrough(page);
  // every other card shows its delivered photograph
  const decoded = await page.evaluate(() => Array.from(document.querySelectorAll('.product-card img[data-slot]'))
    .filter((i) => i.complete && i.naturalWidth > 0).map((i) => i.getAttribute('data-slot')).sort());
  expect(decoded).toEqual(['product-au-02', 'product-au-03', 'product-mn-01', 'product-mn-02', 'product-mn-03',
    'product-sr-01', 'product-sr-03', 'product-vn-01', 'product-vn-02', 'product-vn-03']);
  for (const id of ['sr-02', 'au-01']) {
    const card = page.locator(`.product-card:has([data-wish="${id}"])`).first();
    const ph = card.locator('.media .ph');
    await expect(ph).toBeVisible();
    await expect(ph).toHaveAttribute('role', 'img');
    expect(await ph.getAttribute('aria-label')).toBeTruthy();
    expect(await card.locator('.media img').count()).toBe(0);
  }
  expect(errors).toEqual([]);
});

// ----------------------------------------- (b) real media replaces the placeholder

test('real photographs decode and cover their placeholder (home, shop, product)', async ({ page }) => {
  const errors = collectErrors(page);
  await page.setViewportSize(DESKTOP);
  await trackCls(page);
  await page.goto(pageUrl('index'));
  await shellMounted(page);
  await page.waitForSelector('[data-media="cat-men"] img');
  await scrollThrough(page);
  const covered = (sel) => page.evaluate((s) => {
    const img = document.querySelector(s);
    if (!img || !img.complete || img.naturalWidth === 0) return 'not decoded';
    // layout boxes, not transformed rects: the hero still settles in with a scale animation
    const box = img.parentElement;
    if (Math.abs(img.offsetWidth - box.clientWidth) > 1 || Math.abs(img.offsetHeight - box.clientHeight) > 1) return 'does not fill its box';
    img.scrollIntoView({ block: 'center', behavior: 'instant' }); // the site scrolls smoothly
    // hit-test the media layers themselves, whatever overlays or pointer-events say
    const probe = document.createElement('style');
    probe.textContent = '.media, .media > * { pointer-events: auto !important; }';
    document.head.appendChild(probe);
    const c = img.getBoundingClientRect();
    const stack = document.elementsFromPoint(c.left + c.width / 2, c.top + c.height / 2);
    const ph = img.parentElement.querySelector('.ph');
    const iImg = stack.indexOf(img);
    const iPh = stack.indexOf(ph);
    probe.remove();
    if (iImg < 0) return 'image not painted';
    if (iPh >= 0 && iPh < iImg) return 'placeholder on top';
    return getComputedStyle(img).objectFit;
  }, sel);
  for (const slot of ['hero-1', 'cat-men', 'cat-women', 'cat-unisex-oud', 'cat-gift', 'banner-3', 'lifestyle-1']) {
    expect(await covered(`img[data-slot="${slot}"]`), slot).toBe('cover');
  }
  expect(await page.evaluate(() => window.__cls)).toBeLessThan(0.1);

  await page.goto(pageUrl('shop'));
  await page.waitForSelector('.product-card');
  await scrollThrough(page);
  for (const id of ['mn-01', 'vn-02', 'au-01', 'sr-01', 'sr-02', 'sr-03']) {
    expect(await covered(`img[data-slot="product-${id}"]`), id).toBe('cover');
  }

  await page.goto(pageUrl('index').replace('index.html', 'product.html?id=sr-02'));
  await page.waitForSelector('img[data-slot="product-sr-02"]');
  await scrollThrough(page);
  expect(await covered('img[data-slot="product-sr-02"]')).toBe('cover');
  expect(errors).toEqual([]);
});

test('about and brands photographs decode in place', async ({ page }) => {
  const errors = collectErrors(page);
  await page.setViewportSize(MOBILE);
  for (const [name, slots] of [['about', ['about-1', 'about-2', 'about-3']], ['brands', ['banner-1', 'lifestyle-1', 'cat-men', 'cat-women', 'lifestyle-4']]]) {
    await page.goto(pageUrl(name));
    await page.waitForSelector('[data-ready]');
    await scrollThrough(page);
    for (const s of slots) {
      const ok = await page.evaluate((id) => {
        const i = document.querySelector(`img[data-slot="${id}"]`);
        return !!i && i.naturalWidth > 0;
      }, s);
      expect(ok, name + ' ' + s).toBe(true);
    }
  }
  expect(errors).toEqual([]);
});

// ------------------------------------------------------------- (c) video

test('hero clip: muted inline loop with metadata preload and poster; it plays', async ({ page }) => {
  const errors = collectErrors(page);
  await page.setViewportSize(DESKTOP);
  await page.goto(pageUrl('index'));
  const video = page.locator('video[data-slot="hero-video"]');
  await expect(video).toHaveCount(1);
  const attrs = await video.evaluate((v) => ({
    muted: v.muted, playsinline: v.hasAttribute('playsinline'), loop: v.loop,
    preload: v.getAttribute('preload'), autoplay: v.hasAttribute('autoplay'),
    poster: v.getAttribute('poster'),
  }));
  expect(attrs).toEqual({ muted: true, playsinline: true, loop: true, preload: 'metadata', autoplay: true,
    poster: 'assets/img/poster-hero-video.jpg' });
  await expect.poll(() => video.evaluate((v) => v.readyState), { timeout: 10000 }).toBeGreaterThanOrEqual(2);
  const t0 = await video.evaluate((v) => v.currentTime);
  await page.waitForTimeout(800);
  expect(await video.evaluate((v) => v.currentTime)).toBeGreaterThan(t0);
  expect(await video.evaluate((v) => v.duration)).toBeCloseTo(8, 0);
  expect(errors).toEqual([]);
});

test('reduced motion: the hero clip does not autoplay and shows its poster', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize(DESKTOP);
  await page.goto(pageUrl('index'));
  const video = page.locator('video[data-slot="hero-video"]');
  await expect(video).toHaveCount(1);
  expect(await video.evaluate((v) => v.hasAttribute('autoplay'))).toBe(false);
  await page.waitForTimeout(600);
  expect(await video.evaluate((v) => v.paused && v.currentTime === 0)).toBe(true);
  // the poster file itself decodes
  expect(await page.evaluate(() => new Promise((r) => {
    const i = new Image(); i.onload = () => r(i.naturalWidth); i.onerror = () => r(0);
    i.src = document.querySelector('video[data-slot="hero-video"]').poster;
  }))).toBeGreaterThan(0);
});

test('a missing clip falls back to its poster image', async ({ page }) => {
  const errors = collectErrors(page);
  await page.setViewportSize(DESKTOP);
  await breakMedia(page, ['hero-video']);
  await page.goto(pageUrl('index'));
  const stage = page.locator('[data-media="hero-video"]');
  await expect(stage.locator('video')).toHaveCount(0);
  const poster = stage.locator('img[data-slot="poster-hero-video"]');
  await expect(poster).toHaveCount(1);
  await expect.poll(() => poster.evaluate((i) => i.complete && i.naturalWidth > 0)).toBe(true);
  expect(errors).toEqual([]);
});

test('a missing clip AND poster fall back to the placeholder, keeping the box', async ({ page }) => {
  const errors = collectErrors(page);
  await page.setViewportSize(DESKTOP);
  await breakMedia(page, ['scent-video', 'poster-scent-video']);
  await page.goto(pageUrl('styleguide'));
  await page.evaluate(() => {
    const host = document.createElement('div');
    host.id = 'probe';
    host.style.width = '480px';
    host.innerHTML = Shop.ui.media('scent-video');
    document.getElementById('main').appendChild(host);
    host.scrollIntoView({ behavior: 'instant' }); // the poster fallback is lazy, like every poster
  });
  const box = page.locator('#probe .media');
  await expect.poll(() => box.evaluate((b) => !b.querySelector('video') && !b.querySelector('img'))).toBe(true);
  await expect(box.locator('.ph')).toBeVisible();
  await expect(box.locator('.ph')).toHaveAttribute('role', 'img');
  const r = await box.evaluate((b) => b.getBoundingClientRect().width / b.getBoundingClientRect().height);
  expect(r).toBeCloseTo(16 / 9, 1);
  expect(errors).toEqual([]);
});

// ------------------------------------- (c2) clips below the fold (Task 17c)

const IN_VIEW_CLIPS = [
  ['about', 'about-video'], ['scent-quiz', 'scent-video'], ['shipping-returns', 'gift-video'],
];

for (const [name, slot] of IN_VIEW_CLIPS) {
  test(`${slot} on ${name}: muted inline loop, metadata only, poster, no autoplay; plays only in view`, async ({ page }) => {
    const errors = collectErrors(page);
    await page.setViewportSize(DESKTOP);
    await page.goto(pageUrl(name));
    const video = page.locator(`video[data-slot="${slot}"]`);
    await expect(video).toHaveCount(1);
    const attrs = await video.evaluate((v) => ({
      muted: v.muted, playsinline: v.hasAttribute('playsinline'), loop: v.loop,
      preload: v.getAttribute('preload'), autoplay: v.hasAttribute('autoplay'),
      poster: v.getAttribute('poster'), play: v.getAttribute('data-play'),
    }));
    expect(attrs).toEqual({ muted: true, playsinline: true, loop: true, preload: 'metadata', autoplay: false,
      poster: 'assets/img/poster-' + slot + '.jpg', play: 'inview' });
    // the poster decodes
    expect(await video.evaluate((v) => new Promise((r) => {
      const i = new Image(); i.onload = () => r(i.naturalWidth); i.onerror = () => r(0); i.src = v.poster;
    }))).toBeGreaterThan(0);
    // on screen: it plays and time advances
    await video.evaluate((v) => v.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await expect.poll(() => video.evaluate((v) => !v.paused && v.currentTime > 0.2), { timeout: 10000 }).toBe(true);
    // scrolled away: it pauses
    await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
    const off = await video.evaluate((v) => v.getBoundingClientRect().bottom < 0 || v.getBoundingClientRect().top > innerHeight);
    if (off) await expect.poll(() => video.evaluate((v) => v.paused)).toBe(true);
    expect(errors).toEqual([]);
  });
}

test('reduced motion: no clip below the fold ever plays; the poster shows', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize(DESKTOP);
  for (const [name, slot] of IN_VIEW_CLIPS) {
    await page.goto(pageUrl(name));
    const video = page.locator(`video[data-slot="${slot}"]`);
    await video.evaluate((v) => v.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await page.waitForTimeout(700);
    expect(await video.evaluate((v) => v.paused && v.currentTime === 0), name).toBe(true);
  }
});

test('one clip at a time: scrolling from the home hero pauses it; the quiz clip pauses once the quiz begins', async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  await page.goto(pageUrl('index'));
  const hero = page.locator('video[data-slot="hero-video"]');
  await expect.poll(() => hero.evaluate((v) => !v.paused)).toBe(true);
  await page.evaluate(() => window.scrollTo({ top: innerHeight * 3, behavior: 'instant' }));
  await expect.poll(() => hero.evaluate((v) => v.paused)).toBe(true);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await expect.poll(() => hero.evaluate((v) => !v.paused)).toBe(true);

  await page.goto(pageUrl('scent-quiz'));
  const clip = page.locator('video[data-slot="scent-video"]');
  await expect.poll(() => clip.evaluate((v) => !v.paused), { timeout: 10000 }).toBe(true);
  await page.locator('[data-qz-begin]').click();
  await expect.poll(() => clip.evaluate((v) => v.paused)).toBe(true);
  expect(await page.evaluate(() => document.querySelectorAll('video').length)).toBe(1);
  expect(await page.evaluate(() => Array.from(document.querySelectorAll('video')).filter((v) => !v.paused).length)).toBe(0);
});
