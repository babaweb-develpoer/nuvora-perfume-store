// Find Your Scent quiz (Task 13): intro, one question at a time as real radio
// inputs in a fieldset (explicit Next, no auto-advance), progress bar and step
// markers, Back keeps answers, focus and live-region announcements, keyboard-only
// completion, results ranked by Shop.quiz.scoreProducts with sold-out products
// skipped, "why it matches", add to bag, also-consider row, answer chips, Edit
// answers, Retake, privacy of the URL, reduced motion, headings and layout.
const { test, expect } = require('@playwright/test');
const { pageUrl, collectErrors } = require('./helpers');

const MOBILE = { width: 375, height: 812 };
const TABLET = { width: 768, height: 1024 };
const DESKTOP = { width: 1280, height: 900 };

// A full set of answers (question id -> option value).
const EVENING_OUD = { occasion: 'evening', season: 'winter', intensity: 'strong', family: 'oud', budget: 'over-12000' };
// Favours Peony Blush (au-03, stock 0): floral + gift + summer + light.
const FLORAL_CHEAP = { occasion: 'gift', season: 'summer', intensity: 'light', family: 'floral', budget: 'under-6000' };

async function open(page, { viewport = DESKTOP } = {}) {
  const errors = collectErrors(page);
  await page.setViewportSize(viewport);
  await page.goto(pageUrl('styleguide'));
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.goto(pageUrl('scent-quiz'));
  await page.waitForSelector('header.site-header');
  await page.waitForSelector('[data-ready]');
  return errors;
}

const questions = (page) => page.evaluate(() => Shop.quiz.QUESTIONS.map((q) => ({
  id: q.id, text: q.text, options: q.options.map((o) => ({ label: o.label, value: o.value }))
})));

const view = (page, name) => page.locator('[data-qz-view="' + name + '"]');
const heading = (page) => page.locator('[data-qz-question]');
const progressLabel = (page) => page.locator('[data-qz-progress-label]');
const progress = (page) => page.locator('[data-qz-progress]');
const radios = (page) => page.locator('[data-qz-view="step"] input[type="radio"]');
const next = (page) => page.locator('[data-qz-next]');
const back = (page) => page.locator('[data-qz-back]');
const live = (page) => page.locator('[data-qz-live]');
const matches = (page) => page.locator('[data-qz-match]');
const also = (page) => page.locator('[data-qz-also] .product-card');
const activeIs = (page, selector) => page.evaluate((s) => !!document.activeElement && document.activeElement.matches(s), selector);

async function begin(page) {
  await page.locator('[data-qz-begin]').click();
  await expect(view(page, 'step')).toBeVisible();
}

// Pick `value` for the current question with the mouse, then press Next.
async function answer(page, value) {
  await page.locator('[data-qz-view="step"] input[type="radio"][value="' + value + '"]').check();
  await next(page).click();
}

async function answerAll(page, answers) {
  const qs = await questions(page);
  for (const q of qs) await answer(page, answers[q.id]);
  await expect(view(page, 'results')).toBeVisible();
}

const matchIds = (page) => matches(page).evaluateAll((els) => els.map((e) => e.getAttribute('data-id')));
const alsoIds = (page) => page.locator('[data-qz-also] [data-wish]').evaluateAll((els) => els.map((e) => e.getAttribute('data-wish')));

// In-stock ranking computed in the page from the shared scoring, independent of quiz.js page code.
const expectedInStock = (page, answers) => page.evaluate((a) =>
  Shop.quiz.scoreProducts(a, Shop.products).filter((r) => r.product.stock > 0).map((r) => r.product.id), answers);

async function noHorizontalScroll(page) {
  const o = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  expect(o.sw, 'no horizontal scroll').toBeLessThanOrEqual(o.cw);
}

