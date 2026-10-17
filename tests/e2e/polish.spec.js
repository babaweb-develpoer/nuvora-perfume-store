// Task 16b: copy-accuracy and UX polish. One test (or a few) per review item.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { pageUrl, collectErrors } = require('./helpers');

const root = path.resolve(__dirname, '..', '..');
const DESKTOP = { width: 1280, height: 900 };
const html = (name) => fs.readFileSync(path.join(root, name + '.html'), 'utf8');
const htmlFiles = fs.readdirSync(root).filter((f) => /\.html$/.test(f)).map((f) => f.replace(/\.html$/, ''));

async function open(page, name, { query = '', viewport = DESKTOP, wishlist = [] } = {}) {
  const errors = collectErrors(page);
  await page.setViewportSize(viewport);
  await page.goto(pageUrl('styleguide'));
  await page.evaluate((ids) => {
    try { localStorage.clear(); } catch (e) {}
    ids.forEach((id) => Shop.store.toggleWishlist(id));
  }, wishlist);
  await page.goto(pageUrl(name) + query);
  await page.waitForSelector('header.site-header');
  return errors;
}

// ============================================================ copy accuracy

test('C1: no static head names Lahore; about and contact stay generic, address comes from config', async ({ page }) => {
  for (const name of htmlFiles) {
    const head = (/<head[\s\S]*?<\/head>/i.exec(html(name)) || [''])[0];
    expect(head, name + ' head').not.toMatch(/Lahore/);
  }
  expect(html('about')).not.toMatch(/Lahore/);
  expect(html('contact')).not.toMatch(/Lahore/);
  await open(page, 'about');
  const address = await page.evaluate(() => Shop.config.address);
  await expect(page.locator('.ab-close__visit-line[data-config="address"]')).toHaveText(address);
});

test('C3: FAQ JSON-LD answers are the DOM paragraphs joined by a single space', async ({ page }) => {
  await open(page, 'faq');
  const out = await page.evaluate(() => {
    const data = JSON.parse(document.querySelector('script[type="application/ld+json"]').textContent);
    const answers = Array.from(document.querySelectorAll('.faq-answer')).map((a) =>
      Array.from(a.children).map((c) => c.textContent.replace(/\s+/g, ' ').trim()).join(' '));
    return { ld: data.mainEntity.map((m) => m.acceptedAnswer.text), answers };
  });
  expect(out.ld.length).toBeGreaterThan(10);
  expect(out.ld).toEqual(out.answers);
});

test('C4: the about pull-quote does not repeat the sentence before it', async () => {
  const src = html('about');
  const quote = /<blockquote class="ab-story__quote">\s*<p>([^<]+)<\/p>/.exec(src)[1].replace(/[.\s]+$/, '').toLowerCase();
  const paras = /<div class="ab-story__text">([\s\S]*?)<\/div>/.exec(src)[1].toLowerCase();
  expect(paras).not.toContain(quote);
});

const BRAND_NOTE_WORDS = {
  'Maison Noor': ['oud', 'saffron', 'taif rose', 'amber'],
  'Velluto Nero': ['suede', 'smoked birch', 'atlas cedar', 'haitian vetiver'],
  'Aurelle': ['rose', 'jasmine', 'peony', 'musk'],
  'Sahara Royale': ['bergamot', 'grapefruit', 'sea salt', 'vetiver']
};

test('C5: brands page names only notes the house actually sells', async ({ page }) => {
  await open(page, 'brands');
  const out = await page.evaluate(() => Array.from(document.querySelectorAll('[data-house]')).map((s) => ({
    house: s.getAttribute('data-house'),
    story: s.querySelector('.br-house__story').textContent.toLowerCase(),
    family: s.querySelector('.br-house__family').textContent.toLowerCase(),
    notes: Shop.products.filter((p) => p.house === s.getAttribute('data-house'))
      .reduce((a, p) => a.concat(p.notes.top, p.notes.heart, p.notes.base), []).join(' | ').toLowerCase()
  })));
  expect(out).toHaveLength(4);
  for (const h of out) {
    for (const w of BRAND_NOTE_WORDS[h.house]) {
      expect(h.story + ' ' + h.family, h.house + ' copy names ' + w).toContain(w);
      expect(h.notes, h.house + ' data has ' + w).toContain(w);
    }
    expect(h.family).not.toContain('attar');
    expect(h.story).not.toContain('sand');
  }
  expect(html('brands')).not.toMatch(/Oud and attar/);
});

