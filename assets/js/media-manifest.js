/*
 * Media manifest: every image/video slot used by the site, keyed by slot id.
 * Slot ids are a binding contract (ui.js and every page look media up by id).
 * Entry shape: { file, alt, kind: 'image' | 'video', aspect, poster? }
 * - 32 generated images (hero, products, categories, lifestyle, about, banners, gift, og)
 * - 4 videos (assets/video/<id>.mp4)
 * - 4 poster images (poster: true) exported as frames from each video, NOT generated
 * Prompts for every generated file live in docs/media-prompts.md.
 */
(function () {
  var IMG = 'assets/img/';
  var VID = 'assets/video/';

  function img(id, alt, aspect) { return { file: IMG + id + '.jpg', alt: alt, kind: 'image', aspect: aspect }; }
  function vid(id, alt) { return { file: VID + id + '.mp4', alt: alt, kind: 'video', aspect: '16:9' }; }
  function poster(videoId, alt) {
    return { file: IMG + 'poster-' + videoId + '.jpg', alt: alt, kind: 'image', aspect: '16:9', poster: true };
  }

  var products = [
    ['mn-01', 'Oud Royale', 'Maison Noor', 'deep amber glass bottle with a polished gold cap'],
    ['mn-02', 'Amber Nights', 'Maison Noor', 'deep amber glass bottle with a polished gold cap'],
    ['mn-03', 'Rose Oud', 'Maison Noor', 'deep amber glass bottle with a polished gold cap'],
    ['vn-01', 'Black Leather', 'Velluto Nero', 'matte black bottle with a brushed gold collar'],
    ['vn-02', 'Cedar & Smoke', 'Velluto Nero', 'matte black bottle with a brushed gold collar'],
    ['vn-03', 'Midnight Vetiver', 'Velluto Nero', 'matte black bottle with a brushed gold collar'],
    ['au-01', 'Rose Eternelle', 'Aurelle', 'clear faceted glass bottle with blush-pink liquid and a rose-gold ring'],
    ['au-02', 'Jasmine Silk', 'Aurelle', 'clear faceted glass bottle with blush-pink liquid and a rose-gold ring'],
    ['au-03', 'Peony Blush', 'Aurelle', 'clear faceted glass bottle with blush-pink liquid and a rose-gold ring'],
    ['sr-01', 'Citrus Dune', 'Sahara Royale', 'pale teal glass bottle with a brushed silver cap'],
    ['sr-02', 'Aqua Oasis', 'Sahara Royale', 'pale teal glass bottle with a brushed silver cap'],
    ['sr-03', 'Bergamot Breeze', 'Sahara Royale', 'pale teal glass bottle with a brushed silver cap'],
  ];

  var manifest = {
    // Hero (16:9)
    'hero-1': img('hero-1', 'Four luxury perfume bottles arranged on black marble under warm gold light', '16:9'),
    'hero-2': img('hero-2', 'An amber perfume bottle on a brass tray with drifting oud smoke and rose petals', '16:9'),

    // Videos (16:9, 8s loops) and their exported poster frames
    'hero-video': vid('hero-video', 'Slow orbit around a gold-capped perfume bottle on black marble with drifting smoke'),
    'scent-video': vid('scent-video', 'Scent story: oud wood, rose petals, saffron and amber resin drifting through warm light'),
    'about-video': vid('about-video', 'Ambient atelier scene with glass vials, brass tools and soft smoke in candlelight'),
    'gift-video': vid('gift-video', 'Hands lifting a perfume bottle from an open black gift box with a gold ribbon, then setting it back in satin'),
    'poster-hero-video': poster('hero-video', 'Gold-capped perfume bottle on black marble with drifting smoke'),
    'poster-scent-video': poster('scent-video', 'Oud wood, rose petals and amber resin in warm light'),
    'poster-about-video': poster('about-video', 'Perfumer\'s atelier with glass vials and brass tools in candlelight'),
    'poster-gift-video': poster('gift-video', 'Open black gift box with a gold ribbon and a perfume bottle resting in ivory satin'),

    // Categories (3:4: delivered 1493x2000)
    'cat-men': img('cat-men', 'Matte black perfume bottle beside dark leather and cedar wood', '3:4'),
    'cat-women': img('cat-women', 'Faceted glass perfume bottle with blush-pink liquid among rose petals on silk', '3:4'),
    'cat-unisex-oud': img('cat-unisex-oud', 'Amber perfume bottle with oud wood chips and curling incense smoke', '3:4'),
    'cat-gift': img('cat-gift', 'Black gift box with a gold ribbon holding a perfume bottle', '3:4'),

    // Lifestyle (3:4: delivered 1493x2000)
    'lifestyle-1': img('lifestyle-1', 'A hand lifting an amber perfume bottle from a brass tray on a marble vanity', '3:4'),
    'lifestyle-2': img('lifestyle-2', 'Perfume bottle in a Mughal arch shadow with draped ivory silk', '3:4'),
    'lifestyle-3': img('lifestyle-3', 'A wrist being scented beside rose petals and a gold bangle', '3:4'),
    'lifestyle-4': img('lifestyle-4', 'Teal perfume bottle on a sunlit sandstone ledge with jasmine', '3:4'),

    // About (4:3: delivered 2000x1493)
    'about-1': img('about-1', 'Perfumer\'s hands measuring oils from glass vials on a brass scale', '4:3'),
    'about-2': img('about-2', 'Raw ingredients: oud wood, saffron threads, rose petals and amber resin', '4:3'),
    'about-3': img('about-3', 'Rows of perfume bottles on dark shelves in a softly lit boutique', '4:3'),

    // Banners (16:9: delivered 2000x1116; the site crops them with object-fit: cover)
    'banner-1': img('banner-1', 'Wide view of perfume bottles in a row on black marble with a gold horizon glow', '16:9'),
    'banner-2': img('banner-2', 'Oud smoke curling across a dark backdrop beside an amber perfume bottle', '16:9'),
    'banner-3': img('banner-3', 'Rose petals and silk ribbon scattered around black gift boxes', '16:9'),
    'banner-4': img('banner-4', 'Pale teal perfume bottle with citrus slices and sand ripples in cool light', '16:9'),

    // Gift (3:4: delivered 1493x2000)
    'gift-1': img('gift-1', 'Open black gift box with a perfume bottle nestled in ivory satin', '3:4'),
    'gift-2': img('gift-2', 'Hands tying a gold ribbon around a black gift box on a brass tray', '3:4'),

    // Open Graph (1.91:1)
    'og': img('og', 'Luxury perfume bottles on black marble with warm gold rim light', '1.91:1'),
  };

  products.forEach(function (p) {
    manifest['product-' + p[0]] = img('product-' + p[0], p[1] + ' by ' + p[2] + ', ' + p[3], '1:1');
  });

  var api = manifest;
  if (typeof module !== 'undefined') module.exports = api;
  else { window.Shop = window.Shop || {}; window.Shop.media = api; }
})();
