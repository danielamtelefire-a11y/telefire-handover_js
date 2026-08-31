/* ============================================================
   TELEFIRE PDF GENERATOR - SHARED MODULE (v4)
   Used by: form1, form2, form3

   v2 CHANGE: Fixed Hebrew gibberish.
   jsPDF's built-in fonts don't support Hebrew. Instead of
   rendering text directly, we now build a styled hidden HTML
   element (with real Hebrew + RTL), capture it with html2canvas
   as a high-resolution image, and embed that image into the PDF.

   v3 CHANGE: Optional embedded machine-readable data (referent
   handoff feature). If config.embedData is set, the resulting
   .pdf file gets a small marker block appended after its own
   %%EOF - the file still opens/prints normally in any PDF viewer,
   but shared/theme.js's TF_applyProjectFile() can pull the data
   back out of it.

   v4 CHANGE: Fixed content getting cut in half across page breaks.
   v2/v3 rendered the WHOLE document as one giant screenshot, then
   sliced it into page-height chunks at a fixed pixel offset - which
   had no idea where a section/row actually ended, so a row (or even
   a line of text) could get its top half on one page and bottom half
   on the next. Now every section (and the header and signatures) is
   captured as its OWN small screenshot, and those pieces are packed
   onto PDF pages greedily: a piece that doesn't fit in the remaining
   space on the current page starts a fresh page instead of being cut.
   Only a single piece that's taller than an entire page (rare - e.g.
   a huge notes field) still falls back to slicing, and only that one
   piece.

   REQUIRES both libraries loaded via CDN in the HTML page:
   <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
   <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
   ============================================================ */