test('C6: about, shipping, checkout, cart, FAQ and confirmation agree: dispatch 1-2 days, then 2-5 days after dispatch', async () => {
  const files = ['about.html', 'shipping-returns.html', 'checkout.html', 'faq.html',
    'assets/js/pages/cart.js', 'assets/js/pages/confirmation.js', 'assets/js/pages/faq.js'];
  for (const f of files) {
    const src = fs.readFileSync(path.join(root, f), 'utf8');
    const re = /2 to 5 working days/g;
    let m;
    while ((m = re.exec(src))) {
      expect(src.slice(m.index, m.index + 60), f + ' near "' + m[0] + '"').toMatch(/after dispatch|once dispatched|of dispatch/);
    }
  }
  const about = html('about');
  expect(about).toMatch(/1 to 2 working days of confirmation/);
  expect(about).not.toMatch(/usually within a week/);
  expect(html('shipping-returns')).not.toMatch(/working days from your order/);
});

test('C7: home copy does not hard-code the catalogue sizes', async () => {
  expect(html('index')).not.toMatch(/30, 50 and 100/);
});

test('C8: au-03 copy matches its season tag', async ({ page }) => {
  await open(page, 'shop');
  const p = await page.evaluate(() => Shop.products.filter((x) => x.id === 'au-03')[0]);
  expect(p.tags).toContain('summer');
  expect(p.description).not.toMatch(/spring/i);
  expect(p.description).toMatch(/warm afternoons and weddings/);
});

test('C9: the home gift lead wraps without an orphan', async ({ page }) => {
  await open(page, 'index');
  const tw = await page.locator('.home-gift__lead').evaluate((el) => getComputedStyle(el).textWrap || getComputedStyle(el).getPropertyValue('text-wrap-style'));
  expect(tw).toMatch(/pretty|balance/);
});

// ================================================================ product

async function product(page, id, viewport = DESKTOP) {
  const errors = await open(page, 'product', { query: '?id=' + id, viewport });
  await page.waitForSelector('[data-pdp]:not([hidden])');
  return errors;
}

test('U1: adding more than stock allows shows a notice and never exceeds stock (sr-02, stock 5)', async ({ page }) => {
  await product(page, 'sr-02');
  const qty = page.getByRole('textbox', { name: /quantity/i });
  const notice = page.locator('[data-pdp-notice]');
  await expect(notice).toHaveAttribute('role', 'status');
  await qty.fill('5');
  await page.locator('[data-pdp-add]').click();
  await page.keyboard.press('Escape');
  expect((await page.evaluate(() => Shop.store.getCart())).map((l) => l.qty)).toEqual([5]);
  await qty.fill('2');
  await page.locator('[data-pdp-add]').click();
  expect((await page.evaluate(() => Shop.store.getCart())).map((l) => l.qty)).toEqual([5]);
  await expect(notice).toContainText('You already have all 5 in your bag');
  await expect(page.locator('#cart-drawer')).toBeHidden();
});

test('U1: a partial add adds the remainder and says so', async ({ page }) => {
  await product(page, 'sr-02');
  const qty = page.getByRole('textbox', { name: /quantity/i });
  await qty.fill('3');
  await page.locator('[data-pdp-add]').click();
  await page.keyboard.press('Escape');
  await qty.fill('4');
  await page.locator('[data-pdp-add]').click();
  expect((await page.evaluate(() => Shop.store.getCart())).map((l) => l.qty)).toEqual([5]);
  await expect(page.locator('[data-pdp-notice]')).toContainText(/Added 2/);
  await expect(page.locator('[data-pdp-notice]')).toContainText('all 5 in your bag');
});

test('U2: a product with no notes still renders the page', async ({ page }) => {
  await page.addInitScript(() => {
    window.Shop = window.Shop || {};
    let list;
    Object.defineProperty(window.Shop, 'products', {
      configurable: true,
      get() { return list; },
      set(v) { v.forEach((p) => { delete p.notes; }); list = v; }
    });
  });
  const errors = collectErrors(page);
  await page.setViewportSize(DESKTOP);
  await page.goto(pageUrl('product') + '?id=mn-01');
  await page.waitForSelector('[data-pdp]:not([hidden])');
  await expect(page.locator('h1')).toHaveText('Oud Royale');
  await expect(page.locator('[data-pdp-add]')).toBeVisible();
  expect(errors).toEqual([]);
});

