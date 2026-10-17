// Shared UI shell (Task 7): header, footer, mobile menu, cart drawer,
// wishlist delegation, media fallback and layout sanity.
const { test, expect } = require('@playwright/test');
const { pageUrl, collectErrors, routeConfig, TEST_WHATSAPP } = require('./helpers');

const MOBILE = { width: 375, height: 812 };
const DESKTOP = { width: 1280, height: 900 };

async function open(page, viewport, name = 'index') {
  const errors = collectErrors(page);
  await page.setViewportSize(viewport);
  await page.goto(pageUrl(name));
  // Start every test from an empty store.
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForSelector('header.site-header');
  return errors;
}

async function noHorizontalScroll(page) {
  const { sw, iw } = await page.evaluate(() => ({
    sw: document.documentElement.scrollWidth,
    iw: window.innerWidth,
  }));
  expect(sw).toBeLessThanOrEqual(iw);
}

for (const [label, vp] of [['375', MOBILE], ['1280', DESKTOP]]) {
  test(`landmarks, no errors and no horizontal scroll at ${label}`, async ({ page }) => {
    const errors = await open(page, vp);
    await expect(page.locator('header.site-header')).toHaveCount(1);
    await expect(page.locator('footer.site-footer')).toHaveCount(1);
    await expect(page.locator('main#main')).toHaveCount(1);
    await expect(page.locator('a.skip-link')).toHaveAttribute('href', '#main');
    await noHorizontalScroll(page);
    expect(errors).toEqual([]);
  });
}

test('mountShell is idempotent', async ({ page }) => {
  const errors = await open(page, DESKTOP);
  await page.evaluate(() => { Shop.ui.mountShell('shop'); Shop.ui.mountShell('shop'); });
  await expect(page.locator('header.site-header')).toHaveCount(1);
  await expect(page.locator('footer.site-footer')).toHaveCount(1);
  await expect(page.locator('#cart-drawer')).toHaveCount(1);
  await expect(page.locator('.site-header [aria-current="page"]')).toHaveText(/Shop/);
  expect(errors).toEqual([]);
});

test('mobile menu: Enter opens, Escape closes, focus returns', async ({ page }) => {
  const errors = await open(page, MOBILE);
  const btn = page.locator('.site-header__menu-btn');
  await expect(btn).toBeVisible();
  await expect(btn).toHaveAttribute('aria-expanded', 'false');
  const controls = await btn.getAttribute('aria-controls');
  await btn.focus();
  await page.keyboard.press('Enter');
  await expect(btn).toHaveAttribute('aria-expanded', 'true');
  const panel = page.locator('#' + controls);
  await expect(panel).toBeVisible();
  // focus moved inside the panel
  expect(await page.evaluate((id) => document.getElementById(id).contains(document.activeElement), controls)).toBe(true);
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
  await expect(btn).toHaveAttribute('aria-expanded', 'false');
  await expect(btn).toBeFocused();
  expect(errors).toEqual([]);
});

test('desktop shows inline nav and hides the menu button', async ({ page }) => {
  await open(page, DESKTOP);
  await expect(page.locator('.site-header__menu-btn')).toBeHidden();
  await expect(page.locator('.site-nav a', { hasText: 'Find Your Scent' })).toHaveAttribute('href', 'scent-quiz.html');
});

test('adding to the cart updates the badge and the drawer lists it with a PKR price', async ({ page }) => {
  const errors = await open(page, DESKTOP);
  await page.evaluate(() => Shop.store.addToCart('mn-01', 50, 1));
  await expect(page.locator('[data-cart-count]')).toHaveText('1');
  await page.locator('.site-header__cart').click();
  const drawer = page.locator('#cart-drawer');
  await expect(drawer).toBeVisible();
  await expect(drawer).toHaveAttribute('role', 'dialog');
  await expect(drawer).toHaveAttribute('aria-modal', 'true');
  await expect(drawer.locator('.cart-line')).toHaveCount(1);
  await expect(drawer.locator('.cart-line')).toContainText('Oud Royale');
  await expect(drawer.locator('.cart-line')).toContainText('PKR 12,400');
  await expect(drawer).toContainText(/Add PKR [\d,]+ more for free delivery|unlocked free delivery/);
  // qty stepper goes through the store
  await drawer.locator('[data-line-action="inc"]').click();
  await expect(page.locator('[data-cart-count]')).toHaveText('2');
  await expect(drawer).toContainText("You've unlocked free delivery");
  expect(errors).toEqual([]);
});

