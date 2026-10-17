// Demo admin dashboard (Task 15): demo label, stats from seeded + live orders, an
// accessible inline-SVG sales chart with a data table, the orders table (Live at the
// top, status changes that persist for live orders and stay out of the store for
// sample ones, "Show all"), products and low-stock panels, XSS, layout, hygiene.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { pageUrl, collectErrors } = require('./helpers');

const MOBILE = { width: 375, height: 812 };
const TABLET = { width: 768, height: 1024 };
const DESKTOP = { width: 1280, height: 900 };
const XSS = '<img src=x onerror="window.__x=1">';

const CUSTOMER = {
  name: 'Test Buyer', phone: '03001234567', email: 'buyer@example.com',
  province: 'Punjab', city: 'Lahore', address: 'House 1, Street 1', notes: ''
};
const LINES = [{ productId: 'vn-01', ml: 50, qty: 1, gift: false }, { productId: 'sr-01', ml: 30, qty: 2, gift: false }];
const TOTALS = { subtotal: 18000, giftWrap: 0, discount: 0, delivery: 0, total: 18000 };

const num = (s) => Number(String(s).replace(/[^\d-]/g, ''));

// Clear storage (local + session), optionally place real orders through the store, open admin.
async function open(page, { orders = [], viewport = DESKTOP } = {}) {
  const errors = collectErrors(page);
  await page.setViewportSize(viewport);
  await page.goto(pageUrl('styleguide'));
  const placed = await page.evaluate((list) => {
    try { localStorage.clear(); sessionStorage.clear(); } catch (e) {}
    return list.map((o) => Shop.store.placeOrder(o.customer, o.lines, o.totals));
  }, orders);
  await page.goto(pageUrl('admin'));
  await page.waitForSelector('header.site-header');
  await page.waitForSelector('[data-ready]');
  return { errors, placed };
}

const rows = (page) => page.locator('[data-orders-body] tr[data-order-row]');
const row = (page, n) => page.locator('[data-orders-body] tr[data-order-row="' + n + '"]');
const statusSelect = (page, n) => page.locator('select[data-status-for="' + n + '"]');

test('admin: title, noindex, back-office label, heading and clean console', async ({ page }) => {
  const { errors } = await open(page);
  await expect(page).toHaveTitle('Back office | Nuvora');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
  await expect(page.locator('h1')).toHaveText('Dashboard');
  await expect(page.locator('.ad-strip__text')).toHaveText(/^Back office\s*·\s*Generated sales history plus orders placed in this browser$/);
  await expect(page.getByText('Generated sales history plus orders placed in this browser')).toBeVisible();
  await expect(page.locator('main')).not.toContainText(/\bdemo\b|\bsample\b|illustrative/i);
  await expect(page.locator('body')).toHaveClass(/page-admin/);
  expect(errors).toEqual([]);
});

test('admin: stat cards equal figures computed from seeded + live orders', async ({ page }) => {
  const { errors } = await open(page, { orders: [{ customer: CUSTOMER, lines: LINES, totals: TOTALS }] });
  const want = await page.evaluate(() => {
    const all = Shop.store.getOrders().concat(Shop.adminData.orders);
    const revenue = all.reduce((s, o) => s + Number(o.totals.total || 0), 0);
    return {
      orders: String(all.length),
      revenue: Shop.util.formatPKR(revenue),
      aov: Shop.util.formatPKR(Math.round(revenue / all.length)),
      low: String(Shop.products.filter((p) => p.stock <= 5).length)
    };
  });
  await expect(page.locator('[data-stat="orders"]')).toHaveText(want.orders);
  await expect(page.locator('[data-stat="revenue"]')).toHaveText(want.revenue);
  await expect(page.locator('[data-stat="aov"]')).toHaveText(want.aov);
  await expect(page.locator('[data-stat="low"]')).toHaveText(want.low);
  expect(want.low).toBe('4');
  expect(errors).toEqual([]);
});

