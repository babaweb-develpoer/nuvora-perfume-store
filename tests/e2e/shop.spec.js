// Shop page (Task 9): catalogue grid, search, filters, sorting, active-filter
// chips, empty state, URL state (history.replaceState), malformed params,
// XSS safety of the query, wishlist persistence, mobile filter sheet, keyboard
// reach and layout.
const { test, expect } = require('@playwright/test');
const { pageUrl, collectErrors } = require('./helpers');

const MOBILE = { width: 375, height: 812 };
const TABLET = { width: 768, height: 1024 };
const DESKTOP = { width: 1280, height: 900 };

const cards = (page) => page.locator('[data-shop-grid] .product-card');
const status = (page) => page.locator('[data-shop-status]');
const search = (page) => page.getByRole('searchbox', { name: /search the collection/i });
const sortSelect = (page) => page.getByLabel(/^sort/i);
const filters = (page) => page.locator('[data-shop-filters]');
const chips = (page) => page.locator('[data-shop-chips] .shop-active__chip');
const empty = (page) => page.locator('[data-shop-empty]');

async function open(page, query = '', viewport = DESKTOP, { clear = true } = {}) {
  const errors = collectErrors(page);
  await page.setViewportSize(viewport);
  if (clear) {
    await page.goto(pageUrl('shop'));
    await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  }
  await page.goto(pageUrl('shop') + query);
  await page.waitForSelector('header.site-header');
  await page.waitForSelector('[data-shop-grid] .product-card, [data-shop-empty]:not([hidden])');
  return errors;
}

const cardIds = (page) => cards(page).locator('[data-wish]').evaluateAll((els) => els.map((e) => e.getAttribute('data-wish')));
const cardNames = (page) => cards(page).locator('.product-card__name').allTextContents();
const query = (page) => page.evaluate(() => window.location.search);

// Expected ids computed from the catalogue itself (not from the page script).
const expectedIds = (page, fn) => page.evaluate(`Shop.products.filter(${fn}).map(function (p) { return p.id; })`);
const lowest = 'function (p) { return Math.min.apply(null, p.sizes.map(function (s) { return s.price; })); }';

test('default: 12 cards, live result count, title, meta description, solid header', async ({ page }) => {
  const errors = await open(page);
  await expect(cards(page)).toHaveCount(12);
  await expect(status(page)).toHaveText(/Showing 12 of 12 fragrances/);
  await expect(status(page)).toHaveAttribute('aria-live', 'polite');
  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.locator('body')).toHaveAttribute('data-nav', 'shop');
  expect(await page.locator('body').getAttribute('data-header')).toBeNull();
  await expect(page.locator('.site-nav__link[aria-current="page"]')).toHaveText('Shop');
  const title = await page.title();
  expect(title).toMatch(/shop|collection/i);
  expect(title).toMatch(/Nuvora/);
  const desc = await page.locator('meta[name="description"]').getAttribute('content');
  expect(desc.length).toBeGreaterThanOrEqual(110);
  expect(desc.length).toBeLessThanOrEqual(170);
  expect(await query(page)).toBe('');
  await expect(empty(page)).toBeHidden();
  expect(errors).toEqual([]);
});

test('typing "oud" narrows the results and updates the count and the URL', async ({ page }) => {
  const errors = await open(page);
  await search(page).fill('');
  await search(page).pressSequentially('oud', { delay: 30 });
  await expect(page).toHaveURL(/[?&]q=oud(&|$)/);
  const n = await cards(page).count();
  expect(n).toBeGreaterThan(0);
  expect(n).toBeLessThan(12);
  await expect(status(page)).toHaveText(new RegExp(`Showing ${n} of 12 fragrances`));
  // focus stays in the search box while typing
  await expect(search(page)).toBeFocused();
  for (const name of await cardNames(page)) expect(name.length).toBeGreaterThan(0);
  // the search term is shown as a removable chip
  await expect(chips(page).filter({ hasText: 'oud' })).toHaveCount(1);
  // clear button empties the field and restores everything
  await page.getByRole('button', { name: /clear search/i }).click();
  await expect(search(page)).toHaveValue('');
  await expect(cards(page)).toHaveCount(12);
  await expect(search(page)).toBeFocused();
  expect(errors).toEqual([]);
});

