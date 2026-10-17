// Media usage (Task 17c): every delivered photograph and clip is actually shown
// somewhere on the site. Manifest-driven: the test loads every public page
// (plus a product page per product, and the bag with items in it), collects the
// slot ids that are rendered at rest (static HTML and JS-rendered markup), and
// fails with the list of manifest slots that no page uses.
//
// Counting rules
// - an element with [data-slot] (img, video, or the poster img a failed clip
//   leaves behind) uses that slot; a [data-media] host uses its slot too, so a
//   missing file swapped for its placeholder still counts as placed;
// - a poster counts as used when its clip is used (the <video poster> shows it);
// - og counts as used when the pages' og:image points at its file;
// - styleguide.html is not scanned: it is the internal component reference and
//   renders sample slots that would hide a slot no real page uses.
// Only slots listed in INTENTIONALLY_UNUSED (with a reason) may stay unused.
const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { pageUrl, collectErrors, root } = require('./helpers');
const manifest = require('../../assets/js/media-manifest.js');
const products = require('../../assets/js/products.js');

/** Slots deliberately not shown anywhere: { id: 'reason' }. Keep it empty. */
const INTENTIONALLY_UNUSED = [];

const NOT_SCANNED = ['styleguide'];
const KEY = 'maison_demo_v1';

const PAGES = fs.readdirSync(root).filter((f) => f.endsWith('.html')).map((f) => f.slice(0, -5))
  .filter((n) => !NOT_SCANNED.includes(n)).sort();

const VISITS = [
  ...PAGES.map((name) => ({ label: name, url: pageUrl(name) })),
  ...products.map((p) => ({ label: 'product ' + p.id, url: pageUrl('product') + '?id=' + encodeURIComponent(p.id) })),
  {
    label: 'cart with items',
    url: pageUrl('cart'),
    state: { cart: [{ productId: 'mn-01', ml: 50, qty: 1, gift: true }, { productId: 'sr-02', ml: 50, qty: 1, gift: false }] },
  },
];

/** manifest id for a media file path (assets/img/x.jpg), or null */
function slotForFile(file) {
  const clean = String(file || '').replace(/^https?:\/\/[^/]+\//, '').split(/[?#]/)[0];
  return Object.keys(manifest).find((id) => manifest[id].file === clean) || null;
}

async function usedOn(page, visit) {
  const state = JSON.stringify(Object.assign({ cart: [], wishlist: [], reviews: [], orders: [], code: '' }, visit.state || {}));
  await page.addInitScript(({ key, state }) => {
    try { localStorage.setItem(key, state); } catch (e) { /* ignore */ }
  }, { key: KEY, state });
  await page.goto(visit.url, { waitUntil: 'load' });
  await page.waitForSelector('#site-header', { state: 'attached' });
  // let page scripts finish rendering (product grids, house index, bestsellers)
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await page.waitForTimeout(150);
  return page.evaluate(() => ({
    slots: Array.from(document.querySelectorAll('[data-slot]')).map((n) => n.getAttribute('data-slot')),
    hosts: Array.from(document.querySelectorAll('[data-media]')).map((n) => n.getAttribute('data-media')),
    posters: Array.from(document.querySelectorAll('video[poster]')).map((v) => v.getAttribute('poster')),
    og: (document.querySelector('meta[property="og:image"]') || { content: '' }).content,
  }));
}

test('every manifest slot (images, clips, posters, og) is used on at least one page', async ({ page }) => {
  test.setTimeout(120000);
  const errors = collectErrors(page);
  const where = {}; // slot -> [visit labels]
  const mark = (slot, label) => {
    if (!slot) return;
    (where[slot] = where[slot] || []);
    if (!where[slot].includes(label)) where[slot].push(label);
  };

  for (const visit of VISITS) {
    const r = await usedOn(page, visit);
    r.slots.concat(r.hosts).forEach((s) => mark(s, visit.label));
    r.posters.forEach((f) => mark(slotForFile(f), visit.label));
    mark(slotForFile(r.og), visit.label);
  }

  // a poster is shown wherever its clip is
  Object.keys(manifest).filter((id) => manifest[id].poster).forEach((id) => {
    const clip = id.replace(/^poster-/, '');
    (where[clip] || []).forEach((label) => mark(id, label));
  });

  const unknown = Object.keys(where).filter((s) => !manifest[s]);
  expect(unknown, 'pages reference slots the manifest does not define').toEqual([]);

  const unused = Object.keys(manifest).filter((id) => !where[id] && !INTENTIONALLY_UNUSED.includes(id));
  expect(unused, 'manifest slots no page uses: ' + unused.join(', ')).toEqual([]);
  expect(errors).toEqual([]);

  // Helpful when something regresses: which pages carry each slot.
  test.info().annotations.push({
    type: 'media usage',
    description: Object.keys(manifest).map((id) => id + ': ' + (where[id] || ['(unused)']).join(', ')).join('\n'),
  });
});

test('INTENTIONALLY_UNUSED lists only real manifest slots', () => {
  for (const id of INTENTIONALLY_UNUSED) expect(manifest[id], id).toBeTruthy();
});

test('the four clips each have a purposeful home outside the home hero', async ({ page }) => {
  // scent-video on the quiz intro, about-video on about, gift-video with the gifting notes
  const homes = [['scent-quiz', 'scent-video'], ['about', 'about-video'], ['shipping-returns', 'gift-video']];
  for (const [name, slot] of homes) {
    await page.goto(pageUrl(name));
    await expect(page.locator(`video[data-slot="${slot}"]`), name + ' ' + slot).toHaveCount(1);
  }
});