test('admin: sales chart is an accessible SVG with a 30-row data table that adds up', async ({ page }) => {
  const { errors } = await open(page);
  const svg = page.locator('[data-sales-chart] svg[role="img"]');
  await expect(svg).toHaveCount(1);
  const label = await svg.getAttribute('aria-label');
  expect(label).toMatch(/30-day revenue PKR [\d,]+ across \d+ orders/);
  await expect(page.locator('[data-sales-summary]')).toContainText('30-day revenue');
  await expect(page.locator('[data-sales-chart] [data-bar]')).toHaveCount(30);

  const table = page.locator('[data-sales-table]');
  await expect(table.locator('tbody tr')).toHaveCount(30);
  await expect(table.locator('caption')).toBeAttached();
  const cells = await table.locator('tbody tr td:last-child').allTextContents();
  const sum = cells.reduce((s, t) => s + num(t), 0);
  const expected = await page.evaluate(() => Shop.adminData.sales.reduce((s, d) => s + d.total, 0));
  expect(sum).toBe(expected);
  expect(label).toContain(await page.evaluate((v) => Shop.util.formatPKR(v), expected));

  // the table toggles into view
  const toggle = page.locator('[data-sales-toggle]');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(table).toBeVisible();
  expect(errors).toEqual([]);
});

test('admin: keyboard focus on a bar shows its value, arrows move between days', async ({ page }) => {
  await open(page);
  const tip = page.locator('[data-chart-tip]');
  await expect(tip).toBeHidden();
  const current = page.locator('[data-sales-chart] [data-bar][tabindex="0"]');
  await expect(current).toHaveCount(1);
  await current.focus();
  await expect(tip).toBeVisible();
  const sales = await page.evaluate(() => Shop.adminData.sales);
  await expect(tip).toContainText(await page.evaluate((v) => Shop.util.formatPKR(v), sales[29].total));
  // the tooltip sits over the chart, near the focused day
  const tb = await tip.boundingBox();
  const fb = await page.locator('[data-sales-chart]').boundingBox();
  const bb = await current.boundingBox();
  expect(tb.y).toBeGreaterThanOrEqual(fb.y - 1);
  expect(tb.y + tb.height).toBeLessThanOrEqual(bb.y + bb.height);
  expect(Math.abs(tb.x + tb.width / 2 - (bb.x + bb.width / 2))).toBeLessThan(tb.width / 2 + 1);
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('[data-sales-chart] [data-bar]').nth(28)).toBeFocused();
  await expect(tip).toContainText(await page.evaluate((v) => Shop.util.formatPKR(v), sales[28].total));
  await page.keyboard.press('Home');
  await expect(page.locator('[data-sales-chart] [data-bar]').nth(0)).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(tip).toBeHidden();
});

test('admin: a real order sits at the top marked Live and counts into Orders and today', async ({ page }) => {
  const { errors, placed } = await open(page, { orders: [{ customer: CUSTOMER, lines: LINES, totals: TOTALS }] });
  const number = placed[0].number;
  const first = rows(page).first();
  await expect(first).toHaveAttribute('data-order-row', number);
  await expect(first.locator('[data-origin]')).toHaveText('This browser');
  await expect(rows(page).nth(1).locator('[data-origin]')).toHaveText('Generated');
  await expect(first).toContainText('Test Buyer');
  await expect(first).toContainText('Lahore');
  await expect(first).toContainText('PKR 18,000');
  await expect(first).toContainText('COD');
  await expect(page.locator('[data-live-empty]')).toBeHidden();

  const seeded = await page.evaluate(() => ({ n: Shop.adminData.orders.length, today: Shop.adminData.sales[29].total }));
  await expect(page.locator('[data-stat="orders"]')).toHaveText(String(seeded.n + 1));
  const lastRow = page.locator('[data-sales-table] tbody tr').last();
  expect(num(await lastRow.locator('td').last().textContent())).toBe(seeded.today + 18000);

  // a second order placed while the dashboard is open appears without a reload
  const second = await page.evaluate((o) => Shop.store.placeOrder(o.customer, o.lines, o.totals),
    { customer: Object.assign({}, CUSTOMER, { name: 'Second Buyer' }), lines: LINES, totals: TOTALS });
  await expect(rows(page).first()).toHaveAttribute('data-order-row', second.number);
  await expect(page.locator('[data-stat="orders"]')).toHaveText(String(seeded.n + 2));
  expect(num(await lastRow.locator('td').last().textContent())).toBe(seeded.today + 36000);
  expect(errors).toEqual([]);
});

