/* ============================================================
   TELEFIRE PDF GENERATOR - SHARED MODULE
   Used by: form1-fire-system.html, form2-warranty.html, form3-service.html

   Generates a summary PDF after a form is submitted.
   Each form passes its own config (title, sections, signatures)
   and this module renders a consistent, branded A4 document.

   REQUIRES: jsPDF loaded via CDN in the HTML page:
   <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
   ============================================================ */

(function(window) {
  'use strict';

  // Brand colors (RGB)
  const NAVY = [23, 43, 84];
  const RED = [204, 33, 40];
  const DARK = [40, 40, 40];
  const GRAY = [150, 150, 150];
  const LIGHT_BORDER = [200, 200, 200];

  /**
   * Generates and downloads a branded summary PDF.
   *
   * @param {Object} config
   * @param {string} config.title        - Form title in Hebrew (e.g. 'טופס מסירת מערכת גילוי אש')
   * @param {string} config.formNumber   - e.g. '01 / 03'
   * @param {string} config.filename     - download filename (e.g. 'Telefire_FireSystem_P123.pdf')
   * @param {Array}  config.sections     - [{ title, rows: [[label, value], ...], paragraphs: [str, ...] }]
   * @param {Array}  [config.signatures] - [{ label, name, id, image (base64 PNG or '') }]
   *
   * @returns {boolean} true if generated successfully
   */
  window.TF_generatePDF = function(config) {
    if (!window.jspdf || !window.jspdf.jsPDF) {
      console.error('[TF_generatePDF] jsPDF library not loaded');
      return false;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    let y = 0;

    // ---- Helper: right-aligned text (Hebrew RTL) ----
    const rtl = (text, yPos, fontSize, bold, color) => {
      doc.setFontSize(fontSize || 10);
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      if (color) doc.setTextColor(color[0], color[1], color[2]);
      doc.text(String(text), pageW - 15, yPos, { align: 'right' });
    };

    // ---- Helper: page break check ----
    const ensureSpace = (needed) => {
      if (y + needed > pageH - 20) {
        doc.addPage();
        y = 20;
      }
    };

    // ============ HEADER BAR ============
    doc.setFillColor(NAVY[0], NAVY[1], NAVY[2]);
    doc.rect(0, 0, pageW, 28, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('TELEFIRE', 15, 12);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Project Handover System', 15, 19);
    doc.text(new Date().toLocaleDateString('he-IL'), pageW - 15, 12, { align: 'right' });
    if (config.formNumber) {
      doc.text('Form ' + config.formNumber, pageW - 15, 19, { align: 'right' });
    }

    // ============ TITLE ============
    y = 40;
    rtl(config.title, y, 15, true, RED);
    y += 10;

    // ============ SECTIONS ============
    (config.sections || []).forEach(section => {
      ensureSpace(20);

      // Section divider line + title
      doc.setDrawColor(RED[0], RED[1], RED[2]);
      doc.setLineWidth(0.5);
      doc.line(pageW - 15, y, 15, y);
      y += 6;
      rtl(section.title, y, 12, true, NAVY);
      y += 7;

      // Label/value rows
      (section.rows || []).forEach(([label, value]) => {
        ensureSpace(8);
        doc.setTextColor(DARK[0], DARK[1], DARK[2]);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text(String(label), pageW - 15, y, { align: 'right' });
        doc.setFont('helvetica', 'normal');
        doc.text(String(value || '—'), pageW - 70, y, { align: 'right' });
        y += 6;
      });

      // Free paragraphs (multi-line text like notes)
      (section.paragraphs || []).forEach(par => {
        if (!par) return;
        const lines = doc.splitTextToSize(String(par), pageW - 35);
        lines.forEach(line => {
          ensureSpace(6);
          rtl(line, y, 9, false, DARK);
          y += 5;
        });
        y += 2;
      });

      y += 4;
    });

    // ============ SIGNATURES ============
    if (config.signatures && config.signatures.length) {
      ensureSpace(20);
      doc.setDrawColor(RED[0], RED[1], RED[2]);
      doc.line(pageW - 15, y, 15, y);
      y += 6;
      rtl('חתימות', y, 12, true, NAVY);
      y += 8;

      config.signatures.forEach(sig => {
        // Skip completely empty signature blocks
        if (!sig.image && !sig.name) return;

        ensureSpace(45);

        rtl(sig.label, y, 10, true, RED);
        y += 6;

        let info = 'שם: ' + (sig.name || '—');
        if (sig.id) info += '    ת.ז: ' + sig.id;
        rtl(info, y, 9, false, DARK);
        y += 4;

        if (sig.image) {
          try {
            doc.addImage(sig.image, 'PNG', pageW - 80, y, 60, 25);
            doc.setDrawColor(LIGHT_BORDER[0], LIGHT_BORDER[1], LIGHT_BORDER[2]);
            doc.rect(pageW - 80, y, 60, 25);
            y += 28;
          } catch (e) {
            console.warn('[TF_generatePDF] Failed to embed signature image', e);
            y += 4;
          }
        } else {
          y += 4;
        }
        y += 5;
      });
    }

    // ============ FOOTER (every page) ============
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);
      doc.text(
        'Telefire Ltd. · Generated ' + new Date().toLocaleString('he-IL') + ' · Page ' + i + '/' + pageCount,
        pageW / 2, pageH - 8, { align: 'center' }
      );
    }

    // ============ DOWNLOAD ============
    doc.save(config.filename || 'telefire-handover.pdf');
    return true;
  };

})(window);
