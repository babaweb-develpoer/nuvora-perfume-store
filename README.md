# Nuvora: a concept perfume store (portfolio project)

## What this is

A portfolio showcase: a complete dark-luxury online perfume store for Pakistan, designed and built as a **static site** (plain HTML, CSS and vanilla JavaScript, no framework, no build step). Prices are in PKR and payment is cash on delivery. **Nuvora is a fictional shop**, and so are its four perfume houses (Maison Noor, Velluto Nero, Aurelle, Sahara Royale) and every product, review, quote and order. It is a **concept store**: there is no server, so orders and messages are never delivered or paid (see [How orders work](#how-orders-work-on-this-site)). Every page says so in its footer, and every form that asks for personal details repeats it. The contact details are fictional and do nothing: the email uses the reserved `.example` domain, the address is only "Gulberg, Lahore", and there is no WhatsApp number. The site works when opened straight from disk (`file://`) and on any static host, including GitHub Pages.

The 18 pages:

| Shop | Content | Utility |
|---|---|---|
| `index.html` home | `about.html` | `cart.html` |
| `shop.html` search, filters, sort | `contact.html` | `checkout.html` |
| `product.html?id=mn-01` | `faq.html` | `order-confirmation.html` |
| `brands.html` | `shipping-returns.html` | `track-order.html` |
| `scent-quiz.html` | `fragrance-guide.html` | `wishlist.html` |
| | `404.html` | Behind the build: `admin.html` back-office dashboard, `styleguide.html` design system |

## Quick start

Needs nothing installed to view it. Double-click `index.html`, or serve the folder:

```
npx serve .
python -m http.server 8080     # then open http://localhost:8080
```

[Node.js](https://nodejs.org) 18 or newer is needed for `npm run package` and `npm run set-domain`. Only the tests need `npm install` (then `npx playwright install chromium` once).

## Before you publish it (owner checklist)

1. **Set `credit`** in `assets/js/config.js` to your own name and portfolio link, e.g. `credit: { name: 'Your Name', url: 'https://your-site' }`. While it is empty the footer shows no credit at all. The link opens in a new tab with `rel="noopener noreferrer"`.
2. **Optionally set `whatsapp`** (digits only, country code first, no `+`). Leave it empty (the default) and the site shows **no WhatsApp link anywhere**: the floating button, the menu and the footer become "Message us" links to the contact page, and the WhatsApp and call cards on the contact page stay hidden. Do not put a personal number in a public showcase.
3. Run `npm run set-domain -- https://<your-user>.github.io/<repo>` (or your domain), then `npm run package`, and publish `dist/` (see [Deploy](#deploy)).

No real personal information belongs in this project: no real names, emails, phone numbers or street addresses. The testimonials, the back-office customers and the test fixtures use invented names and `example.com` / `.example` addresses only.

## Settings and rebrand

Edit the files in this table, then reload. Most settings live in **`assets/js/config.js`**.

| What to change | File | Field / where |
|---|---|---|
| Shop name | `assets/js/config.js` **and** every `*.html` | `shopName` (`Nuvora`). The name is also written in each page's `<title>`, `og:site_name` and `og:title`, and as fallback text in a few `data-shop-name` spots (about, style guide) that the scripts refill from config: find and replace `Nuvora` across the `*.html` files |
| Tagline | `assets/js/config.js` | `tagline` |
| WhatsApp number | `assets/js/config.js` | `whatsapp`: `''` (default) or digits only, country code first, no `+`. When set it drives the floating button, menu, footer, contact cards, FAQ and returns links, "Confirm on WhatsApp" on the order confirmation and the tracking help link; every one of those is guarded, so an empty value never produces a `wa.me` link |
| Email | `assets/js/config.js` | `email` (`hello@nuvora.example`: `.example` is reserved and never delivers) |
| Address | `assets/js/config.js` | `address` (`Gulberg, Lahore`, no street on purpose) |
| Opening hours | `assets/js/config.js` | `hours` |
| **Concept notice** | `assets/js/config.js` | `conceptNotice`: the one disclosure line. The footer always shows `© <year> Nuvora. <conceptNotice>`, and every `[data-concept-note]` (checkout twice, order confirmation, contact, newsletter, track order) shows the same text. `''` hides it everywhere |
| **Credit** | `assets/js/config.js` | `credit: { name, url }`: footer "Designed and built by <name>." Hidden while `name` is empty; `name` is a link only when `url` is an `http(s)` address |
| **Showcase pages** | `assets/js/config.js` | `showcasePages: true` adds a small "Behind the build" row to the footer linking the dashboard (`admin.html`) and the style guide (`styleguide.html`), and makes `npm run package` keep both. `false` removes the row and leaves them out of `dist/` |
| **Indexable** | `assets/js/config.js` | `indexable: false` (default): `npm run package` adds `<meta name="robots" content="noindex">` to every page in `dist/`, writes `robots.txt` as `Disallow: /` and leaves out `sitemap.xml`, because a fictional store must not show up in search results. The source pages are not changed (only `admin`, `styleguide`, `order-confirmation` and `404` carry noindex there). Set `true` only for a real shop |
| Notice strip | `assets/js/config.js` | `demoBanner` (internal name kept): `false` by default. `true` shows the concept notice in a slim strip above the header on every page; the layout reserves its height either way, so nothing shifts |
| Delivery fee | `assets/js/config.js` | `deliveryFee` (PKR) |
| Free-delivery threshold | `assets/js/config.js` | `freeDeliveryThreshold` (PKR) |
| Gift-wrap fee | `assets/js/config.js` | `giftWrapFee` (PKR, a flat fee per order; the product page shows "+ PKR 300 per order") |
| Discount codes | `assets/js/config.js` | `codes`: `NAME: { type: 'percent', value: 10, min: 0 }`. Only `percent` is supported; `min` is the smallest subtotal. Home, FAQ and shipping pages mention `GIFT15`: if you rename or remove it, edit the text in `shipping-returns.html` (the `GIFT15` chip) too |
| Website address | `assets/js/config.js` + others | `siteUrl`: do not edit by hand, use [`npm run set-domain`](#set-the-real-domain) |
| Colours | `assets/css/tokens.css` | `:root` variables: `--bg`, `--gold`, `--gold-soft`, text and surface colours. Every component uses these |
| Fonts | `assets/css/tokens.css` and every `*.html` | `--font-heading`, `--font-body`, plus the Google Fonts `<link>` in each page's `<head>` (fonts load from Google, so they need internet) |
| Logo / wordmark | `assets/js/ui.js`, `assets/img/favicon.svg` | The logo is the shop name as styled text (`.wordmark`, built from `shopName`; "NUVORA" fits the phone header at 320 px). For an image logo change the three `wordmark` lines in `ui.js` (header, menu, footer). Replace `favicon.svg` for the browser-tab icon |
| Products | `assets/js/products.js` | see below |

### Products

Each product is one `p(...)` call in `assets/js/products.js`:

```js
p('mn-01', 'Oud Royale', 'Maison Noor', 'unisex', 'oud',
  { top: [...], heart: [...], base: [...] },       // notes
  'Two or three sentences of description.',
  [7800, 12400, 21500],                            // PKR for 30 / 50 / 100 ml
  24, 4.8, 212,                                    // stock, rating, review count
  ['bestseller', 'gift'],                          // tags
  '2026-01-22')                                    // createdAt
```

- `gender`: `men`, `women` or `unisex`. `family`: `oud`, `woody`, `floral` or `fresh` (the scent families the filters and quiz use). The `bestseller` tag picks the products the home page shows as bestsellers; the `gift` tag feeds the home "Gifts" tile and "Shop gifts" link (`shop.html?q=gift`); tags are also searchable in the shop.
- **Add a product:** add the `p(...)` line with a new unique `id` (`xx-04` style); add `[id, name, house, 'bottle description']` to the `products` list at the top of `assets/js/media-manifest.js` (this creates the image slot `product-<id>`); put the photo at **`assets/img/product-<id>.jpg`, square (1:1)**; add its `<url>` to `sitemap.xml`. Shop, filters, cards, product page, quiz and its structured data update by themselves.
- **Remove a product:** delete its `p(...)` line, its manifest entry and its image, and its sitemap `<url>`.
- Houses: the shop filters and cards follow the data, but house names and stories are also written by hand in `brands.html` (one section per house) and in `HOUSE_STORY` in `assets/js/pages/home.js`. Edit those when you change houses.
- Stock is respected everywhere: the product page, quick add on cards and the bag's + / − buttons never go past `min(stock, 20)` of one bottle.
- `npm run package` fails if a product image or manifest file is missing, so a forgotten photo is caught before deploy.
- The unit tests expect exactly 12 products, 4 houses and 3 per house (`tests/unit/products.test.js` and others). After changing the catalogue, update those tests or delete them.

### Invented copy

All of it is fiction written for the concept: the about story, the FAQ and shipping policies (cities, courier, the 1 to 2 working days to dispatch plus 2 to 5 after dispatch, refunds, the 7-day return window), the three testimonials on the home page, the star ratings and review counts in `products.js`, and the back office's generated order history (`assets/js/admin-data.js`). The expected-delivery dates on the confirmation and tracking pages follow the same rule: 3 to 7 working days after the order, Monday to Saturday (Sundays are skipped, so a date never lands on one).

The storage key `maison_demo_v1` in `assets/js/store.js` is internal and never shown; renaming it is optional (saved carts and orders restart).

## Media

All 40 files are real and in place (32 images, 4 videos, 4 video posters). Images go in `assets/img/` and videos in `assets/video/`, as **JPG / MP4 with the exact file name** listed in `assets/js/media-manifest.js`. That file also holds each image's alt text and shape. Shapes below are what ships; other pixel sizes of the same shape are fine.

| Files | Shape | Shipped size |
|---|---|---|
| `hero-1.jpg`, `hero-2.jpg`, `banner-1` to `banner-4.jpg` | 16:9 | 2000 x 1116 |
| `product-<id>.jpg` (12 products) | 1:1 | 1600 x 1600 |
| `cat-men`, `cat-women`, `cat-unisex-oud`, `cat-gift`, `lifestyle-1` to `-4`, `gift-1`, `gift-2` (`.jpg`) | 3:4 | 1194 x 1600 |
| `about-1` to `about-3.jpg` | 4:3 | 1600 x 1194 |
| `og.jpg` (link preview card) | 1.91:1 | 1200 x 630 |
| `poster-<video>.jpg` (4) | 16:9 | 1280 x 720 |
| `hero-video`, `scent-video`, `about-video`, `gift-video` (`.mp4`) | 16:9, about 8 s, no sound | under 3 MB each |

Tests enforce a size budget (images under 600 KB, videos under 3 MB), so keep new files small. The home page preloads `hero-1.jpg`, its largest paint; if you replace the hero still under another name, update the `<link rel="preload">` in `index.html` too.

**Replace one image:** save the new JPG over the old file with the same name, then hard-refresh (Ctrl+F5). If its shape changed, update `aspect` in `media-manifest.js`; update `alt` if the picture's content changed. **Replace a video:** same, and re-export its poster. The shipped posters are the frame at 0.4 s, past any fade-in from black (only the about-video poster, re-exported after its blur fix, is the first frame; see the Delivery notes in `docs/media-prompts.md`):

```
ffmpeg -y -ss 0.4 -i assets/video/hero-video.mp4 -frames:v 1 -q:v 3 assets/img/poster-hero-video.jpg
```

Prompts for every image and video, cropping, resizing and compression commands (ffmpeg) are in **`docs/media-prompts.md`** (its "Delivery notes" section describes the shapes actually shipped). Do not put real brand names or logos in the pictures.

## Set the real domain

`sitemap.xml`, `robots.txt`, `siteUrl` in `config.js` and every page's `og:image` use the placeholder `https://example.com/`. Link previews (and search engines, for a real shop) need the real address. Once you know it:

```
npm run set-domain -- https://yourname.github.io/nuvora
```

It rewrites those places (sitemap dates are set to today), removes the "Placeholder origin ... run set-domain" notes from the top of `robots.txt` and `sitemap.xml`, and leaves relative links alone. Add `--dry-run` to preview. It checks the address is `https://`, adds the trailing slash, and **refuses** (exit 1) if that address is already set, so running it twice never changes anything. For a GitHub project page use the full address including the repository name. Run it **before** `npm run package`.

## Deploy

First build the deployable folder:

```
npm run package                              # creates dist/ (summary + link check); follows config.js
npm run package -- --zip                     # also writes dist.zip (best effort)
npm run package -- --with-showcase-pages     # keep admin.html + styleguide.html even if showcasePages is false
npm run package -- --without-showcase-pages  # leave them out (fails while showcasePages is true)
```

`dist/` holds only the pages, `assets/`, `robots.txt`, `sitemap.xml` and (if you add them to the project folder) `CNAME` / `.nojekyll`. Tests, docs and tools are never copied. What else happens follows `config.js`:

- `showcasePages: true` (default): `admin.html`, `styleguide.html` and the scripts only they use are kept, because every footer links them. The build **fails** if they would be left out (`--without-showcase-pages`, or a page missing). With `false` they are left out, and the footer list in `ui.js` (gated by the same flag) is not treated as a broken link.
- `indexable: false` (default): every page in `dist/` gets `<meta name="robots" content="noindex">`, `robots.txt` becomes `User-agent: * / Disallow: /`, and `sitemap.xml` is not shipped.

The command exits with an error if a link or a referenced image is broken.

**GitHub Pages:** the pages use relative paths only, so the site works under a project address like `https://name.github.io/repo/`. Publish the **contents of `dist/`**, not the project root, so `docs/`, tests and tools are not public: copy the files inside `dist/` into a repository (or a `gh-pages` branch) and choose Settings, Pages, "Deploy from a branch" (or publish `dist/` with a Pages workflow). Add an empty `.nojekyll` file to the project folder before packaging so GitHub serves the files untouched. `404.html` at the top level is served for unknown addresses. For a custom domain add a one-line `CNAME` file (just the domain) to the project folder before packaging, and set the domain in Settings, Pages. GitHub Pages ignores `netlify.toml`, so its cache and security headers do not apply there. A mistyped address nested two folders deep (`/a/b`) shows the 404 text without styling, because paths are relative (so `file://` works too).

**Netlify, drag and drop:** open [app.netlify.com/drop](https://app.netlify.com/drop) and drop the `dist` folder. The site works. `netlify.toml` is not read by drag and drop, so the cache and security headers are not applied this way.

**Netlify with Git:** "Add new site, Import from Git". `netlify.toml` already sets build command `npm run package` (which follows `config.js` as above) and publish folder `dist`, plus cache and security headers (`X-Frame-Options: SAMEORIGIN`, no Content-Security-Policy because of inline structured data and Google Fonts). `404.html` is used automatically for unknown addresses.

**Any static host:** upload the contents of `dist/` (or unzip `dist.zip`) to the web root. No server settings are required.

## How orders work on this site

- Orders, the cart, wishlist, reviews and the discount code are saved **only in the visitor's browser** (`localStorage`). Nothing is sent to a server, and no email or message goes out. The contact form and the newsletter validate, say thank you, and keep nothing.
- The order confirmation shows the order number, the expected delivery dates and the cash-on-delivery total, with the concept notice under the order number. With a WhatsApp number configured it also offers "Confirm on WhatsApp", a message the visitor would send themselves.
- Track order and the back office read the same browser data, so an order only shows up on the device and browser that placed it. Clearing site data erases it.
- If storage is blocked the shop still works for that visit (in memory only).

## Upgrade path to a real store

All data access goes through `assets/js/store.js`; no page touches `localStorage` directly. To make it a live shop, replace its functions with calls to a backend and keep the same function names, so the pages need few changes.

- **Backend options:** a hosted commerce platform with an API (fastest), a headless store backend, or a small custom API (Node, Python or PHP) with a database.
- **Payments:** JazzCash, Easypaisa and card gateways all need a backend to create payments and confirm them safely; never put merchant secrets in these static files. Cash on delivery can stay as an option.
- **Notifications:** send order emails and SMS/WhatsApp messages from the backend when an order is placed or its status changes.
- **Admin:** a real admin needs a login, roles and server-side checks. The showcase `admin.html` has none.
- **Inventory:** stock in `products.js` is static; a real store reads and reduces stock on the server per order.
- Then set `conceptNotice: ''`, real contact details and `indexable: true`.

### Not built

Real payments, user accounts, a database, email sending, real inventory sync, multi-language, and a real admin login.

## Testing

```
npm install
npx playwright install chromium     # once
npm run test:unit                   # Node unit tests (pricing, store, products, quiz, config, tools...)
npm run test:e2e                    # Playwright browser tests (same as: npx playwright test)
```

- **Unit** (`tests/unit/`): money maths and discount codes, the store, catalogue and quiz scoring, delivery dates, media manifest, config, and the `package` and `set-domain` tools (run against a temporary copy).
- **E2E** (`tests/e2e/`): every page walked through in Chromium over `file://` at phone, tablet and desktop widths: shop filters, product, cart, checkout, order tracking, quiz, wishlist, back office; accessibility basics, SEO tags, sitemap and robots, console errors, links.
- `portfolio.spec.js` fails if any page's visible text (static HTML, and every page rendered at rest) says "demo", "illustrative" or `example.com`, or if any `wa.me` link exists without a WhatsApp number; it also checks the footer notice, credit and "Behind the build" row, the concept notes by every form, and that the wordmark clears the header icons at 320, 360 and 375 px. Specs that need WhatsApp inject a test number with `routeConfig()` from `tests/e2e/helpers.js`.
- `cls.spec.js` fails if any page shifts its layout by more than 0.05 (Cumulative Layout Shift), with the notice strip off (default) and on.
- `media.spec.js` checks every manifest file exists, is a real JPEG/MP4 of the right shape and within the size budget; `media-usage.spec.js` fails if a media slot is not used on any page.
- `dist.spec.js` builds the package into a temporary folder and opens key pages from it.
- **Fonts are blocked in tests** (`playwright.config.js` makes the Google Fonts hosts unreachable) so no test depends on the network; pages render with fallback fonts there.

## Project structure

```
index.html ... 404.html     the 18 pages (flat, one file each)
assets/
  css/   tokens.css (colours, fonts), base.css, components.css, pages.css
  js/    config.js, products.js, media-manifest.js, store.js, ui.js, pricing.js,
         catalogue.js, quiz.js, seo.js, util.js, admin-data.js, pages/*.js (one per page)
  img/   all pictures and posters      video/  the four clips
robots.txt, sitemap.xml     search engine files (set by npm run set-domain)
netlify.toml                Netlify build + headers
tools/                      package.js, set-domain.js
tests/                      unit/ and e2e/
docs/                       media-prompts.md, page-template.html, spec and plan
dist/                       build output (not in git)
```

## Known limitations

- Every absolute address points at `https://example.com/` until you run `npm run set-domain` (only `og:image`, `siteUrl` and the robots/sitemap files use it; nothing visible does).
- All media files are delivered and **AI-generated**. In `about-video.mp4` a blur mask hides a generated label on a glass tube; re-rendering that clip later is optional.
- **The back office has no login.** It is a showcase screen over this browser's orders and a generated sales history; never use `admin.html` as a real admin. Both it and the style guide are noindex, and `robots.txt` lists them under Disallow.
- The shop name is also written into every page's HTML (titles, Open Graph).
- Fonts load from Google Fonts (internet needed for the intended typefaces).
- `netlify.toml` headers apply to Netlify Git deploys only; this has not been tested on a live Netlify site.
