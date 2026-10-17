// Product page (Task 10): product detail, size/qty/gift purchase flow, sold-out
// and low-stock states, notes pyramid, keyboard tabs, reviews (XSS-safe,
// persisted, validated), related products, Product JSON-LD, not-found state,
// sticky mobile purchase bar, wishlist, layout and console hygiene.
const { test, expect } = require('@playwright/test');
const { pageUrl, collectErrors } = require('./helpers');

const MOBILE = { width: 375, height: 812 };
const TABLET = { width: 768, height: 1024 };
const DESKTOP = { width: 1280, height: 900 };

async function open(page, query = '?id=mn-01', viewport = DESKTOP, { clear = true } = {}) {
  const errors = collectErrors(page);
  await page.setViewportSize(viewport);
  if (clear) {
    await page.goto(pageUrl('product'));
    await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  }
  await page.goto(pageUrl('product') + query);
  await page.waitForSelector('header.site-header');
  await page.waitForSelector('[data-pdp]:not([hidden]), [data-notfound]:not([hidden])');
  return errors;
}

const product = (page, id) => page.evaluate((pid) => Shop.products.filter((p) => p.id === pid)[0], id);
const pkr = (page, n) => page.evaluate((v) => Shop.util.formatPKR(v), n);
const cart = (page) => page.evaluate(() => Shop.store.getCart());
const sizeGroup = (page) => page.getByRole('radiogroup', { name: /size/i });
const sizeRadio = (page, ml) => sizeGroup(page).getByRole('radio', { name: new RegExp('^' + ml + ' ml') });
const price = (page) => page.locator('[data-pdp-price]');
const addBtn = (page) => page.locator('[data-pdp-add]');
const qtyInput = (page) => page.getByRole('textbox', { name: /quantity/i });
const incBtn = (page) => page.getByRole('button', { name: /increase quantity/i });
const decBtn = (page) => page.getByRole('button', { name: /decrease quantity/i });
const drawer = (page) => page.locator('#cart-drawer');
const reviewForm = (page) => page.locator('[data-review-form]');
const reviewItems = (page) => page.locator('[data-review-list] .pdp-review');
const jsonLd = (page) => page.locator('script[type="application/ld+json"]');

async function openReviews(page) {
  await page.getByRole('tab', { name: /reviews/i }).click();
  await expect(reviewForm(page)).toBeVisible();
}

async function postReview(page, { name = '', rating = 0, text = '' }) {
  const form = reviewForm(page);
  await form.getByLabel(/your name/i).fill(name);
  if (rating) await form.getByRole('radio', { name: new RegExp('^' + rating + ' star') }).check({ force: true });
  await form.getByLabel(/your review/i).fill(text);
  await form.getByRole('button', { name: /post review/i }).click();
}

// ----------------------------------------------------------------- content

test('mn-01: house, name, rating, notes pyramid, three sizes from the data, 50 ml default', async ({ page }) => {
  const errors = await open(page);
  const p = await product(page, 'mn-01');

  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.locator('h1')).toHaveText(p.name);
  const house = page.locator('[data-pdp-house]');
  await expect(house).toHaveText(p.house);
  await expect(house).toHaveAttribute('href', 'shop.html?houses=' + encodeURIComponent(p.house));

  // every note name from the data appears in the pyramid, in its own tier
  const notes = page.locator('[data-pdp-notes]');
  for (const tier of ['top', 'heart', 'base']) {
    const tierEl = notes.locator('[data-tier="' + tier + '"]');
    await expect(tierEl).toHaveCount(1);
    for (const n of p.notes[tier]) await expect(tierEl).toContainText(n);
  }

  // three sizes with prices from the data; 50 ml selected by default
  await expect(sizeGroup(page).getByRole('radio')).toHaveCount(3);
  for (const s of p.sizes) {
    const r = sizeRadio(page, s.ml);
    await expect(r).toHaveCount(1);
    await expect(sizeGroup(page)).toContainText(await pkr(page, s.price));
  }
  await expect(sizeRadio(page, 50)).toBeChecked();
  const fifty = p.sizes.filter((s) => s.ml === 50)[0];
  await expect(price(page)).toHaveText(await pkr(page, fifty.price));
  await expect(price(page)).not.toContainText(/from/i);

  // rating with review count, stock and gift-wrap copy from config
  await expect(page.locator('[data-pdp-rating]')).toContainText(String(p.reviewCount));
  await expect(page.locator('[data-pdp-stock]')).toHaveText(/in stock/i);
  const fee = await page.evaluate(() => Shop.config.giftWrapFee);
  await expect(page.getByRole('checkbox', { name: /gift wrap/i })).toHaveCount(1);
  await expect(page.locator('[data-pdp-gift]')).toContainText(await pkr(page, fee));

  // trust block reads the free-delivery threshold from config
  const threshold = await page.evaluate(() => Shop.config.freeDeliveryThreshold);
  const trust = page.locator('[data-pdp-trust]');
  await expect(trust).toContainText(/cash on delivery/i);
  await expect(trust).toContainText(await pkr(page, threshold));
  await expect(trust).toContainText(/7-day returns/i);
  await expect(trust).toContainText(/authentic/i);
  expect(errors).toEqual([]);
});

