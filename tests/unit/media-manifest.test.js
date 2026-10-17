const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const media = require('../../assets/js/media-manifest.js');

const PRODUCT_IDS = [
  'mn-01', 'mn-02', 'mn-03',
  'vn-01', 'vn-02', 'vn-03',
  'au-01', 'au-02', 'au-03',
  'sr-01', 'sr-02', 'sr-03',
];
const VIDEO_IDS = ['hero-video', 'scent-video', 'about-video', 'gift-video'];
const GENERATED_IMAGE_IDS = [
  'hero-1', 'hero-2',
  ...PRODUCT_IDS.map((id) => `product-${id}`),
  'cat-men', 'cat-women', 'cat-unisex-oud', 'cat-gift',
  'lifestyle-1', 'lifestyle-2', 'lifestyle-3', 'lifestyle-4',
  'about-1', 'about-2', 'about-3',
  'banner-1', 'banner-2', 'banner-3', 'banner-4',
  'gift-1', 'gift-2',
  'og',
];

const entries = Object.entries(media);
const generatedImages = entries.filter(([, e]) => e.kind === 'image' && !e.poster);
const videos = entries.filter(([, e]) => e.kind === 'video');
const posters = entries.filter(([, e]) => e.kind === 'image' && e.poster === true);

test('manifest has 32 generated images, 4 videos, 4 posters and nothing else', () => {
  assert.equal(generatedImages.length, 32);
  assert.equal(videos.length, 4);
  assert.equal(posters.length, 4);
  assert.equal(entries.length, 40);
});

test('slot ids match the binding contract exactly', () => {
  assert.deepEqual(generatedImages.map(([id]) => id).sort(), [...GENERATED_IMAGE_IDS].sort());
  assert.deepEqual(videos.map(([id]) => id).sort(), [...VIDEO_IDS].sort());
  assert.deepEqual(posters.map(([id]) => id).sort(), VIDEO_IDS.map((v) => `poster-${v}`).sort());
});

test('includes product-<id> for all 12 products', () => {
  for (const id of PRODUCT_IDS) {
    assert.ok(media[`product-${id}`], `missing product-${id}`);
    assert.equal(media[`product-${id}`].kind, 'image');
    assert.equal(media[`product-${id}`].aspect, '1:1');
  }
});

test('every entry has file, alt, kind, aspect; files are unique and correctly located', () => {
  const files = new Set();
  for (const [id, e] of entries) {
    assert.equal(typeof e.file, 'string', `${id}.file`);
    assert.equal(typeof e.alt, 'string', `${id}.alt`);
    assert.ok(e.alt.trim().length > 0, `${id}.alt empty`);
    assert.ok(['image', 'video'].includes(e.kind), `${id}.kind`);
    assert.equal(typeof e.aspect, 'string', `${id}.aspect`);
    assert.ok(e.file.startsWith('assets/img/') || e.file.startsWith('assets/video/'), `${id}.file prefix`);
    if (e.kind === 'video') assert.equal(e.file, `assets/video/${id}.mp4`);
    else assert.match(e.file, /^assets\/img\/[a-z0-9-]+\.jpg$/, `${id}.file`);
    assert.ok(!files.has(e.file), `duplicate file ${e.file}`);
    files.add(e.file);
  }
});

test('posters are exported frames named after their video', () => {
  for (const v of VIDEO_IDS) {
    const p = media[`poster-${v}`];
    assert.equal(p.file, `assets/img/poster-${v}.jpg`);
    assert.equal(p.poster, true);
    assert.equal(p.aspect, media[v].aspect);
  }
});

test('docs/media-prompts.md references exactly the manifest files', () => {
  const md = fs.readFileSync(path.join(__dirname, '../../docs/media-prompts.md'), 'utf8');
  const found = new Set(md.match(/assets\/(?:img|video)\/[A-Za-z0-9._-]+\.(?:jpg|mp4)/g) || []);
  const manifestFiles = new Set(entries.map(([, e]) => e.file));
  assert.deepEqual([...found].sort(), [...manifestFiles].sort());
});
