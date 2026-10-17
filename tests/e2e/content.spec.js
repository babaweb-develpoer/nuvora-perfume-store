// Brands and content pages (Task 14): brands, about, contact, FAQ, shipping &
// returns, fragrance guide and 404. Every number a shopper relies on (counts,
// price ranges, fees, thresholds, code percentages) is computed from
// Shop.products / Shop.config in the page and compared here, never hard-coded.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { pageUrl, collectErrors, routeConfig, TEST_WHATSAPP } = require('./helpers');

const root = path.resolve(__dirname, '..', '..');

const MOBILE = { width: 375, height: 812 };
const TABLET = { width: 768, height: 1024 };
const DESKTOP = { width: 1280, height: 900 };

const PAGES = ['brands', 'about', 'contact', 'faq', 'shipping-returns', 'fragrance-guide', '404'];
const HOUSES = ['Maison Noor', 'Velluto Nero', 'Aurelle', 'Sahara Royale'];
const FAMILIES = ['oud', 'woody', 'floral', 'fresh'];
const FAQ_GROUPS = ['faq-authenticity', 'faq-ordering', 'faq-delivery', 'faq-returns', 'faq-care'];

async function open(page, name, viewport = DESKTOP) {
  const errors = collectErrors(page);
  await page.setViewportSize(viewport);
  await page.goto(pageUrl(name));
  await page.waitForSelector('header.site-header');
  await page.waitForSelector('body[data-ready]');
  return errors;
}

async function revealAll(page) {
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 15)); }
    window.scrollTo(0, 0);
  });
}

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// =================================================================== brands

test('brands: four houses, each with a deep-link id and a filtered shop link', async ({ page }) => {
  const errors = await open(page, 'brands');
  await expect(page.locator('h1')).toHaveText(/The houses/);
  const sections = page.locator('[data-house]');
  await expect(sections).toHaveCount(4);
  for (const name of HOUSES) {
    const sec = page.locator('#' + slug(name));
    await expect(sec, name).toHaveCount(1);
    await expect(sec).toHaveAttribute('data-house', name);
    await expect(sec.locator('h2')).toContainText(name);
    const cta = sec.locator('a[data-house-cta]');
    await expect(cta).toHaveAttribute('href', 'shop.html?houses=' + encodeURIComponent(name));
  }
  expect(errors).toEqual([]);
});

test('brands: fragrance count and price range are computed from Shop.products', async ({ page }) => {
  await open(page, 'brands');
  const rows = await page.evaluate(() => {
    const fmt = Shop.util.formatPKR;
    return Array.prototype.map.call(document.querySelectorAll('[data-house]'), (sec) => {
      const name = sec.getAttribute('data-house');
      const list = Shop.products.filter((p) => p.house === name);
      const prices = [];
      list.forEach((p) => p.sizes.forEach((s) => prices.push(s.price)));
      return {
        name,
        count: list.length,
        min: fmt(Math.min.apply(null, prices)),
        max: fmt(Math.max.apply(null, prices)),
        countText: sec.querySelector('[data-house-count]').textContent,
        rangeText: sec.querySelector('[data-house-range]').textContent,
        scents: list.map((p) => p.name),
        scentText: (sec.querySelector('[data-house-scents]') || { textContent: '' }).textContent
      };
    });
  });
  expect(rows).toHaveLength(4);
  for (const r of rows) {
    expect(r.count, r.name).toBeGreaterThan(0);
    expect(r.countText, r.name).toContain(String(r.count));
    expect(r.rangeText, r.name).toContain(r.min);
    expect(r.rangeText, r.name).toContain(r.max);
    for (const s of r.scents) expect(r.scentText, r.name).toContain(s);
  }
});

test('brands: explains how houses are chosen and links to the quiz', async ({ page }) => {
  await open(page, 'brands');
  await expect(page.locator('main a[href="scent-quiz.html"]').first()).toBeVisible();
  await expect(page.locator('main')).toContainText(/how we choose/i);
  await expect(page.locator('.site-nav__link[data-nav-key="brands"]')).toHaveAttribute('aria-current', 'page');
});