async function headingOutlineSane(page) {
  const levels = await page.evaluate(() =>
    Array.prototype.map.call(document.querySelectorAll('main h1, main h2, main h3, main h4'), (h) => {
      const r = h.getBoundingClientRect();
      return { level: Number(h.tagName[1]), shown: !h.closest('[hidden]') && (r.width > 0 || h.closest('.sr-only')) };
    }).filter((h) => h.shown).map((h) => h.level));
  expect(levels.filter((l) => l === 1)).toHaveLength(1);
  expect(levels[0]).toBe(1);
  for (let i = 1; i < levels.length; i++) expect(levels[i] - levels[i - 1], 'no skipped heading level').toBeLessThanOrEqual(1);
}

// ===================================================================== intro

test('intro: title, description, active nav, Begin and a quiet way to the shop', async ({ page }) => {
  const errors = await open(page);
  await expect(page).toHaveTitle(/Find your scent \| Nuvora/i);
  const desc = await page.locator('meta[name="description"]').getAttribute('content');
  expect(desc.length).toBeGreaterThan(80);
  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.locator('h1')).toHaveText(/Find your signature scent/i);
  await expect(view(page, 'intro')).toBeVisible();
  await expect(view(page, 'step')).toBeHidden();
  await expect(view(page, 'results')).toBeHidden();
  const n = (await questions(page)).length;
  await expect(view(page, 'intro')).toContainText(new RegExp(['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'][n] + ' quick questions', 'i'));
  await expect(page.locator('[data-qz-begin]')).toBeVisible();
  await expect(view(page, 'intro').locator('a[href="shop.html"]')).toContainText(/browse the full collection/i);
  await expect(page.locator('.site-nav a[aria-current="page"]')).toHaveText(/Find Your Scent/);
  expect(errors).toEqual([]);
});

// ===================================================================== steps

test('step 1: "Question 1 of N", the question as a heading and its options as radios', async ({ page }) => {
  await open(page);
  await begin(page);
  const qs = await questions(page);
  await expect(progressLabel(page)).toHaveText('Question 1 of ' + qs.length);
  await expect(heading(page)).toHaveText(qs[0].text);
  await expect(page.locator('[data-qz-view="step"] fieldset legend')).toContainText(qs[0].text);
  const count = await radios(page).count();
  expect(count).toBe(qs[0].options.length);
  expect(count).toBeGreaterThanOrEqual(3);
  expect(count).toBeLessThanOrEqual(4);
  for (const o of qs[0].options) {
    await expect(page.getByRole('radio', { name: o.label, exact: true })).toHaveAttribute('value', o.value);
    await expect(page.getByRole('radio', { name: o.label, exact: true })).not.toBeChecked();
  }
  await expect(back(page)).toBeDisabled();
  await expect(page.locator('form.qz-form')).toHaveAttribute('method', 'post');
});

test('Begin moves focus to the first question heading', async ({ page }) => {
  await open(page);
  await begin(page);
  expect(await activeIs(page, '[data-qz-question]')).toBe(true);
});

test('progress bar and step markers follow every step', async ({ page }) => {
  await open(page);
  await begin(page);
  const qs = await questions(page);
  const markers = page.locator('[data-qz-markers] > li');
  await expect(markers).toHaveCount(qs.length);
  for (let i = 0; i < qs.length; i++) {
    await expect(progressLabel(page)).toHaveText('Question ' + (i + 1) + ' of ' + qs.length);
    await expect(progress(page)).toHaveAttribute('role', 'progressbar');
    await expect(progress(page)).toHaveAttribute('aria-valuenow', String(i + 1));
    await expect(progress(page)).toHaveAttribute('aria-valuemax', String(qs.length));
    const ratio = await progress(page).evaluate((n) => parseFloat(getComputedStyle(n).getPropertyValue('--progress-ratio')));
    expect(ratio).toBeCloseTo((i + 1) / qs.length, 3);
    await expect(markers.nth(i)).toHaveAttribute('aria-current', 'step');
    await expect(page.locator('[data-qz-markers] > li[aria-current="step"]')).toHaveCount(1);
    for (let j = 0; j < i; j++) await expect(markers.nth(j)).toHaveAttribute('data-state', 'done');
    await answer(page, qs[i].options[0].value);
  }
  await expect(view(page, 'results')).toBeVisible();
});

