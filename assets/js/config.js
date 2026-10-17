(function () {
  'use strict';

  var api = {
    shopName: 'Nuvora',
    // Placeholder origin for absolute URLs (JSON-LD, sitemap.xml, robots.txt): replace before launch.
    siteUrl: 'https://babaweb-develpoer.github.io/nuvora-perfume-store/',
    tagline: 'Rare essences, poured into quiet luxury.',
    currency: 'PKR',
    // Digits only, country code first, no "+" (for example 92 then the mobile number).
    // Empty: the site shows no WhatsApp links at all; the floating button and the
    // menu/footer entries become "Message us" links to contact.html instead.
    whatsapp: '',
    // Fictional and deliberately non-functional: .example is a reserved domain.
    email: 'hello@nuvora.example',
    address: 'Gulberg, Lahore',
    hours: 'Mon–Sat, 11:00–20:00 PKT',
    // One-line disclosure shown in the footer on every page and next to every form
    // that takes personal details ([data-concept-note]). Empty hides it everywhere.
    conceptNotice: 'Concept store: orders and messages are not delivered.',
    // Optional footer credit: "Designed and built by <name>". Hidden while name is
    // empty; name is a link only when url is set.
    credit: { name: '', url: '' },
    // true: the footer shows a small "Behind the build" row linking the dashboard
    // (admin.html) and style guide (styleguide.html), and `npm run package` keeps
    // those pages. false: both are left out of the footer and of dist/.
    showcasePages: true,
    // false: `npm run package` adds <meta name="robots" content="noindex"> to every
    // page in dist/ and makes robots.txt "Disallow: /", so this fictional store never
    // shows up in search results. Set it to true only for a real shop.
    indexable: false,
    // LAUNCH SWITCH for the slim notice strip above the header (the concept notice
    // above, on every page). Off by default: the footer already carries the notice.
    // The layout follows by itself: when this is false, the bottom of this file tags
    // <html class="no-banner">, and the CSS shell reservation (components.css) then
    // drops the strip's height, so nothing shifts and no blank band shows.
    demoBanner: false,
    freeDeliveryThreshold: 8000,
    deliveryFee: 250,
    giftWrapFee: 300,
    codes: {
      WELCOME10: { type: 'percent', value: 10, min: 0 },
      GIFT15: { type: 'percent', value: 15, min: 10000 }
    }
  };

  // Tell the stylesheet as early as config is known (this file loads synchronously, before
  // ui.js) that there will be no banner, so the reserved space is the header alone.
  if (!api.demoBanner && typeof document !== 'undefined' && document.documentElement) {
    document.documentElement.classList.add('no-banner');
  }

  if (typeof module !== 'undefined') module.exports = api;
  else { window.Shop = window.Shop || {}; window.Shop.config = api; }
})();