test('admin: with no live orders the empty hint shows', async ({ page }) => {
  await open(page);
  const hint = page.locator('[data-live-empty]');
  await expect(hint).toBeVisible();
  await expect(hint).toContainText('Place an order at checkout and it appears here instantly');
  await expect(hint).toContainText('No orders from this browser yet.');
  await expect(rows(page).first().locator('[data-origin]')).toHaveText('Generated');
});

test('admin: changing a live order status persists after reload and shows on track-order', async ({ page }) => {
  const { errors, placed } = await open(page, { orders: [{ customer: CUSTOMER, lines: LINES, totals: TOTALS }] });
  const number = placed[0].number;
  const sel = statusSelect(page, number);
  await expect(sel).toHaveAttribute('aria-label', 'Status for ' + number);
  await expect(sel).toHaveValue('Placed');
  await sel.selectOption('Dispatched');
  await expect(row(page, number).locator('[data-status-pill]')).toHaveAttribute('data-status', 'Dispatched');
  await expect(page.locator('[data-admin-live]')).toHaveText(number + ' set to Dispatched');
  expect(await page.evaluate((n) => Shop.store.findOrder(n, '0300 1234567').status, number)).toBe('Dispatched');

  await page.reload();
  await page.waitForSelector('[data-ready]');
  await expect(statusSelect(page, number)).toHaveValue('Dispatched');

  await page.goto(pageUrl('track-order'));
  await page.waitForSelector('[data-ready]');
  await page.fill('#tk-number', number);
  await page.fill('#tk-phone', '0300 1234567');
  await page.click('.tk-form__submit');
  await expect(page.locator('.tk-status [data-track-status]')).toHaveText('Dispatched');
  expect(errors).toEqual([]);
});

test('admin: changing a sample order status updates the row and stats in-page, never the store, and resets on reload', async ({ page }) => {
  const { errors } = await open(page);
  const number = await rows(page).first().getAttribute('data-order-row');
  expect(number).toMatch(/^ORD-S\d{4}$/);
  const seeded = await page.evaluate((n) => Shop.adminData.orders.find((o) => o.number === n).status, number);
  expect(seeded).not.toBe('Delivered');
  const storeBefore = await page.evaluate(() => JSON.stringify(Shop.store.getOrders()));
  const lsBefore = await page.evaluate(() => JSON.stringify(Object.assign({}, localStorage)));
  const statsBefore = await page.locator('[data-stat-sub="orders"]').textContent();

  await statusSelect(page, number).selectOption('Delivered');
  // (a) row pill and the dependent stat update in-page
  await expect(row(page, number).locator('[data-status-pill]')).toHaveAttribute('data-status', 'Delivered');
  await expect(page.locator('[data-stat-sub="orders"]')).not.toHaveText(statsBefore);
  // (b) nothing added or changed in the store's orders or in localStorage
  expect(await page.evaluate(() => JSON.stringify(Shop.store.getOrders()))).toBe(storeBefore);
  expect(await page.evaluate(() => JSON.stringify(Object.assign({}, localStorage)))).toBe(lsBefore);

  // (c) a reload brings back the seeded status
  await page.reload();
  await page.waitForSelector('[data-ready]');
  await expect(statusSelect(page, number)).toHaveValue(seeded);
  await expect(row(page, number).locator('[data-status-pill]')).toHaveAttribute('data-status', seeded);
  await expect(page.locator('[data-stat-sub="orders"]')).toHaveText(statsBefore);
  expect(errors).toEqual([]);
});