(function(window) {
  'use strict';

  const BLOCK_STYLE = [
    'position: absolute',
    'top: 0',
    'left: -9999px',           // off-screen, invisible to user
    'width: 794px',            // A4 ratio at 96dpi
    'background: #FFFFFF',
    'font-family: "Heebo", Arial, sans-serif',
    'direction: rtl',
    'color: #1A202C'
  ].join(';');

  /** Header bar + title + optional "draft" banner - always the first block. */
  function buildHeaderHtml(config) {
    let html = '';
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

    html += '<div style="padding: 28px 32px 8px;">';
    html += '<div style="font-size: 24px; font-weight: 800; color: #CC2128;">' + config.title + '</div>';
    html += '</div>';

    if (config.isDraft) {
      html += '<div style="padding: 0 32px 8px;">';
      html += '<div style="display: inline-block; padding: 8px 16px; background: #FEF3C7; border: 1px solid #F59E0B; border-radius: 6px; font-size: 12px; font-weight: 700; color: #92400E;">';
      html += '⚠️ טיוטת עבודה - הטופס טרם נשלח באופן סופי';
      html += '</div></div>';
    }
    return html;
  }

  /** One section (title + rows table and/or free paragraphs) - one block per section. */
  function buildSectionHtml(section) {
    let html = '<div style="padding: 0 32px;">';
    html += '<div style="display: flex; align-items: center; gap: 8px; border-bottom: 2px solid #CC2128; padding-bottom: 8px; margin-bottom: 14px;">';
    html += '<div style="font-size: 16px; font-weight: 700; color: #172B54;">' + section.title + '</div>';
    html += '</div>';

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

    if (section.paragraphs && section.paragraphs.length) {
      section.paragraphs.forEach(par => {
        if (!par) return;
        html += '<div style="font-size: 13px; line-height: 1.7; color: #1A202C; margin-bottom: 8px; background: #F8FAFC; border-right: 3px solid #6DAADC; padding: 10px 14px; border-radius: 6px;">' + par + '</div>';
      });
    }
    html += '</div>';
    return html;
  }

  /** Signatures block - one block, kept together so no signature gets split from its name/image. */
  function buildSignaturesHtml(config) {
    const sigs = (config.signatures || []).filter(s => s.image || s.name);
    if (!sigs.length) return null;

    let html = '<div style="padding: 0 32px;">';
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
    return html;
  }

  /** Footer - one block, placed wherever it lands after the last piece. */
  function buildFooterHtml() {
    let html = '<div style="border-top: 1px solid #E2E8F0; padding: 14px 32px; font-size: 10px; color: #94A3B8; text-align: center;">';
    html += 'טלפייר בע"מ · הסיבים 43, פתח תקווה · 03-9700400 · הופק ' + new Date().toLocaleString('he-IL');
    html += '</div>';
    return html;
  }

  /** Renders one HTML fragment off-screen and captures it as a canvas. */
  async function captureBlock(html) {
    const el = document.createElement('div');
    el.style.cssText = BLOCK_STYLE;
    el.innerHTML = html;
    document.body.appendChild(el);
    // Give the browser a tick to lay out fonts/images before capture
    await new Promise(resolve => setTimeout(resolve, 50));
    const canvas = await window.html2canvas(el, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#FFFFFF',
      logging: false,
      width: el.offsetWidth,
      height: el.scrollHeight,
      windowWidth: el.offsetWidth,
      windowHeight: el.scrollHeight,
      scrollX: 0,
      scrollY: 0
    });
    document.body.removeChild(el);
    return canvas;
  }

  /**
   * Generates and downloads a branded summary PDF with full Hebrew support.
   * SAME API as v1/v2/v3 - existing forms don't need parameter changes.
   *
   * @param {Object} config
   * @param {string} config.title        - Form title in Hebrew
   * @param {string} config.formNumber   - e.g. '01 / 03'
   * @param {string} config.filename     - download filename
   * @param {boolean} [config.isDraft]   - shows a "draft" banner
   * @param {Object} [config.embedData]  - machine-readable payload to embed
   *                                       invisibly in the PDF bytes -
   *                                       see shared/theme.js TF_encodeEmbeddedData
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

    (async () => {
      try {
        // ----- Build the list of independent HTML blocks -----
        const blockHtmls = [];
        blockHtmls.push(buildHeaderHtml(config));
        (config.sections || []).forEach(section => blockHtmls.push(buildSectionHtml(section)));
        const sigHtml = buildSignaturesHtml(config);
        if (sigHtml) blockHtmls.push(sigHtml);
        blockHtmls.push(buildFooterHtml());

        // ----- Capture each block as its own canvas -----
        const canvases = [];
        for (const html of blockHtmls) {
          canvases.push(await captureBlock(html));
        }

        // ----- Pack blocks onto pages: never split a block unless it alone is taller than a page -----
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const pageW = pdf.internal.pageSize.getWidth();   // 210mm
        const pageH = pdf.internal.pageSize.getHeight();  // 297mm

        let cursorY = 0;
        let isFirstImageOnDoc = true;

        canvases.forEach(canvas => {
          const imgW = pageW;
          const imgH = (canvas.height * pageW) / canvas.width;

          if (imgH > pageH) {
            // This single block is taller than a whole page (rare - e.g. a
            // very long notes field). Give it fresh page(s) and slice ONLY it.
            if (!isFirstImageOnDoc) pdf.addPage();
            const pageCanvasHeight = Math.floor((pageH * canvas.width) / pageW);
            let renderedHeight = 0;
            let firstSlice = true;
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
              if (!firstSlice) pdf.addPage();
              pdf.addImage(sliceCanvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, imgW, sliceH);
              renderedHeight += sliceHeight;
              firstSlice = false;
            }
            // Force the next block onto a fresh page rather than computing
            // the (usually tiny) leftover space on the last slice.
            cursorY = pageH;
            isFirstImageOnDoc = false;
            return;
          }

          if (!isFirstImageOnDoc && cursorY + imgH > pageH) {
            pdf.addPage();
            cursorY = 0;
          }
          pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, cursorY, imgW, imgH);
          cursorY += imgH;
          isFirstImageOnDoc = false;
        });

        // ----- Build the final file - optionally with embedded data -----
        const pdfArrayBuffer = pdf.output('arraybuffer');
        let finalBlob;
        if (config.embedData && window.TF_encodeEmbeddedData) {
          const marker = window.TF_encodeEmbeddedData(config.embedData);
          const markerBytes = new TextEncoder().encode(marker);
          finalBlob = new Blob([pdfArrayBuffer, markerBytes], { type: 'application/pdf' });
        } else {
          finalBlob = new Blob([pdfArrayBuffer], { type: 'application/pdf' });
        }

        const url = URL.createObjectURL(finalBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = config.filename || 'telefire-handover.pdf';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);

        if (callback) callback(true);
      } catch (err) {
        console.error('[TF_generatePDF] failed', err);
        if (callback) callback(false);
      }
    })();

    return true; // async operation started
  };

})(window);
