/* ============================================================
   TELEFIRE PDF GENERATOR - SHARED MODULE (v2)
   Used by: form1, form2, form3

   v2 CHANGE: Fixed Hebrew gibberish.
   jsPDF's built-in fonts don't support Hebrew. Instead of
   rendering text directly, we now build a styled hidden HTML
   element (with real Hebrew + RTL), capture it with html2canvas
   as a high-resolution image, and embed that image into the PDF.

   REQUIRES both libraries loaded via CDN in the HTML page:
   <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
   <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
   ============================================================ */

(function(window) {
  'use strict';

  /**
   * Builds the hidden HTML template that will be captured as PDF.
   * Uses inline styles only (no external CSS dependency) so the
   * capture is identical regardless of page theme (light/dark).
   */
  function buildTemplate(config) {
    const wrap = document.createElement('div');
    wrap.id = 'tf-pdf-template';
    // A4 ratio at 794px wide (96dpi). Rendered at scale=2 for sharpness.
    wrap.style.cssText = [
      'position: absolute',
      'top: 0',
      'left: -9999px',           // off-screen, invisible to user
      'width: 794px',
      'background: #FFFFFF',
      'font-family: "Heebo", Arial, sans-serif',
      'direction: rtl',
      'color: #1A202C',
      'z-index: -1'
    ].join(';');

    let html = '';

    // ===== Header bar =====
    html += '<div style="background: linear-gradient(135deg, #172B54 0%, #2A4173 100%); color: white; padding: 24px 32px; display: flex; justify-content: space-between; align-items: center;">';
    html += '<div>';
    html += '<div style="font-size: 24px; font-weight: 800; letter-spacing: 2px;">TELEFIRE</div>';
    html += '<div style="font-size: 11px; opacity: 0.8; margin-top: 4px;">Project Handover System</div>';
    html += '</div>';
    html += '<div style="text-align: left;">';
    html += '<div style="font-size: 13px;">' + new Date().toLocaleDateString('he-IL') + '</div>';
    if (config.formNumber) {
      html += '<div style="font-size: 11px; opacity: 0.8; margin-top: 4px;">טופס ' + config.formNumber + '</div>';
    }
    html += '</div></div>';

    // ===== Title =====
    html += '<div style="padding: 28px 32px 8px;">';
    html += '<div style="font-size: 24px; font-weight: 800; color: #CC2128;">' + config.title + '</div>';
    html += '</div>';

    // ===== Sections =====
    html += '<div style="padding: 0 32px 24px;">';
    (config.sections || []).forEach(section => {
      html += '<div style="margin-top: 20px;">';
      // Section title with red accent
      html += '<div style="display: flex; align-items: center; gap: 8px; border-bottom: 2px solid #CC2128; padding-bottom: 8px; margin-bottom: 14px;">';
      html += '<div style="font-size: 16px; font-weight: 700; color: #172B54;">' + section.title + '</div>';
      html += '</div>';

      // Label/value rows in a 2-column grid
      if (section.rows && section.rows.length) {
        html += '<table style="width: 100%; border-collapse: collapse; font-size: 13px;">';
        section.rows.forEach(([label, value]) => {
          html += '<tr>';
          html += '<td style="padding: 6px 0; font-weight: 700; color: #64748B; width: 180px; vertical-align: top;">' + label + '</td>';
          html += '<td style="padding: 6px 0; color: #1A202C;">' + (value || '—') + '</td>';
          html += '</tr>';
        });
        html += '</table>';
      }

      // Free paragraphs
      if (section.paragraphs && section.paragraphs.length) {
        section.paragraphs.forEach(par => {
          if (!par) return;
          html += '<div style="font-size: 13px; line-height: 1.7; color: #1A202C; margin-bottom: 8px; background: #F8FAFC; border-right: 3px solid #6DAADC; padding: 10px 14px; border-radius: 6px;">' + par + '</div>';
        });
      }
      html += '</div>';
    });

    // ===== Signatures =====
    if (config.signatures && config.signatures.length) {
      const sigs = config.signatures.filter(s => s.image || s.name);
      if (sigs.length) {
        html += '<div style="margin-top: 24px;">';
        html += '<div style="border-bottom: 2px solid #CC2128; padding-bottom: 8px; margin-bottom: 14px;">';
        html += '<div style="font-size: 16px; font-weight: 700; color: #172B54;">חתימות</div>';
        html += '</div>';
        html += '<div style="display: flex; flex-wrap: wrap; gap: 16px;">';
        sigs.forEach(sig => {
          html += '<div style="flex: 1; min-width: 200px; border: 1px solid #E2E8F0; border-radius: 8px; padding: 14px; background: #F8FAFC;">';
          html += '<div style="font-size: 11px; font-weight: 700; color: #CC2128; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">' + sig.label + '</div>';
          html += '<div style="font-size: 13px; margin-bottom: 8px;">' + (sig.name || '—');
          if (sig.id) html += ' &nbsp;·&nbsp; ת.ז ' + sig.id;
          html += '</div>';
          if (sig.image) {
            html += '<div style="background: white; border: 1px dashed #CBD5E1; border-radius: 6px; padding: 4px; text-align: center;">';
            html += '<img src="' + sig.image + '" style="max-width: 100%; height: 70px; object-fit: contain;">';
            html += '</div>';
          } else {
            html += '<div style="background: white; border: 1px dashed #CBD5E1; border-radius: 6px; padding: 20px; text-align: center; color: #94A3B8; font-size: 11px;">ללא חתימה</div>';
          }
          html += '</div>';
        });
        html += '</div></div>';
      }
    }

    html += '</div>'; // close sections padding

    // ===== Footer =====
    html += '<div style="border-top: 1px solid #E2E8F0; padding: 14px 32px; font-size: 10px; color: #94A3B8; text-align: center;">';
    html += 'טלפייר בע"מ · הסיבים 43, פתח תקווה · 03-9700400 · הופק ' + new Date().toLocaleString('he-IL');
    html += '</div>';

    wrap.innerHTML = html;
    return wrap;
  }

  /**
   * Generates and downloads a branded summary PDF with full Hebrew support.
   * SAME API as v1 - existing forms don't need parameter changes.
   *
   * @param {Object} config
   * @param {string} config.title        - Form title in Hebrew
   * @param {string} config.formNumber   - e.g. '01 / 03'
   * @param {string} config.filename     - download filename
   * @param {Array}  config.sections     - [{ title, rows: [[label, value]], paragraphs: [str] }]
   * @param {Array}  [config.signatures] - [{ label, name, id, image }]
   * @param {Function} [callback]        - called with (success: boolean) when done
   */
  window.TF_generatePDF = function(config, callback) {
    if (!window.jspdf || !window.jspdf.jsPDF) {
      console.error('[TF_generatePDF] jsPDF library not loaded');
      if (callback) callback(false);
      return false;
    }
    if (!window.html2canvas) {
      console.error('[TF_generatePDF] html2canvas library not loaded');
      if (callback) callback(false);
      return false;
    }

    const template = buildTemplate(config);
    document.body.appendChild(template);

    // Give the browser a tick to render fonts/images inside the template
    setTimeout(() => {
      const fullHeight = template.scrollHeight;
      const fullWidth = template.offsetWidth;
      window.html2canvas(template, {
        scale: 2,               // high resolution
        useCORS: true,
        backgroundColor: '#FFFFFF',
        logging: false,
        width: fullWidth,
        height: fullHeight,
        windowWidth: fullWidth,
        windowHeight: fullHeight,
        scrollX: 0,
        scrollY: 0
      }).then(canvas => {
        document.body.removeChild(template);

        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

        const pageW = pdf.internal.pageSize.getWidth();   // 210mm
        const pageH = pdf.internal.pageSize.getHeight();  // 297mm

        // Canvas dimensions in mm, scaled to fit page width
        const imgW = pageW;
        const imgH = (canvas.height * pageW) / canvas.width;

        if (imgH <= pageH) {
          // Fits in one page
          pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, imgW, imgH);
        } else {
          // Multi-page: slice the canvas into page-height chunks
          const pageCanvasHeight = Math.floor((pageH * canvas.width) / pageW);
          let renderedHeight = 0;
          let pageIndex = 0;

          while (renderedHeight < canvas.height) {
            const sliceHeight = Math.min(pageCanvasHeight, canvas.height - renderedHeight);
            const sliceCanvas = document.createElement('canvas');
            sliceCanvas.width = canvas.width;
            sliceCanvas.height = sliceHeight;
            const ctx = sliceCanvas.getContext('2d');
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
            ctx.drawImage(canvas, 0, renderedHeight, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);

            const sliceH = (sliceHeight * pageW) / canvas.width;
            if (pageIndex > 0) pdf.addPage();
            pdf.addImage(sliceCanvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, imgW, sliceH);

            renderedHeight += sliceHeight;
            pageIndex++;
          }
        }

        pdf.save(config.filename || 'telefire-handover.pdf');
        if (callback) callback(true);
      }).catch(err => {
        console.error('[TF_generatePDF] html2canvas failed', err);
        if (document.getElementById('tf-pdf-template')) {
          document.body.removeChild(template);
        }
        if (callback) callback(false);
      });
    }, 100);

    return true; // async operation started
  };

})(window);