test('admin: status changes are announced at once, with no empty gap, even when repeated', async ({ page }) => {
  await open(page);
  const number = await rows(page).first().getAttribute('data-order-row');
  const live = page.locator('[data-admin-live]');
  const read = () => page.evaluate(() => {
    const nodes = Array.from(document.querySelectorAll('[data-admin-live] [aria-live="polite"]'));
    return { text: document.querySelector('[data-admin-live]').textContent, filled: nodes.findIndex((n) => n.textContent), count: nodes.length };
  });
  await statusSelect(page, number).selectOption('Delivered');
  const first = await read(); // read straight away: no timer may leave it empty
  expect(first.text).toBe(number + ' set to Delivered');
  await statusSelect(page, number).selectOption('Placed');
  const mid = await read();
  expect(mid.text).toBe(number + ' set to Placed');
  expect(mid.filled).not.toBe(first.filled);
  await statusSelect(page, number).selectOption('Delivered');
  const again = await read();
  expect(again.text).toBe(number + ' set to Delivered');
  expect(again.count).toBe(2);
  // each message lands in the other live node than the one before, so even a
  // repeat of earlier words is a fresh change and is spoken again
  expect(again.filled).not.toBe(mid.filled);
  await expect(live).toHaveText(number + ' set to Delivered');
});

test('admin: the page script never touches web storage directly (only through store.js)', async () => {
  const src = fs.readFileSync(path.join(__dirname, '..', '..', 'assets', 'js', 'pages', 'admin.js'), 'utf8');
  expect(src).not.toMatch(/sessionStorage/);
  expect(src).not.toMatch(/localStorage/);
});

test('admin: "Show all" expands the orders table to every order', async ({ page }) => {
  await open(page, { orders: [{ customer: CUSTOMER, lines: LINES, totals: TOTALS }] });
  const total = await page.evaluate(() => Shop.adminData.orders.length + Shop.store.getOrders().length);
  await expect(rows(page)).toHaveCount(10);
  const btn = page.locator('[data-orders-toggle]');
  await expect(btn).toHaveAttribute('aria-expanded', 'false');
  await btn.click();
  await expect(rows(page)).toHaveCount(total);
  await expect(btn).toHaveAttribute('aria-expanded', 'true');
  await btn.click();
  await expect(rows(page)).toHaveCount(10);
  // a real table: caption and scoped headers
  await expect(page.locator('[data-orders-table] caption')).toBeAttached();
  expect(await page.locator('[data-orders-table] thead th[scope="col"]').count()).toBeGreaterThanOrEqual(7);
});

test('admin: products table lists 12 with correct stock pills; low-stock list is exact', async ({ page }) => {
  await open(page);
  const prows = page.locator('[data-products-body] tr');
  await expect(prows).toHaveCount(12);
  await expect(page.locator('[data-product-row="au-03"] [data-stock-pill]')).toHaveText('Sold out');
  await expect(page.locator('[data-product-row="mn-02"] [data-stock-pill]')).toHaveText('Low');
  await expect(page.locator('[data-product-row="sr-02"] [data-stock-pill]')).toHaveText('Low');
  await expect(page.locator('[data-product-row="vn-01"] [data-stock-pill]')).toHaveText('In stock');
  const want = await page.evaluate(() => Shop.products.filter((p) => p.stock <= 5).map((p) => p.id).sort());
  const got = (await page.locator('[data-low-stock] [data-low-item]').evaluateAll((els) => els.map((e) => e.getAttribute('data-low-item')))).sort();
  expect(got).toEqual(want);
  await expect(page.locator('[data-low-stock] a[href="product.html?id=au-03"]')).toHaveCount(1);
});

test('admin: customer name and city from a live order render as text (XSS)', async ({ page }) => {
  const evil = Object.assign({}, CUSTOMER, { name: XSS, city: XSS });
  const { errors, placed } = await open(page, { orders: [{ customer: evil, lines: LINES, totals: TOTALS }] });
  const first = row(page, placed[0].number);
  await expect(first).toContainText(XSS);
  expect(await first.locator('img').count()).toBe(0);
  expect(await page.evaluate(() => window.__x)).toBeUndefined();
  expect(errors).toEqual([]);
});