test('drawer traps focus and Escape returns focus to the trigger', async ({ page }) => {
  await open(page, DESKTOP);
  await page.evaluate(() => Shop.store.addToCart('mn-01', 50, 1));
  const trigger = page.locator('.site-header__cart');
  await trigger.focus();
  await page.keyboard.press('Enter');
  const drawer = page.locator('#cart-drawer');
  await expect(drawer).toBeVisible();
  for (let i = 0; i < 25; i++) {
    await page.keyboard.press(i % 3 === 2 ? 'Shift+Tab' : 'Tab');
    const inside = await page.evaluate(() => document.getElementById('cart-drawer').contains(document.activeElement));
    expect(inside).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(drawer).toBeHidden();
  await expect(trigger).toBeFocused();
});

test('empty cart drawer shows an empty state linking to the shop', async ({ page }) => {
  await open(page, MOBILE);
  await page.evaluate(() => Shop.ui.openCart());
  const drawer = page.locator('#cart-drawer');
  await expect(drawer).toBeVisible();
  await expect(drawer.locator('a[href="shop.html"]')).toHaveCount(1);
  await page.evaluate(() => Shop.ui.closeCart());
  await expect(drawer).toBeHidden();
});

test('floating WhatsApp link uses the configured number when one is set', async ({ page }) => {
  await routeConfig(page, { whatsapp: TEST_WHATSAPP });
  await open(page, MOBILE);
  const fab = page.locator('a.whatsapp-float');
  const href = await fab.getAttribute('href');
  expect(href.startsWith('https://wa.me/' + TEST_WHATSAPP)).toBe(true);
  expect(href).toContain('?text=');
  await expect(fab).toHaveAttribute('aria-label', 'Chat with us on WhatsApp');
  await expect(fab).toHaveAttribute('target', '_blank');
  // the menu and the footer carry the number too
  expect(await page.locator('#site-menu a[href^="https://wa.me/' + TEST_WHATSAPP + '"]').count()).toBe(1);
  expect(await page.locator('#site-footer a[href^="https://wa.me/' + TEST_WHATSAPP + '"]').count()).toBe(1);
});

test('without a WhatsApp number (the default) the floating button is "Message us" to contact.html', async ({ page }) => {
  const errors = await open(page, MOBILE);
  expect(await page.evaluate(() => Shop.config.whatsapp)).toBe('');
  const fab = page.locator('a.whatsapp-float');
  await expect(fab).toHaveAttribute('href', 'contact.html');
  await expect(fab).toHaveAttribute('aria-label', 'Message us');
  expect(await fab.getAttribute('target')).toBeNull();
  await expect(page.locator('a[href*="wa.me"]')).toHaveCount(0);
  await expect(page.locator('#site-menu .menu-panel__contact a[href="contact.html"]')).toHaveText('Message us');
  await expect(page.locator('#site-footer .site-footer__contact a[href="contact.html"]')).toHaveText('Message us');
  expect(errors).toEqual([]);
});

for (const [mode, overrides] of [['no WhatsApp number', {}], ['a WhatsApp number', { whatsapp: TEST_WHATSAPP }]]) {
  test(`floating button does not cover the footer copyright at 375 when scrolled to the bottom (${mode})`, async ({ page }) => {
    await routeConfig(page, overrides);
    await open(page, MOBILE);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(100);
    const fab = await page.locator('a.whatsapp-float').boundingBox();
    const copy = await page.locator('.site-footer__copy').boundingBox();
    expect(fab).not.toBeNull();
    expect(copy).not.toBeNull();
    const intersects = fab.x < copy.x + copy.width && copy.x < fab.x + fab.width &&
      fab.y < copy.y + copy.height && copy.y < fab.y + fab.height;
    expect(intersects).toBe(false);
  });

  test(`body.has-bottom-bar lifts the floating button (${mode})`, async ({ page }) => {
    await routeConfig(page, overrides);
    await open(page, MOBILE);
    const before = await page.locator('a.whatsapp-float').boundingBox();
    await page.evaluate(() => document.body.classList.add('has-bottom-bar'));
    const after = await page.locator('a.whatsapp-float').boundingBox();
    expect(before.y - after.y).toBeCloseTo(72, 0);
  });
}

test('free-delivery progress fill is transform-based', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page, DESKTOP);
  await page.evaluate(() => { Shop.store.addToCart('sr-02', 30, 1); Shop.ui.openCart(); });
  const fill = page.locator('#cart-drawer .progress-bar__fill');
  const info = await fill.evaluate((el) => {
    const cs = getComputedStyle(el);
    return { prop: cs.transitionProperty, transform: cs.transform, w: el.getBoundingClientRect().width, track: el.parentElement.getBoundingClientRect().width };
  });
  // 3,600 of 8,000 = 45%
  expect(info.transform).toMatch(/^matrix\(0\.45/);
  expect(info.w / info.track).toBeCloseTo(0.45, 2);
  expect(info.prop).not.toContain('width');
});