test('selecting a house and a sort option updates results and the URL query', async ({ page }) => {
  const errors = await open(page);
  await filters(page).getByRole('checkbox', { name: /Velluto Nero/ }).check();
  await expect(cards(page)).toHaveCount(3);
  await expect(page).toHaveURL(/houses=Velluto%20Nero/);
  await sortSelect(page).selectOption('price-asc');
  await expect(page).toHaveURL(/sort=price-asc/);
  expect(await query(page)).toMatch(/houses=Velluto%20Nero/);
  expect((await cardNames(page))[0]).toBe('Cedar & Smoke');
  await expect(chips(page).filter({ hasText: 'Velluto Nero' })).toHaveCount(1);
  // sort survives later filter changes
  await filters(page).getByRole('checkbox', { name: /Aurelle/ }).check();
  await expect(cards(page)).toHaveCount(6);
  expect(await query(page)).toMatch(/sort=price-asc/);
  // history.replaceState: no new entries were pushed
  expect(await page.evaluate(() => history.length)).toBeLessThanOrEqual(2);
  expect(errors).toEqual([]);
});

test('house counts are shown next to each house checkbox', async ({ page }) => {
  await open(page);
  for (const house of ['Maison Noor', 'Velluto Nero', 'Aurelle', 'Sahara Royale']) {
    const label = filters(page).locator('label').filter({ has: page.getByRole('checkbox', { name: new RegExp(house) }) });
    await expect(label).toContainText('3');
  }
});

test('?houses=Aurelle pre-applies the filter: checkbox checked, 3 cards, chip shown', async ({ page }) => {
  const errors = await open(page, '?houses=Aurelle');
  await expect(filters(page).getByRole('checkbox', { name: /Aurelle/ })).toBeChecked();
  await expect(cards(page)).toHaveCount(3);
  for (const id of await cardIds(page)) expect(id.startsWith('au-')).toBe(true);
  await expect(chips(page)).toHaveCount(1);
  await expect(chips(page).first()).toContainText('Aurelle');
  await expect(status(page)).toHaveText(/Showing 3 of 12 fragrances/);
  // removing the chip restores the full list and unchecks the box
  await chips(page).first().click();
  await expect(cards(page)).toHaveCount(12);
  await expect(filters(page).getByRole('checkbox', { name: /Aurelle/ })).not.toBeChecked();
  expect(await query(page)).toBe('');
  expect(errors).toEqual([]);
});

test('?q=gift shows the gift-tagged products and fills the search box', async ({ page }) => {
  const errors = await open(page, '?q=gift');
  await expect(search(page)).toHaveValue('gift');
  const expected = await expectedIds(page, "function (p) { return p.tags.indexOf('gift') >= 0; }");
  await expect(cards(page)).toHaveCount(expected.length);
  expect((await cardIds(page)).sort()).toEqual(expected.sort());
  expect(errors).toEqual([]);
});

test('?genders=unisex&families=oud combines filters', async ({ page }) => {
  const errors = await open(page, '?genders=unisex&families=oud');
  await expect(cards(page)).toHaveCount(1);
  expect(await cardNames(page)).toEqual(['Oud Royale']);
  await expect(filters(page).getByRole('checkbox', { name: /Unisex/ })).toBeChecked();
  await expect(filters(page).getByRole('checkbox', { name: /^Oud/ })).toBeChecked();
  await expect(chips(page)).toHaveCount(2);
  expect(errors).toEqual([]);
});