for (const [name, vp] of [['375', MOBILE], ['768', TABLET], ['1280', DESKTOP]]) {
  test('admin: no horizontal scroll and no tiny text at ' + name, async ({ page }) => {
    const { errors } = await open(page, { viewport: vp, orders: [{ customer: CUSTOMER, lines: LINES, totals: TOTALS }] });
    await page.locator('[data-orders-toggle]').click();
    await page.locator('[data-sales-toggle]').click();
    const o = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    expect(o.sw, 'no horizontal scroll').toBeLessThanOrEqual(o.cw);
    const tiny = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll('main *').forEach((el) => {
        if (!el.childNodes.length) return;
        const own = Array.prototype.some.call(el.childNodes, (n) => n.nodeType === 3 && n.textContent.trim());
        if (!own) return;
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) return;
        if (el.closest('.sr-only')) return;
        const fs = parseFloat(getComputedStyle(el).fontSize);
        if (fs < 11) out.push(el.tagName + ' ' + fs + ' ' + el.textContent.trim().slice(0, 30));
      });
      return out;
    });
    expect(tiny).toEqual([]);
    expect(errors).toEqual([]);
  });
}

// ============================================================ order details (expandable rows)

const FULL = {
  name: 'Test Buyer', phone: '03001234567', email: 'buyer@example.com',
  province: 'Punjab', city: 'Lahore', address: 'House 1, Street 1, Gulberg III', notes: 'Ring the bell twice.'
};
const toggle = (page, n) => page.locator('[data-order-toggle="' + n + '"]');
const detailsRow = (page, n) => page.locator('tr[data-order-details="' + n + '"]');
const region = (page, n) => detailsRow(page, n).locator('[role="region"]');

test('admin orders: every row has a collapsed toggle; opening shows the full customer, items and totals', async ({ page }) => {
  const { errors, placed } = await open(page, { orders: [{ customer: FULL, lines: LINES, totals: TOTALS }] });
  const n = placed[0].number;
  const count = await rows(page).count();
  await expect(page.locator('[data-orders-body] button[data-order-toggle]')).toHaveCount(count);
  const states = await page.locator('[data-orders-body] button[data-order-toggle]').evaluateAll((els) => els.map((e) => e.getAttribute('aria-expanded')));
  expect(states.every((s) => s === 'false')).toBe(true);
  // the toggle is the first cell of the row
  await expect(rows(page).first().locator(':scope > :first-child [data-order-toggle]')).toHaveCount(1);

  const btn = toggle(page, n);
  await expect(btn).toHaveAttribute('type', 'button');
  await expect(btn).toHaveAttribute('aria-label', 'Show details for ' + n);
  const id = await btn.getAttribute('aria-controls');
  expect(id).toBeTruthy();
  await expect(detailsRow(page, n)).toBeHidden();

  await btn.click();
  await expect(btn).toHaveAttribute('aria-expanded', 'true');
  const r = region(page, n);
  await expect(r).toBeVisible();
  expect(await r.getAttribute('id')).toBe(id);
  await expect(r).toHaveAttribute('aria-label', 'Details for ' + n);
  for (const t of ['Test Buyer', '03001234567', 'buyer@example.com', 'Punjab', 'Lahore', 'House 1, Street 1, Gulberg III',
    'Ring the bell twice.', 'Cash on delivery', 'Placed', 'None']) {
    await expect(r).toContainText(t);
  }
  const names = await page.evaluate(() => ({ a: Shop.products.find((p) => p.id === 'vn-01').name, b: Shop.products.find((p) => p.id === 'sr-01').name }));
  await expect(r).toContainText(names.a);
  await expect(r).toContainText(names.b);
  await expect(r).toContainText('50 ml');
  await expect(r).toContainText('30 ml');
  await expect(r.locator('li')).toHaveCount(2);
  await expect(r.locator('img[data-slot="product-vn-01"]')).toHaveCount(1);
  await expect(r.locator('img[data-slot="product-sr-01"]')).toHaveCount(1);
  await expect(r.locator('.ledger__row--total')).toContainText('PKR 18,000');
  await expect(r.locator('.ledger__row--subtotal')).toBeVisible();
  await expect(r.locator('.ledger__row--delivery')).toBeVisible();
  // the date and time of the order are shown
  await expect(r.locator('time')).toHaveCount(1);

  await btn.click();
  await expect(btn).toHaveAttribute('aria-expanded', 'false');
  await expect(detailsRow(page, n)).toBeHidden();
  expect(errors).toEqual([]);
});