test('search overlay submits to shop.html?q=', async ({ page }) => {
  await open(page, DESKTOP);
  await page.locator('.site-header__search').click();
  const input = page.locator('#search-overlay input[type="search"]');
  await expect(input).toBeFocused();
  await input.fill('rose oud');
  // shop.html is built in a later task: only the navigation request matters here.
  const req = page.waitForRequest(/shop\.html\?q=rose%20oud$/);
  await page.keyboard.press('Enter');
  await req;
});

test('wishlist delegation toggles aria-pressed and the header count', async ({ page }) => {
  const errors = await open(page, DESKTOP);
  await page.evaluate(() => {
    const host = document.createElement('div');
    host.id = 'probe';
    host.innerHTML = Shop.ui.productCard(Shop.products[0]) + Shop.ui.productCard(Shop.products[0]);
    document.getElementById('main').appendChild(host);
  });
  const hearts = page.locator('#probe [data-wish="mn-01"]');
  await expect(hearts).toHaveCount(2);
  await expect(hearts.first()).toHaveAttribute('aria-pressed', 'false');
  await expect(hearts.first()).toHaveAttribute('aria-label', 'Add Oud Royale to wishlist');
  await hearts.first().click();
  await expect(hearts.nth(0)).toHaveAttribute('aria-pressed', 'true');
  await expect(hearts.nth(1)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-wish-count]')).toHaveText('1');
  await expect(page.locator('.toast')).toContainText('Added to wishlist');
  expect(await page.evaluate(() => location.href)).toMatch(/index\.html$/); // did not follow the card link
  await hearts.nth(1).click();
  await expect(hearts.nth(0)).toHaveAttribute('aria-pressed', 'false');
  expect(errors).toEqual([]);
});

test('quick add puts 50 ml in the cart and opens the drawer; sold out is disabled', async ({ page }) => {
  await open(page, DESKTOP);
  await page.evaluate(() => {
    const host = document.createElement('div');
    host.id = 'probe';
    const soldOut = Shop.products.find((p) => p.stock === 0);
    host.innerHTML = Shop.ui.productCard(Shop.products[3]) + Shop.ui.productCard(soldOut);
    document.getElementById('main').appendChild(host);
  });
  await page.locator('#probe [data-quick-add="vn-01"]').click();
  await expect(page.locator('#cart-drawer')).toBeVisible();
  const cart = await page.evaluate(() => Shop.store.getCart());
  expect(cart).toEqual([{ productId: 'vn-01', ml: 50, qty: 1, gift: false }]);
  const sold = page.locator('#probe [data-quick-add="au-03"]');
  await expect(sold).toBeDisabled();
  await expect(sold).toContainText('Sold out');
  await expect(page.locator('#probe .product-card').nth(1)).toContainText('Sold out');
});

