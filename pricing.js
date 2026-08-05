/* =========================================================================
   Manhwa Translator AI — Pricing button handler
   Intercepts "Upgrade Monthly" and "Upgrade Yearly" clicks on the homepage.
   Calls the create-order Edge Function, then navigates to /checkout with
   the order parameters so checkout.js handles the Razorpay modal.

   This is the ONLY place create-order is called from the website.
   checkout.js is not modified — it already handles everything correctly
   once it receives the URL parameters.
   ========================================================================= */
(function () {
  'use strict';

  /* ── Config ─────────────────────────────────────────────────────────────── */
  var SUPABASE_URL     = 'https://pjhumtkkqffxuopmxjkc.supabase.co';
  var SUPABASE_ANON_KEY = 'sb_publishable_I_eZATPbggFPlRaarQGoRw_QwXdRdHI';
  var CREATE_ORDER_URL  = SUPABASE_URL + '/functions/v1/create-order';
  var CHECKOUT_PATH     = '/checkout';

  /* Plan definitions — amounts match the Edge Function server-side catalogue.
     The server re-validates; these are for display and the URL only. */
  var PLANS = {
    monthly: { id: 'monthly', amountPaise: 9900,  currency: 'INR' },
    yearly:  { id: 'yearly',  amountPaise: 79900, currency: 'INR' }
  };

  /* ── Helpers ─────────────────────────────────────────────────────────────── */

  /* Read the user's Supabase JWT from localStorage (set when they sign in via
     the extension or the website). Used as the Authorization header so the
     Edge Function can identify the caller via auth.uid(). */
  function getAuthToken() {
    try {
      /* Supabase JS client stores the session under this key by default. */
      var raw = localStorage.getItem(
        'sb-' + SUPABASE_URL.replace('https://', '').split('.')[0] + '-auth-token'
      );
      if (raw) {
        var session = JSON.parse(raw);
        return (session && session.access_token) || null;
      }
    } catch (e) { /* ignore */ }
    return null;
  }

  function setButtonState(btn, busy) {
    if (!btn) return;
    if (busy) {
      btn.setAttribute('data-original-text', btn.textContent);
      btn.textContent = 'Preparing checkout…';
      btn.setAttribute('aria-disabled', 'true');
      btn.style.opacity = '0.7';
      btn.style.pointerEvents = 'none';
    } else {
      var orig = btn.getAttribute('data-original-text');
      if (orig) btn.textContent = orig;
      btn.removeAttribute('aria-disabled');
      btn.style.opacity = '';
      btn.style.pointerEvents = '';
    }
  }

  function showInlineError(btn, message) {
    /* Insert a small error message after the button's parent card. */
    var existing = document.getElementById('pricing-inline-error');
    if (existing) existing.remove();

    var err = document.createElement('p');
    err.id        = 'pricing-inline-error';
    err.textContent = message;
    err.style.cssText = [
      'color:#f87171', 'font-size:13px', 'text-align:center',
      'margin-top:10px', 'padding:0 16px'
    ].join(';');

    var card = btn.closest('.price-card') || btn.parentNode;
    if (card) card.appendChild(err);

    setTimeout(function () {
      var el = document.getElementById('pricing-inline-error');
      if (el) el.remove();
    }, 6000);
  }

  /* ── Core: call create-order and navigate to checkout ────────────────────── */
  function startCheckout(plan, btn) {
    var planConfig = PLANS[plan];
    if (!planConfig) return;

    /* Prevent double-click. */
    if (btn && btn.getAttribute('aria-disabled') === 'true') return;

    var token = (window.ManhwaAuth && typeof window.ManhwaAuth.getAuthToken === 'function')
      ? window.ManhwaAuth.getAuthToken()
      : getAuthToken();

    /* If unauthenticated, save pending plan and show Google Login modal */
    if (!token) {
      if (window.ManhwaAuth && typeof window.ManhwaAuth.openAuthModal === 'function') {
        window.ManhwaAuth.savePendingPlan(plan);
        window.ManhwaAuth.openAuthModal(plan === 'yearly' ? 'Yearly' : 'Monthly');
      } else if (btn) {
        showInlineError(btn, 'Please sign in with your Google account first, then try upgrading.');
      }
      return;
    }

    if (btn) setButtonState(btn, true);

    var headers = {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': 'Bearer ' + token
    };

    fetch(CREATE_ORDER_URL, {
      method:  'POST',
      headers: headers,
      body:    JSON.stringify({ planId: planConfig.id })
    })
      .then(function (res) {
        return res.json().then(function (data) {
          if (!res.ok) {
            var msg = data && (data.error || data.message);
            throw new Error(msg || ('Server error ' + res.status));
          }
          return data;
        });
      })
      .then(function (data) {
        /* data = { orderId, amount, currency, keyId } from create-order Edge Function */
        var orderId  = data.orderId  || data.order_id;
        var keyId    = data.keyId    || data.key_id;
        var amount   = data.amount;
        var currency = data.currency || 'INR';

        if (!orderId || !keyId) {
          throw new Error('Incomplete response from payment server. Please try again.');
        }

        /* Build checkout URL — checkout.js reads these params. */
        var params = new URLSearchParams({
          order_id: orderId,
          key_id:   keyId,
          amount:   String(amount),
          currency: currency,
          plan:     planConfig.id
        });
        if (token) {
          params.set('token', token);
        }

        window.location.href = CHECKOUT_PATH + '?' + params.toString();
        /* Button state stays "busy" because we're navigating away. */
      })
      .catch(function (err) {
        if (btn) setButtonState(btn, false);
        var message = (err && err.message) || 'Could not start checkout. Please try again.';

        /* Special case: not signed in. */
        if (message.toLowerCase().includes('unauthorized') ||
            message.toLowerCase().includes('sign in') ||
            message.toLowerCase().includes('401')) {
          if (window.ManhwaAuth && typeof window.ManhwaAuth.openAuthModal === 'function') {
            window.ManhwaAuth.savePendingPlan(plan);
            window.ManhwaAuth.openAuthModal(plan === 'yearly' ? 'Yearly' : 'Monthly');
            return;
          }
          message = 'Please sign in with your Google account first, then try upgrading.';
        }

        if (btn) showInlineError(btn, message);
        console.error('[Pricing] create-order failed:', message);
      });
  }

  /* ── Wire up buttons ─────────────────────────────────────────────────────── */
  function attachHandlers() {
    /* Select all anchor/button elements whose visible text matches the plan
       labels. This is robust to HTML changes — no ID required. */
    var allLinks = document.querySelectorAll('a, button');

    allLinks.forEach(function (el) {
      var text = el.textContent.trim();

      if (text === 'Upgrade Monthly') {
        el.addEventListener('click', function (e) {
          e.preventDefault();        /* stop href="#" scroll-to-top */
          e.stopPropagation();
          startCheckout('monthly', el);
        });
      } else if (text === 'Upgrade Yearly') {
        el.addEventListener('click', function (e) {
          e.preventDefault();
          e.stopPropagation();
          startCheckout('yearly', el);
        });
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attachHandlers);
  } else {
    attachHandlers();
  }

  /* Expose Global API for auth.js auto-resume flow */
  window.ManhwaPricing = {
    startCheckout: startCheckout,
    resumePendingCheckout: function (planId) {
      var allLinks = document.querySelectorAll('a, button');
      var targetBtn = null;
      var targetText = planId === 'yearly' ? 'Upgrade Yearly' : 'Upgrade Monthly';
      allLinks.forEach(function (el) {
        if (el.textContent.trim() === targetText) {
          targetBtn = el;
        }
      });
      startCheckout(planId, targetBtn);
    }
  };

})();
