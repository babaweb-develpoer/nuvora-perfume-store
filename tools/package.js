#!/usr/bin/env node
/*
 * package: build dist/, the folder you upload to a host.
 *
 *   npm run package                              (follows config.js, see below)
 *   npm run package -- --with-showcase-pages     (keep admin.html + styleguide.html)
 *   npm run package -- --without-showcase-pages  (leave them out)
 *   npm run package -- --zip                     (also write dist.zip, best effort)
 *   DIST_DIR=some/folder npm run package         (build somewhere else; or --out <dir>)
 *
 * dist/ gets ONLY deployable files: the top-level *.html pages, assets/ (img, js,
 * css, video), robots.txt, sitemap.xml and, if they exist in the project folder, favicon files
 * and the GitHub Pages files CNAME and .nojekyll. Tests, docs, tools, node_modules,
 * package files and editor/agent folders are never copied.
 *
 * Two fields in assets/js/config.js steer the build:
 *   showcasePages  true: the dashboard and style guide (plus the scripts only they
 *                  use) are kept, because the footer links them ("Behind the build").
 *                  The build FAILS if they are then left out (--without-showcase-pages,
 *                  or a page missing from the project). false/unset: they are left out
 *                  unless --with-showcase-pages.
 *   indexable      false: every built page gets <meta name="robots" content="noindex">
 *                  (pages that already have a robots meta keep theirs), robots.txt
 *                  becomes "Disallow: /" and sitemap.xml is not shipped, so a fictional
 *                  store stays out of search results. The source files are not touched.
 *                  true/unset: pages, robots.txt and sitemap.xml are copied as they are.
 *
 * The folder is emptied first and files are copied in sorted order, so two runs give
 * the same result. Afterwards the build is checked and the process exits 1 if:
 *   - an href/src/poster in any built page points at a file that is not in dist/
 *   - a built script names an .html page that is not in dist/ (e.g. a nav link)
 *   - a file named in media-manifest.js or a product image in products.js is missing
 * No dependencies. Options: --root <dir> (source folder), --out <dir>, --quiet.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const SHOWCASE_PAGES = ['admin.html', 'styleguide.html'];
// Scripts that only the showcase pages load; dropped together with them.
const SHOWCASE_ONLY_FILES = ['assets/js/admin-data.js', 'assets/js/pages/admin.js', 'assets/js/pages/styleguide.js'];
const ROOT_FILES = ['robots.txt', 'sitemap.xml', 'favicon.ico', 'favicon.svg', 'favicon.png', 'apple-touch-icon.png', 'site.webmanifest', 'CNAME', '.nojekyll'];
const JUNK = /^(\.|Thumbs\.db$|desktop\.ini$)/i;
const NOINDEX = '<meta name="robots" content="noindex">';
const ROBOTS_NONE = 'User-agent: *\nDisallow: /\n';
// ui.js lists the showcase pages for the footer in this one declaration and renders
// them only while config.showcasePages is true; see checkScriptPages.
const SHOWCASE_DECL = /var SHOWCASE_PAGES = \[[^;]*\];/g;

function parseArgs(argv, env) {
  // showcase: true / false from a flag, null = follow config.showcasePages
  const o = { root: path.resolve(__dirname, '..'), out: null, showcase: null, zip: false, quiet: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--with-showcase-pages') o.showcase = true;
    else if (a === '--without-showcase-pages') o.showcase = false;
    else if (a === '--with-demo-pages') throw new Error('--with-demo-pages was renamed: use --with-showcase-pages (or set showcasePages: true in assets/js/config.js).');
    else if (a === '--zip') o.zip = true;
    else if (a === '--quiet') o.quiet = true;
    else if (a === '--root') o.root = path.resolve(argv[++i] || '');
    else if (a === '--out') o.out = path.resolve(argv[++i] || '');
    else throw new Error('Unknown option: ' + a);
  }
  if (!o.out) o.out = path.resolve(env.DIST_DIR ? env.DIST_DIR : path.join(o.root, 'dist'));
  return o;
}

function toPosix(p) { return p.split(path.sep).join('/'); }

/** Sorted list of files (posix, relative to dir) under dir, skipping dotfiles and junk. */
function walk(dir, base) {
  base = base || dir;
  let out = [];
  fs.readdirSync(dir, { withFileTypes: true })
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
    .forEach((e) => {
      if (JUNK.test(e.name)) return;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) out = out.concat(walk(full, base));
      else if (e.isFile()) out.push(toPosix(path.relative(base, full)));
    });
  return out;
}

