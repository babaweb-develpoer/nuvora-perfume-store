// Wishlist and order tracking (Task 12): empty state, hearts carried over from the
// shop, live un-hearting, "Move to bag" (single and all), sold-out and unknown ids;
// order lookup by number + phone (any valid format), the four-step timeline, one
// generic not-found message, inline validation, ?order= prefill, privacy, XSS,
// keyboard use, layout at three widths and console hygiene.
const { test, expect } = require('@playwright/test');
const { pageUrl, collectErrors, routeConfig, TEST_WHATSAPP } = require('./helpers');

const MOBILE = { width: 375, height: 812 };
const TABLET = { width: 768, height: 1024 };
const DESKTOP = { width: 1280, height: 900 };

const XSS = '<img src=x onerror="window.__x=1">';
const NOT_FOUND = 'We couldn’t find an order matching those details. Check your order number and the mobile number you used at checkout.';
const STATUSES = ['Placed', 'Confirmed', 'Dispatched', 'Delivered'];

// Clear storage, seed through the real store, then open `name`.
async function open(page, name, { wishlist = [], viewport = DESKTOP, query = '' } = {}) {
  const errors = collectErrors(page);
  await page.setViewportSize(viewport);
  await page.goto(pageUrl('styleguide'));
  await page.evaluate((ids) => {
    try { localStorage.clear(); } catch (e) {}
    ids.forEach((id) => Shop.store.toggleWishlist(id));
  }, wishlist);
  await page.goto(pageUrl(name) + query);
  await page.waitForSelector('header.site-header');
  await page.waitForSelector('[data-ready]');
  return errors;
}

const wish = (page) => page.evaluate(() => Shop.store.getWishlist());
const cart = (page) => page.evaluate(() => Shop.store.getCart());
const items = (page) => page.locator('.wl-item');
const item = (page, id) => page.locator('.wl-item[data-id="' + id + '"]');
const moveBtn = (page, id) => page.locator('[data-move-to-bag="' + id + '"]');

async function noHorizontalScroll(page) {
  const o = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  expect(o.sw, 'no horizontal scroll').toBeLessThanOrEqual(o.cw);
}

// ================================================================== wishlist

test('wishlist: empty state offers both ways forward', async ({ page }) => {
  const errors = await open(page, 'wishlist');
  await expect(page.locator('h1')).toHaveText(/Your wishlist/);
  const empty = page.locator('[data-wl-empty]');
  await expect(empty).toBeVisible();
  await expect(empty.locator('a[href="shop.html"]')).toBeVisible();
  await expect(empty.locator('a[href="scent-quiz.html"]')).toBeVisible();
  await expect(items(page)).toHaveCount(0);
  await expect(page.locator('[data-wl-count]')).toHaveText('0');
  await expect(page.locator('[data-move-all]')).toBeHidden();
  expect(errors).toEqual([]);
});

test('wishlist: title, description and the active header heart are set', async ({ page }) => {
  await open(page, 'wishlist');
  await expect(page).toHaveTitle(/Your wishlist \| Nuvora/);
  const desc = await page.locator('meta[name="description"]').getAttribute('content');
  expect(desc.length).toBeGreaterThan(60);
  await expect(page.locator('.site-header__wishlist')).toHaveAttribute('aria-current', 'page');
});

test('wishlist: hearts toggled on the shop appear here after navigation', async ({ page }) => {
  await page.goto(pageUrl('styleguide'));
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.goto(pageUrl('shop'));
  await page.waitForSelector('[data-wish="mn-01"]');
  await page.locator('[data-wish="mn-01"]').first().click();
  await page.locator('[data-wish="vn-01"]').first().click();
  expect(await wish(page)).toEqual(['mn-01', 'vn-01']);
  await page.goto(pageUrl('wishlist'));
  await page.waitForSelector('[data-ready]');
  await expect(items(page)).toHaveCount(2);
  await expect(item(page, 'mn-01')).toContainText('Oud Royale');
  await expect(item(page, 'vn-01')).toContainText('Black Leather');
  await expect(page.locator('[data-wl-count]')).toHaveText('2');
  await expect(page.locator('[data-wl-empty]')).toBeHidden();
});