test('selecting an option does not advance on its own; Next does, and focus goes to the new heading', async ({ page }) => {
  await open(page);
  await begin(page);
  const qs = await questions(page);
  await page.getByRole('radio', { name: qs[0].options[1].label, exact: true }).check();
  await page.waitForTimeout(600);
  await expect(progressLabel(page)).toHaveText('Question 1 of ' + qs.length);
  await next(page).click();
  await expect(progressLabel(page)).toHaveText('Question 2 of ' + qs.length);
  await expect(heading(page)).toHaveText(qs[1].text);
  expect(await activeIs(page, '[data-qz-question]')).toBe(true);
});

test('Next without a choice stays put and explains what to do', async ({ page }) => {
  await open(page);
  await begin(page);
  const qs = await questions(page);
  await next(page).click();
  await expect(progressLabel(page)).toHaveText('Question 1 of ' + qs.length);
  await expect(page.locator('[data-qz-error]')).toBeVisible();
  await expect(page.locator('[data-qz-error]')).toHaveText(/choose/i);
  expect(await activeIs(page, 'input[type="radio"]')).toBe(true);
  await answer(page, qs[0].options[0].value);
  await expect(progressLabel(page)).toHaveText('Question 2 of ' + qs.length);
  await expect(page.locator('[data-qz-error]')).toBeHidden();
});

test('Back keeps earlier answers selected and is disabled on step 1', async ({ page }) => {
  await open(page);
  await begin(page);
  const qs = await questions(page);
  await answer(page, 'wedding');
  await answer(page, 'winter');
  await expect(progressLabel(page)).toHaveText('Question 3 of ' + qs.length);
  await expect(back(page)).toBeEnabled();
  await back(page).click();
  await expect(progressLabel(page)).toHaveText('Question 2 of ' + qs.length);
  await expect(page.locator('input[name="season"][value="winter"]')).toBeChecked();
  expect(await activeIs(page, '[data-qz-question]')).toBe(true);
  await back(page).click();
  await expect(progressLabel(page)).toHaveText('Question 1 of ' + qs.length);
  await expect(page.locator('input[name="occasion"][value="wedding"]')).toBeChecked();
  await expect(back(page)).toBeDisabled();
  // Going forward again keeps the answer on step 2 too.
  await next(page).click();
  await expect(page.locator('input[name="season"][value="winter"]')).toBeChecked();
});

test('Start over clears the answers and returns to question 1', async ({ page }) => {
  await open(page);
  await begin(page);
  await answer(page, 'gift');
  await page.locator('[data-qz-restart]').click();
  await expect(progressLabel(page)).toHaveText(/^Question 1 of /);
  await expect(page.locator('input[name="occasion"]:checked')).toHaveCount(0);
});

test('live region announces each step and the results', async ({ page }) => {
  await open(page);
  const qs = await questions(page);
  await expect(live(page)).toHaveAttribute('aria-live', 'polite');
  await begin(page);
  await expect(live(page)).toContainText('Question 1 of ' + qs.length);
  await answer(page, qs[0].options[0].value);
  await expect(live(page)).toContainText('Question 2 of ' + qs.length);
  await expect(live(page)).not.toContainText(qs[1].text);
  for (let i = 1; i < qs.length; i++) await answer(page, qs[i].options[0].value);
  await expect(live(page)).toContainText('Your top matches are ready');
});

