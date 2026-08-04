/* =========================================================================
   Manhwa Translator AI — Site interactions
   Vanilla JS only. No dependencies. Guards every selector so this file
   can be shared safely across index.html, privacy.html, terms.html and
   contact.html even though each page only has a subset of elements.
   ========================================================================= */
(function () {
  'use strict';

  var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Footer year ---------- */
  var yearEl = document.getElementById('year');
  if (yearEl) { yearEl.textContent = new Date().getFullYear(); }

  /* ---------- Sticky nav shadow on scroll ---------- */
  var nav = document.getElementById('siteNav');
  if (nav) {
    var onScroll = function () {
      if (window.scrollY > 8) { nav.classList.add('is-scrolled'); }
      else { nav.classList.remove('is-scrolled'); }
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* ---------- Mobile nav toggle ---------- */
  var navToggle = document.getElementById('navToggle');
  var mobilePanel = document.getElementById('mobilePanel');
  if (navToggle && mobilePanel) {
    navToggle.addEventListener('click', function () {
      var isOpen = mobilePanel.classList.toggle('is-open');
      navToggle.classList.toggle('is-open', isOpen);
      navToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      document.body.style.overflow = isOpen ? 'hidden' : '';
    });
    mobilePanel.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        mobilePanel.classList.remove('is-open');
        navToggle.classList.remove('is-open');
        navToggle.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
      });
    });
  }

  /* ---------- Reveal-on-scroll ---------- */
  var revealEls = document.querySelectorAll('.reveal');
  if (revealEls.length) {
    if (prefersReducedMotion || !('IntersectionObserver' in window)) {
      revealEls.forEach(function (el) { el.classList.add('is-visible'); });
    } else {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            io.unobserve(entry.target);
          }
        });
      }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
      revealEls.forEach(function (el) { io.observe(el); });
    }
  }

  /* ---------- Hero "live scan" loop ---------- */
  var scanPanel = document.getElementById('scanPanel');
  if (scanPanel) {
    var statusLabel = document.getElementById('scanStatusLabel');
    var pills = [
      document.getElementById('pillHi'),
      document.getElementById('pillHinglish'),
      document.getElementById('pillEn')
    ].filter(Boolean);
    var pillIndex = 1; /* Hinglish starts active */

    function setActivePill(i) {
      pills.forEach(function (p, idx) { p.classList.toggle('is-active', idx === i); });
    }

    if (prefersReducedMotion) {
      scanPanel.classList.add('is-translated');
      if (statusLabel) { statusLabel.textContent = 'Translated'; }
    } else {
      var cycle = function () {
        scanPanel.classList.remove('is-translated');
        if (statusLabel) { statusLabel.textContent = 'Scanning…'; }
        setTimeout(function () {
          scanPanel.classList.add('is-translated');
          if (statusLabel) { statusLabel.textContent = 'Translated'; }
          pillIndex = (pillIndex + 1) % pills.length;
          setActivePill(pillIndex);
        }, 1750);
      };
      cycle();
      setInterval(cycle, 4200);
    }
  }

  /* ---------- Screenshot tabs ---------- */
  var shotTabs = document.querySelectorAll('.shots-tab');
  if (shotTabs.length) {
    shotTabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        var targetId = tab.getAttribute('data-target');
        shotTabs.forEach(function (t) {
          t.classList.toggle('is-active', t === tab);
          t.setAttribute('aria-selected', t === tab ? 'true' : 'false');
        });
        document.querySelectorAll('.shot-panel').forEach(function (panel) {
          panel.classList.toggle('is-active', panel.id === targetId);
        });
      });
    });
  }

  /* ---------- FAQ accordion ---------- */
  var faqItems = document.querySelectorAll('.faq-item');
  if (faqItems.length) {
    faqItems.forEach(function (item) {
      var btn = item.querySelector('.faq-q');
      var answer = item.querySelector('.faq-a');
      var setState = function (open) {
        item.classList.toggle('is-open', open);
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
        answer.style.maxHeight = open ? answer.scrollHeight + 'px' : '0px';
      };
      setState(item.classList.contains('is-open'));
      btn.addEventListener('click', function () {
        setState(!item.classList.contains('is-open'));
      });
      window.addEventListener('resize', function () {
        if (item.classList.contains('is-open')) { answer.style.maxHeight = answer.scrollHeight + 'px'; }
      });
    });
  }

  /* ---------- Doc pages: scrollspy for table of contents ---------- */
  var tocLinks = document.querySelectorAll('.doc-toc a');
  if (tocLinks.length && 'IntersectionObserver' in window) {
    var sections = [];
    tocLinks.forEach(function (link) {
      var id = link.getAttribute('href').replace('#', '');
      var section = document.getElementById(id);
      if (section) { sections.push({ link: link, section: section }); }
    });
    var tocObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var match = sections.find(function (s) { return s.section === entry.target; });
        if (match && entry.isIntersecting) {
          tocLinks.forEach(function (l) { l.classList.remove('is-active'); });
          match.link.classList.add('is-active');
        }
      });
    }, { rootMargin: '-20% 0px -70% 0px' });
    sections.forEach(function (s) { tocObserver.observe(s.section); });
  }

  /* ---------- Contact form: open Gmail compose in a new tab, no mailto ---------- */
  var contactForm = document.getElementById('contactForm');
  if (contactForm) {
    var statusEl = document.getElementById('formStatus');
    contactForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = contactForm.elements['name'].value.trim();
      var email = contactForm.elements['email'].value.trim();
      var topic = contactForm.elements['topic'].value;
      var message = contactForm.elements['message'].value.trim();

      if (!name || !email || !message) {
        if (statusEl) { statusEl.textContent = 'Please fill in your name, email, and message.'; statusEl.classList.remove('ok'); }
        return;
      }

      var body = 'Name: ' + name + '\nEmail: ' + email + '\nTopic: ' + topic + '\nMessage: ' + message;

      var gmailUrl = 'https://mail.google.com/mail/?view=cm&fs=1'
        + '&to=' + encodeURIComponent('primeayush256@gmail.com')
        + '&su=' + encodeURIComponent(topic)
        + '&body=' + encodeURIComponent(body);

      window.open(gmailUrl, '_blank', 'noopener');

      if (statusEl) {
        statusEl.textContent = 'Opening Gmail in a new tab with this message pre-filled…';
        statusEl.classList.add('ok');
      }
    });
  }

})();
