// Cart, checkout and order confirmation (Task 11): cart lines and totals,
// free-delivery progress, discount codes, stock clamping and sold-out lines,
// checkout validation, cash-on-delivery only, one order per submit, the
// confirmation page (XSS-safe, WhatsApp link, not-found), headings, keyboard
// use, layout at three widths and console hygiene.
const { test, expect } = require('@playwright/test');
const { pageUrl, collectErrors, routeConfig, TEST_WHATSAPP } = require('./helpers');

const MOBILE = { width: 375, height: 812 };
const TABLET = { width: 768, height: 1024 };
const DESKTOP = { width: 1280, height: 900 };

const XSS = '<img src=x onerror="window.__x=1">';

// Clear storage, seed the cart through the real store, then open `name`.
async function open(page, name, { lines = [], code = '', viewport = DESKTOP, query = '' } = {}) {
  const errors = collectErrors(page);
  await page.setViewportSize(viewport);
  // Seed from a page that never rewrites the cart (cart.html would sync clamped quantities).
  await page.goto(pageUrl('styleguide'));
  await page.evaluate(({ lines, code }) => {
    try { localStorage.clear(); } catch (e) {}
    lines.forEach((l) => Shop.store.addToCart(l[0], l[1], l[2], !!l[3]));
    if (code) Shop.store.setCode(code);
  }, { lines, code });
  await page.goto(pageUrl(name) + query);
  await page.waitForSelector('header.site-header');
  await page.waitForSelector('[data-ready]');
  return errors;
}

const pkr = (page, n) => page.evaluate((v) => Shop.util.formatPKR(v), n);
const cfg = (page) => page.evaluate(() => Shop.config);
const cart = (page) => page.evaluate(() => Shop.store.getCart());
const orders = (page) => page.evaluate(() => Shop.store.getOrders());
const storedCode = (page) => page.evaluate(() => Shop.store.getCode());
const totalsOf = (page) => page.evaluate(() =>
  Shop.pricing.cartTotals(Shop.store.getCart(), Shop.products, Shop.config, Shop.store.getCode()));
const price = (page, id, ml) => page.evaluate(({ id, ml }) =>
  Shop.products.filter((p) => p.id === id)[0].sizes.filter((s) => s.ml === ml)[0].price, { id, ml });

const lines = (page) => page.locator('[data-bag-lines] .cart-line');
const line = (page, id, ml) => page.locator('[data-bag-lines] .cart-line[data-id="' + id + '"][data-ml="' + ml + '"]');
const sum = (page, key) => page.locator('[data-sum-value="' + key + '"]').first();
const row = (page, key) => page.locator('[data-sum="' + key + '"]').first();
const codeInput = (page) => page.getByLabel('Discount code', { exact: true });
const applyBtn = (page) => page.getByRole('button', { name: 'Apply', exact: true });
const codeMsg = (page) => page.locator('[data-code-msg]').first();
const placeBtn = (page) => page.getByRole('button', { name: /place order/i });
const form = (page) => page.locator('form[data-checkout-form]');

async function noHorizontalScroll(page) {
  const o = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  expect(o.sw, 'no horizontal scroll').toBeLessThanOrEqual(o.cw);
}

async function headingOutlineSane(page) {
  const levels = await page.evaluate(() =>
    Array.prototype.map.call(document.querySelectorAll('main h1, main h2, main h3, main h4'), (h) => {
      const r = h.getBoundingClientRect();
      return { level: Number(h.tagName[1]), shown: !h.closest('[hidden]') && (r.width > 0 || h.closest('.sr-only, details')) };
    }).filter((h) => h.shown).map((h) => h.level));
  expect(levels.filter((l) => l === 1)).toHaveLength(1);
  expect(levels[0]).toBe(1);
  for (let i = 1; i < levels.length; i++) expect(levels[i] - levels[i - 1], 'no skipped heading level').toBeLessThanOrEqual(1);
}

async function fillCheckout(page, over = {}) {
  const v = Object.assign({
    name: 'Ayesha Khan', phone: '0300-1234567', email: '', province: 'Punjab',
    city: 'Lahore', address: 'House 14, Street 7, Gulberg III', notes: ''
  }, over);
  await page.getByLabel('Full name').fill(v.name);
  await page.getByLabel('Mobile number').fill(v.phone);
  await page.getByLabel(/^Email/).fill(v.email);
  await page.getByLabel('Province').selectOption(v.province);
  await page.getByLabel('City').fill(v.city);
  await page.getByLabel(/^Address/).fill(v.address);
  await page.getByLabel(/^Delivery notes/).fill(v.notes);
}

// ===================================================================== cart

