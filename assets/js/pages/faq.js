/*
 * FAQ page. GROUPS below is the single source of truth: it renders the category
 * rail, the accordions (<details>, the shared .accordion component) and the
 * FAQPage JSON-LD, so the structured data can never drift from what is on screen.
 *
 * Answers are trusted, hand-written HTML templates. Every value they borrow from
 * config (fees, thresholds, the gift code) passes through escapeHtml first.
 */
(function () {
  'use strict';

  var Shop = window.Shop || {};
  var doc = document;
  var esc = Shop.util.escapeHtml;
  var pkr = Shop.util.formatPKR;
  var config = Shop.config || {};

  // a price never breaks between "PKR" and its figure
  function nowrap(html) { return '<span class="faq-nowrap">' + html + '</span>'; }

  function money(key) { return typeof config[key] === 'number' ? nowrap(esc(pkr(config[key]))) : ''; }

  function gift() {
    var g = config.codes && config.codes.GIFT15;
    if (!g || g.type !== 'percent') return null;
    return { pct: esc(g.value + '%'), min: g.min ? nowrap(esc(pkr(g.min))) : '' };
  }

  // A WhatsApp link when a number is configured, else a link to the contact page.
  function wa(text, label, offLabel) {
    if (!Shop.content.hasWhatsapp()) return '<a href="contact.html">' + esc(offLabel) + '</a>';
    return '<a href="' + esc(Shop.content.whatsappHref(text)) + '" target="_blank" rel="noopener">' + esc(label) + '</a>';
  }

  var GROUPS = [
    {
      id: 'faq-authenticity',
      title: 'Authenticity',
      items: [
        {
          q: 'Are your fragrances original?',
          a: function () {
            return '<p>Yes, every one. We buy directly from the four houses we carry, never through resellers or grey-market importers, and every bottle reaches you factory-sealed.</p>' +
              '<p>If a bottle we sold you is ever shown not to be genuine, we refund you in full. That promise has no time limit.</p>';
          }
        },
        {
          q: 'How can I check my bottle when it arrives?',
          a: function () {
            return '<p>Look for unbroken cellophane on the box, an intact seal under the cap, and a batch code that matches on the box and the base of the bottle. You are welcome to check all three with the courier waiting, before you hand over any cash. If the seal is broken, refuse the parcel and we will send another.</p>';
          }
        },
        {
          q: 'Do you sell decants or samples?',
          a: function () {
            return '<p>No. Once a seal is broken we can no longer promise what is inside, so we only sell full bottles exactly as the house filled them. Our 30 ml size is the closest thing to a sample: a complete, sealed bottle at the lowest price in each range, and the size we suggest when you are trying a house for the first time.</p>';
          }
        }
      ]
    },
    {
      id: 'faq-ordering',
      title: 'Ordering & payment',
      items: [
        {
          q: 'How does cash on delivery work?',
          a: function () {
            return '<p>You place your order online without paying anything. Within one working day we get in touch to confirm the bottles, address and total. When the parcel reaches you, check it, then pay the courier the exact amount in cash.</p>' +
              '<p>Please keep the total ready in notes: couriers often carry very little change.</p>';
          }
        },
        {
          q: 'Which size should I choose: 30, 50 or 100 ml?',
          a: function () {
            return '<p>All three sizes hold the same fragrance at the same strength; only the amount changes. At three sprays a day, 30 ml lasts around three months and is ideal for a first try or for travel. 50 ml is the size most people choose. 100 ml costs least per millilitre and suits a signature you already know you love.</p>';
          }
        },
        {
          q: 'Do you gift wrap, and is there a gift code?',
          a: function () {
            var g = gift();
            var wrap = money('giftWrapFee');
            return '<p>Yes. Tick gift wrap next to any bottle in your bag and we pack it in our black gift box, tied with a gold ribbon' +
              (wrap ? ', for a flat ' + wrap + ' per order however many bottles you wrap' : '') + '.</p>' +
              (g ? '<p>Use the code <strong>GIFT15</strong> at checkout for ' + g.pct + ' off' + (g.min ? ' orders of ' + g.min + ' or more' : ' your order') + '.</p>' : '') +
              '<p>If the parcel is going straight to someone else, use the delivery notes at checkout to tell the courier, for example a landmark or the best time to call.</p>';
          }
        },
        {
          q: 'How do I choose a scent I have never smelled?',
          a: function () {
            return '<p>Start with the <a href="scent-quiz.html">scent quiz</a>: five questions about where you will wear it and what you are drawn to, and it ranks the whole collection for you. Our <a href="fragrance-guide.html">fragrance guide</a> explains the families and how long each kind of perfume lasts. Or tell us a fragrance you already like and we will suggest its closest relatives ' + wa('Hello ' + (config.shopName || '') + ', could you help me choose a fragrance?', 'on WhatsApp', 'through our contact page') + '.</p>';
          }
        }
      ]
    },
    {
      id: 'faq-delivery',
      title: 'Delivery',
      items: [
        {
          q: 'Where do you deliver, and how long does it take?',
          a: function () {
            return '<p>Anywhere in Pakistan our courier reaches. Lahore, Karachi, Islamabad and Rawalpindi usually take 2 to 3 working days after dispatch; other cities and towns 3 to 5. The full table is on <a href="shipping-returns.html#shipping">Shipping &amp; returns</a>.</p>';
          }
        },
        {
          q: 'How much is delivery?',
          a: function () {
            var fee = money('deliveryFee');
            var free = money('freeDeliveryThreshold');
            return '<p>' + (free ? 'Delivery is free on orders of ' + free + ' or more. ' : '') +
              (fee ? 'Below that it is a flat ' + fee + ' per order, wherever you are in the country.' : '') + '</p>';
          }
        },
        {
          q: 'How do I track my order?',
          a: function () {
            return '<p>Open <a href="track-order.html">Track your order</a> and enter the order number from your confirmation with the mobile number you used at checkout. You will see whether it is placed, confirmed, dispatched or delivered, and the expected delivery dates.</p>';
          }
        }
      ]
    },
    {
      id: 'faq-returns',
      title: 'Returns & exchanges',
      items: [
        {
          q: 'Can I return a fragrance?',
          a: function () {
            return '<p>Yes, within 7 days of delivery, as long as the bottle is unopened: cellophane and seal intact, in its original box. Message us to start a return and we arrange collection from your door at no cost to you.</p>' +
              '<p>Opened bottles cannot be returned unless they arrived damaged or faulty, because we can no longer sell them as sealed.</p>';
          }
        },
        {
          q: 'Can I exchange a bottle for another fragrance or size?',
          a: function () {
            return '<p>Yes, within the same 7 days and on the same condition that it is unopened. If the new bottle costs more, you pay the difference in cash when it is delivered; if it costs less, we refund the difference.</p>';
          }
        },
        {
          q: 'How do refunds work if I paid cash?',
          a: function () {
            return '<p>We refund by bank transfer or mobile wallet, whichever you prefer, within 5 working days of the returned bottle reaching us. The delivery charge is refunded too if the mistake was ours. Details are under <a href="shipping-returns.html#returns">Returns &amp; exchanges</a>.</p>';
          }
        }
      ]
    },
    {
      id: 'faq-care',
      title: 'Fragrance care',
      items: [
        {
          q: 'How should I store my perfume?',
          a: function () {
            return '<p>Keep it somewhere cool, dark and dry, with the cap on. The original box on a bedroom shelf is ideal. Avoid the bathroom, a sunny windowsill and above all the car: heat and light break down the top notes first, and a bottle left in a summer car can turn in a week.</p>';
          }
        },
        {
          q: 'How can I make a fragrance last longer?',
          a: function () {
            return '<p>Apply to moisturised skin at the pulse points (wrists, neck, inner elbows) and let it dry without rubbing, which crushes the lighter notes. A spray on clothing or a scarf lasts longer still, though test delicate silk first. Oud and woody fragrances naturally last longest; fresh citrus scents fade sooner and are worth reapplying.</p>';
          }
        }
      ]
    }
  ];

  function itemHtml(item, i, gi) {
    var id = 'faq-q-' + gi + '-' + i;
    return '<details class="accordion__item faq-item" id="' + id + '">' +
      '<summary class="accordion__summary">' + esc(item.q) + '</summary>' +
      '<div class="accordion__content faq-answer">' + item.html + '</div>' +
    '</details>';
  }

  function textOf(html) {
    var t = doc.createElement('template');
    // a space after every block so paragraphs and list items never run together
    t.innerHTML = html.replace(/<\/(p|li|div|h[1-6]|ul|ol)>/gi, '$& ');
    return t.content.textContent.replace(/\s+/g, ' ').trim();
  }

  function render() {
    var rail = doc.querySelector('[data-faq-rail]');
    var host = doc.querySelector('[data-faq-groups]');
    if (!rail || !host) return;

    GROUPS.forEach(function (g) { g.items.forEach(function (it) { it.html = it.a(); }); });

    rail.innerHTML = GROUPS.map(function (g) {
      return '<li><a class="faq-rail__link" href="#' + g.id + '"><span class="faq-rail__name">' + esc(g.title) + '</span>' +
        '<span class="faq-rail__count" aria-hidden="true">' + g.items.length + '</span></a></li>';
    }).join('');

    host.innerHTML = GROUPS.map(function (g, gi) {
      return '<section class="faq-group" id="' + g.id + '" aria-labelledby="' + g.id + '-title">' +
        '<h2 class="faq-group__title" id="' + g.id + '-title">' + esc(g.title) + '</h2>' +
        '<div class="accordion faq-group__list">' + g.items.map(function (it, i) { return itemHtml(it, i, gi); }).join('') + '</div>' +
      '</section>';
    }).join('');

    var data = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: []
    };
    GROUPS.forEach(function (g) {
      g.items.forEach(function (it) {
        data.mainEntity.push({
          '@type': 'Question',
          name: it.q,
          acceptedAnswer: { '@type': 'Answer', text: textOf(it.html) }
        });
      });
    });
    var script = doc.createElement('script');
    script.type = 'application/ld+json';
    // "<" escaped so no answer text can ever close the script element
    script.textContent = JSON.stringify(data).replace(/</g, '\\u003c');
    doc.head.appendChild(script);

    initDeepLinks();
  }

  // ------------------------------------------------------------- deep links
  //
  // The groups and questions are rendered by script, so the browser's own
  // load-time fragment scroll can run before they exist or collide with a smooth
  // scroll. Once the content is rendered, fonts have settled and the page has
  // loaded, we jump (instantly, never smoothly) to the target; scroll-margin-top
  // on group titles and summaries keeps it clear of the sticky header. A later
  // hash change to a question (#faq-q-3-0) opens it and scrolls to it as well.

  function reducedMotion() {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
  }

  function currentHash() {
    try { return decodeURIComponent(window.location.hash.slice(1)); } catch (e) { return ''; }
  }

  // The element to bring into view for a hash: a group's title or a question's summary.
  function anchorFor(hash) {
    var el = hash ? doc.getElementById(hash) : null;
    if (!el) return null;
    if (el.matches('details.faq-item')) return { item: el, anchor: el.querySelector('summary') };
    if (el.matches('section.faq-group')) return { item: null, anchor: el.querySelector('.faq-group__title') };
    return null;
  }

  function scrollToAnchor(anchor, smooth) {
    try {
      anchor.scrollIntoView({ block: 'start', behavior: smooth && !reducedMotion() ? 'smooth' : 'instant' });
    } catch (e) {
      anchor.scrollIntoView(true);
    }
  }

  function afterSettled(fn) {
    var loaded = doc.readyState === 'complete'
      ? Promise.resolve()
      : new Promise(function (resolve) { window.addEventListener('load', resolve, { once: true }); });
    var fonts = doc.fonts && doc.fonts.ready ? doc.fonts.ready.catch(function () {}) : Promise.resolve();
    Promise.all([loaded, fonts]).then(function () {
      requestAnimationFrame(function () { requestAnimationFrame(fn); });
    });
  }

  function initDeepLinks() {
    var first = anchorFor(currentHash());
    if (first) {
      if (first.item) first.item.open = true;
      afterSettled(function () {
        var again = anchorFor(currentHash());
        if (again) scrollToAnchor(again.anchor, false);
      });
    }

    window.addEventListener('hashchange', function () {
      var t = anchorFor(currentHash());
      if (!t || !t.item) return; // group links: the native fragment scroll and scroll-margin handle them
      t.item.open = true;
      scrollToAnchor(t.anchor, true);
    });
  }

  Shop.content.page(render);
})();