test('title, meta description and breadcrumb', async ({ page }) => {
  const errors = await open(page);
  const p = await product(page, 'mn-01');
  expect(await page.title()).toBe(p.name + ' by ' + p.house + ' | Nuvora');
  const firstSentence = p.description.match(/^.*?[.!?](?=\s|$)/)[0];
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', firstSentence);

  const crumbs = page.getByRole('navigation', { name: /breadcrumb/i });
  await expect(crumbs).toHaveCount(1);
  await expect(crumbs.getByRole('link', { name: 'Home' })).toHaveAttribute('href', 'index.html');
  await expect(crumbs.getByRole('link', { name: 'Shop' })).toHaveAttribute('href', 'shop.html');
  await expect(crumbs.getByRole('link', { name: p.house })).toHaveAttribute('href', 'shop.html?houses=' + encodeURIComponent(p.house));
  const current = crumbs.locator('[aria-current="page"]');
  await expect(current).toHaveCount(1);
  await expect(current).toHaveText(p.name);
  await expect(page.locator('.site-nav__link[aria-current="page"]')).toHaveText('Shop');
  expect(errors).toEqual([]);
});

// -------------------------------------------------------- purchase controls

test('choosing 100 ml updates the price; add to bag adds ml 100, qty and gift, and opens the drawer', async ({ page }) => {
  const errors = await open(page);
  const p = await product(page, 'mn-01');
  const hundred = p.sizes.filter((s) => s.ml === 100)[0];

  await sizeRadio(page, 100).check({ force: true });
  await expect(sizeRadio(page, 100)).toBeChecked();
  await expect(price(page)).toHaveText(await pkr(page, hundred.price));

  await incBtn(page).click();
  await expect(qtyInput(page)).toHaveValue('2');
  await page.getByRole('checkbox', { name: /gift wrap/i }).check({ force: true });

  await addBtn(page).click();
  await expect(drawer(page)).toBeVisible();
  await expect(drawer(page).locator('.cart-line')).toHaveCount(1);
  expect(await cart(page)).toEqual([{ productId: 'mn-01', ml: 100, qty: 2, gift: true }]);
  expect(errors).toEqual([]);
});

test('gift wrap unchecked adds a plain line', async ({ page }) => {
  await open(page);
  await addBtn(page).click();
  await expect(drawer(page)).toBeVisible();
  expect(await cart(page)).toEqual([{ productId: 'mn-01', ml: 50, qty: 1, gift: false }]);
});

