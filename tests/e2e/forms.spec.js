// Privacy rule for every form in the site: a form that is not an intentional GET
// form (header/shop search, shop filters) must declare method="post", so a no-JS
// or aborted-init submit never puts names, phones, addresses or emails in the URL.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { pageUrl } = require('./helpers');

const root = path.resolve(__dirname, '..', '..');
const pages = fs.readdirSync(root).filter((f) => /\.html$/.test(f)).map((f) => f.replace(/\.html$/, ''));

for (const name of pages) {
  test('forms: every <form> on ' + name + '.html is an explicit GET search/filter or a POST', async ({ page }) => {
    await page.goto(pageUrl(name));
    await page.waitForLoadState('load');
    await page.waitForSelector('header.site-header');
    const forms = await page.evaluate(() => Array.prototype.map.call(document.querySelectorAll('form'), (f) => ({
      html: f.outerHTML.slice(0, 120),
      method: f.getAttribute('method'),
      search: f.getAttribute('role') === 'search',
      filters: f.matches('[data-shop-filters]')
    })));
    for (const f of forms) {
      const method = (f.method || '').toLowerCase();
      if (f.search || f.filters) expect(method, 'intentional GET form needs an explicit method: ' + f.html).toBe('get');
      else expect(method, 'form must be method="post": ' + f.html).toBe('post');
    }
  });
}

// Pages that render their form only for some state (checkout, product) are covered by source.
for (const name of pages) {
  test('forms: <form> tags in ' + name + '.html source declare the right method', async () => {
    const src = fs.readFileSync(path.join(root, name + '.html'), 'utf8');
    for (const tag of src.match(/<form[^>]*>/g) || []) {
      const m = /method="([^"]*)"/i.exec(tag);
      const method = m ? m[1].toLowerCase() : '';
      if (/role="search"/.test(tag) || /data-shop-filters/.test(tag)) expect(method, tag).toBe('get');
      else expect(method, tag).toBe('post');
    }
  });
}

test('forms: forms written inside JS templates declare a method too', async () => {
  const dir = path.join(root, 'assets', 'js');
  const files = [];
  (function walk(d) {
    fs.readdirSync(d, { withFileTypes: true }).forEach((e) => {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p); else if (/\.js$/.test(e.name)) files.push(p);
    });
  })(dir);
  for (const file of files) {
    const src = fs.readFileSync(file, 'utf8');
    const tags = src.match(/<form\b[^>]*>/g) || [];
    for (const tag of tags) expect(tag, path.basename(file)).toMatch(/\bmethod="(get|post)"/i);
  }
});

test('forms: with JavaScript off, submitting the tracking form puts nothing in the URL', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(pageUrl('track-order'));
  await page.locator('#tk-number').fill('ORD-123456');
  await page.locator('#tk-phone').fill('0300 1234567');
  await page.locator('[data-track-form] button[type="submit"]').click();
  await page.waitForTimeout(500);
  const url = decodeURIComponent(page.url()).replace(/\+/g, ' ');
  expect(url).not.toContain('1234567');
  expect(url).not.toContain('ORD-123456');
  expect(url).not.toMatch(/[?&](order|phone)=/);
  await context.close();
});
