// tools/set-domain.js and tools/package.js, run as the real CLIs against a small
// throwaway copy of the project (a temp folder), never the real repo.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const REPO = path.resolve(__dirname, '..', '..');
const SET_DOMAIN = path.join(REPO, 'tools', 'set-domain.js');
const PACKAGE = path.join(REPO, 'tools', 'package.js');

const PAGE = (title, body) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${title}</title>
<meta property="og:image" content="https://example.com/assets/img/og.jpg">
<link rel="icon" href="assets/img/a.jpg">
<link rel="stylesheet" href="assets/css/x.css">
<script src="assets/js/config.js"></script></head>
<body>${body}<input placeholder="you@example.com"><a href="https://wa.me/923000000000">wa</a>
<a href="mailto:hi@example.com">m</a></body></html>`;

function write(root, rel, text) {
  const f = path.join(root, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, text);
}

/** A minimal project: public pages, demo pages, assets, and folders that must never ship. */
function makeFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'perfume-tools-'));
  write(root, 'index.html', PAGE('Home', '<a href="shop.html">Shop</a> <a href="product.html?id=a-01#top">P</a> <a href="#main">skip</a> <img src="assets/img/a.jpg">'));
  write(root, 'shop.html', PAGE('Shop', '<a href="./">Home</a>'));
  write(root, 'product.html', PAGE('Product', ''));
  write(root, '404.html', PAGE('Not found', ''));
  write(root, 'admin.html', PAGE('Admin', '<script src="assets/js/admin-data.js"></script><script src="assets/js/pages/admin.js"></script>'));
  write(root, 'styleguide.html', PAGE('Styleguide', '<script src="assets/js/pages/styleguide.js"></script>'));
  write(root, 'assets/js/config.js', "module.exports = { siteUrl: 'https://example.com/', shopName: 'X' };\n");
  write(root, 'assets/js/ui.js', "var links = ['shop.html', 'product.html?id=', 'index.html'];\n// admin.html is mentioned in a comment only\n");
  write(root, 'assets/js/admin-data.js', '/* sample data for admin.html */\n');
  write(root, 'assets/js/pages/admin.js', '/* admin.html */\n');
  write(root, 'assets/js/pages/styleguide.js', '/* styleguide.html */\n');
  write(root, 'assets/css/x.css', 'body{margin:0}');
  write(root, 'assets/img/a.jpg', 'jpg');
  write(root, 'assets/img/og.jpg', 'jpg');
  write(root, 'assets/img/.gitkeep', '');
  write(root, 'assets/video/v.mp4', 'mp4');
  write(root, 'sitemap.xml', '<?xml version="1.0"?>\n<!--\n  Placeholder origin: every URL below uses the example.com placeholder. Run\n  npm run set-domain -- https://yourshop.pk before going live.\n-->\n<urlset>\n<url><loc>https://example.com/</loc><lastmod>2026-01-01</lastmod></url>\n<url><loc>https://example.com/shop.html</loc><lastmod>2026-01-01</lastmod></url>\n</urlset>\n');
  write(root, 'robots.txt', '# Placeholder origin: the Sitemap URL below uses example.com. Run\n# npm run set-domain -- https://yourshop.pk before going live.\nUser-agent: *\nDisallow: /admin.html\n\nSitemap: https://example.com/sitemap.xml\n');
  write(root, 'package.json', '{}');
  write(root, 'README.md', '# x');
  write(root, 'tests/e2e/x.spec.js', '//');
  write(root, 'docs/notes.md', '#');
  write(root, 'tools/t.js', '//');
  write(root, 'node_modules/m/index.js', '//');
  write(root, '.superpowers/s.md', '#');
  write(root, 'test-results/r.txt', 'r');
  return root;
}

function cleanup(root) { fs.rmSync(root, { recursive: true, force: true }); }

function run(script, args, env) {
  const r = spawnSync(process.execPath, [script, ...args], { encoding: 'utf8', env: { ...process.env, DIST_DIR: '', ...(env || {}) } });
  return { code: r.status, out: r.stdout, err: r.stderr };
}

function snapshot(root) {
  const out = {};
  (function walk(d) {
    fs.readdirSync(d, { withFileTypes: true }).forEach((e) => {
      const f = path.join(d, e.name);
      if (e.isDirectory()) walk(f);
      else out[path.relative(root, f).split(path.sep).join('/')] = crypto.createHash('sha1').update(fs.readFileSync(f)).digest('hex');
    });
  })(root);
  return out;
}

function listFiles(dir) { return Object.keys(snapshot(dir)).sort(); }

function today() {
  const d = new Date();
  const p = (n) => (n < 10 ? '0' : '') + n;
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

// ---------------------------------------------------------------- set-domain

test('set-domain: rejects bad input and leaves every file untouched', () => {
  const root = makeFixture();
  try {
    const before = snapshot(root);
    for (const bad of ['http://yourshop.pk', 'yourshop.pk', 'https://localhost', 'https://yourshop.pk/?a=1', 'not a url', 'https://u:p@yourshop.pk']) {
      const r = run(SET_DOMAIN, [bad, '--root', root]);
      assert.equal(r.code, 2, bad + ' should be rejected: ' + r.err);
    }
    assert.equal(run(SET_DOMAIN, ['--root', root]).code, 2, 'no argument is a usage error');
    assert.deepEqual(snapshot(root), before);
  } finally { cleanup(root); }
});

test('set-domain --dry-run reports the changes and writes nothing', () => {
  const root = makeFixture();
  try {
    const before = snapshot(root);
    const r = run(SET_DOMAIN, ['https://yourshop.pk', '--dry-run', '--root', root]);
    assert.equal(r.code, 0, r.err);
    assert.match(r.out, /DRY RUN/);
    assert.match(r.out, /would change sitemap\.xml/);
    assert.match(r.out, /would change index\.html/);
    assert.deepEqual(snapshot(root), before);
  } finally { cleanup(root); }
});

test('set-domain rewrites config, sitemap, robots and every html file, and nothing else', () => {
  const root = makeFixture();
  try {
    const r = run(SET_DOMAIN, ['https://yourshop.pk', '--root', root]);
    assert.equal(r.code, 0, r.err);
    const rd = (f) => fs.readFileSync(path.join(root, f), 'utf8');
    assert.match(rd('assets/js/config.js'), /siteUrl: 'https:\/\/yourshop\.pk\/'/);
    assert.match(rd('robots.txt'), /Sitemap: https:\/\/yourshop\.pk\/sitemap\.xml/);
    const sm = rd('sitemap.xml');
    assert.match(sm, /<loc>https:\/\/yourshop\.pk\/<\/loc>/);
    assert.match(sm, /<loc>https:\/\/yourshop\.pk\/shop\.html<\/loc>/);
    assert.ok(!sm.includes('example.com'));
    assert.equal((sm.match(new RegExp('<lastmod>' + today() + '</lastmod>', 'g')) || []).length, 2, 'every lastmod is today');
    for (const f of ['index.html', 'shop.html', 'product.html', '404.html', 'admin.html', 'styleguide.html']) {
      const h = rd(f);
      assert.match(h, /content="https:\/\/yourshop\.pk\/assets\/img\/og\.jpg"/, f);
      assert.ok(!h.includes('https://example.com'), f + ' still has the placeholder origin');
      // relative paths, email addresses and other hosts are untouched
      assert.match(h, /href="assets\/img\/a\.jpg"/);
      assert.match(h, /placeholder="you@example\.com"/);
      assert.match(h, /href="mailto:hi@example\.com"/);
      assert.match(h, /href="https:\/\/wa\.me\/923000000000"/);
    }
    assert.equal(rd('assets/js/ui.js'), "var links = ['shop.html', 'product.html?id=', 'index.html'];\n// admin.html is mentioned in a comment only\n");
  } finally { cleanup(root); }
});

test('set-domain removes the "Placeholder origin ... example.com" notes from robots.txt and sitemap.xml', () => {
  const root = makeFixture();
  try {
    const r = run(SET_DOMAIN, ['https://yourshop.pk', '--root', root]);
    assert.equal(r.code, 0, r.err);
    const robots = fs.readFileSync(path.join(root, 'robots.txt'), 'utf8');
    const sitemap = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
    for (const [name, text] of [['robots.txt', robots], ['sitemap.xml', sitemap]]) {
      assert.ok(!/placeholder/i.test(text), name + ' still has the placeholder note:\n' + text);
      assert.ok(!/example\.com/.test(text), name + ' still mentions example.com');
      assert.ok(!/set-domain/.test(text), name + ' still tells the reader to run set-domain');
    }
    assert.match(robots, /^User-agent: \*\nDisallow: \/admin\.html\n\nSitemap: https:\/\/yourshop\.pk\/sitemap\.xml\n$/);
    assert.match(sitemap, /^<\?xml version="1\.0"\?>\n<urlset>\n<url><loc>https:\/\/yourshop\.pk\/<\/loc>/);
    assert.match(r.out, /changed robots\.txt/);
  } finally { cleanup(root); }
});

test('set-domain is idempotent: a second run with the same URL is refused and changes nothing', () => {
  const root = makeFixture();
  try {
    assert.equal(run(SET_DOMAIN, ['https://yourshop.pk', '--root', root]).code, 0);
    const after = snapshot(root);
    for (const again of ['https://yourshop.pk', 'https://yourshop.pk/']) {
      const r = run(SET_DOMAIN, [again, '--root', root]);
      assert.equal(r.code, 1, again);
      assert.match(r.err, /already/);
    }
    assert.deepEqual(snapshot(root), after);
    // the current value comes from config.js, so a different domain can still be applied
    assert.equal(run(SET_DOMAIN, ['https://other.pk', '--root', root]).code, 0);
    assert.match(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), /https:\/\/other\.pk\/assets\/img\/og\.jpg/);
  } finally { cleanup(root); }
});

test('set-domain normalises the trailing slash and accepts a sub-path', () => {
  const a = makeFixture();
  const b = makeFixture();
  try {
    assert.equal(run(SET_DOMAIN, ['https://yourshop.pk', '--root', a]).code, 0);
    assert.equal(run(SET_DOMAIN, ['https://yourshop.pk/', '--root', b]).code, 0);
    assert.deepEqual(snapshot(a), snapshot(b));
    const c = makeFixture();
    try {
      assert.equal(run(SET_DOMAIN, ['https://me.github.io/shop', '--root', c]).code, 0);
      assert.match(fs.readFileSync(path.join(c, 'assets/js/config.js'), 'utf8'), /siteUrl: 'https:\/\/me\.github\.io\/shop\/'/);
      assert.match(fs.readFileSync(path.join(c, 'index.html'), 'utf8'), /https:\/\/me\.github\.io\/shop\/assets\/img\/og\.jpg/);
    } finally { cleanup(c); }
  } finally { cleanup(a); cleanup(b); }
});

// ------------------------------------------------------------------- package

/** Rewrites the fixture's config.js with extra fields (showcasePages, indexable, ...). */
function setConfig(root, extra) {
  write(root, 'assets/js/config.js', 'module.exports = ' + JSON.stringify(Object.assign({ siteUrl: 'https://example.com/', shopName: 'X' }, extra)) + ';\n');
}

const SHOWCASE_FILES = ['admin.html', 'styleguide.html', 'assets/js/admin-data.js', 'assets/js/pages/admin.js', 'assets/js/pages/styleguide.js'];

test('package: default build excludes showcase pages (no showcasePages in config), their scripts, tests, docs, tools and junk', () => {
  const root = makeFixture();
  const out = path.join(root, 'dist');
  try {
    const r = run(PACKAGE, ['--root', root, '--out', out]);
    assert.equal(r.code, 0, r.out + r.err);
    assert.deepEqual(listFiles(out), [
      '404.html', 'assets/css/x.css', 'assets/img/a.jpg', 'assets/img/og.jpg', 'assets/js/config.js',
      'assets/js/ui.js', 'assets/video/v.mp4', 'index.html', 'product.html', 'robots.txt', 'shop.html', 'sitemap.xml',
    ]);
    assert.match(r.out, /TOTAL/);
    assert.match(r.out, /Largest files/);
  } finally { cleanup(root); }
});

test('package --with-showcase-pages includes admin.html, styleguide.html and their scripts', () => {
  const root = makeFixture();
  const out = path.join(root, 'dist');
  try {
    const r = run(PACKAGE, ['--root', root, '--out', out, '--with-showcase-pages']);
    assert.equal(r.code, 0, r.out + r.err);
    const files = listFiles(out);
    for (const f of SHOWCASE_FILES) assert.ok(files.includes(f), f);
    assert.ok(!files.some((f) => /^(tests|docs|tools|node_modules|\.superpowers|test-results)\//.test(f) || f === 'README.md' || f === 'package.json'));
  } finally { cleanup(root); }
});

test('package: the old --with-demo-pages flag is refused with a pointer to the new name', () => {
  const root = makeFixture();
  try {
    const r = run(PACKAGE, ['--root', root, '--out', path.join(root, 'dist'), '--with-demo-pages']);
    assert.equal(r.code, 2);
    assert.match(r.err, /--with-showcase-pages/);
  } finally { cleanup(root); }
});

test('package: showcasePages: true in config.js keeps the dashboard and style guide by default', () => {
  const root = makeFixture();
  const out = path.join(root, 'dist');
  try {
    setConfig(root, { showcasePages: true });
    const r = run(PACKAGE, ['--root', root, '--out', out]);
    assert.equal(r.code, 0, r.out + r.err);
    const files = listFiles(out);
    for (const f of SHOWCASE_FILES) assert.ok(files.includes(f), f);
    assert.match(r.out, /showcase/i);
  } finally { cleanup(root); }
});

test('package fails loudly when showcasePages is true but the showcase pages are left out', () => {
  const root = makeFixture();
  const out = path.join(root, 'dist');
  try {
    setConfig(root, { showcasePages: true });
    let r = run(PACKAGE, ['--root', root, '--out', out, '--without-showcase-pages']);
    assert.equal(r.code, 1, r.out + r.err);
    assert.match(r.err, /showcasePages is true/);
    assert.match(r.err, /admin\.html/);
    // ...or missing from the project folder
    fs.rmSync(path.join(root, 'styleguide.html'));
    r = run(PACKAGE, ['--root', root, '--out', out]);
    assert.equal(r.code, 1, r.out + r.err);
    assert.match(r.err, /showcasePages is true/);
    assert.match(r.err, /styleguide\.html/);
  } finally { cleanup(root); }
});

test('package: showcasePages false leaves the pages out, and the footer list in ui.js that config gates is not a broken link', () => {
  const root = makeFixture();
  const out = path.join(root, 'dist');
  try {
    setConfig(root, { showcasePages: false });
    write(root, 'assets/js/ui.js', "var SHOWCASE_PAGES = [['Dashboard', 'admin.html'], ['Style guide', 'styleguide.html']];\nvar l = ['shop.html'];\n");
    const r = run(PACKAGE, ['--root', root, '--out', out]);
    assert.equal(r.code, 0, r.out + r.err);
    const files = listFiles(out);
    for (const f of SHOWCASE_FILES) assert.ok(!files.includes(f), f);
    // any other mention in a script is still a broken link
    write(root, 'assets/js/ui.js', "var SHOWCASE_PAGES = [['Dashboard', 'admin.html']];\nvar l = ['styleguide.html'];\n");
    const r2 = run(PACKAGE, ['--root', root, '--out', out]);
    assert.equal(r2.code, 1);
    assert.match(r2.err, /script links to "styleguide\.html"/);
  } finally { cleanup(root); }
});

test('package: indexable false adds noindex to every built page and disallows everything in robots.txt; the sources are untouched', () => {
  const root = makeFixture();
  const out = path.join(root, 'dist');
  try {
    setConfig(root, { indexable: false, showcasePages: true });
    write(root, 'admin.html', PAGE('Admin', '<script src="assets/js/admin-data.js"></script><script src="assets/js/pages/admin.js"></script>').replace('<meta charset="utf-8">', '<meta charset="utf-8">\n<meta name="robots" content="noindex">'));
    const before = snapshot(root);
    const r = run(PACKAGE, ['--root', root, '--out', out]);
    assert.equal(r.code, 0, r.out + r.err);
    const pages = listFiles(out).filter((f) => f.endsWith('.html'));
    assert.ok(pages.length >= 6);
    for (const f of pages) {
      const h = fs.readFileSync(path.join(out, f), 'utf8');
      assert.equal((h.match(/<meta name="robots" content="noindex">/g) || []).length, 1, f + ' has exactly one noindex');
      assert.ok(h.indexOf('<meta name="robots"') < h.indexOf('</head>'), f + ': noindex is in <head>');
    }
    assert.equal(fs.readFileSync(path.join(out, 'robots.txt'), 'utf8'), 'User-agent: *\nDisallow: /\n');
    assert.ok(!listFiles(out).includes('sitemap.xml'), 'no sitemap for a site that asks not to be indexed');
    assert.match(r.out, /noindex/);
    const after = snapshot(root);
    delete after['dist/index.html'];
    Object.keys(after).filter((k) => k.startsWith('dist/')).forEach((k) => delete after[k]);
    assert.deepEqual(after, before, 'source files unchanged');
  } finally { cleanup(root); }
});

test('package: indexable true (or unset) copies pages, robots.txt and sitemap.xml unchanged', () => {
  const root = makeFixture();
  const out = path.join(root, 'dist');
  try {
    setConfig(root, { indexable: true });
    assert.equal(run(PACKAGE, ['--root', root, '--out', out]).code, 0);
    assert.equal(fs.readFileSync(path.join(out, 'index.html'), 'utf8'), fs.readFileSync(path.join(root, 'index.html'), 'utf8'));
    assert.equal(fs.readFileSync(path.join(out, 'robots.txt'), 'utf8'), fs.readFileSync(path.join(root, 'robots.txt'), 'utf8'));
    assert.ok(listFiles(out).includes('sitemap.xml'));
  } finally { cleanup(root); }
});

test('package honours DIST_DIR, empties the folder first and is deterministic', () => {
  const root = makeFixture();
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'perfume-dist-'));
  try {
    write(out, 'stale.html', 'old');
    write(out, 'old/deep/file.js', 'old');
    const r1 = run(PACKAGE, ['--root', root, '--quiet'], { DIST_DIR: out });
    assert.equal(r1.code, 0, r1.out + r1.err);
    assert.ok(!fs.existsSync(path.join(out, 'stale.html')) && !fs.existsSync(path.join(out, 'old')));
    const first = snapshot(out);
    assert.equal(run(PACKAGE, ['--root', root, '--quiet'], { DIST_DIR: out }).code, 0);
    assert.deepEqual(snapshot(out), first);
    assert.ok(!fs.existsSync(path.join(root, 'dist')), 'nothing written to the default dist');
  } finally { cleanup(root); cleanup(out); }
});

test('package fails when a page links to a file that is not in the build', () => {
  const root = makeFixture();
  const out = path.join(root, 'dist');
  try {
    write(root, 'shop.html', PAGE('Shop', '<a href="missing-page.html">x</a> <img src="assets/img/nope.jpg">'));
    const r = run(PACKAGE, ['--root', root, '--out', out]);
    assert.equal(r.code, 1);
    assert.match(r.err, /shop\.html: broken link "missing-page\.html"/);
    assert.match(r.err, /shop\.html: broken link "assets\/img\/nope\.jpg"/);
  } finally { cleanup(root); }
});

test('package fails loudly when a kept page or script links to an excluded showcase page', () => {
  const root = makeFixture();
  const out = path.join(root, 'dist');
  try {
    write(root, 'index.html', PAGE('Home', '<a href="admin.html">Admin</a>'));
    let r = run(PACKAGE, ['--root', root, '--out', out]);
    assert.equal(r.code, 1);
    assert.match(r.err, /index\.html: broken link "admin\.html"/);
    // the same page is fine once the showcase pages are included
    assert.equal(run(PACKAGE, ['--root', root, '--out', out, '--with-showcase-pages']).code, 0);

    write(root, 'index.html', PAGE('Home', ''));
    write(root, 'assets/js/ui.js', "var l = ['styleguide.html'];\n");
    r = run(PACKAGE, ['--root', root, '--out', out]);
    assert.equal(r.code, 1);
    assert.match(r.err, /assets\/js\/ui\.js: script links to "styleguide\.html"/);
  } finally { cleanup(root); }
});

test('package ignores external, mailto, tel, data and fragment links and links inside comments', () => {
  const root = makeFixture();
  const out = path.join(root, 'dist');
  try {
    write(root, 'shop.html', PAGE('Shop', '<a href="https://example.org/x">e</a><a href="tel:+92300">t</a><a href="#top">f</a><img src="data:image/gif;base64,AAAA"><!-- <a href="gone.html">x</a> -->'));
    const r = run(PACKAGE, ['--root', root, '--out', out]);
    assert.equal(r.code, 0, r.out + r.err);
  } finally { cleanup(root); }
});

test('package refuses an output folder that is the project folder', () => {
  const root = makeFixture();
  try {
    const before = snapshot(root);
    const r = run(PACKAGE, ['--root', root, '--out', root]);
    assert.equal(r.code, 1);
    assert.deepEqual(snapshot(root), before);
  } finally { cleanup(root); }
});

test('package fails when the media manifest or a product names an image that does not exist', () => {
  const root = makeFixture();
  const out = path.join(root, 'dist');
  try {
    write(root, 'assets/js/media-manifest.js', "module.exports = { a: { file: 'assets/img/a.jpg' }, b: { file: 'assets/img/gone.jpg' } };\n");
    write(root, 'assets/js/products.js', "module.exports = [{ id: 'x-01', images: ['assets/img/product-x-01.jpg'] }];\n");
    const r = run(PACKAGE, ['--root', root, '--out', out]);
    assert.equal(r.code, 1);
    assert.match(r.err, /slot "b" needs assets\/img\/gone\.jpg/);
    assert.match(r.err, /product "x-01" image assets\/img\/product-x-01\.jpg/);
    assert.ok(!/slot "a"/.test(r.err));
  } finally { cleanup(root); }
});

test('package copies a CNAME file (GitHub Pages custom domain) when the project has one', () => {
  const root = makeFixture();
  const out = path.join(root, 'dist');
  try {
    write(root, 'CNAME', 'yourshop.pk');
    assert.equal(run(PACKAGE, ['--root', root, '--out', out]).code, 0);
    assert.ok(listFiles(out).includes('CNAME'));
  } finally { cleanup(root); }
});

test('netlify.toml: frames allowed from the same origin only, and the build runs the package script', () => {
  const toml = fs.readFileSync(path.join(REPO, 'netlify.toml'), 'utf8');
  assert.match(toml, /X-Frame-Options = "SAMEORIGIN"/);
  assert.ok(!/X-Frame-Options = "DENY"/.test(toml));
  assert.match(toml, /command = "npm run package"/);
});
