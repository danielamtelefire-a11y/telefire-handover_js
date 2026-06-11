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
      const data = preserve && !this.empty ? this.canvas.toDataURL() : null;
      const ratio = window.devicePixelRatio || 1;
      const rect = this.canvas.getBoundingClientRect();
      this.canvas.width = rect.width * ratio;
      this.canvas.height = rect.height * ratio;
      this.ctx.scale(ratio, ratio);
      this._setStroke();
      if (data) {
        const img = new Image();
        img.onload = () => this.ctx.drawImage(img, 0, 0, rect.width, rect.height);
        img.src = data;
      }
    }

    /** Clears the canvas and restores the placeholder text. */
    clear() {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.empty = true;
      if (this.placeholder) this.placeholder.style.display = 'flex';
    }

    /** Loads a signature from a base64 PNG data URL (for draft restore). */
    loadFromDataURL(dataURL) {
      if (!dataURL) return;
      const img = new Image();
      img.onload = () => {
        const rect = this.canvas.getBoundingClientRect();
        this.ctx.drawImage(img, 0, 0, rect.width, rect.height);
        this.empty = false;
        if (this.placeholder) this.placeholder.style.display = 'none';
      };
      img.src = dataURL;
    }

    /** Returns true if the user hasn't signed yet. */
    isEmpty() {
      return this.empty;
    }

    /** Exports the signature as a base64 PNG data URL (or '' if empty). */
    toDataURL() {
      return this.empty ? '' : this.canvas.toDataURL('image/png');
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