test('U3: Product JSON-LD image and offer url are absolute, built on config.siteUrl', async ({ page }) => {
  await product(page, 'mn-01');
  const out = await page.evaluate(() => {
    const ld = Array.from(document.querySelectorAll('script[type="application/ld+json"]')).map((s) => JSON.parse(s.textContent)).filter((d) => d['@type'] === 'Product')[0];
    return { ld, site: Shop.config.siteUrl };
  });
  expect(out.ld.image).toMatch(/^https?:\/\//);
  expect(out.ld.offers.url).toMatch(/^https?:\/\//);
  expect(out.ld.image.startsWith(out.site)).toBe(true);
  expect(out.ld.offers.url).toBe(out.site + 'product.html?id=mn-01');
});

for (const vp of [{ width: 1280, height: 900 }, { width: 1366, height: 768 }]) {
  test('U4: Add to bag is visible without scrolling at ' + vp.width + 'x' + vp.height, async ({ page }) => {
    await product(page, 'mn-01', vp);
    const bottom = await page.locator('[data-pdp-add]').evaluate((el) => el.getBoundingClientRect().bottom);
    expect(bottom).toBeLessThanOrEqual(vp.height);
  });
}

test('U5: review form describedby ids appear only while an error is shown', async ({ page }) => {
  await product(page, 'mn-01');
  await page.getByRole('tab', { name: /reviews/i }).click();
  const form = page.locator('[data-review-form]');
  const rate = form.locator('[data-rate-field]');
  const text = form.getByLabel(/your review/i);
  expect((await rate.getAttribute('aria-describedby')) || '').not.toContain('rv-rating-error');
  expect(await text.getAttribute('aria-describedby')).not.toContain('rv-text-error');
  await form.getByRole('button', { name: /post review/i }).click();
  await expect(rate).toHaveAttribute('aria-describedby', /rv-rating-error/);
  await form.getByRole('radio', { name: /^4 star/ }).check({ force: true });
  expect((await rate.getAttribute('aria-describedby')) || '').not.toContain('rv-rating-error');
  await form.getByRole('button', { name: /post review/i }).click();
  await expect(text).toHaveAttribute('aria-describedby', /rv-text-error/);
  await expect(text).toHaveAttribute('aria-describedby', /rv-text-count/);
  await text.fill('Lovely.');
  expect(await text.getAttribute('aria-describedby')).not.toContain('rv-text-error');
});

// ==================================================================== quiz

test('U6a: Enter on an unchecked radio selects nothing and shows the error; on a checked radio it advances', async ({ page }) => {
  await open(page, 'scent-quiz');
  await page.locator('[data-qz-begin]').click();
  await page.keyboard.press('Tab');
  const first = page.locator('[data-qz-view="step"] input[type="radio"]').first();
  await expect(first).toBeFocused();
  await expect(first).not.toBeChecked();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-qz-progress-label]')).toHaveText(/^Question 1 of/);
  await expect(page.locator('[data-qz-error]')).toBeVisible();
  await expect(page.locator('[data-qz-view="step"] input[type="radio"]:checked')).toHaveCount(0);
  await page.keyboard.press('Space');
  await expect(first).toBeChecked();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-qz-progress-label]')).toHaveText(/^Question 2 of/);
});

test('U6b: quiz add buttons start their accessible name with the visible text', async ({ page }) => {
  await open(page, 'scent-quiz');
  await page.locator('[data-qz-begin]').click();
  const n = await page.evaluate(() => Shop.quiz.QUESTIONS.length);
  for (let i = 0; i < n; i++) {
    await page.locator('[data-qz-view="step"] input[type="radio"]').first().check({ force: true });
    await page.locator('[data-qz-next]').click();
  }
  const btns = page.locator('[data-qz-add]');
  const count = await btns.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i++) {
    const out = await btns.nth(i).evaluate((b) => ({ label: b.getAttribute('aria-label'), text: b.textContent.trim() }));
    expect(out.label.toLowerCase().startsWith(out.text.toLowerCase()), out.label + ' vs ' + out.text).toBe(true);
  }
});

test('U6c: the live region announces only "Question n of N" while focus moves to the heading', async ({ page }) => {
  await open(page, 'scent-quiz');
  await page.locator('[data-qz-begin]').click();
  const n = await page.evaluate(() => Shop.quiz.QUESTIONS.length);
  await expect(page.locator('[data-qz-live]')).toHaveText('Question 1 of ' + n);
  await page.locator('[data-qz-view="step"] input[type="radio"]').first().check({ force: true });
  await page.locator('[data-qz-next]').click();
  await expect(page.locator('[data-qz-live]')).toHaveText('Question 2 of ' + n);
});

// ================================================================ wishlist