test('admin orders: missing email and notes read "Not provided" and "None"; gift wrap and discount show', async ({ page }) => {
  const lines = [{ productId: 'mn-01', ml: 50, qty: 1, gift: true }];
  const { placed } = await open(page, { orders: [{ customer: Object.assign({}, FULL, { email: '', notes: '' }), lines, totals: { subtotal: 22000, giftWrap: 300, discount: 2200, delivery: 0, total: 20100 } }] });
  const n = placed[0].number;
  await toggle(page, n).click();
  const r = region(page, n);
  await expect(r.locator('[data-fact="email"]')).toContainText('Not provided');
  await expect(r.locator('[data-fact="notes"]')).toContainText('None');
  await expect(r.locator('[data-fact="code"]')).toContainText('None');
  await expect(r.locator('li')).toContainText(/gift wrap/i);
  await expect(r.locator('.ledger__row--giftWrap')).toContainText('PKR 300');
  await expect(r.locator('.ledger__row--discount')).toContainText('PKR 2,200');
  await expect(r.locator('.ledger__row--delivery')).toContainText('Free');
});

test('admin orders: a generated order opens with its seeded customer details', async ({ page }) => {
  await open(page);
  const first = await rows(page).first().getAttribute('data-order-row');
  const o = await page.evaluate((num) => Shop.adminData.orders.find((x) => x.number === num), first);
  await toggle(page, first).click();
  const r = region(page, first);
  await expect(r).toBeVisible();
  for (const v of [o.customer.name, o.customer.phone, o.customer.email, o.customer.province, o.customer.city, o.customer.address]) {
    await expect(r).toContainText(v);
  }
  await expect(r.locator('li')).toHaveCount(o.lines.length);
  await expect(r.locator('.ledger__row--total')).toContainText(await page.evaluate((v) => Shop.util.formatPKR(v), o.totals.total));
});

test('admin orders: dangerous text in name, address and notes renders as text in the details', async ({ page }) => {
  const evil = Object.assign({}, FULL, { name: XSS, address: XSS, notes: XSS });
  const { errors, placed } = await open(page, { orders: [{ customer: evil, lines: LINES, totals: TOTALS }] });
  const n = placed[0].number;
  await toggle(page, n).click();
  const r = region(page, n);
  await expect(r).toContainText(XSS);
  expect(await r.locator('img[onerror], img[src="x"]').count()).toBe(0);
  expect(await page.evaluate(() => window.__x)).toBeUndefined();
  expect(errors).toEqual([]);
});

test('admin orders: Enter and Space on the toggle open and close it, and focus stays on the button', async ({ page }) => {
  const { placed } = await open(page, { orders: [{ customer: FULL, lines: LINES, totals: TOTALS }] });
  const btn = toggle(page, placed[0].number);
  await btn.focus();
  await page.keyboard.press('Enter');
  await expect(btn).toHaveAttribute('aria-expanded', 'true');
  await expect(btn).toBeFocused();
  await expect(region(page, placed[0].number)).toBeVisible();
  await page.keyboard.press('Space');
  await expect(btn).toHaveAttribute('aria-expanded', 'false');
  await expect(btn).toBeFocused();
  await page.keyboard.press('Space');
  await expect(btn).toHaveAttribute('aria-expanded', 'true');
  await expect(btn).toBeFocused();
});