// ==================================================================== about

test('about: story images, promises, a four-step order timeline and a shop CTA', async ({ page }) => {
  const errors = await open(page, 'about');
  await expect(page.locator('h1')).toBeVisible();
  for (const slot of ['about-1', 'about-2', 'about-3']) {
    await expect(page.locator('[data-media="' + slot + '"] .media')).toHaveCount(1);
  }
  const main = page.locator('main');
  await expect(main).toContainText(/sealed/i);
  await expect(main).toContainText(/cash on delivery/i);
  await expect(page.locator('[data-timeline] > li')).toHaveCount(4);
  await expect(main.locator('a[href="shop.html"]').first()).toBeVisible();
  await expect(page.locator('.site-nav__link[data-nav-key="about"]')).toHaveAttribute('aria-current', 'page');
  expect(errors).toEqual([]);
});

// ================================================================== contact

const form = (page) => page.locator('[data-contact-form]');
const field = (page, id) => page.locator('#' + id);

test('contact: the form is a POST to # with the concept-store notice from config', async ({ page }) => {
  await open(page, 'contact');
  await expect(form(page)).toHaveAttribute('method', 'post');
  await expect(form(page)).toHaveAttribute('action', '#');
  const notice = await page.evaluate(() => Shop.config.conceptNotice);
  expect(notice).toBe('Concept store: orders and messages are not delivered.');
  await expect(page.locator('.ct-panel [data-concept-note]')).toHaveText(notice);
  await expect(page.locator('.ct-panel [data-concept-note]')).toBeVisible();
  await expect(page.locator('.site-nav__link[data-nav-key="contact"]')).toHaveAttribute('aria-current', 'page');
});

test('contact: with a WhatsApp number set, WhatsApp, email, phone, address and hours come from config', async ({ page }) => {
  await routeConfig(page, { whatsapp: TEST_WHATSAPP });
  await open(page, 'contact');
  const c = await page.evaluate(() => Shop.config);
  expect(c.whatsapp).toBe(TEST_WHATSAPP);
  const wa = page.locator('a[data-contact-wa]');
  await expect(wa).toBeVisible();
  await expect(wa).toHaveText('Message us on WhatsApp');
  expect(await wa.getAttribute('href')).toMatch(new RegExp('^https://wa\\.me/' + c.whatsapp + '\\?text=.+'));
  await expect(page.locator('a[data-contact-mail]')).toHaveAttribute('href', 'mailto:' + c.email);
  await expect(page.locator('a[data-contact-tel]')).toHaveAttribute('href', 'tel:+' + c.whatsapp);
  await expect(page.locator('a[data-contact-tel]')).toBeVisible();
  await expect(page.locator('[data-contact-write]')).toBeHidden();
  expect(c.hours).toBeTruthy();
  await expect(page.locator('main')).toContainText(c.address);
  await expect(page.locator('main')).toContainText(c.hours);
});

test('contact: without a WhatsApp number (the default) there is no WhatsApp card, call card or wa.me link', async ({ page }) => {
  const errors = await open(page, 'contact');
  const c = await page.evaluate(() => Shop.config);
  expect(c.whatsapp).toBe('');
  expect(c.email).toBe('hello@nuvora.example');
  expect(c.address).toBe('Gulberg, Lahore');
  await expect(page.locator('a[href*="wa.me"]')).toHaveCount(0);
  await expect(page.locator('a[href^="tel:"]')).toHaveCount(0);
  await expect(page.locator('a[data-contact-wa]')).toBeHidden();
  await expect(page.locator('a[data-contact-tel]')).toBeHidden();
  const write = page.locator('a[data-contact-write]');
  await expect(write).toBeVisible();
  await expect(write).toHaveAttribute('href', '#ct-form-title');
  await expect(page.locator('a[data-contact-mail]')).toHaveAttribute('href', 'mailto:hello@nuvora.example');
  await expect(page.locator('main')).toContainText('Gulberg, Lahore');
  expect(errors).toEqual([]);
});