test('price range filters by the lowest size price, from inputs and from the URL', async ({ page }) => {
  const errors = await open(page);
  const min = filters(page).getByLabel(/minimum price/i);
  const max = filters(page).getByLabel(/maximum price/i);
  // placeholders come from the catalogue's cheapest and dearest starting prices
  expect(await min.getAttribute('placeholder')).toMatch(/3,?600/);
  expect(await max.getAttribute('placeholder')).toMatch(/7,?800/);
  await min.fill('5000');
  await max.fill('6500');
  await max.press('Tab');
  const expected = await expectedIds(page, `function (p) { var l = (${lowest})(p); return l >= 5000 && l <= 6500; }`);
  await expect(cards(page)).toHaveCount(expected.length);
  expect((await cardIds(page)).sort()).toEqual(expected.sort());
  await expect(page).toHaveURL(/minPrice=5000/);
  await expect(page).toHaveURL(/maxPrice=6500/);

  await open(page, '?minPrice=7000', DESKTOP, { clear: false });
  await expect(filters(page).getByLabel(/minimum price/i)).toHaveValue('7000');
  const dear = await expectedIds(page, `function (p) { return (${lowest})(p) >= 7000; }`);
  await expect(cards(page)).toHaveCount(dear.length);
  expect(errors).toEqual([]);
});

test('inverted min and max prices from the URL are swapped, not crashed on', async ({ page }) => {
  const errors = await open(page, '?minPrice=6500&maxPrice=5000');
  await expect(filters(page).getByLabel(/minimum price/i)).toHaveValue('5000');
  await expect(filters(page).getByLabel(/maximum price/i)).toHaveValue('6500');
  const expected = await expectedIds(page, `function (p) { var l = (${lowest})(p); return l >= 5000 && l <= 6500; }`);
  await expect(cards(page)).toHaveCount(expected.length);
  expect(errors).toEqual([]);
});

test('a query with no match shows the empty state, and "Clear filters" restores all 12', async ({ page }) => {
  const errors = await open(page, '?q=zzzzqx&houses=Aurelle');
  await expect(cards(page)).toHaveCount(0);
  await expect(empty(page)).toBeVisible();
  await expect(status(page)).toHaveText(/Showing 0 of 12 fragrances/);
  await expect(empty(page).getByRole('link', { name: /scent quiz/i })).toHaveAttribute('href', 'scent-quiz.html');
  await empty(page).getByRole('button', { name: /clear filters/i }).click();
  await expect(cards(page)).toHaveCount(12);
  await expect(empty(page)).toBeHidden();
  await expect(search(page)).toHaveValue('');
  await expect(filters(page).getByRole('checkbox', { name: /Aurelle/ })).not.toBeChecked();
  expect(await query(page)).toBe('');
  expect(errors).toEqual([]);
});

test('Review Focus 5: an HTML query renders as text and never executes', async ({ page }) => {
  const payload = '<img src=x onerror="window.__x=1">';
  const errors = await open(page, '?q=' + encodeURIComponent(payload));
  await expect(search(page)).toHaveValue(payload);
  await expect(empty(page)).toBeVisible();
  await expect(status(page)).toContainText(payload);
  await expect(chips(page).first()).toContainText(payload);
  // and typed, not just loaded
  await search(page).fill('');
  await search(page).fill(payload + ' ');
  await expect(empty(page)).toBeVisible();
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.__x)).toBeUndefined();
  expect(await page.locator('main img[src="x"]').count()).toBe(0);
  expect(errors).toEqual([]);
});