test('quantity stepper is capped at min(stock, 20) and typed values clamp (sr-02, stock 5)', async ({ page }) => {
  const errors = await open(page, '?id=sr-02');
  await expect(page.locator('[data-pdp-stock]')).toHaveText(/only 5 left/i);
  await expect(decBtn(page)).toBeDisabled();
  for (let i = 0; i < 7; i++) {
    if (await incBtn(page).isDisabled()) break;
    await incBtn(page).click();
  }
  await expect(qtyInput(page)).toHaveValue('5');
  await expect(incBtn(page)).toBeDisabled();

  await qtyInput(page).fill('99');
  await qtyInput(page).press('Tab');
  await expect(qtyInput(page)).toHaveValue('5');
  await qtyInput(page).fill('0');
  await qtyInput(page).press('Tab');
  await expect(qtyInput(page)).toHaveValue('1');
  await qtyInput(page).fill('abc');
  await qtyInput(page).press('Tab');
  await expect(qtyInput(page)).toHaveValue('1');
  await qtyInput(page).fill('3');
  await qtyInput(page).press('Tab');
  await expect(qtyInput(page)).toHaveValue('3');

  // typed over the cap and added straight away: still capped
  await qtyInput(page).fill('40');
  await addBtn(page).click();
  await expect(drawer(page)).toBeVisible();
  expect((await cart(page))[0].qty).toBe(5);
  expect(errors).toEqual([]);
});

test('quantity for a well-stocked product is capped at 20', async ({ page }) => {
  await open(page, '?id=mn-01');
  await qtyInput(page).fill('25');
  await qtyInput(page).press('Tab');
  await expect(qtyInput(page)).toHaveValue('20');
  await expect(incBtn(page)).toBeDisabled();
});

test('sold out (au-03): add disabled and labelled Sold out, similar link, no cart change', async ({ page }) => {
  const errors = await open(page, '?id=au-03');
  const p = await product(page, 'au-03');
  expect(p.stock).toBe(0);
  await expect(addBtn(page)).toBeDisabled();
  await expect(addBtn(page)).toHaveText(/sold out/i);
  await expect(page.locator('[data-pdp-stock]')).toHaveText(/sold out/i);
  const similar = page.getByRole('link', { name: /browse similar fragrances/i });
  await expect(similar).toBeVisible();
  expect(await similar.getAttribute('href')).toMatch(/^shop\.html\?/);
  await addBtn(page).click({ force: true });
  await expect(drawer(page)).toBeHidden();
  expect(await cart(page)).toEqual([]);
  expect(errors).toEqual([]);
});

test('arrow keys on the size radiogroup change the selection and the price', async ({ page }) => {
  await open(page);
  const p = await product(page, 'mn-01');
  await sizeRadio(page, 50).focus();
  await page.keyboard.press('ArrowRight');
  await expect(sizeRadio(page, 100)).toBeChecked();
  await expect(price(page)).toHaveText(await pkr(page, p.sizes[2].price));
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  await expect(sizeRadio(page, 30)).toBeChecked();
  await expect(price(page)).toHaveText(await pkr(page, p.sizes[0].price));
});

test('wishlist heart toggles aria-pressed and persists across reloads', async ({ page }) => {
  await open(page);
  const heart = page.locator('[data-pdp] [data-wish="mn-01"]').first();
  await expect(heart).toHaveAttribute('aria-pressed', 'false');
  await heart.click();
  await expect(heart).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => Shop.store.getWishlist())).toContain('mn-01');
  await page.reload();
  await expect(page.locator('[data-pdp] [data-wish="mn-01"]').first()).toHaveAttribute('aria-pressed', 'true');
  await page.locator('[data-pdp] [data-wish="mn-01"]').first().click();
  await expect(page.locator('[data-pdp] [data-wish="mn-01"]').first()).toHaveAttribute('aria-pressed', 'false');
});

// ----------------------------------------------------------------------- tabs