test('keyboard only: arrows and Space choose, Enter moves on, focus follows', async ({ page }) => {
  await open(page);
  const qs = await questions(page);
  await page.locator('[data-qz-begin]').focus();
  await page.keyboard.press('Enter');
  const chosen = {};
  for (let i = 0; i < qs.length; i++) {
    await expect(progressLabel(page)).toHaveText('Question ' + (i + 1) + ' of ' + qs.length);
    expect(await activeIs(page, '[data-qz-question]')).toBe(true);
    await page.keyboard.press('Tab');
    expect(await activeIs(page, 'input[type="radio"][name="' + qs[i].id + '"]')).toBe(true);
    await page.keyboard.press('Space');
    await expect(page.locator('input[name="' + qs[i].id + '"][value="' + qs[i].options[0].value + '"]')).toBeChecked();
    await page.keyboard.press('ArrowDown');
    await expect(page.locator('input[name="' + qs[i].id + '"][value="' + qs[i].options[1].value + '"]')).toBeChecked();
    // Moving with the arrows selects but never advances by itself.
    await expect(progressLabel(page)).toHaveText('Question ' + (i + 1) + ' of ' + qs.length);
    chosen[qs[i].id] = qs[i].options[1].value;
    await page.keyboard.press('Enter');
  }
  await expect(view(page, 'results')).toBeVisible();
  expect(await activeIs(page, '[data-qz-results-title]')).toBe(true);
  const expected = await expectedInStock(page, chosen);
  expect(await matchIds(page)).toEqual(expected.slice(0, 3));
});

// =================================================================== results

test('results: exactly 3 ranked matches with house, name, price, rating, reasons, link and add button', async ({ page }) => {
  const errors = await open(page);
  await begin(page);
  await answerAll(page, EVENING_OUD);
  await expect(page.locator('[data-qz-results-title]')).toHaveText(/Your top matches/i);
  expect(await activeIs(page, '[data-qz-results-title]')).toBe(true);
  await expect(matches(page)).toHaveCount(3);
  const expected = await expectedInStock(page, EVENING_OUD);
  const ids = await matchIds(page);
  expect(ids).toEqual(expected.slice(0, 3));
  for (let i = 0; i < 3; i++) {
    const m = matches(page).nth(i);
    await expect(m).toHaveAttribute('data-rank', String(i + 1));
    const p = await page.evaluate((id) => {
      const x = Shop.products.find((q) => q.id === id);
      return { house: x.house, name: x.name, from: Shop.util.formatPKR(Math.min.apply(null, x.sizes.map((s) => s.price))), rating: x.rating };
    }, ids[i]);
    await expect(m.locator('.qz-match__house')).toHaveText(p.house);
    await expect(m.locator('.qz-match__name')).toHaveText(p.name);
    await expect(m.locator('.qz-match__price')).toContainText('From');
    await expect(m.locator('.qz-match__price')).toContainText(p.from);
    await expect(m.locator('.star-rating__stars')).toHaveAttribute('aria-label', p.rating + ' out of 5');
    const reasons = await m.locator('[data-qz-why] li').allTextContents();
    expect(reasons.length).toBeGreaterThan(0);
    const explained = await page.evaluate(({ a, id }) => Shop.quiz.explain(a, Shop.products.find((q) => q.id === id)), { a: EVENING_OUD, id: ids[i] });
    if (explained.length) expect(reasons.map((r) => r.trim())).toEqual(explained);
    await expect(m.locator('a.qz-match__view')).toHaveAttribute('href', 'product.html?id=' + ids[i]);
    await expect(m.locator('a.qz-match__view')).toHaveText(/View fragrance/i);
    await expect(m.locator('[data-qz-add]')).toHaveText(/Add 50 ml to bag/i);
    await expect(m.locator('[data-wish="' + ids[i] + '"]')).toHaveCount(1);
  }
  expect(errors).toEqual([]);
});

test('answering floral ranks an Aurelle fragrance first, matching scoreProducts', async ({ page }) => {
  await open(page);
  await begin(page);
  const answers = { occasion: 'daily', season: 'all', intensity: 'moderate', family: 'floral', budget: '6000-12000' };
  await answerAll(page, answers);
  const expected = await expectedInStock(page, answers);
  const first = matches(page).first();
  await expect(first).toHaveAttribute('data-id', expected[0]);
  await expect(first.locator('.qz-match__house')).toHaveText('Aurelle');
});

