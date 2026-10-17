const path = require('path');
const { pathToFileURL } = require('url');

const root = path.resolve(__dirname, '..', '..');

/** file:// URL for <repo-root>/<name>.html */
function pageUrl(name) {
  return pathToFileURL(path.join(root, name + '.html')).href;
}

/**
 * Manifest slots whose generated file has NOT been delivered yet. Empty since
 * Task 17c: every manifest file is on disk, tests/e2e/media.spec.js checks each
 * one (valid JPEG/MP4, shape, size budget) and a 404 for any of them fails tests.
 * Should a slot ever be added before its file exists, list its id here so its
 * placeholder is tolerated until the file arrives.
 */
const KNOWN_MISSING = [];

/**
 * Synthetic files that tests point media at to force a load failure. Any path
 * under assets/img or assets/video whose file name starts with "__missing"
 * (e.g. assets/img/__missing-test.jpg) is a deliberate miss.
 */
const SYNTHETIC_MISSING = /\/assets\/(img|video)\/__missing[^/]*$/;

const KNOWN_MISSING_FILE = KNOWN_MISSING.length ? new RegExp('/assets/img/(' +
  KNOWN_MISSING.map((id) => id.replace(/[-]/g, '\\-')).join('|') + ')\\.jpg$') : null;

const FONT_HOST = /fonts\.googleapis\.com|fonts\.gstatic\.com/;
const MEDIA_URL = /\/assets\/(img|video)\/[^\s'")]+/;

/** true when a failed media URL is one we expect to be missing */
function toleratedMedia(url) {
  const clean = String(url).split(/[?#]/)[0];
  return (!!KNOWN_MISSING_FILE && KNOWN_MISSING_FILE.test(clean)) || SYNTHETIC_MISSING.test(clean);
}

/**
 * Records console errors, page errors and failed requests. Google Fonts
 * failures are ignored. Failed media requests are tolerated ONLY for the
 * KNOWN_MISSING files and synthetic "__missing*" test files: a 404 for any
 * other image or video (a typo, a file the manifest promises) is an error.
 * Returns the live array of messages.
 */
function collectErrors(page) {
  const errors = [];
  const norm = (s) => String(s || '').replace(/\\/g, '/');

  page.on('pageerror', (err) => errors.push('pageerror: ' + err.message));
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = norm(msg.text());
    const loc = norm(msg.location() && msg.location().url);
    if (FONT_HOST.test(loc) || FONT_HOST.test(text)) return;
    // Resource-load failures surface as console errors (with the URL as location).
    const media = MEDIA_URL.test(loc) ? loc : (text.match(MEDIA_URL) || [])[0];
    if (media && toleratedMedia(media)) return;
    if (media && /Failed to load resource/i.test(text)) {
      // the matching requestfailed event records it; avoid a duplicate entry
      return;
    }
    errors.push('console: ' + text);
  });
  page.on('requestfailed', (req) => {
    const url = norm(req.url());
    if (FONT_HOST.test(url)) return;
    if (MEDIA_URL.test(url) && toleratedMedia(url)) return;
    // A clip's range request cancelled by navigation (or by the browser after
    // preload="metadata") is not a missing file.
    const reason = (req.failure() || {}).errorText || '';
    if (MEDIA_URL.test(url) && /ERR_ABORTED/.test(reason)) return;
    errors.push('requestfailed: ' + url + ' ' + reason);
  });
  return errors;
}

/**
 * Serves assets/js/config.js with `overrides` merged into Shop.config, e.g.
 * routeConfig(page, { whatsapp: '923000000000' }). The real file runs first, then
 * the overrides are applied before any other script reads the config. demoBanner
 * also keeps <html class="no-banner"> in step, as config.js itself does.
 * Call before page.goto; it holds for reloads too.
 */
async function routeConfig(page, overrides) {
  const fs = require('fs');
  const src = fs.readFileSync(path.join(root, 'assets', 'js', 'config.js'), 'utf8');
  const patch = '\n;(function (o) {\n' +
    '  Object.assign(window.Shop.config, o);\n' +
    "  if ('demoBanner' in o) document.documentElement.classList.toggle('no-banner', !o.demoBanner);\n" +
    '})(' + JSON.stringify(overrides || {}) + ');\n';
  await page.route(/\/assets\/js\/config\.js$/, (route) =>
    route.fulfill({ status: 200, contentType: 'application/javascript', body: src + patch }));
}

/** A WhatsApp number used only by tests (config.js ships with none). */
const TEST_WHATSAPP = '923000000000';

module.exports = { pageUrl, collectErrors, KNOWN_MISSING, toleratedMedia, root, routeConfig, TEST_WHATSAPP };