test('tabs switch by click and keyboard; hidden panels are not focusable', async ({ page }) => {
  await open(page);
  const tabs = page.getByRole('tablist');
  await expect(tabs).toHaveCount(1);
  const desc = page.getByRole('tab', { name: /description/i });
  const wear = page.getByRole('tab', { name: /how to wear/i });
  const reviews = page.getByRole('tab', { name: /reviews/i });

  await expect(desc).toHaveAttribute('aria-selected', 'true');
  await expect(desc).toHaveAttribute('tabindex', '0');
  await expect(wear).toHaveAttribute('tabindex', '-1');
  for (const t of [desc, wear, reviews]) {
    const id = await t.getAttribute('aria-controls');
    expect(id).toBeTruthy();
    await expect(page.locator('#' + id)).toHaveAttribute('role', 'tabpanel');
  }
  const panelOf = async (t) => page.locator('#' + (await t.getAttribute('aria-controls')));
  await expect(await panelOf(desc)).toBeVisible();
  await expect(await panelOf(wear)).toBeHidden();
  await expect(await panelOf(reviews)).toBeHidden();

  // the description panel carries the description and the family/gender facts
  const p = await product(page, 'mn-01');
  await expect(await panelOf(desc)).toContainText(p.description.slice(0, 40));
  await expect(await panelOf(desc)).toContainText(/oud/i);
  await expect(await panelOf(desc)).toContainText(/unisex/i);

  await wear.click();
  await expect(wear).toHaveAttribute('aria-selected', 'true');
  await expect(desc).toHaveAttribute('aria-selected', 'false');
  await expect(await panelOf(wear)).toBeVisible();
  await expect(await panelOf(desc)).toBeHidden();
  await expect(await panelOf(wear)).toContainText(/pulse points/i);
  await expect(await panelOf(wear)).not.toContainText(/eau de parfum|eau de toilette|\bEDP\b|\bEDT\b/i);

  await wear.focus();
  await page.keyboard.press('ArrowRight');
  await expect(reviews).toBeFocused();
  await expect(reviews).toHaveAttribute('aria-selected', 'true');
  await expect(await panelOf(reviews)).toBeVisible();
  await page.keyboard.press('Home');
  await expect(desc).toBeFocused();
  await expect(desc).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('End');
  await expect(reviews).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await expect(wear).toBeFocused();
  await expect(wear).toHaveAttribute('aria-selected', 'true');

  // nothing inside a hidden panel can take focus
  const focusableHidden = await page.evaluate(() => {
    const sel = ['a[href]', 'button', 'input', 'textarea', 'select', '[tabindex]']
      .map((s) => '[role="tabpanel"][hidden] ' + s).join(', ');
    return {
      hiddenPanels: document.querySelectorAll('[role="tabpanel"][hidden]').length,
      inside: document.querySelectorAll(sel).length,
      reachable: Array.from(document.querySelectorAll(sel)).filter((el) => el.getClientRects().length > 0).length
    };
  });
  expect(focusableHidden.hiddenPanels).toBe(2);
  expect(focusableHidden.inside).toBeGreaterThan(0); // the reviews form is in a hidden panel
  expect(focusableHidden.reachable).toBe(0);
});

test('the rating link opens the reviews tab', async ({ page }) => {
  await open(page);
  await page.locator('[data-pdp-rating]').click();
  await expect(page.getByRole('tab', { name: /reviews/i })).toHaveAttribute('aria-selected', 'true');
  await expect(reviewForm(page)).toBeVisible();
});

// -------------------------------------------------------------------- reviews

test('reviews: hostile name and text render as text, nothing executes, and persist after reload', async ({ page }) => {
  const errors = await open(page);
  await openReviews(page);
  await expect(page.locator('[data-review-empty]')).toBeVisible();
  const tab = page.getByRole('tab', { name: /reviews/i });
  const before = await tab.textContent();
  const p = await product(page, 'mn-01');
  expect(before).toContain('(' + p.reviewCount + ')');

  const text = 'Lovely <img src=x onerror="window.__x=1"> on skin';
  await postReview(page, { name: '<b>x</b>', rating: 4, text });

  await expect(reviewItems(page)).toHaveCount(1);
  const item = reviewItems(page).first();
  await expect(item.locator('.pdp-review__name')).toHaveText('<b>x</b>');
  await expect(item.locator('.pdp-review__text')).toHaveText(text);
  expect(await item.locator('b, img').count()).toBe(0);
  expect(await page.evaluate(() => window.__x)).toBeUndefined();
  await expect(page.locator('[data-review-status]')).toBeFocused();
  await expect(page.locator('[data-review-empty]')).toBeHidden();
  await expect(tab).toContainText('(' + (p.reviewCount + 1) + ')');
  // the form reset
  await expect(reviewForm(page).getByLabel(/your review/i)).toHaveValue('');
  await expect(reviewForm(page).getByLabel(/your name/i)).toHaveValue('');

  await page.reload();
  await page.waitForSelector('[data-pdp]:not([hidden])');
  await openReviews(page);
  await expect(reviewItems(page)).toHaveCount(1);
  await expect(reviewItems(page).first().locator('.pdp-review__name')).toHaveText('<b>x</b>');
  await expect(reviewItems(page).first().locator('.pdp-review__text')).toHaveText(text);
  expect(await page.locator('[data-review-list] img').count()).toBe(0);
  expect(await page.evaluate(() => window.__x)).toBeUndefined();
  expect(errors).toEqual([]);
});