test('admin orders: expanded rows stay open across a status change, a live re-render and Show all', async ({ page }) => {
  const { errors, placed } = await open(page, { orders: [{ customer: FULL, lines: LINES, totals: TOTALS }] });
  const n = placed[0].number;
  const sampleNum = await rows(page).nth(1).getAttribute('data-order-row');
  await toggle(page, n).click();
  await toggle(page, sampleNum).click();

  // status change on the open live order (and blur so a deferred rebuild runs)
  await statusSelect(page, n).selectOption('Confirmed');
  await page.evaluate(() => document.activeElement && document.activeElement.blur());
  await expect(toggle(page, n)).toHaveAttribute('aria-expanded', 'true');
  await expect(region(page, n)).toBeVisible();
  await expect(region(page, n).locator('[data-fact="status"]')).toHaveText('Confirmed');

  // a new order arrives: the table is rebuilt, both stay open
  const second = await page.evaluate((o) => Shop.store.placeOrder(o.customer, o.lines, o.totals),
    { customer: Object.assign({}, FULL, { name: 'Second Buyer' }), lines: LINES, totals: TOTALS });
  await expect(rows(page).first()).toHaveAttribute('data-order-row', second.number);
  await expect(toggle(page, second.number)).toHaveAttribute('aria-expanded', 'false');
  await expect(toggle(page, n)).toHaveAttribute('aria-expanded', 'true');
  await expect(region(page, n)).toBeVisible();
  await expect(region(page, n)).toContainText('Test Buyer');
  await expect(toggle(page, sampleNum)).toHaveAttribute('aria-expanded', 'true');
  await expect(region(page, sampleNum)).toBeVisible();

  // sample order status change keeps its panel too
  await statusSelect(page, sampleNum).selectOption('Delivered');
  await expect(region(page, sampleNum).locator('[data-fact="status"]')).toHaveText('Delivered');
  await expect(region(page, sampleNum)).toBeVisible();

  // a rebuild while a toggle has focus keeps focus on it
  await toggle(page, n).focus();
  await page.evaluate((o) => Shop.store.placeOrder(o.customer, o.lines, o.totals),
    { customer: Object.assign({}, FULL, { name: 'Third Buyer' }), lines: LINES, totals: TOTALS });
  await expect(page.locator('[data-stat="orders"]')).toHaveText(String((await page.evaluate(() => Shop.adminData.orders.length)) + 3));
  await expect(toggle(page, n)).toBeFocused();
  await expect(toggle(page, n)).toHaveAttribute('aria-expanded', 'true');

  // Show all and back
  await page.locator('[data-orders-toggle]').click();
  await expect(toggle(page, n)).toHaveAttribute('aria-expanded', 'true');
  await page.locator('[data-orders-toggle]').click();
  await expect(toggle(page, n)).toHaveAttribute('aria-expanded', 'true');
  expect(errors).toEqual([]);
});

for (const [name, vp] of [['320', { width: 320, height: 700 }], ['375', MOBILE], ['768', TABLET], ['900', { width: 900, height: 900 }], ['960', { width: 960, height: 900 }], ['1024', { width: 1024, height: 800 }], ['1099', { width: 1099, height: 800 }], ['1280', DESKTOP]]) {
  test('admin orders: an expanded order has no horizontal scroll and no tiny text at ' + name, async ({ page }) => {
    const long = Object.assign({}, FULL, { address: 'House 118, Block B, Madina Town, Opposite the Central Park Main Boulevard Gate Number Four', notes: 'Please call before delivery and leave it with the guard.' });
    const { errors, placed } = await open(page, { viewport: vp, orders: [{ customer: long, lines: LINES, totals: TOTALS }] });
    const n = placed[0].number;
    await toggle(page, n).click();
    await toggle(page, await rows(page).nth(1).getAttribute('data-order-row')).click();
    await page.locator('[data-orders-toggle]').click();
    const o = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    expect(o.sw, 'no horizontal scroll').toBeLessThanOrEqual(o.cw);
    const r = region(page, n);
    const box = await r.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(vp.width + 0.5);
    // everything inside the details stays inside the details box
    const outside = await r.evaluate((root) => {
      const rb = root.getBoundingClientRect();
      const out = [];
      root.querySelectorAll('*').forEach((el) => {
        const b = el.getBoundingClientRect();
        if (b.width && (b.right > rb.right + 1 || b.left < rb.left - 1)) out.push(el.tagName + '.' + el.className + ' ' + Math.round(b.right - rb.right));
      });
      return out;
    });
    expect(outside).toEqual([]);
    // the table always fits its panel: it never needs a scrollbar of its own
    expect(await page.locator('.ad-orders .ad-table-wrap').evaluate((w) => w.scrollWidth <= w.clientWidth + 1)).toBe(true);
    const tiny = await r.evaluate((root) => {
      const out = [];
      root.querySelectorAll('*').forEach((el) => {
        const own = Array.prototype.some.call(el.childNodes, (c) => c.nodeType === 3 && c.textContent.trim());
        if (!own) return;
        const b = el.getBoundingClientRect();
        if (!b.width || !b.height) return;
        const fs = parseFloat(getComputedStyle(el).fontSize);
        if (fs < 11) out.push(el.tagName + ' ' + fs + ' ' + el.textContent.trim().slice(0, 30));
      });
      return out;
    });
    expect(tiny).toEqual([]);
    expect(errors).toEqual([]);
  });
}

