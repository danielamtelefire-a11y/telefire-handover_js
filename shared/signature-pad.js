/* ============================================================
   TELEFIRE SIGNATURE PAD - SHARED MODULE
   Used by: form1-fire-system.html, form2-warranty.html, form3-service.html

   Lightweight signature pad with no external dependencies.
   Supports mouse, touch, and stylus via Pointer Events API.

   IMPORTANT: Signature pad background is ALWAYS white (set in styles.css),
   so the stroke color is ALWAYS dark - works correctly in both light and dark mode.
   ============================================================ */

(function(window) {
  'use strict';

  class SignaturePad {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.drawing = false;
      this.empty = true;
      this._lastDataURL = null; // single source of truth for the signature image
      this.placeholder = canvas.parentNode.querySelector('.signature-placeholder');

      // Setup canvas dimensions for high-DPI screens
      this._resize();

      // Pointer events handle mouse + touch + pen with single API
      canvas.addEventListener('pointerdown', e => {
        e.preventDefault();
        this.drawing = true;
        this.empty = false;
        if (this.placeholder) this.placeholder.style.display = 'none';
        const p = this._pos(e);
        this.ctx.beginPath();
        this.ctx.moveTo(p.x, p.y);
        canvas.setPointerCapture(e.pointerId);
      });

      canvas.addEventListener('pointermove', e => {
        if (!this.drawing) return;
        e.preventDefault();
        const p = this._pos(e);
        this.ctx.lineTo(p.x, p.y);
        this.ctx.stroke();
      });

      const stop = e => {
        if (!this.drawing) return;
        this.drawing = false;
        try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
        // Store the drawing as the source of truth so it survives resize/tab switches.
        try { this._lastDataURL = this.canvas.toDataURL(); } catch (_) {}
      };
      canvas.addEventListener('pointerup', stop);
      canvas.addEventListener('pointercancel', stop);
      canvas.addEventListener('pointerleave', stop);

      this._setStroke();

      // Re-resize on window changes (preserves the drawing)
      window.addEventListener('resize', () => this._resize(true));
    }

    /**
     * Sets the stroke style. Always dark - because the signature pad
     * background is always white (even in dark mode), so light strokes
     * would be invisible. This was a real bug that's now fixed by design.
     */
    _setStroke() {
      this.ctx.lineWidth = 2;
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';
      this.ctx.strokeStyle = '#1A202C';
    }

    /**
     * Translates pointer event coordinates to canvas coordinates,
     * accounting for device pixel ratio (retina/4K screens).
     */
    _pos(e) {
      const rect = this.canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      return {
        x: (e.clientX - rect.left) * (this.canvas.width / rect.width / dpr),
        y: (e.clientY - rect.top) * (this.canvas.height / rect.height / dpr)
      };
    }

    /**
     * Resizes the canvas to match its display size, accounting for DPR.
     * If `preserve` is true, the existing drawing is kept (useful on window resize).
     */
    _resize(preserve) {
      const rect = this.canvas.getBoundingClientRect();
      // If the pad is hidden (0x0, e.g. inside an inactive tab), skip -
      // resizing to 0 would wipe the canvas. We'll resize when it's shown.
      if (rect.width === 0 || rect.height === 0) return;

      const ratio = window.devicePixelRatio || 1;
      this.canvas.width = rect.width * ratio;
      this.canvas.height = rect.height * ratio;
      this.ctx.scale(ratio, ratio);
      this._setStroke();

      // Redraw from the stored source of truth. This survives both a resize and
      // the case where the image was "loaded" while the pad was hidden (0x0) and
      // never actually rendered - which previously lost the signature.
      if (preserve && this._lastDataURL) {
        const img = new Image();
        const w = rect.width, h = rect.height;
        img.onload = () => this.ctx.drawImage(img, 0, 0, w, h);
        img.src = this._lastDataURL;
      }
    }

    /** Clears the canvas and restores the placeholder text. */
    clear() {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.empty = true;
      this._lastDataURL = null;
      if (this.placeholder) this.placeholder.style.display = 'flex';
    }

    /** Loads a signature from a base64 PNG data URL (for draft restore). */
    loadFromDataURL(dataURL) {
      if (!dataURL) return;
      this._lastDataURL = dataURL;   // source of truth; rendered now or on next resize
      this.empty = false;
      if (this.placeholder) this.placeholder.style.display = 'none';
      const img = new Image();
      img.onload = () => {
        const rect = this.canvas.getBoundingClientRect();
        if (rect.width && rect.height) this.ctx.drawImage(img, 0, 0, rect.width, rect.height);
      };
      img.src = dataURL;
    }

    /**
     * Public resize - call when a pad becomes visible after being hidden
     * (e.g. switching to a tab). Canvases initialized while display:none
     * have 0x0 dimensions and can't be drawn on until resized.
     */
    resize() {
      this._resize(true);
    }

    /** Returns true if the user hasn't signed yet. */
    isEmpty() {
      return this.empty;
    }

    /** Exports the signature as a base64 PNG data URL (or '' if empty). */
    toDataURL() {
      if (this.empty) return '';
      // Prefer the stored source of truth: the canvas may be blank if the
      // signature was restored while the pad was hidden and not yet shown.
      if (this._lastDataURL) return this._lastDataURL;
      try { return this.canvas.toDataURL('image/png'); } catch (_) { return ''; }
    }
  }

  /**
   * Auto-initializes all signature pads on the page.
   * Looks for elements with class `.signature-pad` and a `data-name` attribute.
   * Also wires up `.signature-clear` buttons (with `data-target` pointing to a pad name).
   *
   * Usage in HTML:
   *   <div class="signature-pad" data-name="customer"></div>
   *   <button class="signature-clear" data-target="customer">נקה</button>
   *
   * Usage in JS:
   *   const pads = TF_initSignatures();
   *   pads.customer.isEmpty();  // false if signed
   *   pads.customer.toDataURL();  // PNG string
   *
   * @returns {Object} Map of {name: SignaturePad instance}
   */
  window.TF_initSignatures = function() {
    const pads = {};
    document.querySelectorAll('.signature-pad').forEach(block => {
      let canvas = block.querySelector('canvas');
      if (!canvas) {
        canvas = document.createElement('canvas');
        block.appendChild(canvas);
      }
      const name = block.dataset.name;
      pads[name] = new SignaturePad(canvas);
    });

    // Wire up clear buttons
    document.querySelectorAll('.signature-clear').forEach(btn => {
      btn.addEventListener('click', e => {
        e.preventDefault();
        const target = btn.dataset.target;
        if (pads[target]) pads[target].clear();
      });
    });

    return pads;
  };

  /**
   * Collects all current signatures as a {name: dataURL} object.
   * @param {Object} pads - the map returned by TF_initSignatures()
   * @returns {Object}
   */
  window.TF_getSignatures = function(pads) {
    const out = {};
    Object.keys(pads || {}).forEach(name => {
      out[name] = pads[name].toDataURL();
    });
    return out;
  };

  /**
   * Restores signatures from a {name: dataURL} object into the pads.
   * @param {Object} pads - the map returned by TF_initSignatures()
   * @param {Object} saved - {name: dataURL}
   */
  window.TF_restoreSignatures = function(pads, saved) {
    if (!saved) return;
    Object.keys(saved).forEach(name => {
      if (pads[name] && saved[name]) {
        pads[name].loadFromDataURL(saved[name]);
      }
    });
  };

  // Expose the class globally (in case anyone wants direct access)
  window.SignaturePad = SignaturePad;

})(window);
