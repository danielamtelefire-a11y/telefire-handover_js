/* ============================================================
   TELEFIRE THEME & SHARED STATE - SHARED MODULE
   Used by: index.html, form1, form2, form3

   Responsibilities:
   1. Dark mode toggle (persisted in localStorage)
   2. Shared form fields across pages (sessionStorage)
   3. Form submission status tracking (sessionStorage)
   4. Toast notifications
   ============================================================ */

(function(window) {
  'use strict';

  // ===== STORAGE KEYS =====
  const THEME_KEY  = 'tf-handover-theme';
  const SHARED_KEY = 'tf_handover_shared';
  const STATUS_KEY = 'tf_handover_status';

  // ============================================================
  // 1. DARK MODE
  // ============================================================

  function applyTheme(theme) {
    if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    const icon = document.getElementById('themeIcon');
    if (icon) icon.textContent = theme === 'dark' ? '☀️' : '🌙';
  }

  function getStoredTheme() {
    try { return localStorage.getItem(THEME_KEY) || 'light'; }
    catch (_) { return 'light'; }
  }

  /**
   * Initializes the theme system.
   * Call once on page load. Expects a button with id="themeToggle"
   * containing a span with id="themeIcon".
   */
  window.TF_initTheme = function() {
    applyTheme(getStoredTheme());
    const btn = document.getElementById('themeToggle');
    if (btn) {
      btn.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        applyTheme(next);
        try { localStorage.setItem(THEME_KEY, next); } catch (_) {}
      });
    }
  };

  // ============================================================
  // 2. SHARED FIELDS (cross-page via sessionStorage)
  //    Fields like project_number, customer_name, receiver_name,
  //    handover_date flow from the landing page into all forms.
  // ============================================================

  /** Returns the shared fields object (or {} if none). */
  window.TF_getShared = function() {
    try { return JSON.parse(sessionStorage.getItem(SHARED_KEY) || '{}'); }
    catch (_) { return {}; }
  };

  /** Saves the shared fields object. */
  window.TF_setShared = function(data) {
    try { sessionStorage.setItem(SHARED_KEY, JSON.stringify(data)); } catch (_) {}
  };

  /** Clears all shared fields (e.g. when starting a new project). */
  window.TF_clearShared = function() {
    try { sessionStorage.removeItem(SHARED_KEY); } catch (_) {}
  };

  /**
   * Pre-fills form inputs from shared storage.
   * For each field name, finds [name="..."] and fills it if empty.
   * @param {string[]} fieldNames - list of input names to prefill
   */
  window.TF_prefillShared = function(fieldNames) {
    const shared = window.TF_getShared();
    (fieldNames || []).forEach(name => {
      const el = document.querySelector(`[name="${name}"]`);
      if (el && shared[name] && !el.value) el.value = shared[name];
    });
  };

  /**
   * Auto-saves fields to shared storage as the user types.
   * Used on the landing page so data flows to the forms.
   * @param {string[]} fieldNames - list of input names to watch
   */
  window.TF_autosaveShared = function(fieldNames) {
    (fieldNames || []).forEach(name => {
      const el = document.querySelector(`[name="${name}"]`);
      if (!el) return;
      el.addEventListener('input', () => {
        const data = window.TF_getShared();
        data[name] = el.value;
        window.TF_setShared(data);
      });
    });
  };

  // ============================================================
  // 3. FORM SUBMISSION STATUS
  //    Tracks which of the 3 forms were already submitted,
  //    so the landing page can show "נשלח ✓" badges.
  // ============================================================

  /** Returns the status object: { 'fire-system': {submitted, at}, ... } */
  window.TF_getStatus = function() {
    try { return JSON.parse(sessionStorage.getItem(STATUS_KEY) || '{}'); }
    catch (_) { return {}; }
  };

  /** Marks a form as submitted (called after successful webhook POST). */
  window.TF_markSubmitted = function(formType) {
    const status = window.TF_getStatus();
    status[formType] = { submitted: true, at: new Date().toISOString() };
    try { sessionStorage.setItem(STATUS_KEY, JSON.stringify(status)); } catch (_) {}
  };

  /** Clears all submission statuses (new project). */
  window.TF_clearStatus = function() {
    try { sessionStorage.removeItem(STATUS_KEY); } catch (_) {}
  };

  // ============================================================
  // 4. TOAST NOTIFICATIONS
  //    Expects an element with id="toast" in the page.
  //    Types: '' (red/error default), 'success' (green)
  // ============================================================

  /**
   * Shows a toast message for 3.5 seconds.
   * @param {string} msg - the message text
   * @param {string} [type] - 'success' for green, omit for red
   */
  window.TF_toast = function(msg, type) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.className = 'toast ' + (type || '');
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 3500);
  };

})(window);
