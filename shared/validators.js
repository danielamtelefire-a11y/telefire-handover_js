/* ============================================================
   TELEFIRE VALIDATORS - SHARED MODULE
   Used by: form1, form2, form3

   Provides:
   - Israeli ID validation (check digit algorithm)
   - Name validation (must contain real letters, not just symbols)
   - Live field validation with visual feedback
   ============================================================ */

(function(window) {
  'use strict';

  // ============================================================
  // ISRAELI ID VALIDATION
  // Official check-digit algorithm (similar to Luhn):
  // - Pad to 9 digits with leading zeros
  // - Multiply digits alternately by 1 and 2
  // - If result > 9, sum its digits (equivalent: subtract 9)
  // - Total must be divisible by 10
  // ============================================================

  /**
   * Validates an Israeli ID number (תעודת זהות).
   * @param {string} id - the ID string (digits only, up to 9 digits)
   * @returns {boolean} true if valid
   */
  window.TF_validateIsraeliID = function(id) {
    if (!id) return false;
    id = String(id).trim();

    // Must be digits only, 5-9 characters (old IDs can be shorter)
    if (!/^\d{5,9}$/.test(id)) return false;

    // Pad with leading zeros to 9 digits
    id = id.padStart(9, '0');

    let sum = 0;
    for (let i = 0; i < 9; i++) {
      let digit = parseInt(id[i], 10) * ((i % 2) + 1);
      if (digit > 9) digit -= 9;
      sum += digit;
    }
    return sum % 10 === 0;
  };

  // ============================================================
  // NAME VALIDATION
  // A valid name must contain at least 3 real letters
  // (Hebrew or Latin). Symbols, dots, digits alone are rejected.
  // ============================================================

  /**
   * Validates a person name.
   * @param {string} name
   * @returns {boolean} true if the name contains at least 3 Hebrew/Latin letters
   */
  window.TF_validateName = function(name) {
    if (!name) return false;
    // Count actual letters (Hebrew range + Latin)
    const letters = String(name).match(/[\u0590-\u05FFa-zA-Z]/g);
    return !!letters && letters.length >= 3;
  };

  // ============================================================
  // LIVE FIELD VALIDATION (visual feedback)
  // ============================================================

  function markInvalid(input, message) {
    input.style.borderColor = 'var(--tf-red)';
    input.style.boxShadow = '0 0 0 3px rgba(204,33,40,0.15)';
    // Add or update error message below the field
    let err = input.parentNode.querySelector('.field-error');
    if (!err) {
      err = document.createElement('span');
      err.className = 'field-error';
      err.style.cssText = 'font-size:12px; color:var(--tf-red); font-weight:600; margin-top:2px;';
      input.parentNode.appendChild(err);
    }
    err.textContent = '⚠️ ' + message;
  }

  function markValid(input) {
    input.style.borderColor = '';
    input.style.boxShadow = '';
    const err = input.parentNode.querySelector('.field-error');
    if (err) err.remove();
  }

  /**
   * Attaches live Israeli ID validation to an input.
   * Validates on blur (when leaving the field). Empty is allowed
   * unless the input has the `required` attribute.
   * @param {HTMLInputElement} input
   */
  window.TF_attachIDValidation = function(input) {
    if (!input) return;

    // Restrict typing to digits only
    input.addEventListener('input', () => {
      input.value = input.value.replace(/\D/g, '').slice(0, 9);
    });

    input.addEventListener('blur', () => {
      const val = input.value.trim();
      if (!val) {
        if (input.required) markInvalid(input, 'שדה חובה');
        else markValid(input);
        return;
      }
      if (window.TF_validateIsraeliID(val)) {
        markValid(input);
      } else {
        markInvalid(input, 'תעודת זהות לא תקינה');
      }
    });
  };

  /**
   * Attaches live name validation to an input.
   * @param {HTMLInputElement} input
   */
  window.TF_attachNameValidation = function(input) {
    if (!input) return;
    input.addEventListener('blur', () => {
      const val = input.value.trim();
      if (!val) {
        if (input.required) markInvalid(input, 'שדה חובה');
        else markValid(input);
        return;
      }
      if (window.TF_validateName(val)) {
        markValid(input);
      } else {
        markInvalid(input, 'יש להזין שם תקין (לפחות 3 אותיות)');
      }
    });
  };

  /**
   * Auto-attaches validators to all matching fields in the page:
   * - Inputs with name containing "_id" → ID validation
   * - Inputs with name containing "name" (and type=text) → name validation
   * Call once after the DOM is ready.
   */
  window.TF_initValidators = function() {
    // ID fields: receiver1_id, receiver2_id, service_customer_id, etc.
    document.querySelectorAll('input[name*="_id"]').forEach(input => {
      window.TF_attachIDValidation(input);
    });

    // Name fields: receiver1_name, deliverer_name, customer_name, etc.
    document.querySelectorAll('input[type="text"][name*="name"]').forEach(input => {
      window.TF_attachNameValidation(input);
    });
  };

  /**
   * Validates the whole form before submit.
   * Returns { valid: boolean, errors: string[] }
   * Checks: all required names valid, all filled IDs valid.
   * @param {HTMLFormElement} form
   */
  window.TF_validateForm = function(form) {
    const errors = [];

    // Validate name fields
    form.querySelectorAll('input[type="text"][name*="name"]').forEach(input => {
      const val = input.value.trim();
      if (input.required && !val) {
        errors.push('חסר: ' + (input.closest('.field')?.querySelector('label')?.textContent || input.name).replace('*', '').trim());
      } else if (val && !window.TF_validateName(val)) {
        errors.push('שם לא תקין: "' + val + '"');
      }
    });

    // Validate ID fields (only if filled - IDs are usually optional)
    form.querySelectorAll('input[name*="_id"]').forEach(input => {
      const val = input.value.trim();
      if (val && !window.TF_validateIsraeliID(val)) {
        errors.push('תעודת זהות לא תקינה: ' + val);
      }
    });

    return { valid: errors.length === 0, errors: errors };
  };

})(window);
