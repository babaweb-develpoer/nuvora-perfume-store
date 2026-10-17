#!/usr/bin/env node
/*
 * set-domain: swap the placeholder origin for the shop's real domain.
 *
 *   npm run set-domain -- https://yourshop.pk
 *   npm run set-domain -- https://yourshop.pk --dry-run
 *
 * The current origin is read from `siteUrl` in assets/js/config.js (it ships as
 * https://example.com/). Every occurrence of it is rewritten in:
 *   - assets/js/config.js   (siteUrl)
 *   - sitemap.xml           (every <loc>; every <lastmod> is set to today)
 *   - robots.txt            (Sitemap: line)
 * and the "Placeholder origin ... example.com" notes at the top of sitemap.xml and
 * robots.txt are removed, so the public files carry no developer reminder.
 *   - every top-level *.html (og:image and any other absolute URL on that origin)
 * Relative paths and every other URL are left alone. No dependencies.
 *
 * Options: --dry-run (print only), --root <dir> (project folder; default: this repo).
 * Exit codes: 0 done / dry run, 1 refused or a problem, 2 bad usage.
 */
'use strict';

const fs = require('fs');
const path = require('path');

function parseArgs(argv) {
  const out = { url: null, dryRun: false, root: path.resolve(__dirname, '..') };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') out.dryRun = true;
    else if (a === '--root') out.root = path.resolve(argv[++i] || '');
    else if (a.startsWith('--')) throw new Error('Unknown option: ' + a);
    else if (out.url === null) out.url = a;
    else throw new Error('Unexpected extra argument: ' + a);
  }
  return out;
}

/** Validates and normalises the target to "https://host[/path]/" or throws. */
function normaliseUrl(input) {
  let u;
  try { u = new URL(String(input)); } catch (e) { throw new Error('"' + input + '" is not a valid URL. Example: https://yourshop.pk'); }
  if (u.protocol !== 'https:') throw new Error('The URL must start with https:// (got "' + input + '").');
  if (!u.hostname || u.hostname.indexOf('.') === -1) throw new Error('The URL needs a real domain name, e.g. https://yourshop.pk (got "' + input + '").');
  if (u.search || u.hash) throw new Error('Leave off any ?query or #fragment: use just the site address, e.g. https://yourshop.pk');
  if (u.username || u.password) throw new Error('The URL must not contain a username or password.');
  return u.origin + u.pathname.replace(/\/*$/, '/');
}

function escapeRegExp(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function today() {
  const d = new Date();
  const p = (n) => (n < 10 ? '0' : '') + n;
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

function readCurrentUrl(root) {
  const file = path.join(root, 'assets', 'js', 'config.js');
  if (!fs.existsSync(file)) throw new Error('Cannot find assets/js/config.js under ' + root);
  const m = fs.readFileSync(file, 'utf8').match(/siteUrl:\s*(['"])(https?:\/\/[^'"]+)\1/);
  if (!m) throw new Error("Cannot find siteUrl: '...' in assets/js/config.js");
  return m[2].replace(/\/*$/, '/');
}

function targetFiles(root) {
  const files = [];
  const add = (rel) => { if (fs.existsSync(path.join(root, rel))) files.push(rel); };
  add('assets/js/config.js');
  add('sitemap.xml');
  add('robots.txt');
  fs.readdirSync(root).filter((f) => /\.html$/i.test(f)).sort().forEach((f) => files.push(f));
  return files;
}

/** Returns { changed: [{file, count, lastmod}], total } and writes unless dryRun. */
function run(root, newUrl, dryRun) {
  const current = readCurrentUrl(root);
  if (newUrl === current) {
    const err = new Error('siteUrl is already ' + current + '. Nothing changed.');
    err.refused = true;
    throw err;
  }
  const oldOrigin = current.replace(/\/+$/, '');
  const newOrigin = newUrl.replace(/\/+$/, '');
  // The old origin followed by anything that would make it a different host or user.
  const re = new RegExp(escapeRegExp(oldOrigin) + '(?![\\w.@-])', 'g');
  const day = today();
  const changed = [];
  let total = 0;
  for (const rel of targetFiles(root)) {
    const full = path.join(root, rel);
    const before = fs.readFileSync(full, 'utf8');
    let count = 0;
    let after = before.replace(re, () => { count++; return newOrigin; });
    let lastmod = 0;
    if (rel === 'sitemap.xml') {
      after = after.replace(/<lastmod>[^<]*<\/lastmod>/g, () => { lastmod++; return '<lastmod>' + day + '</lastmod>'; });
    }
    // The "Placeholder origin ... example.com, run set-domain" notes are for the
    // developer only: once a real address is in, the public files lose them.
    if (rel === 'sitemap.xml') after = after.replace(/[ \t]*<!--(?:(?!-->)[\s\S])*Placeholder origin[\s\S]*?-->[ \t]*\r?\n?/g, '');
    if (rel === 'robots.txt') after = after.replace(/^# Placeholder origin.*\r?\n(?:#.*\r?\n)*/m, '');
    if (after !== before) {
      if (!dryRun) fs.writeFileSync(full, after);
      changed.push({ file: rel, count, lastmod });
      total += count;
    }
  }
  return { from: current, to: newUrl, changed, total, day };
}

function main(argv) {
  let args;
  try { args = parseArgs(argv); } catch (e) { console.error('Error: ' + e.message); return 2; }
  if (!args.url) {
    console.error('Usage: npm run set-domain -- https://yourshop.pk [--dry-run]');
    return 2;
  }
  let target;
  try { target = normaliseUrl(args.url); } catch (e) { console.error('Error: ' + e.message); return 2; }
  let res;
  try { res = run(args.root, target, args.dryRun); } catch (e) {
    console.error((e.refused ? 'Refused: ' : 'Error: ') + e.message);
    return 1;
  }
  console.log((args.dryRun ? 'DRY RUN (nothing written): ' : '') + res.from + '  ->  ' + res.to);
  res.changed.forEach((c) => {
    const parts = [];
    if (c.count) parts.push(c.count + ' URL' + (c.count === 1 ? '' : 's'));
    if (c.lastmod) parts.push(c.lastmod + ' lastmod set to ' + res.day);
    console.log('  ' + (args.dryRun ? 'would change ' : 'changed ') + c.file + ' (' + parts.join(', ') + ')');
  });
  console.log(res.changed.length + ' file(s), ' + res.total + ' URL(s) ' + (args.dryRun ? 'would be rewritten.' : 'rewritten.'));
  if (!args.dryRun) console.log('Next: run "npm run package" and deploy the dist folder.');
  return 0;
}

if (require.main === module) process.exitCode = main(process.argv.slice(2));
module.exports = { normaliseUrl, readCurrentUrl, run, main };