test('cart: two lines with media, house, name, size, unit price, qty, line total; qty change updates totals and persists', async ({ page }) => {
  const errors = await open(page, 'cart', { lines: [['mn-01', 50, 1], ['au-01', 30, 1]] });
  await expect(page).toHaveTitle(/^Your bag \| Nuvora$/);
  await expect(page.locator('h1')).toHaveText(/Your bag/);
  await expect(lines(page)).toHaveCount(2);

  const mn = line(page, 'mn-01', 50);
  await expect(mn.locator('a[href="product.html?id=mn-01"]').first()).toBeAttached();
  await expect(mn.locator('.media')).toHaveCount(1);
  await expect(mn).toContainText('Maison Noor');
  await expect(mn).toContainText('Oud Royale');
  await expect(mn).toContainText('50 ml');
  const p50 = await price(page, 'mn-01', 50);
  const p30 = await price(page, 'au-01', 30);
  await expect(mn.locator('[data-line-total]')).toHaveText(await pkr(page, p50));
  await expect(sum(page, 'subtotal')).toHaveText(await pkr(page, p50 + p30));

  await mn.getByRole('button', { name: /increase quantity/i }).click();
  await expect(mn.locator('.qty-stepper__value')).toHaveText('2');
  await expect(mn.locator('[data-line-total]')).toHaveText(await pkr(page, p50 * 2));
  await expect(sum(page, 'subtotal')).toHaveText(await pkr(page, p50 * 2 + p30));
  await expect(sum(page, 'total')).toHaveText(await pkr(page, (await totalsOf(page)).total));
  // focus stays on the control being used
  await expect(mn.getByRole('button', { name: /increase quantity/i })).toBeFocused();
  // announced politely
  await expect(page.locator('[data-live]')).toContainText(await pkr(page, (await totalsOf(page)).total));

  await page.reload();
  await page.waitForSelector('[data-ready]');
  await expect(line(page, 'mn-01', 50).locator('.qty-stepper__value')).toHaveText('2');
  expect((await cart(page)).filter((l) => l.productId === 'mn-01')[0].qty).toBe(2);

  // decrease is disabled at 1; remove takes the line out
  const au = line(page, 'au-01', 30);
  await expect(au.getByRole('button', { name: /decrease quantity/i })).toBeDisabled();
  await au.getByRole('button', { name: /^remove/i }).click();
  await expect(lines(page)).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('cart: gift wrap is charged once per order and labelled as such', async ({ page }) => {
  await open(page, 'cart', { lines: [['mn-01', 50, 1], ['au-01', 30, 1]] });
  const c = await cfg(page);
  await expect(page.locator('[data-sum="giftWrap"]')).toHaveCount(0);
  await line(page, 'mn-01', 50).getByRole('checkbox', { name: /gift wrap/i }).check();
  await expect(sum(page, 'giftWrap')).toHaveText(await pkr(page, c.giftWrapFee));
  await expect(page.locator('[data-bag-summary]')).toContainText('Gift wrap (one fee per order)');
  await line(page, 'au-01', 30).getByRole('checkbox', { name: /gift wrap/i }).check();
  await expect(sum(page, 'giftWrap')).toHaveText(await pkr(page, c.giftWrapFee));
  await expect(line(page, 'au-01', 30).getByRole('checkbox', { name: /gift wrap/i })).toBeFocused();
  expect((await cart(page)).every((l) => l.gift)).toBe(true);
});

test('cart: free-delivery bar shows the remaining amount, then the unlocked message', async ({ page }) => {
  await open(page, 'cart', { lines: [['sr-01', 30, 1]] });
  const c = await cfg(page);
  const p = await price(page, 'sr-01', 30);
  await expect(page.locator('[data-free-text]')).toHaveText('Add ' + await pkr(page, c.freeDeliveryThreshold - p) + ' more for free delivery');
  await expect(sum(page, 'delivery')).toHaveText(await pkr(page, c.deliveryFee));
  const ratio = await page.locator('.progress-bar__fill').first().evaluate((n) => getComputedStyle(n).getPropertyValue('--progress-ratio').trim());
  expect(Number(ratio)).toBeCloseTo(p / c.freeDeliveryThreshold, 2);

  await line(page, 'sr-01', 30).getByRole('button', { name: /increase quantity/i }).click();
  await expect(page.locator('[data-free-text]')).toHaveText('Add ' + await pkr(page, c.freeDeliveryThreshold - p * 2) + ' more for free delivery');
  await line(page, 'sr-01', 30).getByRole('button', { name: /increase quantity/i }).click();
  await expect(page.locator('[data-free-text]')).toHaveText("You've unlocked free delivery");
  await expect(sum(page, 'delivery')).toHaveText('Free');
});

test('cart: WELCOME10 applies 10% of the subtotal, persists across reload, and can be removed', async ({ page }) => {
  await open(page, 'cart', { lines: [['mn-01', 50, 1], ['au-01', 30, 1]] });
  const before = await totalsOf(page);
  await codeInput(page).fill(' welcome10 ');
  await applyBtn(page).click();
  const d = Math.round(before.subtotal * 0.1);
  await expect(row(page, 'discount')).toContainText('WELCOME10');
  await expect(page.locator('[data-sum-value="discount"]')).toHaveText('−' + await pkr(page, d));
  await expect(sum(page, 'total')).toHaveText(await pkr(page, before.total - d));
  await expect(codeMsg(page)).toContainText(await pkr(page, d));
  expect(await storedCode(page)).toMatch(/^welcome10$/i);

  await page.reload();
  await page.waitForSelector('[data-ready]');
  await expect(page.locator('[data-sum-value="discount"]')).toHaveText('−' + await pkr(page, d));

  await page.getByRole('button', { name: /remove code/i }).click();
  await expect(page.locator('[data-sum="discount"]')).toHaveCount(0);
  await expect(sum(page, 'total')).toHaveText(await pkr(page, before.total));
  expect(await storedCode(page)).toBe('');
  await expect(codeInput(page)).toBeFocused();
});

test('cart: an invalid code shows an inline error, leaves totals unchanged and is not kept', async ({ page }) => {
  await open(page, 'cart', { lines: [['mn-01', 50, 1]] });
  const before = await totalsOf(page);
  await codeInput(page).fill('bad');
  await applyBtn(page).click();
  await expect(codeMsg(page)).toHaveText(/That code isn't valid/);
  await expect(codeInput(page)).toHaveAttribute('aria-invalid', 'true');
  await expect(sum(page, 'total')).toHaveText(await pkr(page, before.total));
  await expect(page.locator('[data-sum="discount"]')).toHaveCount(0);
  expect(await storedCode(page)).toBe('');
});

test('cart: GIFT15 below its minimum shows the minimum message and totals stay the same', async ({ page }) => {
  await open(page, 'cart', { lines: [['sr-01', 30, 1]] });
  const c = await cfg(page);
  const before = await totalsOf(page);
  await codeInput(page).fill('GIFT15');
  await page.keyboard.press('Enter');
  await expect(codeMsg(page)).toContainText('GIFT15 needs a subtotal of at least ' + await pkr(page, c.codes.GIFT15.min));
  await expect(sum(page, 'total')).toHaveText(await pkr(page, before.total));
  await expect(page.locator('[data-sum="discount"]')).toHaveCount(0);
});

test('cart: a quantity above stock is shown clamped with a notice and the store is synced (sr-02, stock 5)', async ({ page }) => {
  const errors = await open(page, 'cart', { lines: [['sr-02', 50, 10]] });
  const l = line(page, 'sr-02', 50);
  await expect(l.locator('.qty-stepper__value')).toHaveText('5');
  await expect(l.locator('[data-line-notice]')).toHaveText("Only 5 available — we've adjusted the quantity");
  await expect.poll(async () => (await cart(page))[0].qty).toBe(5);
  await expect(l.getByRole('button', { name: /increase quantity/i })).toBeDisabled();
  await expect(l.locator('[data-line-total]')).toHaveText(await pkr(page, (await price(page, 'sr-02', 50)) * 5));
  expect(errors).toEqual([]);
});

test('cart: a sold-out line says Sold out, offers Remove and is excluded from totals', async ({ page }) => {
  await open(page, 'cart', { lines: [['mn-01', 50, 1], ['au-03', 50, 1]] });
  const l = line(page, 'au-03', 50);
  await expect(l).toContainText('Sold out');
  await expect(l.getByRole('button', { name: /^remove/i })).toBeVisible();
  await expect(l.locator('.qty-stepper')).toHaveCount(0);
  await expect(sum(page, 'subtotal')).toHaveText(await pkr(page, await price(page, 'mn-01', 50)));
  await expect(page.getByRole('link', { name: 'Proceed to checkout' })).toBeVisible();
});

test('cart: only sold-out lines means no checkout button', async ({ page }) => {
  await open(page, 'cart', { lines: [['au-03', 50, 1]] });
  await expect(line(page, 'au-03', 50)).toContainText('Sold out');
  await expect(page.getByRole('link', { name: 'Proceed to checkout' })).toHaveCount(0);
});

test('cart: empty state links to the shop and the scent quiz; checkout and continue links', async ({ page }) => {
  const errors = await open(page, 'cart');
  const empty = page.locator('[data-bag-empty]');
  await expect(empty).toBeVisible();
  await expect(empty.locator('a[href="shop.html"]')).toBeVisible();
  await expect(empty.locator('a[href="scent-quiz.html"]')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Proceed to checkout' })).toHaveCount(0);
  expect(errors).toEqual([]);

  await open(page, 'cart', { lines: [['mn-01', 50, 1]] });
  await expect(page.getByRole('link', { name: 'Proceed to checkout' })).toHaveAttribute('href', 'checkout.html');
  await expect(page.getByRole('link', { name: 'Continue shopping' })).toHaveAttribute('href', 'shop.html');
  await expect(page.locator('[data-bag-summary]')).toContainText(/cash on delivery/i);
});

// ================================================================= checkout

test('checkout: empty required fields show an inline error per field, focus the first, and create no order', async ({ page }) => {
  const errors = await open(page, 'checkout', { lines: [['mn-01', 50, 1]] });
  await expect(page).toHaveTitle(/^Checkout \| Nuvora$/);
  await placeBtn(page).click();
  for (const label of ['Full name', 'Mobile number', 'Province', 'City']) {
    const input = page.getByLabel(new RegExp('^' + label));
    await expect(input, label).toHaveAttribute('aria-invalid', 'true');
    const describedBy = await input.getAttribute('aria-describedby');
    const errId = describedBy.split(/\s+/).filter((id) => /err/.test(id))[0];
    await expect(page.locator('#' + errId)).toBeVisible();
  }
  await expect(page.getByLabel(/^Address/)).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByLabel('Full name')).toBeFocused();
  await expect(page.locator('[data-error-summary]')).toBeVisible();
  // optional fields are not flagged
  await expect(page.getByLabel(/^Email/)).not.toHaveAttribute('aria-invalid', 'true');
  expect(await orders(page)).toHaveLength(0);
  expect(page.url()).toContain('checkout.html');
  expect(errors).toEqual([]);
});

test('checkout: no error while typing the first time; errors appear on blur and clear once fixed', async ({ page }) => {
  await open(page, 'checkout', { lines: [['mn-01', 50, 1]] });
  const phone = page.getByLabel('Mobile number');
  await phone.fill('abc');
  await expect(phone).not.toHaveAttribute('aria-invalid', 'true');
  await expect(phone).toHaveAttribute('aria-describedby', /hint/);
  expect(await phone.getAttribute('aria-describedby')).not.toMatch(/err/);
  await page.getByLabel(/^Email/).focus();
  await expect(phone).toHaveAttribute('aria-invalid', 'true');
  await expect(phone).toHaveAttribute('aria-describedby', /err/);
  await phone.fill('0300-1234567');
  await expect(phone).not.toHaveAttribute('aria-invalid', 'true');
  expect(await phone.getAttribute('aria-describedby')).not.toMatch(/err/);
  await page.getByLabel(/^Email/).focus();
  await expect(phone).toHaveValue('0300 1234567'); // normalised on blur
});

test('checkout: phone abc is rejected, 0300-1234567 accepted; a malformed email is rejected', async ({ page }) => {
  await open(page, 'checkout', { lines: [['mn-01', 50, 1]] });
  await fillCheckout(page, { phone: 'abc', email: 'ayesha@' });
  await placeBtn(page).click();
  await expect(page.getByLabel('Mobile number')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByLabel(/^Email/)).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByLabel('Mobile number')).toBeFocused();
  await expect(page.getByLabel('Full name')).not.toHaveAttribute('aria-invalid', 'true');
  expect(await orders(page)).toHaveLength(0);

  await page.getByLabel('Mobile number').fill('0300-1234567');
  await page.getByLabel(/^Email/).fill('ayesha@example.pk');
  await placeBtn(page).click();
  await page.waitForURL(/order-confirmation\.html\?order=ORD-\d{6}$/);
  const list = await orders(page);
  expect(list).toHaveLength(1);
  expect(list[0].customer.phone).toBe('03001234567');
  expect(list[0].customer.email).toBe('ayesha@example.pk');
});

test('checkout: the payment section is cash on delivery only, with no card fields', async ({ page }) => {
  await open(page, 'checkout', { lines: [['mn-01', 50, 1]] });
  const pay = page.locator('[data-payment]');
  await expect(pay).toContainText('Cash on delivery');
  await expect(pay).toContainText(/pay the courier when your order arrives/i);
  await expect(pay.getByRole('radio')).toBeChecked();
  const cardish = await page.evaluate(() => Array.prototype.filter.call(document.querySelectorAll('input, select, textarea'), (n) =>
    /^cc-/.test(n.getAttribute('autocomplete') || '') || /card/i.test((n.name || '') + ' ' + (n.id || ''))).length);
  expect(cardish).toBe(0);
});

test('checkout: the concept-store notice sits by the contact lead and by Place order, and no call is promised', async ({ page }) => {
  await open(page, 'checkout', { lines: [['mn-01', 50, 1]] });
  const notice = await page.evaluate(() => Shop.config.conceptNotice);
  expect(notice).toBeTruthy();
  const notes = page.locator('form[data-checkout-form] [data-concept-note]');
  await expect(notes).toHaveCount(2);
  await expect(notes.first()).toHaveText(notice);
  await expect(notes.first()).toBeVisible();
  await expect(page.locator('.co-section__lead [data-concept-note]')).toBeVisible();
  await expect(page.locator('.co-submit [data-concept-note]')).toHaveText(notice);
  await expect(page.locator('.co-submit [data-concept-note]')).toBeVisible();
  await expect(page.locator('main')).not.toContainText(/whatsapp|we call|we'll confirm by phone/i);
});

test('checkout: an empty conceptNotice hides both notes', async ({ page }) => {
  await routeConfig(page, { conceptNotice: '' });
  await open(page, 'checkout', { lines: [['mn-01', 50, 1]] });
  await expect(page.locator('[data-concept-note]').first()).toBeHidden();
  await expect(page.locator('.co-submit [data-concept-note]')).toBeHidden();
  await expect(page.locator('#site-footer .site-footer__notice')).toHaveCount(0);
});

test('checkout: autocomplete, types and the city datalist', async ({ page }) => {
  await open(page, 'checkout', { lines: [['mn-01', 50, 1]] });
  await expect(page.getByLabel('Full name')).toHaveAttribute('autocomplete', 'name');
  await expect(page.getByLabel('Mobile number')).toHaveAttribute('autocomplete', 'tel');
  await expect(page.getByLabel('Mobile number')).toHaveAttribute('type', 'tel');
  await expect(page.getByLabel(/^Email/)).toHaveAttribute('type', 'email');
  await expect(page.getByLabel(/^Email/)).toHaveAttribute('autocomplete', 'email');
  await expect(page.getByLabel('Province')).toHaveAttribute('autocomplete', 'address-level1');
  await expect(page.getByLabel('City')).toHaveAttribute('autocomplete', 'address-level2');
  await expect(page.getByLabel(/^Address/)).toHaveAttribute('autocomplete', 'street-address');
  const provinces = await page.getByLabel('Province').locator('option:not([value=""])').allTextContents();
  expect(provinces).toEqual(['Punjab', 'Sindh', 'Khyber Pakhtunkhwa', 'Balochistan', 'Islamabad Capital Territory', 'Azad Jammu & Kashmir', 'Gilgit-Baltistan']);
  const listId = await page.getByLabel('City').getAttribute('list');
  const cities = await page.locator('datalist#' + listId + ' option').evaluateAll((os) => os.map((o) => o.value));
  expect(cities).toEqual(expect.arrayContaining(['Karachi', 'Lahore', 'Islamabad', 'Rawalpindi', 'Faisalabad', 'Multan', 'Peshawar', 'Quetta', 'Hyderabad', 'Sialkot', 'Gujranwala', 'Bahawalpur']));
  await expect(page.getByLabel(/^Delivery notes/)).toHaveAttribute('maxlength', '300');
});

test('checkout: the order summary lists lines and totals; codes can be applied and removed here too', async ({ page }) => {
  await open(page, 'checkout', { lines: [['mn-01', 50, 1], ['au-01', 30, 1, true]] });
  const t = await totalsOf(page);
  const summary = page.locator('[data-bag-summary]');
  await expect(summary).toContainText('Oud Royale');
  await expect(summary).toContainText('Rose Eternelle');
  await expect(sum(page, 'subtotal')).toHaveText(await pkr(page, t.subtotal));
  await expect(sum(page, 'giftWrap')).toHaveText(await pkr(page, t.giftWrap));
  await expect(sum(page, 'total')).toHaveText(await pkr(page, t.total));
  await expect(summary.locator('a[href="cart.html"]')).toBeAttached();
  await expect(placeBtn(page)).toHaveText(new RegExp('Place order.*' + (await pkr(page, t.total)).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

  await codeInput(page).fill('WELCOME10');
  await applyBtn(page).click();
  const d = Math.round(t.subtotal * 0.1);
  await expect(page.locator('[data-sum-value="discount"]')).toHaveText('−' + await pkr(page, d));
  await expect(placeBtn(page)).toContainText(await pkr(page, t.total - d));
  await page.getByRole('button', { name: /remove code/i }).click();
  await expect(page.locator('[data-sum="discount"]')).toHaveCount(0);
  await expect(placeBtn(page)).toContainText(await pkr(page, t.total));
});

test('checkout: a successful order lands on the confirmation page, clears the cart and the code', async ({ page }) => {
  const errors = await open(page, 'checkout', { lines: [['mn-01', 50, 1], ['au-01', 30, 2]], code: 'WELCOME10' });
  const t = await totalsOf(page);
  await fillCheckout(page);
  await placeBtn(page).click();
  await page.waitForURL(/order-confirmation\.html\?order=ORD-\d{6}$/);
  await page.waitForSelector('[data-ready]');
  const number = new URL(page.url()).searchParams.get('order');
  await expect(page.locator('[data-order-number]')).toHaveText(number);
  await expect(page).toHaveTitle('Order ' + number + ' | Nuvora');
  await expect(page.locator('h1')).toHaveText('Thank you, Ayesha');
  const confirm = page.locator('[data-confirm]');
  await expect(confirm).toContainText('Oud Royale');
  await expect(confirm).toContainText('Rose Eternelle');
  await expect(confirm).toContainText('WELCOME10');
  await expect(confirm).toContainText(/Cash on delivery/);
  await expect(confirm.locator('.oc-facts__row--pay')).toContainText('Cash on delivery — ' + await pkr(page, t.total));
  // standard flow wording, no promise of a call; the concept notice sits under the ticket
  await expect(confirm).toContainText('Your order is placed. Your order summary is below.');
  await expect(confirm).not.toContainText(/we will call|call or whatsapp|pay the courier/i);
  await expect(confirm.locator('.oc-ticket + [data-concept-note]')).toHaveText(await page.evaluate(() => Shop.config.conceptNotice));
  await expect(confirm).toContainText('House 14, Street 7, Gulberg III');
  await expect(confirm).toContainText('0300 1234567');
  await expect(sum(page, 'total')).toHaveText(await pkr(page, t.total));
  expect(await cart(page)).toEqual([]);
  expect(await storedCode(page)).toBe('');
  const o = (await orders(page))[0];
  expect(o.number).toBe(number);
  expect(o.totals.total).toBe(t.total);
  expect(o.code).toBe('WELCOME10');

  // expected delivery range: createdAt + 3 .. + 7 working days (Mon-Sat), e.g. "Mon 19 – Fri 23 Oct"
  const range = await page.evaluate((iso) => {
    const D = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const work = (n) => { const d = new Date(iso); while (n > 0) { d.setDate(d.getDate() + 1); if (d.getDay() !== 0) n--; } return d; };
    const a = work(3);
    const b = work(7);
    const same = a.getMonth() === b.getMonth();
    return D[a.getDay()] + ' ' + a.getDate() + (same ? '' : ' ' + M[a.getMonth()]) + ' – ' + D[b.getDay()] + ' ' + b.getDate() + ' ' + M[b.getMonth()];
  }, o.createdAt);
  await expect(page.locator('[data-delivery-range]')).toHaveText(range);

  await expect(page.getByRole('link', { name: /track this order/i })).toHaveAttribute('href', /^track-order\.html/);
  await expect(page.getByRole('link', { name: /continue shopping/i })).toHaveAttribute('href', 'shop.html');
  // no WhatsApp number configured (the default): no "Confirm on WhatsApp", no wa.me anywhere
  await expect(page.locator('a[data-wa]')).toHaveCount(0);
  await expect(page.locator('a[href*="wa.me"]')).toHaveCount(0);
  await headingOutlineSane(page);
  expect(errors).toEqual([]);
});

test('confirmation: with a WhatsApp number set, "Confirm on WhatsApp" carries the order number and total, never the address', async ({ page }) => {
  await routeConfig(page, { whatsapp: TEST_WHATSAPP });
  const errors = await open(page, 'checkout', { lines: [['mn-01', 50, 1], ['au-01', 30, 2]], code: 'WELCOME10' });
  const t = await totalsOf(page);
  await fillCheckout(page);
  await placeBtn(page).click();
  await page.waitForURL(/order-confirmation\.html\?order=ORD-\d{6}$/);
  await page.waitForSelector('[data-ready]');
  const number = new URL(page.url()).searchParams.get('order');
  const wa = page.locator('a[data-wa]');
  await expect(wa).toHaveText(/Confirm on WhatsApp/);
  await expect(wa).toHaveAttribute('href', new RegExp('^https://wa\\.me/' + TEST_WHATSAPP + '\\?text='));
  const text = decodeURIComponent((await wa.getAttribute('href')).split('?text=')[1]);
  expect(text).toContain(number);
  expect(text).toContain(await pkr(page, t.total));
  expect(text).not.toContain('Gulberg');
  expect(text).not.toContain('1234567');
  expect(errors).toEqual([]);
});

test('checkout: double submit (two rapid clicks, Enter, requestSubmit) creates exactly one order', async ({ page }) => {
  await open(page, 'checkout', { lines: [['mn-01', 50, 1]] });
  await fillCheckout(page);
  await page.evaluate(() => {
    const b = Array.prototype.filter.call(document.querySelectorAll('button'), (n) => /place order/i.test(n.textContent))[0];
    const f = document.querySelector('form[data-checkout-form]');
    b.click();
    b.click();
    f.requestSubmit();
    f.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  });
  await page.waitForURL(/order-confirmation\.html\?order=ORD-\d{6}$/);
  await page.waitForSelector('[data-ready]');
  expect(await orders(page)).toHaveLength(1);
});

test('checkout: rapid Playwright double click plus Enter still creates one order', async ({ page }) => {
  await open(page, 'checkout', { lines: [['mn-01', 50, 1]] });
  await fillCheckout(page);
  // two clicks within one double-click gesture, then Enter straight after
  await placeBtn(page).dblclick({ noWaitAfter: true });
  await page.keyboard.press('Enter').catch(() => {});
  await expect(page).toHaveURL(/order-confirmation\.html\?order=ORD-\d{6}$/);
  await page.waitForSelector('[data-ready]');
  expect(await orders(page)).toHaveLength(1);
});

test('checkout: a sold-out line is excluded from the order; an over-stock line is ordered at the clamped quantity', async ({ page }) => {
  await open(page, 'checkout', { lines: [['sr-02', 50, 10], ['au-03', 50, 1], ['mn-01', 30, 1]] });
  const summary = page.locator('[data-bag-summary]');
  await expect(summary).not.toContainText('Peony Blush');
  await fillCheckout(page);
  await placeBtn(page).click();
  await page.waitForURL(/order-confirmation\.html/);
  await page.waitForSelector('[data-ready]');
  const o = (await orders(page))[0];
  expect(o.lines.map((l) => l.productId).sort()).toEqual(['mn-01', 'sr-02']);
  expect(o.lines.filter((l) => l.productId === 'sr-02')[0].qty).toBe(5);
  const expected = (await price(page, 'sr-02', 50)) * 5 + (await price(page, 'mn-01', 30));
  expect(o.totals.subtotal).toBe(expected);
  await expect(page.locator('[data-confirm]')).not.toContainText('Peony Blush');
});

test('checkout: an empty cart shows the empty state, no form, and no order can be created', async ({ page }) => {
  const errors = await open(page, 'checkout');
  await expect(page.locator('[data-checkout-empty]')).toBeVisible();
  await expect(page.locator('[data-checkout-empty] a[href="shop.html"]')).toBeVisible();
  await expect(form(page)).toHaveCount(0);
  await expect(page.locator('main form')).toHaveCount(0);
  await expect(placeBtn(page)).toHaveCount(0);
  await page.evaluate(() => { const f = document.querySelector('main form'); if (f) f.requestSubmit(); });
  expect(await orders(page)).toHaveLength(0);
  await headingOutlineSane(page);
  expect(errors).toEqual([]);
});

test('checkout: a cart of only sold-out lines is treated as empty', async ({ page }) => {
  await open(page, 'checkout', { lines: [['au-03', 50, 1]] });
  await expect(page.locator('[data-checkout-empty]')).toBeVisible();
  await expect(form(page)).toHaveCount(0);
});

test('checkout: keyboard only, Tab through the form and submit with Enter', async ({ page }) => {
  await open(page, 'checkout', { lines: [['mn-01', 50, 1]] });
  await page.getByLabel('Full name').focus();
  await page.keyboard.type('Bilal Ahmed');
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Mobile number')).toBeFocused();
  await page.keyboard.type('03211234567');
  await page.keyboard.press('Tab');
  await expect(page.getByLabel(/^Email/)).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Province')).toBeFocused();
  await page.keyboard.type('Sindh');
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('City')).toBeFocused();
  await page.keyboard.type('Karachi');
  await page.keyboard.press('Tab');
  await expect(page.getByLabel(/^Address/)).toBeFocused();
  await page.keyboard.type('Flat 3, Block 5, Clifton');
  let onButton = false;
  for (let i = 0; i < 6 && !onButton; i++) {
    await page.keyboard.press('Tab');
    onButton = await page.evaluate(() => /place order/i.test(document.activeElement.textContent || ''));
  }
  expect(onButton).toBe(true);
  await page.keyboard.press('Enter');
  await page.waitForURL(/order-confirmation\.html\?order=ORD-\d{6}$/);
  await page.waitForSelector('[data-ready]');
  const o = (await orders(page))[0];
  expect(o.customer.province).toBe('Sindh');
  expect(o.customer.city).toBe('Karachi');
});

// ============================================================= confirmation

test('confirmation: hostile name, address and notes render as text and nothing executes', async ({ page }) => {
  const errors = await open(page, 'checkout', { lines: [['mn-01', 50, 1]] });
  await fillCheckout(page, { name: XSS, address: XSS + ' Street 12, Model Town', notes: XSS, city: XSS });
  await placeBtn(page).click();
  await page.waitForURL(/order-confirmation\.html/);
  await page.waitForSelector('[data-ready]');
  await expect(page.locator('[data-confirm]')).toContainText(XSS + ' Street 12, Model Town');
  await expect(page.locator('[data-confirm] img[src="x"]')).toHaveCount(0);
  expect(await page.evaluate(() => window.__x)).toBeUndefined();
  await page.reload();
  await page.waitForSelector('[data-ready]');
  expect(await page.evaluate(() => window.__x)).toBeUndefined();
  await expect(page.locator('main img[src="x"]')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('confirmation: lookup is case-insensitive and trimmed; optional fields may be missing', async ({ page }) => {
  await open(page, 'cart');
  const number = await page.evaluate(() => {
    const o = Shop.store.placeOrder({ name: 'Sana', phone: '03001234567', province: 'Punjab', city: 'Lahore', address: 'House 1, Street 2, DHA' },
      [{ productId: 'mn-01', ml: 50, qty: 1, gift: false }], { subtotal: 12400, giftWrap: 0, discount: 0, delivery: 0, total: 12400 });
    return o.number;
  });
  await page.goto(pageUrl('order-confirmation') + '?order=%20' + number.toLowerCase() + '%20');
  await page.waitForSelector('[data-ready]');
  await expect(page.locator('[data-order-number]')).toHaveText(number);
  await expect(page.locator('h1')).toHaveText('Thank you, Sana');
  await expect(page.locator('[data-confirm]')).not.toContainText('undefined');
});

for (const [label, query] of [['unknown', '?order=ORD-000000'], ['missing', '']]) {
  test('confirmation: ' + label + ' order shows a friendly not-found state with links', async ({ page }) => {
    const errors = await open(page, 'order-confirmation', { query });
    const nf = page.locator('[data-notfound]');
    await expect(nf).toBeVisible();
    await expect(nf.locator('a[href^="track-order.html"]')).toBeVisible();
    await expect(nf.locator('a[href="shop.html"]')).toBeVisible();
    await expect(page.locator('[data-confirm]')).toHaveCount(0);
    await headingOutlineSane(page);
    expect(errors).toEqual([]);
  });
}

// =================================================================== layout

test('headings: one h1 and no skipped levels on cart and checkout', async ({ page }) => {
  await open(page, 'cart', { lines: [['mn-01', 50, 1]] });
  await headingOutlineSane(page);
  await open(page, 'cart');
  await headingOutlineSane(page);
  await open(page, 'checkout', { lines: [['mn-01', 50, 1]] });
  await headingOutlineSane(page);
});

test('mobile checkout: the order summary is a collapsible details at the top', async ({ page }) => {
  await open(page, 'checkout', { lines: [['mn-01', 50, 1]], viewport: MOBILE });
  const details = page.locator('details[data-summary-toggle]');
  await expect(details).toBeVisible();
  await expect(details).not.toHaveAttribute('open', '');
  const top = await details.evaluate((n) => n.getBoundingClientRect().top);
  const formTop = await form(page).evaluate((n) => n.getBoundingClientRect().top);
  expect(top).toBeLessThan(formTop);
  await details.locator('summary').click();
  await expect(details).toHaveAttribute('open', '');
  await expect(page.locator('[data-bag-summary]')).toContainText('Oud Royale');

  await page.setViewportSize(DESKTOP);
  await expect(details).toHaveAttribute('open', '');
});

test('no horizontal scroll at 375, 768 and 1280 on cart, checkout and confirmation', async ({ page }) => {
  for (const vp of [MOBILE, TABLET, DESKTOP]) {
    await open(page, 'cart', { lines: [['mn-01', 100, 2, true], ['sr-02', 50, 9], ['au-03', 50, 1]], code: 'WELCOME10', viewport: vp });
    await noHorizontalScroll(page);
    await open(page, 'cart', { viewport: vp });
    await noHorizontalScroll(page);
    await open(page, 'checkout', { lines: [['mn-01', 100, 2, true]], viewport: vp });
    await placeBtn(page).click();
    await noHorizontalScroll(page);
    await open(page, 'checkout', { viewport: vp });
    await noHorizontalScroll(page);
    await open(page, 'checkout', { lines: [['mn-01', 100, 2, true]], code: 'WELCOME10', viewport: vp });
    await fillCheckout(page, { notes: 'Please call before arriving; the gate is on the side street.' });
    await placeBtn(page).click();
    await page.waitForURL(/order-confirmation/);
    await page.waitForSelector('[data-ready]');
    await noHorizontalScroll(page);
    await page.goto(pageUrl('order-confirmation') + '?order=nope');
    await page.waitForSelector('[data-ready]');
    await noHorizontalScroll(page);
  }
});
