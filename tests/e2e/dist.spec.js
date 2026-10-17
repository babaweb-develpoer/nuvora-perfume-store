// The deliverable folder (Task 18): `node tools/package.js` builds a dist/ with only
// deployable files. This spec builds it into a temp folder (DIST_DIR, so the real
// dist/ is never touched), opens the key pages from there via file:// and checks that
// they run without errors, that images load, and that config.js decides what ships
// (showcasePages keeps the dashboard and style guide, indexable: false adds noindex).
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { pathToFileURL } = require('url');
const { collectErrors, root } = require('./helpers');

let dist;

test.beforeAll(() => {
  dist = fs.mkdtempSync(path.join(os.tmpdir(), 'perfume-dist-spec-'));
  execFileSync(process.execPath, [path.join(root, 'tools', 'package.js'), '--quiet'], {
    env: { ...process.env, DIST_DIR: dist },
    stdio: 'pipe',
  });
});

test.afterAll(() => {
  if (dist) fs.rmSync(dist, { recursive: true, force: true });
});

// 'product.html?id=mn-01' -> file:// URL with the query kept as a query (not %3F)
const distUrl = (file) => {
  const [name, query] = file.split('?');
  return pathToFileURL(path.join(dist, name)).href + (query ? '?' + query : '');
};

test('dist: showcasePages is true, so the dashboard and style guide ship (the footer links them); no dev folders do', () => {
  const config = require(path.join(root, 'assets', 'js', 'config.js'));
  expect(config.showcasePages).toBe(true);
  expect(fs.existsSync(path.join(dist, 'index.html'))).toBe(true);
  expect(fs.existsSync(path.join(dist, 'admin.html'))).toBe(true);
  expect(fs.existsSync(path.join(dist, 'styleguide.html'))).toBe(true);
  expect(fs.existsSync(path.join(dist, 'assets/js/admin-data.js'))).toBe(true);
  for (const dir of ['tests', 'docs', 'tools', 'node_modules', 'test-results', '.superpowers', '.impeccable']) {
    expect(fs.existsSync(path.join(dist, dir)), dir).toBe(false);
  }
  for (const f of ['package.json', 'README.md', 'playwright.config.js']) {
    expect(fs.existsSync(path.join(dist, f)), f).toBe(false);
  }
  expect(fs.existsSync(path.join(dist, 'assets/img/.gitkeep'))).toBe(false);
});

test('dist: indexable is false, so every built page is noindex, robots.txt disallows all and there is no sitemap', () => {
  const config = require(path.join(root, 'assets', 'js', 'config.js'));
  expect(config.indexable).toBe(false);
  const pages = fs.readdirSync(dist).filter((f) => f.endsWith('.html'));
  expect(pages.length).toBe(18);
  for (const f of pages) {
    const html = fs.readFileSync(path.join(dist, f), 'utf8');
    expect((html.match(/<meta name="robots" content="noindex">/g) || []).length, f).toBe(1);
  }
  expect(fs.readFileSync(path.join(dist, 'robots.txt'), 'utf8')).toBe('User-agent: *\nDisallow: /\n');
  expect(fs.existsSync(path.join(dist, 'sitemap.xml'))).toBe(false);
  // the source pages are not touched: only the ones that were already noindex carry it
  expect(fs.readFileSync(path.join(root, 'index.html'), 'utf8')).not.toMatch(/name="robots"/);
});

const PAGES = [
  ['index.html', 'home'],
  ['shop.html', 'shop'],
  ['product.html?id=mn-01', 'product'],
  ['cart.html', 'cart'],
  ['checkout.html', 'checkout'],
  ['track-order.html', 'track order'],
  ['admin.html', 'dashboard'],
  ['styleguide.html', 'style guide'],
];

for (const [file, label] of PAGES) {
  test(`dist: ${label} opens from the built folder with no console errors`, async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto(distUrl(file));
    await page.waitForSelector('header.site-header');
    await expect(page.locator('main#main')).toHaveCount(1);
    await page.waitForLoadState('load');
    expect(errors).toEqual([]);
  });
}

test('dist: the home hero poster and a shop product image load', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto(distUrl('index.html'));
  await page.waitForSelector('header.site-header');
  // hero still (hero-1) is an <img> in the hero; the clip's poster is checked by loading its URL
  const hero = page.locator('.home-hero img').first();
  await expect(hero).toBeVisible();
  await expect.poll(() => hero.evaluate((i) => i.naturalWidth)).toBeGreaterThan(0);
  const posterOk = await page.evaluate(() => new Promise((resolve) => {
    const v = document.querySelector('.home-hero video[poster]') || document.querySelector('video[poster]');
    if (!v) return resolve('no poster');
    const im = new Image();
    im.onload = () => resolve(im.naturalWidth > 0);
    im.onerror = () => resolve('poster failed: ' + v.getAttribute('poster'));
    im.src = v.getAttribute('poster');
  }));
  expect(posterOk).toBe(true);

  await page.goto(distUrl('shop.html'));
  await page.waitForSelector('.product-card img');
  const card = page.locator('.product-card img').first();
  await card.scrollIntoViewIfNeeded();
  await expect.poll(() => card.evaluate((i) => i.naturalWidth)).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test('dist: a product page renders its name and photo', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto(distUrl('product.html?id=mn-01'));
  await page.waitForSelector('h1');
  await expect(page.locator('h1').first()).toContainText('Oud Royale');
  const img = page.locator('main img').first();
  await expect.poll(() => img.evaluate((i) => i.naturalWidth)).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});