test('U7: Move all available offers a View bag action that opens the drawer without taking focus', async ({ page }) => {
  await open(page, 'wishlist', { wishlist: ['mn-01', 'vn-01', 'au-01'] });
  await page.waitForSelector('[data-ready]');
  await page.locator('[data-move-all]').click();
  const toast = page.locator('.toast');
  await expect(toast).toHaveCount(1);
  const view = toast.getByRole('button', { name: /view bag/i });
  await expect(view).toBeVisible();
  expect(await page.evaluate(() => !!document.activeElement.closest('.toast-host'))).toBe(false);
  await view.click();
  await expect(page.locator('#cart-drawer')).toBeVisible();
});

test('U7: the toast pauses its auto-dismiss while hovered', async ({ page }) => {
  await open(page, 'wishlist', { wishlist: ['mn-01', 'vn-01'] });
  await page.waitForSelector('[data-ready]');
  await page.locator('[data-move-all]').click();
  const toast = page.locator('.toast');
  await expect(toast).toHaveCount(1);
  await toast.hover();
  await page.waitForTimeout(4000);
  await expect(toast).toHaveCount(1);
  await page.mouse.move(5, 5);
  await expect(toast).toHaveCount(0, { timeout: 6000 });
});

// ================================================ toast focus (Task 17d)

async function toastWithTrigger(page) {
  await page.evaluate(() => {
    const b = document.createElement('button');
    b.id = 'toast-trigger';
    b.textContent = 'Trigger';
    document.getElementById('main').appendChild(b);
    b.focus();
    Shop.ui.toast('Something happened', { action: { label: 'Undo', onClick: () => { window.__undone = true; } } });
  });
  await expect(page.locator('.toast')).toHaveCount(1);
}

test('D3c: after the toast action runs by keyboard, focus returns to the element that triggered the toast', async ({ page }) => {
  await open(page, 'about');
  await toastWithTrigger(page);
  await page.locator('.toast__action').focus();
  await page.keyboard.press('Enter');
  expect(await page.evaluate(() => window.__undone)).toBe(true);
  await expect(page.locator('.toast')).toHaveCount(0);
  expect(await page.evaluate(() => document.activeElement && document.activeElement.id)).toBe('toast-trigger');
});

test('D3c: when the triggering element is gone, focus falls back to main', async ({ page }) => {
  await open(page, 'about');
  await toastWithTrigger(page);
  await page.evaluate(() => document.getElementById('toast-trigger').remove());
  await page.locator('.toast__action').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.toast')).toHaveCount(0);
  expect(await page.evaluate(() => document.activeElement && document.activeElement.id)).toBe('main');
});

test('D3c: an action that moves focus itself (View bag) is left alone', async ({ page }) => {
  await open(page, 'wishlist', { wishlist: ['mn-01', 'vn-01'] });
  await page.waitForSelector('[data-ready]');
  await page.locator('[data-move-all]').click();
  await page.locator('.toast__action').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#cart-drawer')).toBeVisible();
  await page.waitForTimeout(700);
  expect(await page.evaluate(() => !!document.activeElement.closest('#cart-drawer'))).toBe(true);
});

test('D3c: mouseleave does not re-arm the auto-dismiss while keyboard focus is still inside the toast', async ({ page }) => {
  await open(page, 'about');
  await toastWithTrigger(page);
  await page.locator('.toast__action').focus();
  await page.locator('.toast').hover();
  await page.mouse.move(5, 5);
  await page.waitForTimeout(4200);   // longer than the 3.2 s auto-dismiss
  await expect(page.locator('.toast')).toHaveCount(1);
  expect(await page.evaluate(() => !!document.activeElement.closest('.toast'))).toBe(true);
  // Focus leaves: the timer is armed again and the toast goes away.
  await page.evaluate(() => document.getElementById('toast-trigger').focus());
  await expect(page.locator('.toast')).toHaveCount(0, { timeout: 6000 });
});

// ======================================== copy that must hold for any catalogue (Task 17d)

test('D3a: the shop lead does not hard-code the bottle sizes', () => {
  const lead = (/<p class="shop-head__lead">([\s\S]*?)<\/p>/.exec(html('shop')) || ['', ''])[1];
  expect(lead.length).toBeGreaterThan(20);
  expect(lead).not.toMatch(/\b30\b|\b50\b|\b100(?:&nbsp;|\s)?ml/i);
});

test('D3b: the styleguide sample FAQ uses the site delivery wording', () => {
  const sg = html('styleguide');
  expect(sg).not.toMatch(/Two to four working days/i);
  expect(sg).not.toMatch(/up to six elsewhere/i);
  expect(sg).toMatch(/dispatch(?:ed)? within 1 to 2 working days/i);
  expect(sg).toMatch(/2 to 5 working days/);
});