test('wishlist: un-hearting a card removes it live and keeps focus in the grid', async ({ page }) => {
  await open(page, 'wishlist', { wishlist: ['mn-01', 'vn-01', 'au-01'] });
  await expect(items(page)).toHaveCount(3);
  await item(page, 'vn-01').locator('[data-wish]').click();
  await expect(items(page)).toHaveCount(2);
  await expect(item(page, 'vn-01')).toHaveCount(0);
  await expect(page.locator('[data-wl-count]')).toHaveText('2');
  expect(await wish(page)).toEqual(['mn-01', 'au-01']);
  // focus moved to the neighbouring card's heart, not lost to <body>
  const focused = await page.evaluate(() => {
    const a = document.activeElement;
    const it = a && a.closest('.wl-item');
    return { inItem: !!it, id: it && it.getAttribute('data-id'), wish: a && a.hasAttribute('data-wish') };
  });
  expect(focused).toEqual({ inItem: true, id: 'au-01', wish: true });
  // removing the rest ends in the empty state with focus on its heading
  await item(page, 'mn-01').locator('[data-wish]').click();
  await item(page, 'au-01').locator('[data-wish]').click();
  await expect(page.locator('[data-wl-empty]')).toBeVisible();
  await expect(page.locator('[data-wl-empty] [tabindex="-1"]')).toBeFocused();
});

test('wishlist: Move to bag adds 50 ml x1, leaves the wishlist and opens the bag', async ({ page }) => {
  const errors = await open(page, 'wishlist', { wishlist: ['mn-01', 'vn-01'] });
  await expect(moveBtn(page, 'mn-01')).toBeEnabled();
  await moveBtn(page, 'mn-01').click();
  expect(await cart(page)).toEqual([{ productId: 'mn-01', ml: 50, qty: 1, gift: false }]);
  expect(await wish(page)).toEqual(['vn-01']);
  await expect(item(page, 'mn-01')).toHaveCount(0);
  await expect(page.locator('#cart-drawer')).toBeVisible();
  await expect(page.locator('#cart-drawer')).toContainText('Oud Royale');
  expect(errors).toEqual([]);
});

test('wishlist: a sold-out product cannot be moved', async ({ page }) => {
  await open(page, 'wishlist', { wishlist: ['au-03', 'mn-01'] });
  const btn = moveBtn(page, 'au-03');
  await expect(btn).toBeDisabled();
  await expect(btn).toContainText('Sold out');
  await btn.click({ force: true });
  expect(await cart(page)).toEqual([]);
  expect(await wish(page)).toEqual(['au-03', 'mn-01']);
  await expect(page.locator('#cart-drawer')).toBeHidden();
});

test('wishlist: Move all available skips sold-out items and acts once', async ({ page }) => {
  await open(page, 'wishlist', { wishlist: ['mn-01', 'au-03', 'vn-01', 'au-01'] });
  const all = page.locator('[data-move-all]');
  await expect(all).toBeVisible();
  await all.click();
  const lines = (await cart(page)).map((l) => [l.productId, l.ml, l.qty]).sort();
  expect(lines).toEqual([['au-01', 50, 1], ['mn-01', 50, 1], ['vn-01', 50, 1]]);
  expect(await wish(page)).toEqual(['au-03']);
  await expect(items(page)).toHaveCount(1);
  await expect(page.locator('.toast')).toHaveCount(1);
  await expect(all).toBeHidden();
});

test('wishlist: Move all needs at least two purchasable items', async ({ page }) => {
  await open(page, 'wishlist', { wishlist: ['mn-01', 'au-03'] });
  await expect(items(page)).toHaveCount(2);
  await expect(page.locator('[data-move-all]')).toBeHidden();
});