function sourceFiles(root, showcase, indexable) {
  const files = [];
  fs.readdirSync(root, { withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => e.name)
    .sort()
    .forEach((n) => {
      if (/\.html$/i.test(n)) { if (showcase || SHOWCASE_PAGES.indexOf(n) === -1) files.push(n); }
      else if (n === 'sitemap.xml' && !indexable) return; // nothing to index
      else if (ROOT_FILES.indexOf(n) !== -1) files.push(n);
    });
  const assets = path.join(root, 'assets');
  if (fs.existsSync(assets)) {
    walk(assets, root).forEach((f) => { if (showcase || SHOWCASE_ONLY_FILES.indexOf(f) === -1) files.push(f); });
  }
  return files;
}

/** Shop.config from the project's assets/js/config.js ({} when it is missing). */
function readConfig(root) {
  const f = path.join(root, 'assets', 'js', 'config.js');
  if (!fs.existsSync(f)) return {};
  try {
    delete require.cache[require.resolve(f)];
    const c = require(f);
    return c && typeof c === 'object' ? c : {};
  } catch (e) {
    throw new Error('assets/js/config.js cannot be read (' + e.message + ')');
  }
}

/** The robots meta goes right after <meta charset>, or first in <head>. */
function addNoindex(html) {
  if (/<meta\s+name=["']robots["']/i.test(html)) return html;
  if (/<meta\s+charset[^>]*>/i.test(html)) return html.replace(/(<meta\s+charset[^>]*>)/i, '$1\n  ' + NOINDEX);
  if (/<head[^>]*>/i.test(html)) return html.replace(/(<head[^>]*>)/i, '$1\n  ' + NOINDEX);
  return html;
}

function safeToClear(out, root) {
  const o = path.resolve(out), r = path.resolve(root);
  const rel = path.relative(o, r);
  // refuse the project folder itself, any parent of it, or a drive root
  if (o === r || o === path.parse(o).root) return false;
  if (rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))) return false;
  return true;
}

// ---- checks ---------------------------------------------------------------

const ATTR = /\b(?:href|src|poster)\s*=\s*("([^"]*)"|'([^']*)')/gi;
const SKIP_URL = /^(?:[a-z][a-z0-9+.-]*:|\/\/|#|$)/i; // http:, mailto:, tel:, data:, javascript:, //host, #frag

function existsIn(out, rel) {
  try { return fs.statSync(path.join(out, rel)).isFile(); } catch (e) { return false; }
}

/** Resolves a link found in `fromFile` (posix, relative to dist); returns the target rel path or null to skip. */
function resolveLink(fromFile, url) {
  if (SKIP_URL.test(url)) return null;
  const clean = url.split('#')[0].split('?')[0];
  if (!clean) return null;
  let target;
  if (clean.charAt(0) === '/') target = path.posix.normalize(clean.slice(1));
  else target = path.posix.normalize(path.posix.join(path.posix.dirname(fromFile), clean));
  if (target === '' || target === '.' || target.slice(-1) === '/') target = (target === '.' ? '' : target) + 'index.html';
  return target;
}

function checkHtmlLinks(out, files) {
  const problems = [];
  files.filter((f) => /\.html$/i.test(f)).forEach((f) => {
    const text = fs.readFileSync(path.join(out, f), 'utf8').replace(/<!--[\s\S]*?-->/g, '');
    let m;
    ATTR.lastIndex = 0;
    while ((m = ATTR.exec(text))) {
      const url = (m[2] !== undefined ? m[2] : m[3]).trim();
      const target = resolveLink(f, url);
      if (target === null) continue;
      if (target.indexOf('..') === 0 || !existsIn(out, target)) problems.push(f + ': broken link "' + url + '" (no ' + target + ' in dist)');
    }
  });
  return problems;
}

// Quoted page names in scripts, e.g. 'shop.html' or "product.html?id=" (nav, footer, redirects).
const JS_PAGE = /['"`](?:\.\/)?([A-Za-z0-9][A-Za-z0-9_-]*\.html)(?=[?#'"`])/g;

// showcaseGated: the showcase pages are left out because config.showcasePages is
// false, so ui.js's SHOWCASE_PAGES list is never rendered and is not a broken link.
function checkScriptPages(out, files, showcaseGated) {
  const problems = [];
  files.filter((f) => /\.js$/i.test(f)).forEach((f) => {
    let text = fs.readFileSync(path.join(out, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
    if (showcaseGated) text = text.replace(SHOWCASE_DECL, '');
    let m;
    JS_PAGE.lastIndex = 0;
    while ((m = JS_PAGE.exec(text))) {
      if (!existsIn(out, m[1])) problems.push(f + ': script links to "' + m[1] + '" which is not in dist');
    }
  });
  return problems;
}

/** Files promised by media-manifest.js and products.js (loaded from the SOURCE folder). */
function checkDataFiles(root, out) {
  const problems = [];
  const load = (rel) => {
    const f = path.join(root, rel);
    if (!fs.existsSync(f)) return null;
    try { return require(f); } catch (e) { problems.push(rel + ': cannot be read (' + e.message + ')'); return null; }
  };
  const manifest = load('assets/js/media-manifest.js');
  if (manifest) Object.keys(manifest).forEach((id) => {
    if (!existsIn(out, manifest[id].file)) problems.push('media-manifest.js: slot "' + id + '" needs ' + manifest[id].file + ', missing from dist');
  });
  const products = load('assets/js/products.js');
  if (Array.isArray(products)) products.forEach((p) => {
    (p.images || []).forEach((img) => {
      if (!existsIn(out, img)) problems.push('products.js: product "' + p.id + '" image ' + img + ' is missing from dist');
    });
  });
  return problems;
}

/** Informational: files that merely MENTION a left-out showcase page (not a link). */
function showcaseMentions(out, files) {
  const hits = [];
  files.filter((f) => /\.(html|js|css|xml|txt)$/i.test(f)).forEach((f) => {
    const t = fs.readFileSync(path.join(out, f), 'utf8');
    SHOWCASE_PAGES.forEach((p) => { if (t.indexOf(p) !== -1) hits.push(f + ' mentions ' + p); });
  });
  return hits;
}

// ---- zip ------------------------------------------------------------------

function makeZip(out) {
  const zip = path.join(path.dirname(out), 'dist.zip');
  try {
    fs.rmSync(zip, { force: true });
    let r;
    if (process.platform === 'win32') {
      r = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
        'Compress-Archive -Path "' + path.join(out, '*') + '" -DestinationPath "' + zip + '" -Force'], { stdio: 'ignore' });
    } else {
      r = spawnSync('zip', ['-r', '-q', zip, '.'], { cwd: out, stdio: 'ignore' });
    }
    if (r && r.status === 0 && fs.existsSync(zip)) return zip;
  } catch (e) { /* best effort */ }
  return null;
}

// ---- main -----------------------------------------------------------------

function build(opts) {
  const { root, out } = opts;
  if (!fs.existsSync(path.join(root, 'index.html'))) throw new Error('No index.html in ' + root + ' (use --root to point at the project folder).');
  if (!safeToClear(out, root)) throw new Error('Refusing to use ' + out + ' as the output folder (it is, or contains, the project folder).');
  const config = readConfig(root);
  const configShowcase = config.showcasePages === true;
  const showcase = opts.showcase === null || opts.showcase === undefined ? configShowcase : opts.showcase;
  if (configShowcase) {
    // The footer links these pages on every page: shipping without them breaks those links.
    const missing = SHOWCASE_PAGES.filter((p) => !showcase || !fs.existsSync(path.join(root, p)));
    if (missing.length) {
      throw new Error('showcasePages is true in assets/js/config.js, so every footer links ' + SHOWCASE_PAGES.join(' and ') +
        ', but ' + missing.join(' and ') + (showcase ? ' is missing from the project.' : ' would be left out (--without-showcase-pages).') +
        ' Set showcasePages: false, or keep the pages.');
    }
  }
  const indexable = config.indexable !== false;
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  const files = sourceFiles(root, showcase, indexable);
  files.forEach((f) => {
    const dest = path.join(out, f);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    if (!indexable && /\.html$/i.test(f) && f.indexOf('/') === -1) {
      fs.writeFileSync(dest, addNoindex(fs.readFileSync(path.join(root, f), 'utf8')));
    } else if (!indexable && f === 'robots.txt') {
      fs.writeFileSync(dest, ROBOTS_NONE);
    } else {
      fs.copyFileSync(path.join(root, f), dest);
    }
  });
  const problems = [].concat(checkHtmlLinks(out, files), checkScriptPages(out, files, !showcase && !configShowcase), checkDataFiles(root, out));
  const notes = showcase ? [] : showcaseMentions(out, files);
  return { files, problems, notes, showcase, indexable };
}

function summary(out, files, res) {
  const sized = files.map((f) => ({ f, size: fs.statSync(path.join(out, f)).size })).sort((a, b) => b.size - a.size || (a.f < b.f ? -1 : 1));
  const total = sized.reduce((n, x) => n + x.size, 0);
  const groups = {};
  sized.forEach((x) => {
    const g = x.f.indexOf('/') === -1 ? (/\.html$/.test(x.f) ? 'pages (*.html)' : 'root files') : x.f.split('/').slice(0, 2).join('/');
    groups[g] = groups[g] || { n: 0, size: 0 };
    groups[g].n++; groups[g].size += x.size;
  });
  const mb = (n) => (n / 1048576).toFixed(2) + ' MB';
  const lines = [];
  lines.push('Built ' + out + (res.showcase ? '  (with the showcase pages: dashboard and style guide)' : '  (shop pages only)') +
    (res.indexable ? '' : '  [noindex: indexable is false]'));
  lines.push('');
  lines.push('  ' + 'Group'.padEnd(18) + 'Files'.padStart(6) + 'Size'.padStart(12));
  Object.keys(groups).sort().forEach((g) => lines.push('  ' + g.padEnd(18) + String(groups[g].n).padStart(6) + mb(groups[g].size).padStart(12)));
  lines.push('  ' + 'TOTAL'.padEnd(18) + String(files.length).padStart(6) + mb(total).padStart(12));
  lines.push('');
  lines.push('  Largest files:');
  sized.slice(0, 5).forEach((x) => lines.push('    ' + mb(x.size).padStart(9) + '  ' + x.f));
  return lines.join('\n');
}

function main(argv, env) {
  let opts;
  try { opts = parseArgs(argv, env || process.env); } catch (e) { console.error('Error: ' + e.message); return 2; }
  let res;
  try { res = build(opts); } catch (e) { console.error('Error: ' + e.message); return 1; }
  if (!opts.quiet) console.log(summary(opts.out, res.files, res));
  if (!opts.quiet && !res.showcase) {
    console.log('\n  Left out on purpose: ' + SHOWCASE_PAGES.join(', ') + ' (showcasePages is not true; add --with-showcase-pages to include).');
    res.notes.forEach((n) => console.log('  note: ' + n + ' (text only, not a link)'));
  }
  if (!opts.quiet && !res.indexable) {
    console.log('\n  indexable is false in config.js: every page got <meta name="robots" content="noindex">,');
    console.log('  robots.txt says "Disallow: /" and sitemap.xml is not shipped. The source files are unchanged.');
  }
  if (opts.zip) {
    const z = makeZip(opts.out);
    if (z && !opts.quiet) console.log('\n  Zip: ' + z);
  }
  if (res.problems.length) {
    console.error('\nPACKAGE FAILED: ' + res.problems.length + ' problem(s):');
    res.problems.forEach((p) => console.error('  - ' + p));
    return 1;
  }
  if (!opts.quiet) console.log('\nOK: every local link and referenced media file exists in the build.');
  return 0;
}

if (require.main === module) process.exitCode = main(process.argv.slice(2), process.env);
module.exports = { main, build, parseArgs, resolveLink };
