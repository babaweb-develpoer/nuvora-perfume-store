/*
 * Site-level structured data (Organization + WebSite JSON-LD), built from
 * Shop.config with JSON.stringify so nothing is hand-escaped. Loaded on the home
 * page only; product and FAQ pages write their own Product / FAQPage blocks.
 * Classic script: window.Shop.seo.
 */
(function () {
  'use strict';

  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  var Shop = window.Shop = window.Shop || {};

  function siteData(c) {
    c = c || Shop.config || {};
    var url = String(c.siteUrl || '');
    var org = {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: c.shopName || '',
      url: url,
      logo: url + 'assets/img/favicon.svg'
    };
    if (c.email) org.email = c.email;
    if (c.whatsapp) org.telephone = '+' + String(c.whatsapp).replace(/\D/g, '');
    if (c.address) org.address = { '@type': 'PostalAddress', streetAddress: c.address, addressCountry: 'PK' };
    var site = {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: c.shopName || '',
      url: url,
      potentialAction: {
        '@type': 'SearchAction',
        target: { '@type': 'EntryPoint', urlTemplate: url + 'shop.html?q={search_term_string}' },
        'query-input': 'required name=search_term_string'
      }
    };
    return [org, site];
  }

  function inject() {
    siteData().forEach(function (block) {
      var s = document.createElement('script');
      s.type = 'application/ld+json';
      s.textContent = JSON.stringify(block).replace(/</g, '\\u003c'); // the six characters \u003c, which JSON reads back as <
      document.head.appendChild(s);
    });
  }

  Shop.seo = { siteData: siteData, inject: inject };
  inject();
})();