test('reviews: missing rating or empty text shows inline errors and stores nothing', async ({ page }) => {
  await open(page);
  await openReviews(page);
  const form = reviewForm(page);

  await postReview(page, { name: 'Ayesha', rating: 0, text: 'Beautiful in the evening.' });
  const ratingError = form.locator('[data-error="rating"]');
  await expect(ratingError).toBeVisible();
  await expect(ratingError).toContainText(/rating/i);
  expect(await page.evaluate(() => Shop.store.getReviews('mn-01'))).toEqual([]);
  await expect(reviewItems(page)).toHaveCount(0);

  await form.getByRole('radio', { name: /^5 star/ }).check({ force: true });
  await expect(ratingError).toBeHidden();
  await form.getByLabel(/your review/i).fill('   ');
  await form.getByRole('button', { name: /post review/i }).click();
  const textError = form.locator('[data-error="text"]');
  await expect(textError).toBeVisible();
  await expect(form.getByLabel(/your review/i)).toHaveAttribute('aria-invalid', 'true');
  expect(await page.evaluate(() => Shop.store.getReviews('mn-01'))).toEqual([]);
  await expect(form.getByLabel(/your review/i)).toHaveAttribute('maxlength', '600');
});

test('reviews: the list is newest first, with name, stars, date and text; empty name becomes Guest', async ({ page }) => {
  await open(page);
  await openReviews(page);
  await postReview(page, { name: 'First', rating: 3, text: 'The first one.' });
  await expect(reviewItems(page)).toHaveCount(1);
  await postReview(page, { name: '', rating: 5, text: 'The second one.' });
  await expect(reviewItems(page)).toHaveCount(2);
  await expect(reviewItems(page).nth(0)).toContainText('The second one.');
  await expect(reviewItems(page).nth(0).locator('.pdp-review__name')).toHaveText('Guest');
  await expect(reviewItems(page).nth(1)).toContainText('The first one.');
  await expect(reviewItems(page).nth(0).locator('[role="img"][aria-label="5 out of 5"]')).toHaveCount(1);
  await expect(reviewItems(page).nth(0).locator('time')).toHaveAttribute('datetime', /^\d{4}-\d{2}-\d{2}/);
});

// --------------------------------------------------------- related and JSON-LD

test('related: four cards, none of them the current product', async ({ page }) => {
  await open(page);
  const cards = page.locator('[data-related] .product-card');
  await expect(cards).toHaveCount(4);
  const ids = await cards.locator('[data-wish]').evaluateAll((els) => els.map((e) => e.getAttribute('data-wish')));
  expect(ids).not.toContain('mn-01');
  expect(new Set(ids).size).toBe(4);

  // a product with fewer close matches is still topped up to four
  await open(page, '?id=au-03', DESKTOP, { clear: false });
  const ids2 = await page.locator('[data-related] .product-card [data-wish]').evaluateAll((els) => els.map((e) => e.getAttribute('data-wish')));
  expect(ids2).toHaveLength(4);
  expect(ids2).not.toContain('au-03');
});

test('JSON-LD Product: sku, price, currency, availability and rating', async ({ page }) => {
  await open(page);
  await expect(jsonLd(page)).toHaveCount(1);
  const p = await product(page, 'mn-01');
  const data = JSON.parse(await jsonLd(page).textContent());
  expect(data['@context']).toMatch(/schema\.org/);
  expect(data['@type']).toBe('Product');
  expect(data.name).toBe(p.name);
  expect(data.sku).toBe('mn-01');
  expect(data.brand.name).toBe(p.house);
  expect(data.description).toBe(p.description);
  expect(data.image).toBeTruthy();
  expect(data.offers.priceCurrency).toBe('PKR');
  expect(Number(data.offers.price)).toBe(p.sizes.filter((s) => s.ml === 50)[0].price);
  expect(data.offers.availability).toBe('https://schema.org/InStock');
  expect(data.offers.url).toContain('mn-01');
  expect(Number(data.aggregateRating.ratingValue)).toBeCloseTo(p.rating, 1);
  expect(Number(data.aggregateRating.reviewCount)).toBe(p.reviewCount);

  await open(page, '?id=au-03', DESKTOP, { clear: false });
  const sold = JSON.parse(await jsonLd(page).textContent());
  expect(sold.sku).toBe('au-03');
  expect(sold.offers.availability).toBe('https://schema.org/OutOfStock');
});