test('a sold-out product (Peony Blush) never appears in the top 3 or in Also consider', async ({ page }) => {
  await open(page);
  await begin(page);
  await answerAll(page, FLORAL_CHEAP);
  // Without the stock rule it would be the best match.
  const raw = await page.evaluate((a) => Shop.quiz.scoreProducts(a, Shop.products)[0].product.id, FLORAL_CHEAP);
  expect(raw).toBe('au-03');
  const ids = await matchIds(page);
  expect(ids).not.toContain('au-03');
  expect(await alsoIds(page)).not.toContain('au-03');
  const expected = await expectedInStock(page, FLORAL_CHEAP);
  expect(ids).toEqual(expected.slice(0, 3));
  expect(await alsoIds(page)).toEqual(expected.slice(3, 6));
  await expect(page.locator('[data-qz-match] [data-qz-add]:disabled')).toHaveCount(0);
});

test('Add 50 ml to bag adds the match at 50 ml x1 and opens the bag', async ({ page }) => {
  await open(page);
  await begin(page);
  await answerAll(page, EVENING_OUD);
  const id = await matches(page).first().getAttribute('data-id');
  await matches(page).first().locator('[data-qz-add]').click();
  const cart = await page.evaluate(() => Shop.store.getCart());
  expect(cart).toHaveLength(1);
  expect(cart[0]).toMatchObject({ productId: id, ml: 50, qty: 1 });
  await expect(page.locator('#cart-drawer')).toBeVisible();
});

test('the wishlist heart on a match toggles through the shared delegation', async ({ page }) => {
  await open(page);
  await begin(page);
  await answerAll(page, EVENING_OUD);
  const id = await matches(page).first().getAttribute('data-id');
  const heart = matches(page).first().locator('[data-wish]');
  await expect(heart).toHaveAttribute('aria-pressed', 'false');
  await heart.click();
  await expect(heart).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => Shop.store.getWishlist())).toEqual([id]);
});

test('Also consider shows the next 3 products as product cards', async ({ page }) => {
  await open(page);
  await begin(page);
  await answerAll(page, EVENING_OUD);
  await expect(also(page)).toHaveCount(3);
  const expected = await expectedInStock(page, EVENING_OUD);
  expect(await alsoIds(page)).toEqual(expected.slice(3, 6));
});

test('answer chips summarise the choices', async ({ page }) => {
  await open(page);
  await begin(page);
  await answerAll(page, EVENING_OUD);
  const qs = await questions(page);
  const chips = page.locator('[data-qz-chips] > li');
  await expect(chips).toHaveCount(qs.length);
  for (let i = 0; i < qs.length; i++) {
    await expect(chips.nth(i)).toHaveAttribute('data-q', qs[i].id);
    await expect(chips.nth(i)).toHaveAttribute('data-value', EVENING_OUD[qs[i].id]);
  }
  await expect(page.locator('[data-qz-chips]')).toContainText('Evening');
  await expect(page.locator('[data-qz-chips]')).toContainText('Winter');
  await expect(page.locator('[data-qz-chips]')).toContainText('Strong');
  await expect(page.locator('[data-qz-chips]')).toContainText('Oud');
  await expect(page.locator('[data-qz-chips]')).toContainText('Over PKR 12,000');
});

test('Edit answers returns to step 1 with every answer still selected', async ({ page }) => {
  await open(page);
  await begin(page);
  await answerAll(page, EVENING_OUD);
  await page.locator('[data-qz-edit]').click();
  await expect(view(page, 'step')).toBeVisible();
  await expect(view(page, 'results')).toBeHidden();
  await expect(progressLabel(page)).toHaveText(/^Question 1 of /);
  expect(await activeIs(page, '[data-qz-question]')).toBe(true);
  const qs = await questions(page);
  for (const q of qs) {
    await expect(page.locator('input[name="' + q.id + '"][value="' + EVENING_OUD[q.id] + '"]')).toBeChecked();
    await next(page).click();
  }
  await expect(view(page, 'results')).toBeVisible();
});