test('contact: an empty submit shows inline errors and focuses the first invalid field', async ({ page }) => {
  const errors = await open(page, 'contact');
  await form(page).locator('button[type="submit"]').click();
  for (const id of ['ct-name', 'ct-email', 'ct-message']) {
    await expect(field(page, id)).toHaveAttribute('aria-invalid', 'true');
    const err = page.locator('#' + id + '-err');
    await expect(err).toBeVisible();
    await expect(err).not.toHaveText('');
    expect(await field(page, id).getAttribute('aria-describedby')).toContain(id + '-err');
  }
  // the optional mobile number is not an error when empty
  await expect(field(page, 'ct-phone')).not.toHaveAttribute('aria-invalid', 'true');
  await expect(field(page, 'ct-name')).toBeFocused();
  await expect(page.locator('[data-contact-success]')).toBeHidden();
  expect(page.url()).toBe(pageUrl('contact'));
  expect(errors).toEqual([]);
});

test('contact: invalid email, invalid phone and a short message are rejected', async ({ page }) => {
  await open(page, 'contact');
  await field(page, 'ct-name').fill('Ayesha Khan');
  await field(page, 'ct-phone').fill('abc');
  await field(page, 'ct-email').fill('ayesha@');
  await field(page, 'ct-message').fill('Too short');
  await form(page).locator('button[type="submit"]').click();
  await expect(field(page, 'ct-name')).not.toHaveAttribute('aria-invalid', 'true');
  expect(await field(page, 'ct-name').getAttribute('aria-describedby') || '').not.toContain('ct-name-err');
  for (const id of ['ct-phone', 'ct-email', 'ct-message']) {
    await expect(field(page, id)).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('#' + id + '-err')).toBeVisible();
  }
  await expect(field(page, 'ct-phone')).toBeFocused();
  await expect(page.locator('[data-contact-success]')).toBeHidden();
  // fixing a field clears its error as you type
  await field(page, 'ct-email').fill('ayesha@example.com');
  await expect(field(page, 'ct-email')).not.toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#ct-email-err')).toBeHidden();
});

test('contact: clicking Send straight from a half-filled field still submits (no lost click) on a phone', async ({ page }) => {
  await open(page, 'contact', MOBILE);
  await field(page, 'ct-phone').fill('abc');
  await field(page, 'ct-message').fill('Too short');
  // focus is still in the message box: the click must not be swallowed by a layout shift
  await form(page).locator('button[type="submit"]').click();
  await expect(field(page, 'ct-name')).toHaveAttribute('aria-invalid', 'true');
  await expect(field(page, 'ct-email')).toHaveAttribute('aria-invalid', 'true');
  await expect(field(page, 'ct-name')).toBeFocused();
});