test('quick add never puts more than the stock in the bag (mn-02, stock 3: five clicks -> 3)', async ({ page }) => {
  const errors = await open(page, DESKTOP);
  expect(await page.evaluate(() => Shop.products.find((p) => p.id === 'mn-02').stock)).toBe(3);
  await page.evaluate(() => {
    const host = document.createElement('div');
    host.id = 'probe';
    host.innerHTML = Shop.ui.productCard(Shop.products.find((p) => p.id === 'mn-02'));
    document.getElementById('main').appendChild(host);
  });
  const quick = page.locator('#probe [data-quick-add="mn-02"]');
  for (let i = 0; i < 5; i++) {
    await quick.click();
    await expect(page.locator('#cart-drawer')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#cart-drawer')).toBeHidden();
  }
  expect(await page.evaluate(() => Shop.store.getCart())).toEqual([{ productId: 'mn-02', ml: 50, qty: 3, gift: false }]);
  await expect(page.locator('[data-cart-count]')).toHaveText('3');
  await expect(page.locator('.toast').last()).toContainText('You already have all 3 in your bag');
  expect(errors).toEqual([]);
});

test('drawer minus steps from the shown (stock-clamped) quantity, not a stored one above stock', async ({ page }) => {
  const errors = await open(page, DESKTOP);
  // A bag saved earlier with more bottles than are now in stock (mn-02 has 3).
  await page.evaluate(() => Shop.store.addToCart('mn-02', 50, 10));
  await page.evaluate(() => Shop.ui.openCart());
  const line = page.locator('#cart-drawer .cart-line[data-id="mn-02"]');
  await expect(line.locator('.qty-stepper__value')).toHaveText('3');
  await expect(line.locator('[data-line-action="inc"]')).toBeDisabled();
  await line.locator('[data-line-action="dec"]').click();
  await expect(line.locator('.qty-stepper__value')).toHaveText('2');
  expect((await page.evaluate(() => Shop.store.getCart()))[0].qty).toBe(2);
  await expect(page.locator('[data-cart-count]')).toHaveText('2');
  await line.locator('[data-line-action="inc"]').click();
  await expect(line.locator('.qty-stepper__value')).toHaveText('3');
  expect((await page.evaluate(() => Shop.store.getCart()))[0].qty).toBe(3);
  expect(errors).toEqual([]);
});

test('productCard and stars markup', async ({ page }) => {
  await open(page, DESKTOP);
  const info = await page.evaluate(() => {
    const host = document.createElement('div');
    host.innerHTML = Shop.ui.productCard(Shop.products[0]);
    const card = host.firstElementChild;
    const stars = document.createElement('div');
    stars.innerHTML = Shop.ui.stars(4.7);
    return {
      link: card.querySelector('a[href="product.html?id=mn-01"]') !== null,
      text: card.textContent.replace(/\s+/g, ' '),
      starsLabel: stars.querySelector('[role="img"]').getAttribute('aria-label'),
    };
  });
  expect(info.link).toBe(true);
  expect(info.text).toContain('Maison Noor');
  expect(info.text).toContain('Oud Royale');
  expect(info.text).toContain('From PKR 7,800');
  expect(info.text).toContain('Bestseller');
  expect(info.starsLabel).toBe('4.7 out of 5');
});

test('escapes dynamic text in productCard', async ({ page }) => {
  await open(page, DESKTOP);
  const html = await page.evaluate(() => Shop.ui.productCard({
    id: 'x"><img src=x>', name: '<b>Evil</b>', house: 'H&M', sizes: [{ ml: 30, price: 100 }],
    stock: 3, rating: 4, reviewCount: 1, tags: [],
  }));
  expect(html).not.toContain('<b>Evil</b>');
  expect(html).not.toContain('<img src=x>');
  expect(html).toContain('&lt;b&gt;Evil&lt;/b&gt;');
});

test('missing media falls back to a .ph placeholder with no broken image', async ({ page }) => {
  const errors = await open(page, DESKTOP);
  await page.evaluate(() => {
    const host = document.createElement('div');
    host.id = 'probe';
    host.style.width = '300px';
    // A manifest slot whose file is guaranteed missing (synthetic __missing* name, tolerated by
    // collectErrors), so this keeps passing once the owner delivers every photograph.
    Shop.media['test-missing'] = Object.assign({}, Shop.media['product-mn-01'], { file: 'assets/img/__missing-test.jpg' });
    host.innerHTML = Shop.ui.media('test-missing', { eager: true }) + Shop.ui.media('no-such-slot', { alt: 'Unknown slot' });
    document.getElementById('main').appendChild(host);
  });
  const first = page.locator('#probe .media').first();
  await expect(first.locator('.ph')).toBeVisible();
  await expect(first.locator('.ph')).toContainText('Oud Royale');
  // broken <img> is removed (or, if still present, it decoded nothing and is invisible)
  await expect.poll(async () => page.evaluate(() => {
    const img = document.querySelector('#probe img[data-slot="test-missing"]');
    return !img || (img.complete && img.naturalWidth === 0 && getComputedStyle(img).visibility === 'hidden');
  })).toBe(true);
  const ratio = await first.evaluate((el) => el.getBoundingClientRect().height / el.getBoundingClientRect().width);
  expect(Math.abs(ratio - 1)).toBeLessThan(0.02);
  await expect(page.locator('#probe .media').nth(1).locator('.ph')).toHaveAttribute('aria-label', 'Unknown slot');
  expect(errors).toEqual([]);
});

test('media() emits lazy img with dimensions, and video with poster', async ({ page }) => {
  await open(page, DESKTOP);
  const out = await page.evaluate(() => {
    const a = document.createElement('div');
    a.innerHTML = Shop.ui.media('cat-men', { className: 'x-test' });
    const b = document.createElement('div');
    b.innerHTML = Shop.ui.media('hero-video', { eager: true });
    const img = a.querySelector('img');
    const vid = b.querySelector('video');
    return {
      wrapClass: a.firstElementChild.className,
      aspect: a.firstElementChild.style.aspectRatio,
      loading: img.getAttribute('loading'),
      decoding: img.getAttribute('decoding'),
      w: img.getAttribute('width'), h: img.getAttribute('height'),
      src: img.getAttribute('src'),
      poster: vid.getAttribute('poster'),
      preload: vid.getAttribute('preload'),
      muted: vid.muted, playsinline: vid.hasAttribute('playsinline'),
      source: b.querySelector('source').getAttribute('src'),
    };
  });
  expect(out.wrapClass).toContain('media');
  expect(out.wrapClass).toContain('x-test');
  expect(out.aspect).toBe('3 / 4'); // delivered category photos are 1493x2000
  expect(out.loading).toBe('lazy');
  expect(out.decoding).toBe('async');
  expect(Number(out.h) / Number(out.w)).toBeCloseTo(4 / 3, 2);
  expect(out.src).toBe('assets/img/cat-men.jpg');
  expect(out.poster).toBe('assets/img/poster-hero-video.jpg');
  expect(out.preload).toBe('metadata');
  expect(out.muted).toBe(true);
  expect(out.playsinline).toBe(true);
  expect(out.source).toBe('assets/video/hero-video.mp4');
});

test('reveal() makes .reveal elements visible (reduced motion: immediately)', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page, MOBILE);
  const visible = await page.evaluate(() => {
    const el = document.createElement('div');
    el.className = 'reveal';
    el.textContent = 'x';
    document.getElementById('main').appendChild(el);
    Shop.ui.reveal();
    return el.classList.contains('is-visible');
  });
  expect(visible).toBe(true);
});

test('toast announces politely', async ({ page }) => {
  await open(page, MOBILE);
  await page.evaluate(() => Shop.ui.toast('Saved <b>'));
  const host = page.locator('.toast-host');
  await expect(host).toHaveAttribute('aria-live', 'polite');
  await expect(host.locator('.toast')).toHaveText('Saved <b>');
});

test('styleguide renders without errors or horizontal scroll', async ({ page }) => {
  for (const vp of [MOBILE, DESKTOP]) {
    const errors = await open(page, vp, 'styleguide');
    await noHorizontalScroll(page);
    expect(errors).toEqual([]);
  }
});
