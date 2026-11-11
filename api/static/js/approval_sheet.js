// =============================================================================
// ROLL-PRINT CAD — Approval Sheet (Бланк погодження замовлення)
// =============================================================================

let approvalLabelImage = null;

function initApprovalSheet() {
  document.getElementById('btnApprovalSheet')?.addEventListener('click', openApprovalModal);
  document.getElementById('btnCloseApprovalModal')?.addEventListener('click', closeApprovalModal);
  document.getElementById('btnApprovalModalBackdrop')?.addEventListener('click', closeApprovalModal);
  document.getElementById('btnExportApprovalPdf')?.addEventListener('click', exportApprovalPdf);
  document.getElementById('btnExportApprovalPng')?.addEventListener('click', exportApprovalPng);

  // Re-render canvas on any input change
  const modal = document.getElementById('approvalModal');
  if (modal) {
    modal.querySelectorAll('input, select, textarea').forEach(el => {
      el.addEventListener('input', () => {
        if (el.id === 'approvalManager') localStorage.setItem('approval_manager', el.value);
        if (el.id === 'approvalDesigner') localStorage.setItem('approval_designer', el.value);
        renderApprovalCanvas();
      });
      el.addEventListener('change', renderApprovalCanvas);
    });
  }

  // Material combobox (select preset OR type custom value)
  const matBtn = document.getElementById('btnMaterialDropdown');
  const matMenu = document.getElementById('approvalMaterialMenu');
  const matInput = document.getElementById('approvalMaterial');
  if (matBtn && matMenu && matInput) {
    matBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      matMenu.classList.toggle('hidden');
    });
    matMenu.querySelectorAll('.approval-mat-opt').forEach(opt => {
      opt.addEventListener('click', () => {
        matInput.value = opt.dataset.val || opt.textContent.trim();
        matMenu.classList.add('hidden');
        renderApprovalCanvas();
      });
    });
    document.addEventListener('click', (e) => {
      if (!matMenu.classList.contains('hidden') && !matMenu.contains(e.target) && e.target !== matBtn) {
        matMenu.classList.add('hidden');
      }
    });
  }

  // ESC key to close menu or modal
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (matMenu && !matMenu.classList.contains('hidden')) {
        matMenu.classList.add('hidden');
        return;
      }
      const m = document.getElementById('approvalModal');
      if (m && !m.classList.contains('hidden')) closeApprovalModal();
    }
  });
}

function openApprovalModal() {
  const modal = document.getElementById('approvalModal');
  if (!modal) return;

  const p = currentLayout ? currentLayout.params : { label_width: 72, label_height: 36, roll_width: 330, gap_x: 2 };
  const a = currentLayout ? currentLayout.active : { winding_scheme: 1 };

  const rawName = currentFile?.original_filename || document.getElementById('currentFileName')?.innerText || 'макет_етикетки';
  const cleanName = rawName.replace(/\.[^/.]+$/, "");

  const today = new Date();
  const dateStr = String(today.getDate()).padStart(2, '0') + '.' + 
                  String(today.getMonth() + 1).padStart(2, '0') + '.' + 
                  today.getFullYear();

  const circInput = document.getElementById('calcCirculationInput');
  const circVal = circInput?.value ? parseInt(circInput.value) : 10000;

  // Pre-fill inputs
  setVal('approvalFileName', cleanName);
  setVal('approvalDate', dateStr);
  setVal('approvalCirculation', circVal);
  setVal('approvalLabelW', p.label_width);
  setVal('approvalLabelH', p.label_height);
  setVal('approvalRollWidth', p.roll_width);
  setVal('approvalExitWidth', '');
  setVal('approvalKnife', '');
  
  if (!document.getElementById('approvalMaterial').value) {
    setVal('approvalMaterial', 'білий глянцевий поліпропілен');
  }

  // Glue radio
  setRadio('approvalGlue', 'acrylic');

  // Application radio synced with current app mode
  const currentAppMode = document.querySelector('input[name="appType"]:checked')?.value || 'auto';
  setRadio('approvalApplicator', currentAppMode === 'manual' ? 'manual' : 'auto');

  setVal('approvalLabelsPerRoll', '');
  setVal('approvalGap', '4 мм (стандарт)');
  setVal('approvalLanes', '1 шт');
  setVal('approvalCore', '76');
  setVal('approvalPantone', 'відсутні');
  
  const noBrandCheck = document.getElementById('approvalNoBranding');
  if (noBrandCheck) noBrandCheck.checked = false;

  setVal('approvalManager', localStorage.getItem('approval_manager') || '');
  setVal('approvalDesigner', localStorage.getItem('approval_designer') || '');
  setVal('approvalApprovedBy', '');
  setVal('approvalApprovalDate', '');

  // Sync unwinding orientation from active layout (manual or auto FINAT)
  const rawRot = currentLayout?.active?.rotation ?? currentLayout?.params?.chosen_rotation ?? 0;
  const normRot = ((parseInt(rawRot, 10) || 0) % 360 + 360) % 360;
  setVal('approvalRollRotation', String(normRot));
  document.getElementById('approvalMaterialMenu')?.classList.add('hidden');

  // Pre-load image for canvas
  const imgUrl = currentPreviewUrl || (currentFile ? currentFile.preview_data_url : null);
  if (imgUrl) {
    approvalLabelImage = new Image();
    approvalLabelImage.onload = () => renderApprovalCanvas();
    approvalLabelImage.src = imgUrl;
  } else {
    approvalLabelImage = null;
  }

  modal.classList.remove('hidden');
  renderApprovalCanvas();
}