test('contact: leaving a field with a bad value explains the problem', async ({ page }) => {
  await open(page, 'contact');
  await field(page, 'ct-email').fill('ayesha@');
  await field(page, 'ct-email').press('Tab');
  await expect(field(page, 'ct-email')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#ct-email-err')).toBeVisible();
});

test('contact: the message counter counts down without announcing every keystroke', async ({ page }) => {
  await open(page, 'contact');
  const counter = page.locator('[data-ct-count]');
  await expect(counter).toContainText('1000');
  await field(page, 'ct-message').fill('Hello there');
  await expect(counter).toContainText(String(1000 - 'Hello there'.length));
  const live = await counter.evaluate((el) => el.getAttribute('aria-live') || (el.closest('[aria-live]') || {}).getAttribute && el.closest('[aria-live]').getAttribute('aria-live'));
  expect(live === null || live === undefined || live === 'off').toBe(true);
  expect(await field(page, 'ct-message').getAttribute('maxlength')).toBe('1000');
});

test('contact: a valid message shows the thank-you, clears the form, sends and stores nothing', async ({ page }) => {
  const errors = await open(page, 'contact');
  const before = await page.evaluate(() => JSON.stringify(Object.assign({}, localStorage)));
  const requests = [];
  page.on('request', (r) => requests.push(r.url()));
  await field(page, 'ct-name').fill('Ayesha Khan');
  await field(page, 'ct-phone').fill('0300 1234567');
  await field(page, 'ct-email').fill('ayesha@example.com');
  await field(page, 'ct-topic').selectOption({ label: 'Gifting' });
  await field(page, 'ct-message').fill('I would like a gift box for my mother, something with rose.');
  await form(page).locator('button[type="submit"]').click();
  const ok = page.locator('[data-contact-success]');
  await expect(ok).toBeVisible();
  await expect(ok).toContainText('Thank you. Messages from this site are not delivered.');
  await expect(ok).not.toContainText(/reply within/i);
  // no WhatsApp number configured: no WhatsApp line in the thank-you
  await expect(ok.locator('a[data-wa]')).toBeHidden();
  expect(await ok.innerText()).not.toMatch(/whatsapp/i);
  await expect(ok).toBeFocused();
  for (const id of ['ct-name', 'ct-phone', 'ct-email', 'ct-message']) await expect(field(page, id)).toHaveValue('');
  await page.waitForTimeout(300);
  expect(requests.filter((u) => !/^file:/.test(u)), 'no network request').toEqual([]);
  const after = await page.evaluate(() => JSON.stringify(Object.assign({}, localStorage)));
  expect(after).toBe(before);
  expect(page.url()).toBe(pageUrl('contact'));
  expect(errors).toEqual([]);
});

test('contact: the topic select offers the four topics', async ({ page }) => {
  await open(page, 'contact');
  const labels = await field(page, 'ct-topic').locator('option').allTextContents();
  for (const t of ['Order help', 'Product advice', 'Gifting', 'Other']) expect(labels).toContain(t);
});

// ====================================================================== faq

const items = (page) => page.locator('.faq-item');

test('faq: at least 12 questions across the five categories', async ({ page }) => {
  const errors = await open(page, 'faq');
  expect(await items(page).count()).toBeGreaterThanOrEqual(12);
  for (const id of FAQ_GROUPS) {
    const g = page.locator('#' + id);
    await expect(g, id).toHaveCount(1);
    expect(await g.locator('.faq-item').count(), id).toBeGreaterThanOrEqual(2);
  }
  expect(errors).toEqual([]);
});

test('faq: questions open and close with the mouse and the keyboard', async ({ page }) => {
  await open(page, 'faq');
  const item = items(page).nth(2);
  const summary = item.locator('summary');
  await expect(item).not.toHaveAttribute('open', '');
  await summary.click();
  await expect(item).toHaveAttribute('open', '');
  await expect(item.locator('.accordion__content')).toBeVisible();
  await summary.click();
  await expect(item).not.toHaveAttribute('open', '');
  await summary.focus();
  await page.keyboard.press('Enter');
  await expect(item).toHaveAttribute('open', '');
  await page.keyboard.press('Space');
  await expect(item).not.toHaveAttribute('open', '');
  await page.keyboard.press('Space');
  await expect(item).toHaveAttribute('open', '');
});

test('faq: category links jump to their section', async ({ page }) => {
  await open(page, 'faq');
  const links = page.locator('[data-faq-rail] a');
  await expect(links).toHaveCount(5);
  for (const id of FAQ_GROUPS) await expect(page.locator('[data-faq-rail] a[href="#' + id + '"]')).toHaveCount(1);
  await page.locator('[data-faq-rail] a[href="#faq-care"]').first().click();
  await expect(page).toHaveURL(/#faq-care$/);
  await expect(page.locator('#faq-care')).toBeInViewport();
});

test('faq: FAQPage JSON-LD matches the questions on the page', async ({ page }) => {
  await open(page, 'faq');
  const raw = await page.locator('script[type="application/ld+json"]').first().textContent();
  const data = JSON.parse(raw);
  expect(data['@type']).toBe('FAQPage');
  const dom = (await items(page).locator('summary').allTextContents()).map((s) => s.trim());
  expect(data.mainEntity).toHaveLength(dom.length);
  data.mainEntity.forEach((q, i) => {
    expect(q['@type']).toBe('Question');
    expect(q.name).toBe(dom[i]);
    expect(q.acceptedAnswer['@type']).toBe('Answer');
    expect(q.acceptedAnswer.text.length).toBeGreaterThan(20);
    expect(q.acceptedAnswer.text).not.toMatch(/<[a-z]/i);
  });
});

test('faq: covers the essentials, with figures read from config', async ({ page }) => {
  await open(page, 'faq');
  const c = await page.evaluate(() => ({
    threshold: Shop.util.formatPKR(Shop.config.freeDeliveryThreshold),
    pct: Shop.config.codes.GIFT15.value + '%',
    min: Shop.util.formatPKR(Shop.config.codes.GIFT15.min),
    wrap: Shop.util.formatPKR(Shop.config.giftWrapFee)
  }));
  const text = await page.locator('main').textContent();
  for (const s of [c.threshold, c.pct, c.min, c.wrap, 'GIFT15', '7 days', '30', '50', '100 ml']) expect(text).toContain(s);
  for (const re of [/original/i, /cash on delivery/i, /Karachi/, /Lahore/, /store/i, /exchange/i]) expect(text).toMatch(re);
  await expect(page.locator('main a[href="track-order.html"]').first()).toHaveCount(1);
  await expect(page.locator('main a[href="scent-quiz.html"]').first()).toHaveCount(1);
  await expect(page.locator('.faq-help a[href="contact.html"]').first()).toBeVisible();
  // no WhatsApp number by default: help links go to the contact page, never wa.me
  await expect(page.locator('a[href*="wa.me"]')).toHaveCount(0);
});

test('faq: with a WhatsApp number set, the help button and the scent answer link to it', async ({ page }) => {
  await routeConfig(page, { whatsapp: TEST_WHATSAPP });
  await open(page, 'faq');
  const wa = page.locator('main a[href^="https://wa.me/"]');
  expect(await wa.count()).toBeGreaterThanOrEqual(2);
  expect(await wa.first().getAttribute('href')).toContain(TEST_WHATSAPP);
  await expect(page.locator('.faq-help a[data-wa]')).toHaveText('Message us on WhatsApp');
});

test('faq: answers only describe features that exist (no handwritten gift card), in the DOM and the JSON-LD', async ({ page }) => {
  await open(page, 'faq');
  const dom = await page.locator('.faq-answer').allTextContents();
  const ld = JSON.parse(await page.locator('script[type="application/ld+json"]').first().textContent());
  const texts = dom.concat(ld.mainEntity.map((q) => q.acceptedAnswer.text));
  for (const t of texts) expect(t, t.slice(0, 60)).not.toMatch(/handwritten|card/i);
  // the gift answer still carries the wrap fee and the code from config
  const c = await page.evaluate(() => ({
    wrap: Shop.util.formatPKR(Shop.config.giftWrapFee),
    pct: Shop.config.codes.GIFT15.value + '%',
    min: Shop.util.formatPKR(Shop.config.codes.GIFT15.min)
  }));
  const gift = page.locator('.faq-item', { hasText: 'gift wrap' }).first();
  for (const s of [c.wrap, c.pct, c.min, 'GIFT15']) await expect(gift.locator('.faq-answer')).toContainText(s);
});

// Deep links: the target heading must land fully below the sticky header.
async function settledScroll(page) {
  await page.waitForSelector('body[data-ready]');
  let last = -1;
  let same = 0;
  for (let i = 0; i < 60 && same < 4; i++) {
    const y = await page.evaluate(() => window.scrollY);
    same = y === last ? same + 1 : 0;
    last = y;
    await page.waitForTimeout(100);
  }
}

async function expectBelowHeader(page, selector) {
  const r = await page.evaluate((sel) => {
    const t = document.querySelector(sel).getBoundingClientRect();
    const h = document.querySelector('header.site-header').getBoundingClientRect();
    return { top: t.top, bottom: t.bottom, headerBottom: h.bottom, vh: window.innerHeight, y: window.scrollY };
  }, selector);
  expect(r.y, selector + ' page scrolled').toBeGreaterThan(0);
  expect(r.top, selector + ' top below the sticky header').toBeGreaterThanOrEqual(r.headerBottom);
  expect(r.bottom, selector + ' inside the viewport').toBeLessThanOrEqual(r.vh);
}

for (const vp of [{ width: 375, height: 812 }, { width: 768, height: 1024 }, { width: 1280, height: 800 }]) {
  test('faq: deep links land below the sticky header at ' + vp.width, async ({ page }) => {
    await page.setViewportSize(vp);
    await page.goto(pageUrl('faq') + '#faq-returns');
    await settledScroll(page);
    await expectBelowHeader(page, '#faq-returns .faq-group__title');

    await page.goto(pageUrl('faq') + '#faq-q-2-1');
    await page.reload();
    await settledScroll(page);
    await expect(page.locator('#faq-q-2-1')).toHaveAttribute('open', '');
    await expectBelowHeader(page, '#faq-q-2-1 > summary');
  });
}

test('faq: a hash change to a question opens it and scrolls it into view', async ({ page }) => {
  await page.setViewportSize(MOBILE);
  await page.goto(pageUrl('faq'));
  await settledScroll(page);
  await expect(page.locator('#faq-q-3-0')).not.toHaveAttribute('open', '');
  await page.evaluate(() => { window.location.hash = 'faq-q-3-0'; });
  await settledScroll(page);
  await expect(page.locator('#faq-q-3-0')).toHaveAttribute('open', '');
  await expectBelowHeader(page, '#faq-q-3-0 > summary');
});

// ======================================================= shipping & returns

test('shipping: fee and free-delivery threshold are read from config', async ({ page }) => {
  const errors = await open(page, 'shipping-returns');
  const c = await page.evaluate(() => ({
    fee: Shop.util.formatPKR(Shop.config.deliveryFee),
    threshold: Shop.util.formatPKR(Shop.config.freeDeliveryThreshold)
  }));
  for (const el of await page.locator('[data-config="deliveryFee"]').all()) await expect(el).toHaveText(c.fee);
  for (const el of await page.locator('[data-config="freeDeliveryThreshold"]').all()) await expect(el).toHaveText(c.threshold);
  expect(await page.locator('[data-config="deliveryFee"]').count()).toBeGreaterThan(0);
  expect(await page.locator('[data-config="freeDeliveryThreshold"]').count()).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test('shipping: a captioned delivery table with scoped headers', async ({ page }) => {
  await open(page, 'shipping-returns');
  const table = page.locator('main table').first();
  await expect(table.locator('caption')).not.toHaveText('');
  const ths = table.locator('th');
  expect(await ths.count()).toBeGreaterThan(3);
  for (const th of await ths.all()) expect(['col', 'row']).toContain(await th.getAttribute('scope'));
  await expect(table).toContainText(/Karachi/);
});

test('shipping: section anchors exist and the contents list points to them', async ({ page }) => {
  await open(page, 'shipping-returns');
  for (const id of ['shipping', 'cod', 'returns', 'damaged']) {
    await expect(page.locator('#' + id)).toHaveCount(1);
    await expect(page.locator('[data-toc] a[href="#' + id + '"]')).toHaveCount(1);
  }
  await expect(page.locator('main')).toContainText('7 days');
  await page.locator('[data-toc] a[href="#damaged"]').click();
  await expect(page.locator('#damaged')).toBeInViewport();
});

// ========================================================== fragrance guide

test('guide: four families with shop links, the pyramid and concentrations', async ({ page }) => {
  const errors = await open(page, 'fragrance-guide');
  for (const f of FAMILIES) await expect(page.locator('main a[href="shop.html?families=' + f + '"]'), f).toHaveCount(1);
  const text = await page.locator('main').textContent();
  for (const s of ['Eau de Toilette', 'Eau de Parfum', 'Parfum', 'Extrait', 'attar', 'Top notes', 'Heart notes', 'Base notes', 'sillage'])
    expect(text, s).toContain(s);
  // percentages are framed as typical industry ranges
  const conc = await page.locator('[data-concentrations]').textContent();
  expect(conc).toMatch(/typically/i);
  expect(conc).toMatch(/\d+\s*[–-]\s*\d+\s*%/);
  await expect(page.locator('main a[href="scent-quiz.html"]').first()).toBeVisible();
  expect(errors).toEqual([]);
});

test('guide: makes no claim about any specific product', async ({ page }) => {
  await open(page, 'fragrance-guide');
  const names = await page.evaluate(() => Shop.products.map((p) => p.name));
  const text = await page.locator('main').textContent();
  for (const n of names) expect(text, n).not.toContain(n);
});

// ====================================================================== 404

test('404: a GET search to the shop, the main links and three bestsellers', async ({ page }) => {
  const errors = await open(page, '404');
  const search = page.locator('main form[role="search"]');
  await expect(search).toHaveAttribute('method', 'get');
  await expect(search).toHaveAttribute('action', 'shop.html');
  await expect(search.locator('input[name="q"]')).toHaveCount(1);
  for (const href of ['index.html', 'shop.html', 'scent-quiz.html', 'contact.html']) {
    await expect(page.locator('main a[href="' + href + '"]').first(), href).toBeVisible();
  }
  const cards = page.locator('[data-bestsellers] .product-card');
  await expect(cards).toHaveCount(3);
  const expected = await page.evaluate(() => Shop.catalogue.sortProducts(
    Shop.products.filter((p) => p.tags.indexOf('bestseller') >= 0), 'featured').slice(0, 3).map((p) => p.name));
  expect((await cards.locator('.product-card__name').allTextContents()).map((s) => s.trim())).toEqual(expected);
  expect(await page.evaluate(() => document.body.getAttribute('data-nav'))).toBe('');
  expect(errors).toEqual([]);
});

test('404: searching takes you to the shop with the query', async ({ page }) => {
  await open(page, '404');
  await page.locator('main form[role="search"] input[name="q"]').fill('rose');
  await page.locator('main form[role="search"] input[name="q"]').press('Enter');
  await page.waitForURL(/shop\.html\?q=rose/);
});

// ============================================================ all seven pages

test('all pages: exactly one h1, unique titles and unique short descriptions', async ({ page }) => {
  const seen = { titles: new Set(), descs: new Set() };
  for (const name of PAGES) {
    await open(page, name);
    await expect(page.locator('h1'), name).toHaveCount(1);
    const title = await page.title();
    expect(title, name).toMatch(/\| Nuvora$/);
    expect(seen.titles.has(title), 'duplicate title ' + title).toBe(false);
    seen.titles.add(title);
    const desc = await page.locator('meta[name="description"]').getAttribute('content');
    expect(desc.length, name).toBeGreaterThan(60);
    expect(desc.length, name).toBeLessThanOrEqual(160);
    expect(seen.descs.has(desc), 'duplicate description on ' + name).toBe(false);
    seen.descs.add(desc);
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', title);
    await expect(page.locator('meta[property="og:description"]')).toHaveAttribute('content', desc);
    expect(await page.evaluate(() => document.body.className), name).toContain('page-');
  }
});

test('all pages: landmarks, a working skip link and an unbroken heading outline', async ({ page }) => {
  for (const name of PAGES) {
    await open(page, name);
    await expect(page.locator('body > header.site-header'), name).toHaveCount(1);
    await expect(page.locator('main#main'), name).toHaveCount(1);
    await expect(page.locator('body > footer.site-footer'), name).toHaveCount(1);
    await page.keyboard.press('Tab');
    await expect(page.locator('a.skip-link'), name).toBeFocused();
    await page.keyboard.press('Enter');
    await page.keyboard.press('Tab');
    const inMain = await page.evaluate(() => !!document.activeElement.closest('main'));
    expect(inMain, name + ': Tab after the skip link lands in main').toBe(true);
    const levels = await page.locator('main h1, main h2, main h3, main h4').evaluateAll((els) => els.map((h) => Number(h.tagName.slice(1))));
    expect(levels[0], name).toBe(1);
    for (let i = 1; i < levels.length; i++) expect(levels[i] - levels[i - 1], name + ' heading ' + i).toBeLessThanOrEqual(1);
  }
});

for (const [label, vp] of [['375', MOBILE], ['768', TABLET], ['1280', DESKTOP]]) {
  test('all pages: no horizontal scroll, no text under 11px and no errors at ' + label, async ({ page }) => {
    for (const name of PAGES) {
      const errors = await open(page, name, vp);
      await revealAll(page);
      const o = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
      expect(o.sw, name + ' horizontal scroll').toBeLessThanOrEqual(o.cw);
      const small = await page.evaluate(() => {
        const out = [];
        document.querySelectorAll('body *').forEach((el) => {
          if (el.closest('.sr-only, script, style, [hidden], [aria-hidden="true"] svg')) return;
          const own = Array.prototype.some.call(el.childNodes, (n) => n.nodeType === 3 && n.textContent.trim());
          if (!own) return;
          const r = el.getBoundingClientRect();
          if (r.width < 2 || r.height < 2) return;
          const cs = getComputedStyle(el);
          if (cs.visibility === 'hidden' || cs.display === 'none') return;
          if (parseFloat(cs.fontSize) < 11) out.push(el.tagName + '.' + el.className + ' ' + cs.fontSize);
        });
        return out;
      });
      expect(small, name + ' text under 11px').toEqual([]);
      expect(errors, name).toEqual([]);
    }
  });
}

test('all pages: no config figures are hard-coded in the source', async () => {
  const files = PAGES.map((n) => n + '.html').concat(
    ['brands', 'contact', 'faq', 'content'].map((n) => path.join('assets', 'js', 'pages', n + '.js')));
  // 15% as a bare figure (the GIFT15 discount); ranges such as "5–15%" in the guide are fine
  const banned = [/8000/, /8,000/, /10,000/, /10000/, /PKR 250/, /PKR 300/, /(^|[^–\-\d])15\s?%/m];
  for (const f of files) {
    const src = fs.readFileSync(path.join(root, f), 'utf8');
    for (const re of banned) expect(re.test(src), f + ' contains ' + re).toBe(false);
  }
});

test('site: no footer says we decant, and no page claims we do', async ({ page }) => {
  const all = fs.readdirSync(root).filter((f) => /\.html$/.test(f)).map((f) => f.replace(/\.html$/, ''));
  for (const name of ['index', 'faq', 'shop']) expect(all).toContain(name);
  const QUESTION = 'Do you sell decants or samples?';
  for (const name of all) {
    await page.goto(pageUrl(name));
    await page.waitForSelector('footer.site-footer');
    const footer = await page.locator('footer.site-footer').textContent();
    expect(footer, name + ' footer').not.toMatch(/decant/i);
    const body = (await page.locator('body').textContent()).split(QUESTION).join('');
    expect(body, name).not.toMatch(/decant/i);
  }
});

test('all pages: the shop name in prose follows config', async ({ page }) => {
  await open(page, 'about');
  const name = await page.evaluate(() => Shop.config.shopName);
  for (const el of await page.locator('main [data-shop-name]').all()) await expect(el).toHaveText(name);
});