for (const q of ['(', '[a', '.*']) {
  test(`regex-special query ${JSON.stringify(q)} does not throw and shows the empty state`, async ({ page }) => {
    const errors = await open(page);
    await search(page).fill(q);
    await expect(empty(page)).toBeVisible();
    await expect(cards(page)).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}

test('wishlist heart on a card toggles aria-pressed and persists on reload', async ({ page }) => {
  const errors = await open(page);
  const heart = cards(page).first().locator('[data-wish]');
  const id = await heart.getAttribute('data-wish');
  await expect(heart).toHaveAttribute('aria-pressed', 'false');
  await heart.click();
  await expect(heart).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await page.waitForSelector('[data-shop-grid] .product-card');
  await expect(page.locator(`[data-shop-grid] [data-wish="${id}"]`)).toHaveAttribute('aria-pressed', 'true');
  await page.locator(`[data-shop-grid] [data-wish="${id}"]`).click();
  await expect(page.locator(`[data-shop-grid] [data-wish="${id}"]`)).toHaveAttribute('aria-pressed', 'false');
  expect(errors).toEqual([]);
});

test('sort orders: price-asc starts with the cheapest, price-desc with the dearest', async ({ page }) => {
  const errors = await open(page);
  const byLowest = await page.evaluate(`Shop.products.slice().sort(function (a, b) { return (${lowest})(a) - (${lowest})(b); }).map(function (p) { return p.name; })`);
  await sortSelect(page).selectOption('price-asc');
  await expect(cards(page).first().locator('.product-card__name')).toHaveText(byLowest[0]);
  await sortSelect(page).selectOption('price-desc');
  await expect(cards(page).first().locator('.product-card__name')).toHaveText(byLowest[byLowest.length - 1]);
  await expect(cards(page)).toHaveCount(12);
  // a sort from the URL is reflected in the select
  await open(page, '?sort=rating', DESKTOP, { clear: false });
  await expect(sortSelect(page)).toHaveValue('rating');
  // featured is the default and is not written to the URL
  await sortSelect(page).selectOption('featured');
  expect(await query(page)).toBe('');
  expect(errors).toEqual([]);
});

test('malformed URL params do not crash and leave a sane state', async ({ page }) => {
  const errors = await open(page, '?minPrice=abc&sizes=zz&houses=Nope&sort=bogus&genders=&families=%E0%A4%A');
  await expect(cards(page)).toHaveCount(12);
  await expect(status(page)).toHaveText(/Showing 12 of 12 fragrances/);
  await expect(chips(page)).toHaveCount(0);
  await expect(sortSelect(page)).toHaveValue('featured');
  await expect(filters(page).getByLabel(/minimum price/i)).toHaveValue('');
  expect(await filters(page).getByRole('checkbox', { checked: true }).count()).toBe(0);
  // the URL is cleaned up to the state actually applied
  expect(await query(page)).toBe('');
  expect(errors).toEqual([]);
});

test('mobile: filters live in a bottom sheet with Escape, focus return and a count badge', async ({ page }) => {
  const errors = await open(page, '', MOBILE);
  const trigger = page.getByRole('button', { name: /^filters/i });
  const sheet = page.getByRole('dialog', { name: /filter/i });
  await expect(trigger).toBeVisible();
  await expect(filters(page)).toBeHidden();
  await expect(sheet).toBeHidden();
  await expect(page.locator('[data-filter-count]')).toBeHidden();

  await trigger.click();
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole('checkbox', { name: /Aurelle/ })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(sheet).toBeHidden();
  await expect(trigger).toBeFocused();

  // choose filters inside the sheet: results update behind it, the button counts them
  await trigger.click();
  await sheet.getByRole('checkbox', { name: /Aurelle/ }).check();
  await sheet.locator('label', { hasText: /^\s*Women/ }).click();
  await expect(cards(page)).toHaveCount(3);
  const apply = sheet.getByRole('button', { name: /show 3 results/i });
  await expect(apply).toBeVisible();
  await apply.click();
  await expect(sheet).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect(page.locator('[data-filter-count]')).toHaveText('2');
  await expect(trigger).toHaveAccessibleName(/2 active/);
  await expect(page).toHaveURL(/houses=Aurelle/);

  // Clear inside the sheet resets everything
  await trigger.click();
  await sheet.getByRole('button', { name: /^clear/i }).click();
  await expect(cards(page)).toHaveCount(12);
  await expect(sheet.getByRole('button', { name: /show 12 results/i })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-filter-count]')).toBeHidden();
  expect(errors).toEqual([]);
});

test('mobile: 2 product columns; tablet: 3; the filter sheet closes when the viewport widens', async ({ page }) => {
  await open(page, '', MOBILE);
  const cols = () => page.locator('[data-shop-grid]').evaluate((g) => getComputedStyle(g).gridTemplateColumns.split(' ').length);
  expect(await cols()).toBe(2);
  await page.getByRole('button', { name: /^filters/i }).click();
  await expect(page.getByRole('dialog', { name: /filter/i })).toBeVisible();
  await page.setViewportSize(DESKTOP);
  await expect(page.getByRole('dialog', { name: /filter/i })).toBeHidden();
  await expect(filters(page)).toBeVisible();
  await expect(filters(page).getByRole('checkbox', { name: /Aurelle/ })).toBeVisible();
  await page.setViewportSize(TABLET);
  expect(await cols()).toBe(3);
});

test('desktop: sticky sidebar filters are visible and the Filters button is not', async ({ page }) => {
  await open(page);
  await expect(filters(page)).toBeVisible();
  await expect(page.getByRole('button', { name: /^filters/i })).toBeHidden();
  const pos = await page.locator('[data-shop-sidebar]').evaluate((el) => getComputedStyle(el).position);
  expect(pos).toBe('sticky');
});

test('desktop: a sidebar taller than the viewport still brings its last group into view', async ({ page }) => {
  await open(page, '', { width: 1280, height: 640 });
  const sideH = await page.locator('[data-shop-sidebar]').evaluate((el) => el.offsetHeight);
  expect(sideH).toBeGreaterThan(640 - 76); // the case under test: it cannot fit
  await page.evaluate(() => window.scrollTo(0, 1100));
  await expect.poll(async () => {
    const box = await filters(page).getByLabel(/maximum price/i).boundingBox();
    return box && box.y >= 0 && box.y + box.height <= 640;
  }).toBe(true);
});

test('keyboard: every filter control is reachable with Tab and operable', async ({ page }) => {
  const errors = await open(page);
  const controls = await filters(page).locator('input').evaluateAll((els) => els.map((e) => e.id));
  expect(controls.length).toBe(4 + 3 + 4 + 3 + 2);
  // start on the search box and tab forward until every control has been focused
  await search(page).focus();
  const seen = new Set();
  for (let i = 0; i < 60 && seen.size < controls.length; i++) {
    await page.keyboard.press('Tab');
    const id = await page.evaluate(() => document.activeElement && document.activeElement.id);
    if (controls.includes(id)) seen.add(id);
  }
  expect([...seen].sort()).toEqual([...controls].sort());

  // Space toggles a house checkbox and a chip-style checkbox
  const house = filters(page).getByRole('checkbox', { name: /Maison Noor/ });
  await house.focus();
  await page.keyboard.press('Space');
  await expect(house).toBeChecked();
  await expect(cards(page)).toHaveCount(3);
  const size = filters(page).getByRole('checkbox', { name: /100 ml/ });
  await size.focus();
  await page.keyboard.press('Space');
  await expect(size).toBeChecked();
  await page.keyboard.press('Space');
  await expect(size).not.toBeChecked();
  // the focus ring is visible on the chip-style control
  const family = filters(page).getByRole('checkbox', { name: /^Floral/ });
  await family.focus();
  await page.keyboard.press('Space');
  await expect(family).toBeChecked();
  await expect(cards(page)).toHaveCount(0);
  // sort select is operable from the keyboard
  await sortSelect(page).focus();
  await page.keyboard.press('ArrowDown');
  await expect(sortSelect(page)).not.toHaveValue('featured');
  expect(errors).toEqual([]);
});

for (const [label, vp] of [['375', MOBILE], ['768', TABLET], ['1280', DESKTOP]]) {
  test(`no horizontal scroll at ${label}, including the empty state`, async ({ page }) => {
    const errors = await open(page, '', vp);
    const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(await overflow()).toBeLessThanOrEqual(0);
    await open(page, '?q=' + encodeURIComponent('a very long query that matches nothing whatsoever at all'), vp, { clear: false });
    await expect(empty(page)).toBeVisible();
    expect(await overflow()).toBeLessThanOrEqual(0);
    expect(errors).toEqual([]);
  });
}

test('heading outline starts at h1 and never skips a level', async ({ page }) => {
  await open(page);
  const levels = await page.locator('main h1, main h2, main h3, main h4').evaluateAll((els) =>
    els.map((h) => Number(h.tagName.slice(1))));
  expect(levels[0]).toBe(1);
  for (let i = 1; i < levels.length; i++) expect(levels[i] - levels[i - 1]).toBeLessThanOrEqual(1);
});