test('admin orders: Expand all / Collapse all opens and closes every shown order', async ({ page }) => {
  await open(page, { orders: [{ customer: FULL, lines: LINES, totals: TOTALS }] });
  const all = page.locator('[data-orders-expand]');
  await expect(all).toHaveText('Expand all');
  await all.click();
  const states = () => page.locator('[data-orders-body] button[data-order-toggle]').evaluateAll((els) => els.map((e) => e.getAttribute('aria-expanded')));
  expect((await states()).every((s) => s === 'true')).toBe(true);
  await expect(all).toHaveText('Collapse all');
  await all.click();
  expect((await states()).every((s) => s === 'false')).toBe(true);
});

// ============================================================ products: photo file name

test('admin products: one extra column "Photo file" shows each manifest file name, nothing else added', async ({ page }) => {
  const { errors } = await open(page);
  const heads = await page.locator('[data-products-table] thead th').allTextContents();
  expect(heads.map((h) => h.trim())).toEqual(['Product', 'House', 'Stock', 'From', 'Rating', 'Availability', 'Photo file']);
  const want = await page.evaluate(() => Shop.products.map((p) => [p.id, Shop.media['product-' + p.id].file.split('/').pop()]));
  expect(want.length).toBe(12);
  for (const [id, file] of want) {
    const cell = page.locator('[data-product-row="' + id + '"] .ad-prow__file');
    await expect(cell).toHaveCount(1);
    await expect(cell.locator('code')).toHaveText(file);
    expect(file).toBe('product-' + id + '.jpg');
  }
  await expect(page.locator('[data-products-body] img, [data-products-body] .media')).toHaveCount(0);
  await expect(page.locator('[data-products-body] a')).toHaveCount(12);
  await expect(page.locator('[data-product-row="mn-01"] th a')).toHaveAttribute('href', 'product.html?id=mn-01');
  expect(errors).toEqual([]);
});

for (const [name, vp] of [['320', { width: 320, height: 700 }], ['375', MOBILE], ['768', TABLET], ['1280', DESKTOP]]) {
  test('admin products: photo file names fit with no horizontal scroll at ' + name, async ({ page }) => {
    const { errors } = await open(page, { viewport: vp });
    const o = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    expect(o.sw).toBeLessThanOrEqual(o.cw);
    const cell = page.locator('[data-product-row="mn-01"] .ad-prow__file');
    await cell.scrollIntoViewIfNeeded();
    const b = await cell.locator('code').boundingBox();
    expect(b.x + b.width).toBeLessThanOrEqual(vp.width + 0.5);
    const fs = await cell.locator('code').evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
    expect(fs).toBeGreaterThanOrEqual(11);
    if (vp.width < 900) await expect(cell).toContainText('Photo file'); // stacked card keeps its label
    expect(await page.locator('.ad-products .ad-table-wrap').evaluate((w) => w.scrollWidth <= w.clientWidth + 1)).toBe(true);
    expect(errors).toEqual([]);
  });
}