test('Retake resets to the intro with nothing selected', async ({ page }) => {
  await open(page);
  await begin(page);
  await answerAll(page, EVENING_OUD);
  await page.locator('[data-qz-retake]').click();
  await expect(view(page, 'intro')).toBeVisible();
  await expect(view(page, 'results')).toBeHidden();
  await begin(page);
  await expect(page.locator('[data-qz-view="step"] input[type="radio"]:checked')).toHaveCount(0);
  await expect(progressLabel(page)).toHaveText(/^Question 1 of /);
  await expect(page.locator('[data-qz-view="results"] [data-qz-browse]')).toHaveAttribute('href', 'shop.html');
});

// ==================================================== privacy, motion, layout

test('answering never changes the URL', async ({ page }) => {
  await open(page);
  const url = page.url();
  await begin(page);
  await answerAll(page, EVENING_OUD);
  expect(page.url()).toBe(url);
  await page.locator('[data-qz-edit]').click();
  await page.keyboard.press('Enter');
  expect(page.url()).toBe(url);
});

test('reduced motion: steps change immediately and nothing animates', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const errors = await open(page);
  await begin(page);
  const qs = await questions(page);
  await page.locator('input[value="' + qs[0].options[0].value + '"]').check();
  await next(page).click();
  await expect(heading(page)).toHaveText(qs[1].text);
  const anim = await page.evaluate(() => Array.prototype.map.call(
    document.querySelectorAll('[data-qz-view="step"], [data-qz-view="step"] *'),
    (n) => getComputedStyle(n).animationName).filter((a) => a && a !== 'none'));
  expect(anim).toEqual([]);
  for (let i = 1; i < qs.length; i++) await answer(page, qs[i].options[0].value);
  await expect(matches(page)).toHaveCount(3);
  const hidden = await page.evaluate(() => Array.prototype.filter.call(
    document.querySelectorAll('[data-qz-view="results"] .reveal'), (n) => getComputedStyle(n).opacity !== '1').length);
  expect(hidden).toBe(0);
  expect(errors).toEqual([]);
});

test('headings: one h1 and no skipped levels in every view', async ({ page }) => {
  await open(page);
  await headingOutlineSane(page);
  await begin(page);
  await headingOutlineSane(page);
  await answerAll(page, EVENING_OUD);
  await headingOutlineSane(page);
});

test('no horizontal scroll at 375, 768 and 1280 in every view', async ({ page }) => {
  for (const vp of [MOBILE, TABLET, DESKTOP]) {
    const errors = await open(page, { viewport: vp });
    await noHorizontalScroll(page);
    await begin(page);
    await noHorizontalScroll(page);
    await answerAll(page, EVENING_OUD);
    await noHorizontalScroll(page);
    expect(errors).toEqual([]);
  }
});

test('product text in results is escaped', async ({ page }) => {
  await open(page);
  await page.evaluate(() => {
    const p = Shop.products.find((x) => x.id === 'mn-01');
    p.name = '<img src=x onerror="window.__x=1">Oud Royale';
    p.house = '<b>Maison Noor</b>';
  });
  await begin(page);
  await answerAll(page, EVENING_OUD);
  expect(await page.evaluate(() => window.__x)).toBeUndefined();
  await expect(page.locator('[data-qz-view="results"] img[src="x"]')).toHaveCount(0);
  await expect(page.locator('[data-qz-view="results"] b')).toHaveCount(0);
});

// ============================================================ fix round 1