test('wishlist: ids that no longer exist are ignored and not counted', async ({ page }) => {
  const errors = await open(page, 'wishlist', { wishlist: ['zz-99', 'mn-01'] });
  await expect(items(page)).toHaveCount(1);
  await expect(page.locator('[data-wl-count]')).toHaveText('1');
  await expect(page.locator('[data-wl-empty]')).toBeHidden();
  expect(errors).toEqual([]);
  await open(page, 'wishlist', { wishlist: ['zz-99'] });
  await expect(page.locator('[data-wl-empty]')).toBeVisible();
  await expect(page.locator('[data-wl-count]')).toHaveText('0');
});

test('wishlist: Move to bag is reachable and operable by keyboard', async ({ page }) => {
  await open(page, 'wishlist', { wishlist: ['mn-01', 'vn-01'] });
  await moveBtn(page, 'mn-01').focus();
  await page.keyboard.press('Enter');
  expect((await cart(page))[0].productId).toBe('mn-01');
  await expect(page.locator('#cart-drawer')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#cart-drawer')).toBeHidden();
});

for (const [label, viewport] of [['375', MOBILE], ['768', TABLET], ['1280', DESKTOP]]) {
  test('wishlist: no horizontal scroll at ' + label, async ({ page }) => {
    const errors = await open(page, 'wishlist', { wishlist: ['mn-01', 'au-03', 'vn-01'], viewport });
    await expect(items(page)).toHaveCount(3);
    await noHorizontalScroll(page);
    await open(page, 'wishlist', { viewport });
    await noHorizontalScroll(page);
    expect(errors).toEqual([]);
  });
}

// ============================================================= order tracking

// Place a real order through the store; returns { number, phone }.
async function placeOrder(page, { name = 'Sana Malik', phone = '0300-1234567', city = 'Lahore', province = 'Punjab',
  address = 'House 12, Street 4, DHA Phase 5', code = 'WELCOME10', status } = {}) {
  return page.evaluate(({ name, phone, city, province, address, code, status }) => {
    Shop.store.addToCart('mn-01', 50, 1, false);
    Shop.store.addToCart('au-01', 30, 2, true);
    if (code) Shop.store.setCode(code);
    const totals = Shop.pricing.cartTotals(Shop.store.getCart(), Shop.products, Shop.config, Shop.store.getCode());
    const o = Shop.store.placeOrder({ name, phone, email: '', province, city, address, notes: '' }, Shop.store.getCart(),
      { subtotal: totals.subtotal, giftWrap: totals.giftWrap, discount: totals.discount, delivery: totals.delivery, total: totals.total });
    if (status) Shop.store.updateOrderStatus(o.number, status);
    return { number: o.number, total: totals.total };
  }, { name, phone, city, province, address, code, status });
}

const numberField = (page) => page.getByLabel('Order number', { exact: true });
const phoneField = (page) => page.getByLabel('Mobile number used at checkout', { exact: true });
const submit = (page) => page.getByRole('button', { name: /^track order$/i });
const result = (page) => page.locator('[data-track-result]');
const alertBox = (page) => page.locator('[data-track-alert]');

async function lookup(page, number, phone) {
  await numberField(page).fill(number);
  await phoneField(page).fill(phone);
  await submit(page).click();
}

async function openTrack(page, opts = {}) {
  // seed from a neutral page; callers place orders after landing here
  const errors = await open(page, 'track-order', opts);
  return errors;
}

test('track: the form has its labels, placeholder, title and description', async ({ page }) => {
  const errors = await openTrack(page);
  await expect(page.locator('h1')).toHaveText(/Track your order/);
  await expect(numberField(page)).toHaveAttribute('placeholder', 'ORD-123456');
  await expect(phoneField(page)).toBeVisible();
  await expect(submit(page)).toBeVisible();
  await expect(page).toHaveTitle(/Track your order \| Nuvora/);
  const desc = await page.locator('meta[name="description"]').getAttribute('content');
  expect(desc.length).toBeGreaterThan(60);
  await expect(result(page)).toHaveCount(0);
  expect(errors).toEqual([]);
});

for (const phone of ['0300-1234567', '+92 300 1234567', '03001234567']) {
  test('track: finds the order with the phone written as "' + phone + '"', async ({ page }) => {
    const errors = await openTrack(page);
    const { number } = await placeOrder(page);
    await lookup(page, number, phone);
    await expect(result(page)).toBeVisible();
    await expect(result(page)).toContainText(number);
    await expect(result(page).locator('.tk-steps > li')).toHaveCount(4);
    await expect(alertBox(page)).toBeEmpty();
    expect(errors).toEqual([]);
  });
}

for (let i = 0; i < STATUSES.length; i++) {
  test('track: ' + STATUSES[i] + ' marks step ' + (i + 1) + ' as current', async ({ page }) => {
    await openTrack(page);
    const { number } = await placeOrder(page, { status: STATUSES[i] });
    await page.reload();
    await page.waitForSelector('[data-ready]');
    await lookup(page, number, '03001234567');
    const steps = result(page).locator('.tk-steps > li');
    await expect(steps).toHaveCount(4);
    const current = result(page).locator('.tk-steps > li[aria-current="step"]');
    await expect(current).toHaveCount(1);
    await expect(current).toContainText(STATUSES[i]);
    // steps before it are complete, steps after it are upcoming
    for (let s = 0; s < 4; s++) {
      const want = s < i ? 'complete' : s === i ? 'current' : 'upcoming';
      await expect(steps.nth(s)).toHaveAttribute('data-state', want);
    }
    // not colour alone: every step carries visually-hidden or visible state text
    for (let s = 0; s < 4; s++) {
      const text = await steps.nth(s).innerText();
      expect(text.toLowerCase()).toMatch(/completed|current|upcoming|done|now|next/);
    }
    await expect(result(page).locator('[data-track-status]')).toHaveText(STATUSES[i]);
    await expect(result(page).locator('[data-track-message]')).not.toBeEmpty();
  });
}

test('track: a wrong phone and a wrong number show the same generic message, no details', async ({ page }) => {
  const errors = await openTrack(page);
  const { number } = await placeOrder(page);

  await lookup(page, number, '0311-7654321');
  await expect(alertBox(page)).toHaveText(NOT_FOUND);
  const wrongPhone = await alertBox(page).innerText();
  await expect(alertBox(page)).toHaveAttribute('role', 'alert');
  await expect(result(page)).toHaveCount(0);
  await expect(page.locator('main')).not.toContainText(number);
  await expect(page.locator('main')).not.toContainText('Oud Royale');

  await lookup(page, 'ORD-000000', '03001234567');
  const wrongNumber = await alertBox(page).innerText();
  expect(wrongNumber).toBe(wrongPhone);
  expect(wrongNumber).toBe(NOT_FOUND);
  await expect(result(page)).toHaveCount(0);
  // no field-level error leaks which input was wrong
  await expect(page.locator('.field__error:visible')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('track: not-found keeps the form filled and puts focus back in the form', async ({ page }) => {
  await openTrack(page);
  const { number } = await placeOrder(page);
  await lookup(page, number, '0311-7654321');
  await expect(alertBox(page)).toHaveText(NOT_FOUND);
  await expect(numberField(page)).toHaveValue(number);
  await expect(phoneField(page)).toHaveValue('0311-7654321');
  const inForm = await page.evaluate(() => !!document.activeElement.closest('[data-track-form]'));
  expect(inForm).toBe(true);
  // the phone is never echoed into a text node
  await expect(alertBox(page)).not.toContainText('7654321');
  const textHasPhone = await page.evaluate(() => document.querySelector('main').innerText.includes('7654321'));
  expect(textHasPhone).toBe(false);
});

test('track: the order number is case-insensitive and tolerates spaces', async ({ page }) => {
  await openTrack(page);
  const { number } = await placeOrder(page);
  await lookup(page, '  ' + number.toLowerCase() + '  ', '0300 1234567');
  await expect(result(page)).toBeVisible();
  await expect(result(page).locator('[data-track-number]')).toHaveText(number);
  await lookup(page, number.replace('-', ' - ').toLowerCase(), '0300 1234567');
  await expect(result(page).locator('[data-track-number]')).toHaveText(number);
});

test('track: invalid fields show inline errors, not the not-found message', async ({ page }) => {
  await openTrack(page);
  await lookup(page, 'ORD-123456', 'abc');
  const phoneErr = page.locator('.field:has(#tk-phone) .field__error');
  await expect(phoneErr).toBeVisible();
  await expect(phoneErr).not.toBeEmpty();
  await expect(phoneField(page)).toHaveAttribute('aria-invalid', 'true');
  const describedBy = await phoneField(page).getAttribute('aria-describedby');
  expect(describedBy || '').toContain(await phoneErr.getAttribute('id'));
  await expect(phoneField(page)).toBeFocused();
  await expect(alertBox(page)).toBeEmpty();
  await expect(numberField(page)).not.toHaveAttribute('aria-invalid', 'true');

  // both empty: first invalid field (the order number) gets focus
  await numberField(page).fill('');
  await phoneField(page).fill('');
  await submit(page).click();
  await expect(numberField(page)).toBeFocused();
  await expect(numberField(page)).toHaveAttribute('aria-invalid', 'true');
  await expect(phoneField(page)).toHaveAttribute('aria-invalid', 'true');

  // fixing a field clears its error and its describedby reference
  await phoneField(page).fill('03001234567');
  await expect(phoneField(page)).not.toHaveAttribute('aria-invalid', 'true');
  const after = (await phoneField(page).getAttribute('aria-describedby')) || '';
  expect(after).not.toContain('err');
});

test('track: ?order= prefills the number but never reveals the order', async ({ page }) => {
  await openTrack(page);
  const { number } = await placeOrder(page);
  await page.goto(pageUrl('track-order') + '?order=' + encodeURIComponent(number.toLowerCase()));
  await page.waitForSelector('[data-ready]');
  await expect(numberField(page)).toHaveValue(number);
  await expect(phoneField(page)).toHaveValue('');
  await expect(result(page)).toHaveCount(0);
  await expect(page.locator('main')).not.toContainText('Oud Royale');
  await phoneField(page).fill('03001234567');
  await phoneField(page).press('Enter');
  await expect(result(page)).toBeVisible();
});

test('track: the result shows delivery area and status text but not the full phone or street address', async ({ page }) => {
  await openTrack(page);
  const { number, total } = await placeOrder(page);
  await lookup(page, number, '03001234567');
  const r = result(page);
  await expect(r).toBeVisible();
  const text = await r.innerText();
  expect(text).toContain('Lahore');
  expect(text).toContain('Punjab');
  expect(text).toContain('ending 4567');
  expect(text).not.toContain('1234567');
  expect(text).not.toContain('0300');
  expect(text).not.toContain('House 12');
  expect(text).not.toContain('Street 4');
  expect(text).not.toContain('Sana');
  expect(text).toContain('Oud Royale');
  expect(text).toContain('Rose Eternelle');
  expect(text).toMatch(/Cash on delivery/i);
  const pkr = await page.evaluate((n) => Shop.util.formatPKR(n), total);
  expect(text).toContain(pkr);
  expect(text).toContain('WELCOME10');
  // expected delivery range, e.g. "Tue 21 – Fri 24 Oct"
  expect(text).toMatch(/[A-Z][a-z]{2} \d{1,2}( [A-Z][a-z]{2})? – [A-Z][a-z]{2} \d{1,2} [A-Z][a-z]{2}/);
  await expect(r.locator('a[href="shop.html"]')).toBeVisible();
  // no WhatsApp number by default: help goes to the contact page
  await expect(r.locator('a[href*="wa.me"]')).toHaveCount(0);
  await expect(r.locator('a[data-help]')).toHaveAttribute('href', 'contact.html');
  await expect(r.locator('a[data-help]')).toContainText('Need help? Message us');
  await expect(page.locator('.tk-panel [data-concept-note]')).toHaveText(await page.evaluate(() => Shop.config.conceptNotice));
  await expect(page.locator('main')).toContainText('Orders are kept only in the browser they were placed from');
});

test('track: with a WhatsApp number set, the help link opens WhatsApp with the order number', async ({ page }) => {
  await routeConfig(page, { whatsapp: TEST_WHATSAPP });
  await openTrack(page);
  const { number } = await placeOrder(page);
  await lookup(page, number, '03001234567');
  const r = result(page);
  await expect(r).toBeVisible();
  const wa = await r.locator('a[href^="https://wa.me/' + TEST_WHATSAPP + '"]').getAttribute('href');
  expect(decodeURIComponent(wa)).toContain(number);
  await expect(r.locator('a[href^="https://wa.me/"]')).toContainText('WhatsApp');
});

test('track: customer text is escaped (XSS)', async ({ page }) => {
  const errors = await openTrack(page);
  const { number } = await placeOrder(page, { name: XSS, city: XSS, province: 'Punjab' });
  await lookup(page, number, '03001234567');
  await expect(result(page)).toBeVisible();
  await expect(result(page)).toContainText('<img src=x');
  expect(await page.evaluate(() => window.__x)).toBeUndefined();
  await expect(page.locator('main img[src="x"]')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('track: works with the keyboard alone and moves focus to the result', async ({ page }) => {
  await openTrack(page);
  const { number } = await placeOrder(page);
  await numberField(page).focus();
  await page.keyboard.type(number);
  await page.keyboard.press('Tab');
  await expect(phoneField(page)).toBeFocused();
  await page.keyboard.type('+92 300 1234567');
  await page.keyboard.press('Tab');
  await expect(submit(page)).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(result(page)).toBeVisible();
  const focusInResult = await page.evaluate(() => !!document.activeElement.closest('[data-track-result]'));
  expect(focusInResult).toBe(true);
  // links inside the result are reachable with Tab
  await page.keyboard.press('Tab');
  const stillInside = await page.evaluate(() => !!document.activeElement.closest('[data-track-result]'));
  expect(stillInside).toBe(true);
});

test('track: the timeline follows a status change made while the result is open', async ({ page }) => {
  await openTrack(page);
  const { number } = await placeOrder(page);
  await lookup(page, number, '03001234567');
  await expect(result(page).locator('[data-track-status]')).toHaveText('Placed');
  await page.evaluate((n) => Shop.store.updateOrderStatus(n, 'Dispatched'), number);
  await expect(result(page).locator('[data-track-status]')).toHaveText('Dispatched');
  await expect(result(page).locator('.tk-steps > li[aria-current="step"]')).toContainText('Dispatched');
});

for (const [label, viewport] of [['375', MOBILE], ['768', TABLET], ['1280', DESKTOP]]) {
  test('track: no horizontal scroll at ' + label + ' (form, result, not found)', async ({ page }) => {
    const errors = await openTrack(page, { viewport });
    await noHorizontalScroll(page);
    const { number } = await placeOrder(page, { name: 'A Very Long Customer Name Indeed', city: 'Muzaffarabad-Upon-A-Very-Long-City-Name' });
    await lookup(page, 'ORD-000000', '03001234567');
    await expect(alertBox(page)).toHaveText(NOT_FOUND);
    await noHorizontalScroll(page);
    await lookup(page, number, '03001234567');
    await expect(result(page)).toBeVisible();
    await noHorizontalScroll(page);
    expect(errors).toEqual([]);
  });
}

test('track: an open result survives store changes when the stored number is lowercase', async ({ page }) => {
  await openTrack(page);
  const { number } = await placeOrder(page);
  await page.evaluate((n) => {
    const blob = JSON.parse(localStorage.getItem('maison_demo_v1'));
    blob.orders.forEach((o) => { if (o.number === n) o.number = n.toLowerCase(); });
    localStorage.setItem('maison_demo_v1', JSON.stringify(blob));
  }, number);
  await page.reload();
  await page.waitForSelector('[data-ready]');
  await lookup(page, number, '03001234567');
  await expect(result(page)).toBeVisible();
  await page.evaluate((n) => Shop.store.updateOrderStatus(n, 'Dispatched'), number.toLowerCase());
  await expect(result(page).locator('[data-track-status]')).toHaveText('Dispatched');
});