// ------------------------------------------------------------------ not found

for (const [label, query] of [['unknown id', '?id=zzz'], ['missing id', ''], ['wrong-case id', '?id=MN-01']]) {
  test('not found (' + label + '): friendly state, shop link, suggestions, no JSON-LD, no errors', async ({ page }) => {
    const errors = await open(page, query);
    const nf = page.locator('[data-notfound]');
    await expect(nf).toBeVisible();
    await expect(page.locator('[data-pdp]')).toBeHidden();
    await expect(page.locator('h1')).toHaveText("We couldn't find that fragrance");
    await expect(nf.getByRole('link', { name: /browse the collection/i })).toHaveAttribute('href', 'shop.html');
    expect(await nf.locator('.product-card').count()).toBeGreaterThanOrEqual(3);
    await expect(jsonLd(page)).toHaveCount(0);
    expect(await page.title()).toMatch(/not found/i);
    expect(await page.title()).toMatch(/Nuvora/);
    // header still works
    await page.locator('.site-header__cart').click();
    await expect(drawer(page)).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test('?slug= resolves to the product', async ({ page }) => {
  const errors = await open(page, '?slug=cedar-smoke');
  await expect(page.locator('h1')).toHaveText('Cedar & Smoke');
  const data = JSON.parse(await jsonLd(page).textContent());
  expect(data.sku).toBe('vn-02');
  expect(errors).toEqual([]);
});

// ----------------------------------------------------------- mobile buy bar

test('mobile: the sticky purchase bar appears after scrolling past the add button and toggles has-bottom-bar', async ({ page }) => {
  await open(page, '?id=mn-01', MOBILE);
  const bar = page.locator('[data-buybar]');
  const body = page.locator('body');
  await expect(bar).toBeHidden();
  await expect(body).not.toHaveClass(/has-bottom-bar/);

  await page.locator('[data-pdp-notes]').scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, 200));
  await expect(bar).toBeVisible();
  await expect(body).toHaveClass(/has-bottom-bar/);
  const p = await product(page, 'mn-01');
  await expect(bar).toContainText(await pkr(page, p.sizes[1].price));

  // the bar button runs the same add logic (selected size and qty)
  const barBtn = bar.getByRole('button', { name: /add to bag/i });
  await barBtn.click();
  await expect(drawer(page)).toBeVisible();
  expect(await cart(page)).toEqual([{ productId: 'mn-01', ml: 50, qty: 1, gift: false }]);
  await page.keyboard.press('Escape');
  await expect(drawer(page)).toBeHidden();

  // no duplicate ids anywhere on the page
  const dupes = await page.evaluate(() => {
    const seen = {}; const out = [];
    document.querySelectorAll('[id]').forEach((el) => { if (seen[el.id]) out.push(el.id); seen[el.id] = 1; });
    return out;
  });
  expect(dupes).toEqual([]);

  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(bar).toBeHidden();
  await expect(body).not.toHaveClass(/has-bottom-bar/);
});

test('desktop: no sticky purchase bar', async ({ page }) => {
  await open(page);
  await page.locator('[data-related]').scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await expect(page.locator('[data-buybar]')).toBeHidden();
  await expect(page.locator('body')).not.toHaveClass(/has-bottom-bar/);
});

// ---------------------------------------------------------------- layout

test('no horizontal scroll at 375, 768 and 1280 (product and not-found)', async ({ page }) => {
  for (const vp of [MOBILE, TABLET, DESKTOP]) {
    for (const q of ['?id=mn-01', '?id=au-03', '?id=zzz']) {
      await open(page, q, vp, { clear: false });
      const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(over, q + ' at ' + vp.width).toBeLessThanOrEqual(0);
    }
  }
});