function closeApprovalModal() {
  const modal = document.getElementById('approvalModal');
  if (modal) modal.classList.add('hidden');
}

function setVal(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val;
}

function getVal(id, defaultVal = '') {
  const el = document.getElementById(id);
  return el ? (el.value || defaultVal) : defaultVal;
}

function setRadio(name, val) {
  const r = document.querySelector(`input[name="${name}"][value="${val}"]`);
  if (r) r.checked = true;
}

function getRadio(name, defaultVal = '') {
  const r = document.querySelector(`input[name="${name}"]:checked`);
  return r ? r.value : defaultVal;
}

// =============================================================================
// Canvas Renderer (A4 Landscape at 200 DPI: 2338 x 1654 px)
// =============================================================================
function renderApprovalCanvas() {
  const canvas = document.getElementById('approvalCanvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const W = 2338;
  const H = 1654;
  canvas.width = W;
  canvas.height = H;

  // Scale factor from PDF points (841.89 x 595.28) to canvas pixels
  const s = W / 841.89;

  // Clean White Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  // Data
  const dateStr = getVal('approvalDate', '09.11.2026');
  const fileName = getVal('approvalFileName', 'макет_етикетки');
  const labelW = parseFloat(getVal('approvalLabelW', '72'));
  const labelH = parseFloat(getVal('approvalLabelH', '36'));
  const circStr = `${getVal('approvalCirculation', '10000')} шт`;
  const rollWStr = `${getVal('approvalRollWidth', '330')} мм`;
  const exitWStr = getVal('approvalExitWidth', '');
  const knifeStr = getVal('approvalKnife', '');
  const matStr = getVal('approvalMaterial', 'білий глянцевий поліпропілен');
  const glueType = getRadio('approvalGlue', 'acrylic');
  const appType = getRadio('approvalApplicator', 'auto');
  const rawLpr = getVal('approvalLabelsPerRoll', '').trim();
  const labelsPerRoll = rawLpr ? (rawLpr.includes('шт') || rawLpr.includes('мм') ? rawLpr : `${rawLpr} шт`) : '';
  const gapStr = getVal('approvalGap', '4 мм (стандарт)');
  const lanesStr = getVal('approvalLanes', '1 шт');
  const coreStr = `${getVal('approvalCore', '76')} мм`;
  const managerStr = getVal('approvalManager', '');
  const designerStr = getVal('approvalDesigner', '');
  const approvedStr = getVal('approvalApprovedBy', '');
  const approvalDateStr = getVal('approvalApprovalDate', '');
  const pantoneStr = getVal('approvalPantone', 'відсутні');
  const noBrand = document.getElementById('approvalNoBranding')?.checked || false;

  const rotEl = document.getElementById('approvalRollRotation');
  const rawRot = rotEl ? rotEl.value : (currentLayout?.active?.rotation ?? currentLayout?.params?.chosen_rotation ?? 0);
  const layoutRot = ((parseInt(rawRot, 10) || 0) % 360 + 360) % 360;

  // Colors
  const cHeaderCyan = '#00aeef';
  const cLightCyan = '#8dd8f8';
  const cYellow = '#fff200';
  const cMagenta = '#ec008c';
  const cRedText = '#d2232a';
  const cRedBorder = '#ed1c24';
  const cDark = '#231f20';

  // 1. TOP HEADER BANNER
  ctx.fillStyle = cHeaderCyan;
  ctx.fillRect(0, 0, W, 44.8 * s);

  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${13.0 * s}px sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.fillText('ТЕХНІЧНЕ ЗАВДАННЯ НА ВИГОТОВЛЕННЯ ЕТИКЕТКИ ЦИФРОВИЙ РУЛОННИЙ ДРУК', 28 * s, 22.4 * s);

  ctx.fillText('ДАТА:', 672 * s, 22.4 * s);

  // Date Box
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = cDark;
  ctx.lineWidth = 1.0 * s;
  ctx.fillRect(722 * s, 11 * s, 95 * s, 23 * s);
  ctx.strokeRect(722 * s, 11 * s, 95 * s, 23 * s);

  ctx.fillStyle = cDark;
  ctx.font = `bold ${11.5 * s}px sans-serif`;
  ctx.fillText(dateStr, 730 * s, 23 * s);

  // 2. SUBHEADER (Filename + Cut Contour)
  ctx.fillStyle = cLightCyan;
  ctx.fillRect(0, 44.8 * s, 590 * s, 23.2 * s);

  function drawFittedText(text, x, y, maxW, startPt, minPt = 4.5, isBold = true) {
    let sz = startPt;
    while (sz > minPt) {
      ctx.font = `${isBold ? 'bold ' : ''}${sz * s}px sans-serif`;
      if (ctx.measureText(String(text)).width <= maxW) break;
      sz -= 0.25;
    }
    ctx.font = `${isBold ? 'bold ' : ''}${Math.max(sz, minPt) * s}px sans-serif`;
    ctx.fillText(String(text), x, y);
  }

  ctx.fillStyle = cDark;
  ctx.font = `bold ${12.0 * s}px sans-serif`;
  ctx.fillText('Назва файлу', 28 * s, 56.4 * s);

  // Filename box
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(122 * s, 48 * s, 263 * s, 17 * s);
  ctx.strokeRect(122 * s, 48 * s, 263 * s, 17 * s);

  ctx.fillStyle = cDark;
  drawFittedText(fileName, 128 * s, 57 * s, 253 * s, 9.5, 5.0, true);

  // Cut contour yellow box
  ctx.fillStyle = cYellow;
  ctx.fillRect(398 * s, 48 * s, 182 * s, 17 * s);
  ctx.strokeStyle = cMagenta;
  ctx.lineWidth = 1.0 * s;
  ctx.strokeRect(398 * s, 48 * s, 182 * s, 17 * s);

  ctx.fillStyle = cDark;
  ctx.font = `bold ${10.5 * s}px sans-serif`;
  ctx.fillText('Контур різу', 406 * s, 57 * s);

  // Magenta dashed line
  ctx.strokeStyle = cMagenta;
  ctx.lineWidth = 2.0 * s;
  ctx.setLineDash([4 * s, 3 * s]);
  ctx.beginPath();
  ctx.moveTo(484 * s, 56.5 * s);
  ctx.lineTo(574 * s, 56.5 * s);
  ctx.stroke();
  ctx.setLineDash([]);

  // 3. RIGHT SIDEBAR
  const sbX0 = 590 * s;
  ctx.fillStyle = cLightCyan;
  ctx.fillRect(sbX0, 44.8 * s, W - sbX0, H - 44.8 * s);

  function drawParamRow(labelLines, yCenter, boxX0 = 692, boxW = 125, boxH = 16, val = '', valColor = cRedText, fontSz = 10.5) {
    const lines = Array.isArray(labelLines) ? labelLines : [labelLines];
    ctx.fillStyle = cDark;
    if (lines.length === 1) {
      ctx.font = `bold ${9.0 * s}px sans-serif`;
      ctx.fillText(lines[0], sbX0 + 6 * s, yCenter * s);
    } else {
      ctx.font = `bold ${8.0 * s}px sans-serif`;
      ctx.fillText(lines[0], sbX0 + 6 * s, (yCenter - 5) * s);
      ctx.fillText(lines[1], sbX0 + 6 * s, (yCenter + 5) * s);
    }

    const bx = boxX0 * s;
    const by = (yCenter - boxH / 2) * s;
    const bw = boxW * s;
    const bh = boxH * s;

    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = cDark;
    ctx.lineWidth = 1.0 * s;
    ctx.fillRect(bx, by, bw, bh);
    ctx.strokeRect(bx, by, bw, bh);

    if (val) {
      ctx.fillStyle = valColor;
      drawFittedText(val, bx + 5 * s, yCenter * s, bw - 10 * s, fontSz, 4.5, true);
    }
  }

  drawParamRow('Тираж, шт', 86, 692, 125, 16, circStr);
  drawParamRow(['Вихід з рулону', '(ширина, мм)'], 110, 692, 56, 16, exitWStr);
  
  ctx.fillStyle = cDark;
  ctx.font = `bold ${10.5 * s}px sans-serif`;
  ctx.fillText('НІЖ', 755 * s, 110 * s);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(785 * s, 102 * s, 32 * s, 16 * s);
  ctx.strokeRect(785 * s, 102 * s, 32 * s, 16 * s);
  if (knifeStr) {
    ctx.fillStyle = cRedText;
    drawFittedText(knifeStr, 788 * s, 110 * s, 26 * s, 9.5, 5.5, true);
  }

  drawParamRow('Ширина, мм', 134, 692, 65, 16, rollWStr);
  drawParamRow('Матеріал', 158, 692, 125, 16, matStr, cRedText, 9.0);

  // Клей: Акрил + / Каучук
  ctx.fillStyle = cDark;
  ctx.font = `bold ${9.5 * s}px sans-serif`;
  ctx.fillText('Клей', sbX0 + 6 * s, 184 * s);
  ctx.font = `bold ${9.0 * s}px sans-serif`;
  ctx.fillText('Акрил', 692 * s, 184 * s);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(730 * s, 176 * s, 17 * s, 16 * s);
  ctx.strokeRect(730 * s, 176 * s, 17 * s, 16 * s);
  if (glueType === 'acrylic') {
    ctx.fillStyle = cRedText;
    ctx.font = `bold ${12.0 * s}px sans-serif`;
    ctx.fillText('+', 734 * s, 184 * s);
  }

  ctx.fillStyle = cDark;
  ctx.font = `bold ${9.0 * s}px sans-serif`;
  ctx.fillText('Каучук', 756 * s, 184 * s);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(800 * s, 176 * s, 17 * s, 16 * s);
  ctx.strokeRect(800 * s, 176 * s, 17 * s, 16 * s);
  if (glueType === 'rubber') {
    ctx.fillStyle = cRedText;
    ctx.font = `bold ${12.0 * s}px sans-serif`;
    ctx.fillText('+', 804 * s, 184 * s);
  }

  // Поклейщик: Автм. + / Ручний
  ctx.fillStyle = cDark;
  ctx.font = `bold ${9.5 * s}px sans-serif`;
  ctx.fillText('Поклейщик', sbX0 + 6 * s, 208 * s);
  ctx.font = `bold ${9.0 * s}px sans-serif`;
  ctx.fillText('Автм.', 692 * s, 208 * s);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(730 * s, 200 * s, 17 * s, 16 * s);
  ctx.strokeRect(730 * s, 200 * s, 17 * s, 16 * s);
  if (appType === 'auto') {
    ctx.fillStyle = cRedText;
    ctx.font = `bold ${12.0 * s}px sans-serif`;
    ctx.fillText('+', 734 * s, 208 * s);
  }

  ctx.fillStyle = cDark;
  ctx.font = `bold ${9.0 * s}px sans-serif`;
  ctx.fillText('Ручний', 756 * s, 208 * s);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(800 * s, 200 * s, 17 * s, 16 * s);
  ctx.strokeRect(800 * s, 200 * s, 17 * s, 16 * s);
  if (appType === 'manual') {
    ctx.fillStyle = cRedText;
    ctx.font = `bold ${12.0 * s}px sans-serif`;
    ctx.fillText('+', 804 * s, 208 * s);
  }

  drawParamRow(['К-сть. етикеток', 'в рулоні, шт'], 232, 692, 125, 16, labelsPerRoll);
  drawParamRow(['Відстань між', 'етикетками,мм'], 256, 692, 125, 16, gapStr, cRedText, 9.5);
  drawParamRow(['Кількість рядів', 'в рулоні, шт'], 280, 692, 125, 16, lanesStr);
  drawParamRow('Втулка, мм', 304, 692, 125, 16, coreStr);

  // Signatures
  const sigs = [
    ['Менеджер:', managerStr, 332],
    ['Дизайнер:', designerStr, 356],
    ['Затвердив:', approvedStr, 380],
    ['Дата:', approvalDateStr, 404]
  ];
  sigs.forEach(([lbl, val, y]) => {
    ctx.fillStyle = cDark;
    ctx.font = `bold ${9.5 * s}px sans-serif`;
    ctx.fillText(lbl, sbX0 + 10 * s, y * s);

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(692 * s, (y - 8) * s, 125 * s, 18 * s);
    ctx.strokeRect(692 * s, (y - 8) * s, 125 * s, 18 * s);

    if (val) {
      ctx.fillStyle = cDark;
      drawFittedText(val, 698 * s, (y + 1) * s, 115 * s, 9.0, 5.5, false);
    }
  });

  // Warning Box
  const wx = sbX0 + 10 * s;
  const wy = 444 * s;
  const ww = 217 * s;
  const wh = 130 * s;

  ctx.fillStyle = cYellow;
  ctx.fillRect(wx, wy, ww, wh);
  ctx.strokeStyle = cRedBorder;
  ctx.lineWidth = 1.5 * s;
  ctx.strokeRect(wx, wy, ww, wh);

  ctx.fillStyle = cDark;
  ctx.font = `bold ${11.5 * s}px sans-serif`;
  ctx.fillText('Будь ласка, будьте уважні!', wx + 8 * s, wy + 16 * s);

  const warnLines = [
    'Після затвердження макета Замовник несе',
    'відповідальність за правильність всієї вказаної',
    'інформації, а саме: дані по матеріалу, розміри',
    'та конфігурація етикетки, намотка, текстова',
    'інформація, штрих-код, наявність та',
    'розташування знаків та елементів дизайну.'
  ];
  ctx.font = `${8.5 * s}px sans-serif`;
  let lY = wy + 32 * s;
  warnLines.forEach(wl => {
    ctx.fillText(wl, wx + 8 * s, lY);
    lY += 13.5 * s;
  });

  // 4. MIDDLE STRIP: CMYK, PANTONE, BRANDING
  const midY0 = 368 * s;
  const midH = 34 * s;
  ctx.fillStyle = cLightCyan;
  ctx.fillRect(0, midY0, 590 * s, midH);

  // CMYK Swatches
  const swatches = [
    ['C', '#00aeef', '#ffffff'],
    ['M', '#ec008c', '#ffffff'],
    ['Y', '#fff200', cDark],
    ['K', '#231f20', '#ffffff']
  ];
  let curCx = 50 * s;
  swatches.forEach(([letter, bg, fg]) => {
    ctx.fillStyle = bg;
    ctx.fillRect(curCx, midY0 + 4 * s, 24 * s, midH - 8 * s);
    ctx.strokeStyle = cDark;
    ctx.lineWidth = 0.8 * s;
    ctx.strokeRect(curCx, midY0 + 4 * s, 24 * s, midH - 8 * s);

    ctx.fillStyle = fg;
    ctx.font = `bold ${15.0 * s}px sans-serif`;
    ctx.fillText(letter, curCx + 6 * s, midY0 + 17 * s);
    curCx += 28 * s;
  });

  ctx.fillStyle = cDark;
  ctx.font = `bold ${10.0 * s}px sans-serif`;
  ctx.fillText('Додаткові кольори (Pantone)', 175 * s, midY0 + 17 * s);

  // Pantone box
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(348 * s, midY0 + 7 * s, 80 * s, midH - 14 * s);
  ctx.strokeRect(348 * s, midY0 + 7 * s, 80 * s, midH - 14 * s);
  ctx.fillStyle = cDark;
  drawFittedText(pantoneStr, 354 * s, midY0 + 17 * s, 70 * s, 9.0, 5.5, true);

  // Без брендування
  ctx.fillStyle = cDark;
  ctx.font = `bold ${10.0 * s}px sans-serif`;
  ctx.fillText('Без брендування', 442 * s, midY0 + 17 * s);

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(552 * s, midY0 + 7 * s, 20 * s, midH - 14 * s);
  ctx.strokeRect(552 * s, midY0 + 7 * s, 20 * s, midH - 14 * s);
  if (noBrand) {
    ctx.fillStyle = cRedText;
    ctx.font = `bold ${13.0 * s}px sans-serif`;
    ctx.fillText('+', 556 * s, midY0 + 17 * s);
  }

  // 5. CENTRAL ARTWORK AREA
  ctx.fillStyle = cDark;
  ctx.font = `bold ${22.0 * s}px sans-serif`;
  ctx.fillText(`${labelW}x${labelH}мм`, 360 * s, 115 * s);

  // Draw Artwork
  const artTargetBox = {
    x: 70 * s,
    y: 110 * s,
    w: 270 * s,
    h: 240 * s
  };

  if (approvalLabelImage && approvalLabelImage.complete && approvalLabelImage.naturalWidth > 0) {
    const imgAspect = approvalLabelImage.naturalWidth / approvalLabelImage.naturalHeight;
    let pw = artTargetBox.w;
    let ph = artTargetBox.w / imgAspect;
    if (ph > artTargetBox.h) {
      ph = artTargetBox.h;
      pw = artTargetBox.h * imgAspect;
    }
    const px = artTargetBox.x + (artTargetBox.w - pw) / 2;
    const py = artTargetBox.y + (artTargetBox.h - ph) / 2;

    ctx.drawImage(approvalLabelImage, px, py, pw, ph);

    // Dashed cut contour
    ctx.strokeStyle = cMagenta;
    ctx.lineWidth = 1.2 * s;
    ctx.setLineDash([5 * s, 3 * s]);
    ctx.strokeRect(px, py, pw, ph);
    ctx.setLineDash([]);
  } else {
    // Placeholder
    ctx.fillStyle = '#fafafa';
    ctx.fillRect(artTargetBox.x + 30 * s, artTargetBox.y + 20 * s, 200 * s, 180 * s);
    ctx.strokeStyle = cMagenta;
    ctx.lineWidth = 1.2 * s;
    ctx.setLineDash([5 * s, 3 * s]);
    ctx.strokeRect(artTargetBox.x + 30 * s, artTargetBox.y + 20 * s, 200 * s, 180 * s);
    ctx.setLineDash([]);

    ctx.fillStyle = '#999999';
    ctx.font = `bold ${12.0 * s}px sans-serif`;
    ctx.fillText('МАКЕТ ЕТИКЕТКИ', artTargetBox.x + 65 * s, artTargetBox.y + 110 * s);
  }

  // 6. BOTTOM UNWINDING SCHEME (Clean roll + web + undistorted labels)
  // Roll Cylinder on left
  const rxC = 150 * s;
  const ryC = 445 * s;
  const rMaj = 60 * s;
  const rMin = 16 * s;
  const cylBottom = 560 * s;

  // Cylinder Top Ellipse
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = cDark;
  ctx.lineWidth = 1.2 * s;
  ctx.beginPath();
  ctx.ellipse(rxC, ryC, rMaj, rMin, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Core Hole
  const coreW = 20 * s;
  const coreH = 6 * s;
  ctx.fillStyle = '#dadada';
  ctx.beginPath();
  ctx.ellipse(rxC, ryC, coreW, coreH, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Core Callout lines
  ctx.strokeStyle = cRedBorder;
  ctx.lineWidth = 0.8 * s;
  ctx.beginPath();
  ctx.moveTo(rxC - coreW, ryC - 16 * s);
  ctx.lineTo(rxC - coreW, ryC + 6 * s);
  ctx.moveTo(rxC + coreW, ryC - 16 * s);
  ctx.lineTo(rxC + coreW, ryC + 6 * s);
  ctx.moveTo(rxC - coreW - 4 * s, ryC - 16 * s);
  ctx.lineTo(rxC + coreW + 4 * s, ryC - 16 * s);
  ctx.stroke();

  ctx.fillStyle = cDark;
  ctx.font = `bold ${8.0 * s}px sans-serif`;
  ctx.fillText(coreStr, rxC - 10 * s, ryC - 22 * s);

  // Cylinder Side Lines
  ctx.strokeStyle = cDark;
  ctx.lineWidth = 1.2 * s;
  ctx.beginPath();
  ctx.moveTo(rxC - rMaj, ryC);
  ctx.lineTo(rxC - rMaj, cylBottom);
  ctx.stroke();

  // Cylinder Bottom Curve
  ctx.beginPath();
  ctx.ellipse(rxC, cylBottom, rMaj, rMin, 0, 0, Math.PI);
  ctx.stroke();

  // Paper Web extending right
  const webX0 = rxC;
  const webX1 = 540 * s;
  const webY0 = 472 * s;
  const webY1 = 562 * s;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(webX0, webY0, webX1 - webX0, webY1 - webY0);
  ctx.strokeRect(webX0, webY0, webX1 - webX0, webY1 - webY0);

  // Clean Red Arrow along web top (unwinding direction)
  const arrY = webY0 - 9 * s;
  ctx.strokeStyle = cRedBorder;
  ctx.fillStyle = cRedBorder;
  ctx.lineWidth = 1.5 * s;
  ctx.beginPath();
  ctx.moveTo(webX0 + 40 * s, arrY);
  ctx.lineTo(webX1, arrY);
  ctx.stroke();

  // Arrow head
  ctx.beginPath();
  ctx.moveTo(webX1, arrY);
  ctx.lineTo(webX1 - 8 * s, arrY - 4 * s);
  ctx.lineTo(webX1 - 8 * s, arrY + 4 * s);
  ctx.closePath();
  ctx.fill();

  // Repeated Labels along horizontal unwinding web (undistorted aspect ratio, rotation-aware)
  // Matches roll imposition convention: (layoutRot + 270) % 360 in PDF => (90 - layoutRot) % 360 CW on Canvas
  const rotDeg = ((90 - layoutRot) % 360 + 360) % 360;
  const rotRad = (rotDeg * Math.PI) / 180;
  const isRot = rotDeg === 90 || rotDeg === 270;

  const hasLoadedImg = approvalLabelImage && approvalLabelImage.complete && approvalLabelImage.naturalWidth > 0;
  const artAspect = hasLoadedImg
    ? (approvalLabelImage.naturalWidth / approvalLabelImage.naturalHeight)
    : (labelH > 0 ? labelW / labelH : 1.0);
  const visAspect = (isRot && artAspect > 0) ? (1.0 / artAspect) : artAspect;

  const webH = webY1 - webY0;
  const padY = 7 * s;
  const maxLblH = webH - 2 * padY;
  const gapBetween = 14 * s;
  const availWebW = (webX1 - webX0) - 36 * s;

  let visH = maxLblH;
  let visW = visH * visAspect;
  const maxTwoW = (availWebW - gapBetween) / 2.0;
  if (visW > maxTwoW) {
    visW = maxTwoW;
    visH = visAspect > 0 ? (visW / visAspect) : maxLblH;
  }

  let repeats = Math.floor((availWebW + gapBetween) / (visW + gapBetween));
  repeats = Math.max(2, Math.min(6, repeats));

  const ly0 = webY0 + (webH - visH) / 2.0;
  const startLx = webX0 + 18 * s;

  for (let i = 0; i < repeats; i++) {
    const lx0 = startLx + i * (visW + gapBetween);

    ctx.fillStyle = '#fcfcff';
    ctx.fillRect(lx0, ly0, visW, visH);
    ctx.strokeStyle = cMagenta;
    ctx.lineWidth = 0.8 * s;
    ctx.setLineDash([3 * s, 2 * s]);
    ctx.strokeRect(lx0, ly0, visW, visH);
    ctx.setLineDash([]);

    if (hasLoadedImg) {
      ctx.save();
      ctx.translate(lx0 + visW / 2, ly0 + visH / 2);
      ctx.rotate(rotRad);

      const targetW = isRot ? visH : visW;
      const targetH = isRot ? visW : visH;

      ctx.drawImage(approvalLabelImage, -targetW / 2, -targetH / 2, targetW, targetH);
      ctx.restore();
    } else {
      ctx.fillStyle = '#888888';
      ctx.font = `bold ${8.0 * s}px sans-serif`;
      ctx.fillText(`ЕТИКЕТКА ${i + 1}`, lx0 + 8 * s, ly0 + visH / 2);
    }
  }
}

// =============================================================================
// Export Approval Sheet as PDF
// =============================================================================
async function exportApprovalPdf() {
  const btn = document.getElementById('btnExportApprovalPdf');
  const origHtml = btn.innerHTML;
  btn.innerHTML = `<span class="inline-block w-2.5 h-2.5 border-2 border-white border-t-transparent rounded-full animate-spin mr-1"></span> Генерація...`;
  btn.disabled = true;

  const approvalData = {
    filename: getVal('approvalFileName', 'макет_етикетки'),
    date: getVal('approvalDate', ''),
    label_width: parseFloat(getVal('approvalLabelW', '72')),
    label_height: parseFloat(getVal('approvalLabelH', '36')),
    circulation: getVal('approvalCirculation', '10000'),
    roll_width: getVal('approvalRollWidth', '330'),
    exit_width: getVal('approvalExitWidth', ''),
    knife: getVal('approvalKnife', ''),
    material: getVal('approvalMaterial', 'білий глянцевий поліпропілен'),
    glue: getRadio('approvalGlue', 'acrylic'),
    application_type: getRadio('approvalApplicator', 'auto'),
    labels_per_roll: getVal('approvalLabelsPerRoll', ''),
    gap: getVal('approvalGap', '4 мм (стандарт)'),
    lanes: getVal('approvalLanes', '1 шт'),
    core: getVal('approvalCore', '76'),
    pantone: getVal('approvalPantone', 'відсутні'),
    no_branding: document.getElementById('approvalNoBranding')?.checked || false,
    manager: getVal('approvalManager', ''),
    designer: getVal('approvalDesigner', ''),
    approved_by: getVal('approvalApprovedBy', ''),
    approval_date: getVal('approvalApprovalDate', ''),
    winding_scheme: currentLayout?.params?.winding_scheme ? parseInt(currentLayout.params.winding_scheme, 10) : 1,
    roll_rotation: (() => {
      const rotEl = document.getElementById('approvalRollRotation');
      const raw = rotEl ? rotEl.value : (currentLayout?.active?.rotation ?? currentLayout?.params?.chosen_rotation ?? 0);
      return ((parseInt(raw, 10) || 0) % 360 + 360) % 360;
    })()
  };

  try {
    let fetchOptions;
    if (currentFile && currentFile.type === 'upload' && currentUploadedFile) {
      const formData = new FormData();
      formData.append('file', currentUploadedFile);
      formData.append('filename', currentFile.filename || currentUploadedFile.name);
      formData.append('original_filename', approvalData.filename);
      formData.append('type', 'upload');
      formData.append('approval_data', JSON.stringify(approvalData));
      fetchOptions = { method: 'POST', body: formData };
    } else {
      fetchOptions = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: currentFile ? currentFile.filename : null,
          original_filename: approvalData.filename,
          type: currentFile ? currentFile.type : 'sample',
          approval_data: approvalData
        })
      };
    }

    const res = await fetch('/api/export_approval_sheet', { ...fetchOptions });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || `Помилка сервера: ${res.status}`);
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `бланк_погодження_${approvalData.filename}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error('Approval sheet export error:', err);
    alert(`Помилка формування бланку погодження: ${err.message}`);
  } finally {
    btn.innerHTML = origHtml;
    btn.disabled = false;
  }
}

// =============================================================================
// Export Approval Sheet as High-Res PNG
// =============================================================================
function exportApprovalPng() {
  const canvas = document.getElementById('approvalCanvas');
  if (!canvas) return;

  const fileName = getVal('approvalFileName', 'макет_етикетки');
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `бланк_погодження_${fileName}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 'image/png');
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  initApprovalSheet();
});
