// No test depends on the network (Task 17c). playwright.config.js makes the
// browser resolve the Google Fonts hosts to "not found": the stylesheet request
// fails immediately in every context, the page still loads promptly, and
// collectErrors does not count the failure.
const { test, expect } = require('@playwright/test');
const { pageUrl, collectErrors } = require('./helpers');

const FONT_HOST = /fonts\.googleapis\.com|fonts\.gstatic\.com/;

test('Google Fonts requests fail fast and are not reported as errors', async ({ page }) => {
  const errors = collectErrors(page);
  const failed = [];
  page.on('requestfailed', (r) => { if (FONT_HOST.test(r.url())) failed.push(r.failure().errorText); });
  const t0 = Date.now();
  await page.goto(pageUrl('index'), { waitUntil: 'load' });
  expect(Date.now() - t0, 'load is not held up by the fonts host').toBeLessThan(5000);
  expect(failed.length, 'the fonts stylesheet request was attempted and failed').toBeGreaterThan(0);
  expect(failed.every((e) => /NAME_NOT_RESOLVED|ABORTED|FAILED/.test(e)), failed.join(', ')).toBe(true);
  expect(errors).toEqual([]);
});

test('a context a spec creates itself is offline for fonts too', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const failed = [];
  page.on('requestfailed', (r) => { if (FONT_HOST.test(r.url())) failed.push(r.url()); });
  await page.goto(pageUrl('about'), { waitUntil: 'load' });
  expect(failed.length).toBeGreaterThan(0);
  await context.close();
});
