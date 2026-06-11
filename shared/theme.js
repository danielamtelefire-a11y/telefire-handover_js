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
  // 3b. FORM DRAFTS + DATA LOCK SYSTEM
  //
  //     Behavior matrix:
  //     - Navigating BETWEEN forms: draft always restored silently
  //       (that's the whole point of drafts).
  //     - RELOADING the same form (F5/Ctrl+F5):
  //         * Lock ON  -> restore silently
  //         * Lock OFF -> ask the user: continue draft / start clean
  //     - Closing the tab: sessionStorage dies -> everything resets.
  //     - "Clear form" button: wipes current form draft on demand.
  //
  //     Reload detection: performance.getEntriesByType('navigation').
  // ============================================================

  const DRAFT_PREFIX = 'tf_handover_draft_';
  const LOCK_KEY = 'tf_handover_lock';

  /** Returns true if data lock is ON (drafts survive reload silently). */
  window.TF_isLocked = function() {
    try { return sessionStorage.getItem(LOCK_KEY) === '1'; }
    catch (_) { return false; }
  };

  /** Sets the data lock state. */
  window.TF_setLocked = function(on) {
    try { sessionStorage.setItem(LOCK_KEY, on ? '1' : '0'); } catch (_) {}
  };

  /** True if this page load is a reload (F5) rather than navigation. */
  function isReload() {
    try {
      const nav = performance.getEntriesByType('navigation');
      return nav.length > 0 && nav[0].type === 'reload';
    } catch (_) { return false; }
  }

  /** Checks whether a draft exists for a form. */
  function hasDraft(formType) {
    try {
      const raw = sessionStorage.getItem(DRAFT_PREFIX + formType);
      if (!raw) return false;
      const draft = JSON.parse(raw);
      // Consider it a draft only if at least one field has a value
      return Object.keys(draft).some(k => draft[k] !== '' && draft[k] !== false);
    } catch (_) { return false; }
  }

  /** Applies draft values into the page fields. */
  function applyDraft(formType) {
    let draft;
    try { draft = JSON.parse(sessionStorage.getItem(DRAFT_PREFIX + formType) || '{}'); }
    catch (_) { return; }

    Object.keys(draft).forEach(name => {
      const value = draft[name];
      const els = document.querySelectorAll(`[name="${name}"]`);
      els.forEach(el => {
        if (el.type === 'radio') {
          el.checked = (el.value === value);
          if (el.checked) el.dispatchEvent(new Event('change', { bubbles: true }));
        } else if (el.type === 'checkbox') {
          el.checked = !!value;
        } else {
          el.value = value;
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });
    });
  }

  /** Shows the "draft found" dialog. Returns via callbacks. */
  function showDraftDialog(onContinue, onClean) {
    // Build overlay + dialog
    const overlay = document.createElement('div');
    overlay.className = 'draft-dialog-overlay show';
    const dialog = document.createElement('div');
    dialog.className = 'draft-dialog show';
    dialog.innerHTML =
      '<div class="draft-dialog-icon">📝</div>' +
      '<div class="draft-dialog-title">נמצאה טיוטה שמורה</div>' +
      '<div class="draft-dialog-text">יש נתונים שמורים מהפעם הקודמת. מה תרצה לעשות?</div>' +
      '<div class="draft-dialog-actions">' +
      '<button type="button" class="btn btn-primary" data-action="continue">המשך מהטיוטה</button>' +
      '<button type="button" class="btn btn-secondary" data-action="clean">התחל נקי</button>' +
      '</div>';

    document.body.appendChild(overlay);
    document.body.appendChild(dialog);

    const close = () => { overlay.remove(); dialog.remove(); };
    dialog.querySelector('[data-action="continue"]').addEventListener('click', () => { close(); onContinue(); });
    dialog.querySelector('[data-action="clean"]').addEventListener('click', () => { close(); onClean(); });
  }

  /**
   * Restores form draft with lock-aware behavior.
   * Call AFTER TF_prefillShared. See behavior matrix above.
   * @param {string} formType
   */
  window.TF_restoreForm = function(formType) {
    if (!hasDraft(formType)) return;

    if (isReload() && !window.TF_isLocked()) {
      // Reload without lock -> ask the user
      showDraftDialog(
        () => applyDraft(formType),                         // continue
        () => window.TF_clearFormDraft(formType)            // start clean
      );
    } else {
      // Navigation between pages, or lock is ON -> restore silently
      applyDraft(formType);
    }
  };

  /**
   * Watches all form fields and saves them to sessionStorage on change.
   * @param {string} formType
   * @param {HTMLFormElement|HTMLElement} form - container to watch
   */
  window.TF_autosaveForm = function(formType, form) {
    if (!form) return;
    const key = DRAFT_PREFIX + formType;

    const save = () => {
      const draft = {};
      form.querySelectorAll('input, select, textarea').forEach(el => {
        if (!el.name) return;
        if (el.type === 'radio') {
          if (el.checked) draft[el.name] = el.value;
        } else if (el.type === 'checkbox') {
          draft[el.name] = el.checked;
        } else {
          draft[el.name] = el.value;
        }
      });
      try { sessionStorage.setItem(key, JSON.stringify(draft)); } catch (_) {}
    };

    form.addEventListener('input', save);
    form.addEventListener('change', save);
  };

  /**
   * Clears the saved draft for a form.
   * @param {string} formType
   */
  window.TF_clearFormDraft = function(formType) {
    try { sessionStorage.removeItem(DRAFT_PREFIX + formType); } catch (_) {}
  };

  /**
   * Initializes the lock toggle + clear button in the page toolbar.
   * Expects elements: #dataLockToggle (checkbox or button), #clearFormBtn.
   * Either can be absent.
   * @param {string} formType - which draft the clear button wipes
   * @param {Function} [onClear] - extra cleanup (e.g. clear signature pads)
   */
  window.TF_initDataControls = function(formType, onClear) {
    // Lock toggle
    const lockBtn = document.getElementById('dataLockToggle');
    if (lockBtn) {
      const renderLock = () => {
        const locked = window.TF_isLocked();
        lockBtn.classList.toggle('locked', locked);
        lockBtn.innerHTML = locked ? '🔒' : '🔓';
        lockBtn.title = locked
          ? 'נעילת נתונים פעילה - רענון לא ימחק נתונים'
          : 'נעילת נתונים כבויה - רענון ישאל אם לשחזר';
      };
      lockBtn.addEventListener('click', () => {
        window.TF_setLocked(!window.TF_isLocked());
        renderLock();
        window.TF_toast(window.TF_isLocked() ? '🔒 נעילת נתונים הופעלה' : '🔓 נעילת נתונים כובתה', 'success');
      });
      renderLock();
    }

    // Clear form button
    const clearBtn = document.getElementById('clearFormBtn');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        if (!confirm('לנקות את כל הנתונים בטופס הזה?')) return;
        window.TF_clearFormDraft(formType);
        // Clear visible fields
        document.querySelectorAll('#tfForm input, #tfForm select, #tfForm textarea, .card input, .card select, .card textarea').forEach(el => {
          if (el.type === 'radio' || el.type === 'checkbox') el.checked = false;
          else el.value = '';
        });
        if (typeof onClear === 'function') onClear();
        window.TF_toast('🗑️ הטופס נוקה', 'success');
      });
    }
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