test('currency: budget options read in PKR and no "Rs." appears in any view', async ({ page }) => {
  await open(page);
  const seen = [];
  const grab = async (where) => seen.push({ where, text: await page.evaluate(() => document.body.textContent) });
  await grab('intro');
  await begin(page);
  const qs = await questions(page);
  for (const q of qs) {
    await grab('step ' + q.id);
    if (q.id === 'budget') {
      const labels = await page.locator('[data-qz-view="step"] .qz-option__label').allTextContents();
      expect(labels).toEqual(['Under PKR 6,000', 'PKR 6,000 to 12,000', 'Over PKR 12,000']);
      for (const l of labels) await expect(page.getByRole('radio', { name: l, exact: true })).toHaveCount(1);
    }
    await answer(page, EVENING_OUD[q.id]);
  }
  await expect(view(page, 'results')).toBeVisible();
  await grab('results');
  for (const s of seen) expect(s.text, 'no "Rs." on ' + s.where).not.toContain('Rs.');
});

// Phones: the sticky Back/Next bar must never cover the focused option or the error.
const SHORT_PHONE = { width: 375, height: 700 };
const barTop = (page) => page.locator('.qz-nav').evaluate((n) => n.getBoundingClientRect().top);

test('sticky bar: the keyboard-focused third option of Q1 sits fully above the bar (375x700)', async ({ page }) => {
  await open(page, { viewport: SHORT_PHONE });
  await page.locator('[data-qz-begin]').focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Tab');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  const qs = await questions(page);
  const third = page.locator('input[name="' + qs[0].id + '"][value="' + qs[0].options[2].value + '"]');
  await expect(third).toBeFocused();
  const gap = () => page.evaluate(() => {
    const card = document.activeElement.closest('.qz-option').getBoundingClientRect();
    const bar = document.querySelector('.qz-nav').getBoundingClientRect();
    return { top: card.top, overlap: card.bottom - bar.top };
  });
  // The page may scroll smoothly into place; wait for it to settle.
  await expect.poll(async () => (await gap()).overlap, { message: 'option bottom minus bar top' }).toBeLessThanOrEqual(0);
  expect((await gap()).top).toBeGreaterThanOrEqual(0);
  // ...and clear of the floating WhatsApp button, which the bar lifts above itself.
  // Polled too: clearing the bar can happen mid-way through the smooth scroll, so
  // the settled position is what counts (with fallback fonts the scroll is longer).
  await expect.poll(() => page.evaluate(() => {
    const card = document.activeElement.closest('.qz-option').getBoundingClientRect();
    const f = document.querySelector('.whatsapp-float').getBoundingClientRect();
    return card.bottom - f.top;
  }), { message: 'focused option bottom minus WhatsApp button top' }).toBeLessThanOrEqual(0);
});

test('sticky bar: the required-answer error on Q1 is inside the viewport and above the bar (375x700)', async ({ page }) => {
  await open(page, { viewport: SHORT_PHONE });
  await begin(page);
  await next(page).click();
  const err = page.locator('[data-qz-error]');
  await expect(err).toBeVisible();
  await expect(page.locator('[data-qz-fieldset]')).toHaveAttribute('aria-describedby', 'qz-error');
  expect(await activeIs(page, 'input[type="radio"]')).toBe(true);
  const box = await err.evaluate((n) => { const r = n.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, vh: window.innerHeight }; });
  const top = await barTop(page);
  expect(box.top).toBeGreaterThanOrEqual(0);
  expect(box.bottom).toBeLessThanOrEqual(box.vh);
  expect(box.bottom, 'error bottom ' + box.bottom + ' vs bar top ' + top).toBeLessThanOrEqual(top);
});

// ============================================================ fix round 2

// Wait until the window has stopped scrolling (smooth scroll settles).
async function settle(page) {
  let last = -1;
  for (let i = 0; i < 40; i++) {
    const y = await page.evaluate(() => window.scrollY);
    if (y === last) return;
    last = y;
    await page.waitForTimeout(100);
  }
}

