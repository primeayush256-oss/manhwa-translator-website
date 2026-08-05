/* =========================================================================
   Manhwa Translator AI — Supabase Google Authentication Module
   Vanilla JS only. Dependencies: Supabase JS CDN (@supabase/supabase-js v2)

   Handles:
     - Persistent session management & Auth state synchronization
     - Google OAuth Sign-in & Sign-out
     - Dynamic Navbar UI (Google Login button vs Profile Dropdown)
     - Mobile Menu Profile UI & Logout
     - Auth Modal for unauthenticated users clicking "Upgrade Monthly/Yearly"
     - Automatic continuation of pending upgrade purchase flow post-login
   ========================================================================= */

(function () {
  'use strict';

  /* ── Config ─────────────────────────────────────────────────────────────── */
  var SUPABASE_URL      = 'https://pjhumtkkqffxuopmxjkc.supabase.co';
  var SUPABASE_ANON_KEY = 'sb_publishable_I_eZATPbggFPlRaarQGoRw_QwXdRdHI';
  var PENDING_PLAN_KEY  = 'pending_upgrade_plan';

  var supabaseClient = null;
  var currentUser    = null;

  /* ── Supabase Initialization ────────────────────────────────────────────── */
  function getSupabase() {
    if (!supabaseClient && window.supabase && window.supabase.createClient) {
      supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storage: window.localStorage
        }
      });
    }
    return supabaseClient;
  }

  function getAuthToken() {
    try {
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

  function extractUser(session) {
    if (!session || !session.user) return null;
    var u = session.user;
    var meta = u.user_metadata || {};
    var name = meta.full_name || meta.name || (u.email ? u.email.split('@')[0] : 'User');
    var avatarUrl = meta.avatar_url || meta.picture || null;

    return {
      id: u.id,
      email: u.email || '',
      name: name,
      avatarUrl: avatarUrl
    };
  }

  /* ── OAuth Sign-in & Sign-out ───────────────────────────────────────────── */
  function signInWithGoogle() {
    var sb = getSupabase();
    if (!sb) {
      alert('Authentication client failed to initialize. Please refresh the page.');
      return;
    }
    /* Redirect back to the exact current page URL after Google OAuth */
    var redirectUrl = window.location.origin + window.location.pathname;

    sb.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl
      }
    }).then(function (res) {
      if (res.error) {
        console.error('[Auth] Google OAuth error:', res.error.message);
        alert('Google Sign-In error: ' + res.error.message);
      }
    }).catch(function (err) {
      console.error('[Auth] OAuth error:', err);
    });
  }

  function signOut() {
    var sb = getSupabase();
    if (sb) {
      sb.auth.signOut().then(function () {
        currentUser = null;
        updateUI(null);
      });
    } else {
      currentUser = null;
      updateUI(null);
    }
  }

  /* ── DOM Injection Helpers ───────────────────────────────────────────────── */
  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  }

  function getAvatarHtml(user, isLarge) {
    var sizeClass = isLarge ? ' lg' : '';
    if (user && user.avatarUrl) {
      return '<img src="' + escapeHtml(user.avatarUrl) + '" class="profile-avatar' + sizeClass + '" alt="' + escapeHtml(user.name) + '" referrerpolicy="no-referrer" />';
    }
    var initial = (user && user.name) ? user.name.charAt(0).toUpperCase() : 'U';
    return '<span class="profile-avatar-initial' + sizeClass + '">' + escapeHtml(initial) + '</span>';
  }

  /* ── Render Navbar & Mobile Panel UI ─────────────────────────────────────── */
  function updateUI(user) {
    currentUser = user;

    /* Desktop navbar updates */
    var navCta = document.querySelector('#siteNav .nav-cta');
    if (navCta) {
      var authContainer = document.getElementById('navAuthContainer');
      if (!authContainer) {
        authContainer = document.createElement('div');
        authContainer.id = 'navAuthContainer';
        /* Insert before the mobile toggle button */
        var toggle = document.getElementById('navToggle');
        if (toggle) {
          navCta.insertBefore(authContainer, toggle);
        } else {
          navCta.appendChild(authContainer);
        }
      }

      if (user) {
        authContainer.innerHTML =
          '<div class="profile-dropdown-wrap" id="profileDropdownWrap">' +
            '<button type="button" class="profile-trigger" id="profileTrigger" aria-expanded="false" aria-haspopup="true" aria-label="User menu">' +
              getAvatarHtml(user, false) +
              '<span class="profile-name">' + escapeHtml(user.name) + '</span>' +
              '<svg class="profile-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>' +
            '</button>' +
            '<div class="profile-dropdown-menu" id="profileDropdownMenu" aria-hidden="true">' +
              '<div class="profile-menu-header">' +
                getAvatarHtml(user, true) +
                '<div class="profile-menu-info">' +
                  '<div class="profile-menu-name">' + escapeHtml(user.name) + '</div>' +
                  '<div class="profile-menu-email">' + escapeHtml(user.email) + '</div>' +
                '</div>' +
              '</div>' +
              '<div class="profile-menu-divider"></div>' +
              '<button type="button" class="profile-menu-item profile-logout-btn" id="logoutBtn">' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>' +
                '<span>Sign out</span>' +
              '</button>' +
            '</div>' +
          '</div>';

        bindDropdownEvents();
      } else {
        authContainer.innerHTML =
          '<button type="button" id="navGoogleLoginBtn" class="btn btn-google">' +
            '<svg class="google-icon" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>' +
            '<span>Continue with Google</span>' +
          '</button>';

        var loginBtn = document.getElementById('navGoogleLoginBtn');
        if (loginBtn) {
          loginBtn.addEventListener('click', signInWithGoogle);
        }
      }
    }

    /* Mobile panel updates */
    var mobilePanelCta = document.querySelector('#mobilePanel .nav-cta');
    if (mobilePanelCta) {
      var mobileAuthContainer = document.getElementById('mobileAuthContainer');
      if (!mobileAuthContainer) {
        mobileAuthContainer = document.createElement('div');
        mobileAuthContainer.id = 'mobileAuthContainer';
        mobileAuthContainer.style.width = '100%';
        mobilePanelCta.appendChild(mobileAuthContainer);
      }

      if (user) {
        mobileAuthContainer.innerHTML =
          '<div class="mobile-auth-card">' +
            '<div class="mobile-auth-info">' +
              getAvatarHtml(user, false) +
              '<div class="mobile-auth-details">' +
                '<span class="mobile-auth-name">' + escapeHtml(user.name) + '</span>' +
                '<span class="mobile-auth-email">' + escapeHtml(user.email) + '</span>' +
              '</div>' +
            '</div>' +
            '<button type="button" class="mobile-logout-btn" id="mobileLogoutBtn" title="Sign out">' +
              '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>' +
            '</button>' +
          '</div>';

        var mobileLogoutBtn = document.getElementById('mobileLogoutBtn');
        if (mobileLogoutBtn) {
          mobileLogoutBtn.addEventListener('click', signOut);
        }
      } else {
        mobileAuthContainer.innerHTML =
          '<button type="button" id="mobileGoogleLoginBtn" class="btn btn-google btn-block">' +
            '<svg class="google-icon" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>' +
            '<span>Continue with Google</span>' +
          '</button>';

        var mobileLoginBtn = document.getElementById('mobileGoogleLoginBtn');
        if (mobileLoginBtn) {
          mobileLoginBtn.addEventListener('click', signInWithGoogle);
        }
      }
    }
  }

  function bindDropdownEvents() {
    var wrap = document.getElementById('profileDropdownWrap');
    var trigger = document.getElementById('profileTrigger');
    var menu = document.getElementById('profileDropdownMenu');
    var logoutBtn = document.getElementById('logoutBtn');

    if (!wrap || !trigger) return;

    function toggleMenu(e) {
      if (e) e.stopPropagation();
      var isOpen = wrap.classList.toggle('is-open');
      trigger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      if (menu) menu.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
    }

    function closeMenu() {
      wrap.classList.remove('is-open');
      trigger.setAttribute('aria-expanded', 'false');
      if (menu) menu.setAttribute('aria-hidden', 'true');
    }

    trigger.addEventListener('click', toggleMenu);

    if (logoutBtn) {
      logoutBtn.addEventListener('click', function () {
        closeMenu();
        signOut();
      });
    }

    /* Close dropdown when clicking outside */
    document.addEventListener('click', function (e) {
      if (wrap.classList.contains('is-open') && !wrap.contains(e.target)) {
        closeMenu();
      }
    });
  }

  /* ── Auth Modal Implementation ─────────────────────────────────────────── */
  function ensureAuthModal() {
    var modal = document.getElementById('authModal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'authModal';
    modal.className = 'auth-modal-overlay';
    modal.setAttribute('aria-hidden', 'true');

    modal.innerHTML =
      '<div class="auth-modal-backdrop" id="authModalBackdrop"></div>' +
      '<div class="auth-modal-card" role="dialog" aria-modal="true" aria-labelledby="authModalTitle">' +
        '<button type="button" class="auth-modal-close" id="authModalClose" aria-label="Close modal">&times;</button>' +
        '<div class="auth-modal-badge">' +
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/></svg>' +
          '<span>Sign In Required</span>' +
        '</div>' +
        '<h3 class="auth-modal-title" id="authModalTitle">Sign in to upgrade to Premium</h3>' +
        '<p class="auth-modal-sub" id="authModalSub">Sign in with Google to start your 14-day free trial and complete your upgrade.</p>' +
        '<button type="button" id="authModalGoogleBtn" class="btn btn-google btn-block" style="padding:14px 20px;font-size:1.02rem;">' +
          '<svg class="google-icon" viewBox="0 0 24 24" style="width:20px;height:20px;"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>' +
          '<span>Continue with Google</span>' +
        '</button>' +
        '<p class="auth-modal-fine">🔒 14-day free trial &bull; No credit card required &bull; Cancel anytime</p>' +
      '</div>';

    document.body.appendChild(modal);

    var closeBtn = document.getElementById('authModalClose');
    var backdrop = document.getElementById('authModalBackdrop');
    var googleBtn = document.getElementById('authModalGoogleBtn');

    if (closeBtn) closeBtn.addEventListener('click', closeAuthModal);
    if (backdrop) backdrop.addEventListener('click', closeAuthModal);
    if (googleBtn) googleBtn.addEventListener('click', function () {
      signInWithGoogle();
    });

    return modal;
  }

  function openAuthModal(planName) {
    var modal = ensureAuthModal();
    if (planName) {
      var subEl = document.getElementById('authModalSub');
      if (subEl) {
        subEl.textContent = 'Sign in with Google to start your 14-day free trial and unlock the ' + planName + ' plan.';
      }
    }
    modal.style.display = 'flex';
    /* Force reflow for animation */
    void modal.offsetWidth;
    modal.classList.add('is-active');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeAuthModal() {
    var modal = document.getElementById('authModal');
    if (!modal) return;
    modal.classList.remove('is-active');
    modal.setAttribute('aria-hidden', 'true');
    setTimeout(function () {
      modal.style.display = 'none';
      document.body.style.overflow = '';
    }, 250);
  }

  /* ── Main Init & Session Sync ────────────────────────────────────────────── */
  function handleSession(session) {
    var user = extractUser(session);
    updateUI(user);

    /* Check for pending upgrade plan saved before Google OAuth login */
    if (user) {
      var pendingPlan = sessionStorage.getItem(PENDING_PLAN_KEY);
      if (pendingPlan) {
        sessionStorage.removeItem(PENDING_PLAN_KEY);
        closeAuthModal();
        /* Automatically continue original purchase flow */
        if (window.ManhwaPricing && typeof window.ManhwaPricing.resumePendingCheckout === 'function') {
          window.ManhwaPricing.resumePendingCheckout(pendingPlan);
        }
      }
    }
  }

  function init() {
    var sb = getSupabase();
    if (!sb) return;

    sb.auth.getSession().then(function (res) {
      var session = res && res.data && res.data.session;
      handleSession(session);
    });

    sb.auth.onAuthStateChange(function (event, session) {
      handleSession(session);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  /* ── Export Public Global API ────────────────────────────────────────────── */
  window.ManhwaAuth = {
    getAuthToken: getAuthToken,
    getUser: function () { return currentUser; },
    signInWithGoogle: signInWithGoogle,
    signOut: signOut,
    openAuthModal: openAuthModal,
    closeAuthModal: closeAuthModal,
    savePendingPlan: function (plan) {
      sessionStorage.setItem(PENDING_PLAN_KEY, plan);
    }
  };

})();