for (const vp of [
  { width: 1366, height: 768 }, { width: 1280, height: 720 }, { width: 1024, height: 600 },
  { width: 900, height: 600 }, { width: 667, height: 375 }, { width: 375, height: 700 }
]) {
  test('required-answer error is scrolled into clear view from the Next button at ' + vp.width + 'x' + vp.height, async ({ page }) => {
    await open(page, { viewport: vp });
    await begin(page);
    // Scroll down to Next as a user would, then press it by keyboard with nothing chosen.
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await next(page).focus();
    await settle(page);
    await page.keyboard.press('Enter');
    await settle(page);
    const err = page.locator('[data-qz-error]');
    await expect(err).toBeVisible();
    await expect(page.locator('[data-qz-fieldset]')).toHaveAttribute('aria-describedby', 'qz-error');
    expect(await activeIs(page, 'input[type="radio"]')).toBe(true);
    const m = await page.evaluate(() => {
      const e = document.querySelector('[data-qz-error]').getBoundingClientRect();
      const h = document.querySelector('.site-header').getBoundingClientRect();
      const nav = document.querySelector('.qz-nav');
      const sticky = getComputedStyle(nav).position === 'sticky';
      return { top: e.top, bottom: e.bottom, vh: window.innerHeight, header: h.bottom, bar: sticky ? nav.getBoundingClientRect().top : null };
    });
    const where = JSON.stringify(m);
    expect(m.top, 'below the header ' + where).toBeGreaterThanOrEqual(m.header);
    expect(m.bottom, 'inside the viewport ' + where).toBeLessThanOrEqual(m.vh);
    if (vp.width < 900) {
      expect(m.bar, 'sticky bar below 900px').not.toBeNull();
      expect(m.bottom, 'above the bar ' + where).toBeLessThanOrEqual(m.bar);
    }
    // Where there is room for both, the focused first option is fully in view too.
    if (vp.height >= 600) {
      const c = await page.evaluate(() => document.activeElement.closest('.qz-option').getBoundingClientRect().toJSON());
      expect(c.top, 'first option below the header').toBeGreaterThanOrEqual(m.header);
      expect(c.bottom, 'first option clear of the bottom').toBeLessThanOrEqual(m.bar === null ? m.vh : m.bar);
    }
  });
}

test('required-answer error at 667x375 from a fresh load (scroll 0) clears the bottom bar', async ({ page }) => {
  await open(page, { viewport: { width: 667, height: 375 } });
  await begin(page);
  await next(page).focus();
  await settle(page);
  await page.keyboard.press('Enter');
  await settle(page);
  const m = await page.evaluate(() => {
    const e = document.querySelector('[data-qz-error]').getBoundingClientRect();
    return { top: e.top, bottom: e.bottom, header: document.querySelector('.site-header').getBoundingClientRect().bottom, bar: document.querySelector('.qz-nav').getBoundingClientRect().top };
  });
  expect(m.top, JSON.stringify(m)).toBeGreaterThanOrEqual(m.header);
  expect(m.bottom, JSON.stringify(m)).toBeLessThanOrEqual(m.bar);
});

test('required-answer error: no scroll jump when everything is already in view (1280x900)', async ({ page }) => {
  await open(page);
  await begin(page);
  const before = await page.evaluate(() => window.scrollY);
  await next(page).click();
  await settle(page);
  await expect(page.locator('[data-qz-error]')).toBeVisible();
  expect(await page.evaluate(() => window.scrollY)).toBe(before);
});

test('required-answer error: reduced motion scrolls instantly (1280x720)', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page, { viewport: { width: 1280, height: 720 } });
  await begin(page);
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await next(page).focus();
  await page.keyboard.press('Enter');
  // No waiting for a smooth scroll: the error is in place in the same frame.
  const m = await page.evaluate(() => ({ e: document.querySelector('[data-qz-error]').getBoundingClientRect().toJSON(), header: document.querySelector('.site-header').getBoundingClientRect().bottom, vh: window.innerHeight }));
  expect(m.e.top).toBeGreaterThanOrEqual(m.header);
  expect(m.e.bottom).toBeLessThanOrEqual(m.vh);
});
