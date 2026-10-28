let rollCanvas = null;
let currentFile = null;
let currentPreviewUrl = null;
let currentLayout = null;

document.addEventListener('DOMContentLoaded', async () => {
  rollCanvas = new RollCanvas('rollCanvas', 'canvasContainer');
  initUIEvents();
  renderSchemes();
  await loadSamples();
});

// Render FINAT Schemes grid
function renderSchemes() {
  const container = document.getElementById('schemesGrid');
  if (!container) return;

  container.innerHTML = FINAT_SCHEMES_DATA.map(s => `
    <div class="scheme-card rounded-lg p-2 flex flex-col items-center text-center ${s.id === 1 ? 'active' : ''}" 
         onclick="selectScheme(${s.id})" id="schemeCard_${s.id}">
      <div class="mb-1">${s.iconSvg}</div>
      <div class="font-bold text-xs text-white">${s.name}</div>
      <div class="text-[9px] text-slate-400 mt-0.5 leading-tight">${s.short}</div>
    </div>
  `).join('');
}

function selectScheme(id) {
  document.querySelectorAll('.scheme-card').forEach(c => c.classList.remove('active'));
  const card = document.getElementById(`schemeCard_${id}`);
  if (card) card.classList.add('active');
  document.getElementById('windingSchemeInput').value = id;
  recalculate();
}

async function loadSamples() {
  try {
    const res = await fetch('/api/samples');
    const data = await res.json();
    const container = document.getElementById('samplesList');
    if (!container) return;

    if (data.samples && data.samples.length > 0) {
      container.innerHTML = data.samples.map((s) => `
        <button id="sampleBtn_${encodeURIComponent(s.filename)}" 
                onclick="selectSample('${s.filename}')" 
                class="sample-btn flex items-center gap-2 p-1.5 text-left transition w-full group overflow-hidden active:scale-98">
          <div class="w-7 h-9 rounded-[3px] bg-[#181818] overflow-hidden flex items-center justify-center shrink-0 border border-[#303030]">
            <img src="${s.preview_data_url}" class="w-full h-full object-contain" />
          </div>
          <div class="overflow-hidden flex-1 min-w-0">
            <div class="text-[11px] font-medium text-[#dedede] group-hover:text-white truncate">${s.name}</div>
            <div class="text-[9px] text-[#969696] font-mono">${s.cut_width_mm}×${s.cut_height_mm} мм</div>
          </div>
        </button>
      `).join('');

      // Auto-select the first sample on initial load
      selectSample(data.samples[0].filename);
    }
  } catch (err) {
    console.error('Failed to load samples:', err);
  }
}

async function selectSample(filename) {
  // Highlight active button using CSS classes
  document.querySelectorAll('.sample-btn').forEach(b => {
    b.classList.remove('active');
  });
  const activeBtn = document.getElementById(`sampleBtn_${encodeURIComponent(filename)}`);
  if (activeBtn) {
    activeBtn.classList.add('active');
  }

  try {
    const res = await fetch('/api/inspect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename, type: 'sample' })
    });
    const data = await res.json();
    applyFileInspection(data, filename, 'sample');
  } catch (err) {
    console.error('Failed to inspect sample:', err);
  }
}

const CAD_SVG_ICON = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="48" viewBox="0 0 40 48"><rect x="3" y="3" width="34" height="42" rx="3" fill="%230f172a" stroke="%23ec4899" stroke-width="2" stroke-dasharray="3,2"/><text x="20" y="24" font-family="sans-serif" font-size="8" font-weight="bold" fill="%2338bdf8" text-anchor="middle">CAD</text><text x="20" y="34" font-family="sans-serif" font-size="6" fill="%2394a3b8" text-anchor="middle">CUT</text></svg>`;

function setDimensionOnlyMode() {
  document.querySelectorAll('.sample-btn').forEach(b => {
    b.classList.remove('border-[#38bdf8]', 'bg-[#18233a]', 'ring-1', 'ring-[#38bdf8]/40');
    b.classList.add('border-[#22283a]', 'bg-[#11141d]');
  });

  const labelW = parseFloat(document.getElementById('labelWidthInput').value) || 50.0;
  const labelH = parseFloat(document.getElementById('labelHeightInput').value) || 80.0;

  const displayName = `спуск_висічки_${labelW}x${labelH}мм`;
  currentFile = { 
    filename: '', 
    type: 'none', 
    original_filename: displayName,
    isNoFile: true
  };
  currentPreviewUrl = null;

  document.getElementById('currentFileName').innerText = displayName;
  document.getElementById('currentFileDims').innerText = `${labelW} × ${labelH} мм • Висічка`;
  document.getElementById('currentFilePreview').src = CAD_SVG_ICON;
  document.getElementById('currentFileInfoPanel').classList.remove('hidden');

  recalculate();

  const wInput = document.getElementById('labelWidthInput');
  if (wInput) {
    wInput.focus();
    wInput.select();
  }
}

function applyFileInspection(info, filename, type) {
  const displayName = info.original_filename || info.name || filename.replace(/^[a-f0-9]{8}_/, '');
  currentFile = { 
    filename, 
    type, 
    original_filename: displayName 
  };
  currentPreviewUrl = info.preview_data_url;

  document.getElementById('labelWidthInput').value = info.cut_width_mm;
  document.getElementById('labelHeightInput').value = info.cut_height_mm;
  document.getElementById('bleedInput').value = info.bleed_mm || 0;

  document.getElementById('currentFileName').innerText = displayName;
  const bleedVal = info.bleed_mm || 0;
  document.getElementById('currentFileDims').innerText = `${info.cut_width_mm} × ${info.cut_height_mm} мм • Вильоти: ${bleedVal} мм`;
  document.getElementById('currentFilePreview').src = info.preview_data_url;
  document.getElementById('currentFileInfoPanel').classList.remove('hidden');

  recalculate();
}

async function recalculate() {
  const labelW = parseFloat(document.getElementById('labelWidthInput').value) || 24.0;
  const labelH = parseFloat(document.getElementById('labelHeightInput').value) || 40.0;
  const bleed = parseFloat(document.getElementById('bleedInput').value) || 0.0;
  const rollW = parseFloat(document.getElementById('rollWidthInput').value) || 330.0;
  const printableW = parseFloat(document.getElementById('printableWidthInput').value) || 305.0;
  const gapX = parseFloat(document.getElementById('gapXInput').value) || 2.0;
  const gapY = parseFloat(document.getElementById('gapYInput').value) || 2.0;
  const meterL = parseFloat(document.getElementById('meterLengthInput').value) || 1000.0;

  if (currentFile && currentFile.isNoFile) {
    const displayName = `спуск_висічки_${labelW}x${labelH}мм`;
    currentFile.original_filename = displayName;
    const nameEl = document.getElementById('currentFileName');
    const dimsEl = document.getElementById('currentFileDims');
    if (nameEl) nameEl.innerText = displayName;
    if (dimsEl) dimsEl.innerText = `${labelW} × ${labelH} мм • Висічка`;
  }

  const appType = document.querySelector('input[name="appType"]:checked')?.value || 'manual';
  const orientationMode = document.querySelector('input[name="orientationMode"]:checked')?.value || 'auto_max';
  const windingScheme = parseInt(document.getElementById('windingSchemeInput').value) || 1;

  const payload = {
    label_width: labelW,
    label_height: labelH,
    bleed: bleed,
    roll_width: rollW,
    printable_width: printableW,
    meter_length: meterL,
    gap_x: gapX,
    gap_y: gapY,
    application_type: appType,
    orientation_mode: orientationMode,
    winding_scheme: windingScheme
  };

  try {
    const res = await fetch('/api/calculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    currentLayout = data.layout;

    updateKPIs(data.layout);
    updateComparisonCard(data.layout);

    if (rollCanvas) {
      rollCanvas.setData(data.layout, currentPreviewUrl);
    }
  } catch (err) {
    console.error('Calculation error:', err);
  }
}

function updateKPIs(layout) {
  const active = layout.active;
  document.getElementById('kpiYield').innerText = `${active.total_per_meter} шт/м`;
  document.getElementById('kpiLanes').innerText = `${active.lanes}`;
  document.getElementById('kpiRepeats').innerText = `${active.repeats}`;
  document.getElementById('kpiLayoutW').innerText = `${active.layout_width} мм`;
  document.getElementById('kpiMargins').innerText = `${active.side_margin} мм`;
  document.getElementById('kpiStep').innerText = `${active.step_x} мм`;
  document.getElementById('kpiEfficiency').innerText = `${active.efficiency_pct}%`;

  const tLayoutW = document.getElementById('telemetryLayoutW');
  const tYield = document.getElementById('telemetryYield');
  const tLanesRepeats = document.getElementById('telemetryLanesRepeats');
  const tEfficiency = document.getElementById('telemetryEfficiency');
  if (tLayoutW) tLayoutW.innerText = `${active.layout_width} мм`;
  if (tYield) tYield.innerText = `${active.total_per_meter} шт/м`;
  if (tLanesRepeats) tLanesRepeats.innerText = `${active.lanes} струмків × ${active.repeats} рядів`;
  if (tEfficiency) tEfficiency.innerText = `${active.efficiency_pct}%`;

  updateCirculationCalculator();
}

function updateCirculationCalculator() {
  if (!currentLayout || !currentLayout.active) return;
  const active = currentLayout.active;
  const params = currentLayout.params;

  const circInput = document.getElementById('calcCirculationInput');
  const wasteSelect = document.getElementById('calcWastePercent');
  if (!circInput || !wasteSelect) return;

  const circulation = Math.max(1, parseInt(circInput.value) || 10000);
  const lanes = Math.max(1, active.lanes || 1);
  const stepX = active.step_x || 26.0; // mm along web feed
  const rollWidthMm = params.roll_width || 330.0;

  // Exact rows needed to complete circulation
  const rowsNeeded = Math.ceil(circulation / lanes);

  // Pure net meters along roll
  const metersNet = (rowsNeeded * stepX) / 1000.0;

  // Gross meters with allowance / waste
  const wasteVal = wasteSelect.value;
  let metersGross = metersNet;
  if (wasteVal.endsWith('m')) {
    const extraM = parseFloat(wasteVal) || 0;
    metersGross = metersNet + extraM;
  } else {
    const extraPct = parseFloat(wasteVal) || 0;
    metersGross = metersNet * (1.0 + extraPct / 100.0);
  }

  // Square meters of material
  const sqMeters = metersGross * (rollWidthMm / 1000.0);

  const formatMeters = (val) => {
    if (val >= 1000) return `${Math.round(val).toLocaleString('uk-UA')} м`;
    return `${val.toFixed(1)} м`;
  };

  const elMetersNet = document.getElementById('calcMetersNet');
  const elRowsCount = document.getElementById('calcRowsCount');
  const elMetersGross = document.getElementById('calcMetersGross');
  const elSqMeters = document.getElementById('calcSquareMeters');

  if (elMetersNet) elMetersNet.innerText = `~${formatMeters(metersNet)}`;
  if (elRowsCount) elRowsCount.innerText = `(${rowsNeeded.toLocaleString('uk-UA')} ряд.)`;
  if (elMetersGross) elMetersGross.innerText = `~${formatMeters(metersGross)}`;
  if (elSqMeters) elSqMeters.innerText = `(${sqMeters.toFixed(1)} м²)`;
}

function updateComparisonCard(layout) {
  const cmp = layout.comparison;
  const port = cmp.portrait;
  const land = cmp.landscape;

  document.getElementById('portraitYield').innerText = `${port.total_per_meter} шт/м`;
  document.getElementById('portraitDetails').innerText = `${port.lanes} стр. × ${port.repeats} ряд.`;

  document.getElementById('landscapeYield').innerText = `${land.total_per_meter} шт/м`;
  document.getElementById('landscapeDetails').innerText = `${land.lanes} стр. × ${land.repeats} ряд.`;

  const recBadge = document.getElementById('recommendationBadge');

  if (cmp.diff_labels > 0) {
    const win = cmp.best_orientation === 'landscape' ? 'Альбомна' : 'Книжкова';
    recBadge.innerText = `${win} (+${cmp.diff_labels} шт/м)`;
    recBadge.className = 'px-1.5 py-0.2 rounded text-[9px] font-bold bg-[#172033] text-[#38bdf8] border border-[#243352]';
  } else {
    recBadge.innerText = 'Однакові';
    recBadge.className = 'px-1.5 py-0.2 rounded text-[9px] font-bold bg-[#151926] text-[#8893a7]';
  }
}

function initUIEvents() {
  const inputIds = [
    'labelWidthInput', 'labelHeightInput', 'bleedInput', 'gapXInput', 'gapYInput',
    'rollWidthInput', 'printableWidthInput'
  ];
  inputIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', debounce(recalculate, 200));
  });

  // App type radio
  document.querySelectorAll('input[name="appType"]').forEach(r => {
    r.addEventListener('change', (e) => {
      const isAuto = e.target.value === 'auto';
      document.getElementById('autoSchemesSection').classList.toggle('hidden', !isAuto);
      document.getElementById('manualOrientationSection').classList.toggle('hidden', isAuto);
      recalculate();
    });
  });

  // Orientation mode radio
  document.querySelectorAll('input[name="orientationMode"]').forEach(r => {
    r.addEventListener('change', recalculate);
  });

  // Dimension-only mode button
  document.getElementById('btnDimensionOnly')?.addEventListener('click', setDimensionOnlyMode);

  // Circulation & Web Meters Calculator events
  const circInput = document.getElementById('calcCirculationInput');
  if (circInput) {
    circInput.addEventListener('input', updateCirculationCalculator);
    circInput.addEventListener('change', updateCirculationCalculator);
  }
  const wasteSelect = document.getElementById('calcWastePercent');
  if (wasteSelect) {
    wasteSelect.addEventListener('change', updateCirculationCalculator);
  }

  // File upload
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('fileInput');

  if (dropzone && fileInput) {
    // Prevent nested click recursion
    fileInput.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('border-[#38bdf8]', 'bg-[#38bdf8]/10');
    });
    dropzone.addEventListener('dragleave', () => {
      dropzone.classList.remove('border-[#38bdf8]', 'bg-[#38bdf8]/10');
    });
    dropzone.addEventListener('drop', async (e) => {
      e.preventDefault();
      dropzone.classList.remove('border-[#38bdf8]', 'bg-[#38bdf8]/10');
      if (e.dataTransfer && e.dataTransfer.files.length > 0) {
        await uploadFile(e.dataTransfer.files[0]);
      }
    });

    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      // Reset input value immediately so the exact same file can be selected again
      e.target.value = '';
      if (file) {
        await uploadFile(file);
      }
    });
  }

  // Canvas toolbar
  document.getElementById('btnZoomIn')?.addEventListener('click', () => rollCanvas.zoomIn());
  document.getElementById('btnZoomOut')?.addEventListener('click', () => rollCanvas.zoomOut());
  document.getElementById('btnFitMeter')?.addEventListener('click', () => rollCanvas.fitMeter());
  document.getElementById('btnResetView')?.addEventListener('click', () => rollCanvas.fitMeter());

  // Web orientation toggle
  const pill = document.getElementById('printDirectionPill');
  const btnHoriz = document.getElementById('toggleWebHoriz');
  const btnVert = document.getElementById('toggleWebVert');

  btnHoriz?.addEventListener('click', () => {
    rollCanvas.setOrientation('horizontal');
    btnHoriz.className = 'cad-segment-btn active flex items-center gap-1 whitespace-nowrap active:scale-95';
    btnVert.className = 'cad-segment-btn flex items-center gap-1 whitespace-nowrap active:scale-95';
    if (pill) pill.innerHTML = '1000 мм (хід)';
  });
  btnVert?.addEventListener('click', () => {
    rollCanvas.setOrientation('vertical');
    btnVert.className = 'cad-segment-btn active flex items-center gap-1 whitespace-nowrap active:scale-95';
    btnHoriz.className = 'cad-segment-btn flex items-center gap-1 whitespace-nowrap active:scale-95';
    if (pill) pill.innerHTML = '1000 мм (хід)';
  });

  // Dropdown Menu: Layers & Prepress Marks
  const btnLayersDropdown = document.getElementById('btnLayersDropdown');
  const layersDropdownMenu = document.getElementById('layersDropdownMenu');
  const dropdownArrow = document.getElementById('dropdownArrow');
  const layersContainer = document.getElementById('layersDropdownContainer');

  if (btnLayersDropdown && layersDropdownMenu) {
    btnLayersDropdown.addEventListener('click', (e) => {
      e.stopPropagation();
      const isHidden = layersDropdownMenu.classList.contains('hidden');
      layersDropdownMenu.classList.toggle('hidden', !isHidden);
      if (dropdownArrow) dropdownArrow.classList.toggle('rotate-180', isHidden);
    });

    // Keep dropdown open when interacting with checkboxes inside
    layersDropdownMenu.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    // Close when clicking outside
    document.addEventListener('click', (e) => {
      if (layersContainer && !layersContainer.contains(e.target)) {
        layersDropdownMenu.classList.add('hidden');
        if (dropdownArrow) dropdownArrow.classList.remove('rotate-180');
      }
    });
  }

  function updateLayersCountBadge() {
    const ids = ['chkCutContour', 'chkBleed', 'chkPrintableZone', 'chkEyeMarks', 'chkRulers'];
    const activeCount = ids.filter(id => document.getElementById(id)?.checked).length;
    const badge = document.getElementById('layersCountBadge');
    if (badge) badge.innerText = activeCount;
  }

  // Layer Checkboxes inside Dropdown
  document.getElementById('chkCutContour')?.addEventListener('change', (e) => {
    rollCanvas.showCutContour = e.target.checked;
    rollCanvas.render();
    updateLayersCountBadge();
  });
  document.getElementById('chkBleed')?.addEventListener('change', (e) => {
    rollCanvas.showBleed = e.target.checked;
    rollCanvas.render();
    updateLayersCountBadge();
  });
  document.getElementById('chkPrintableZone')?.addEventListener('change', (e) => {
    rollCanvas.showPrintableZone = e.target.checked;
    rollCanvas.render();
    updateLayersCountBadge();
  });
  document.getElementById('chkEyeMarks')?.addEventListener('change', (e) => {
    rollCanvas.showEyeMarks = e.target.checked;
    rollCanvas.render();
    updateLayersCountBadge();
  });
  document.getElementById('chkRulers')?.addEventListener('change', (e) => {
    rollCanvas.showRulers = e.target.checked;
    rollCanvas.showColorStrip = e.target.checked;
    rollCanvas.render();
    updateLayersCountBadge();
  });

  // Export PDF & Tech Card
  document.getElementById('btnExportPdf')?.addEventListener('click', exportImpositionPdf);
  document.getElementById('btnTechPassport')?.addEventListener('click', openTechPassportModal);
}

async function uploadFile(file) {
  const dropzoneContent = document.getElementById('dropzoneContent');
  const dropzoneLoading = document.getElementById('dropzoneLoading');
  if (dropzoneContent && dropzoneLoading) {
    dropzoneContent.classList.add('hidden');
    dropzoneLoading.classList.remove('hidden');
  }

  const formData = new FormData();
  formData.append('file', file);

  try {
    const res = await fetch('/api/upload', {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    if (data.error) {
      alert(`Помилка: ${data.error}`);
      return;
    }
    applyFileInspection(data, data.filename, 'upload');
  } catch (err) {
    console.error('Upload error:', err);
    alert('Помилка завантаження файлу. Перевірте формат або зв\'язок із сервером.');
  } finally {
    if (dropzoneContent && dropzoneLoading) {
      dropzoneLoading.classList.add('hidden');
      dropzoneContent.classList.remove('hidden');
    }
  }
}

async function exportImpositionPdf() {
  if (!currentFile || !currentLayout) {
    alert('Спочатку завантажте або виберіть етикетку.');
    return;
  }

  const btn = document.getElementById('btnExportPdf');
  const originalHtml = btn.innerHTML;
  btn.innerHTML = `<span class="inline-block w-2.5 h-2.5 border-2 border-white border-t-transparent rounded-full animate-spin mr-1"></span> Генерація...`;
  btn.disabled = true;

  const cleanOriginalName = currentFile.original_filename || document.getElementById('currentFileName')?.innerText || '';
  const circVal = parseInt(document.getElementById('calcCirculationInput')?.value) || 10000;
  const wasteVal = document.getElementById('calcWastePercent')?.value || '5';

  try {
    const res = await fetch('/api/export_pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: currentFile.filename,
        original_filename: cleanOriginalName,
        type: currentFile.type,
        layout: currentLayout,
        circulation: circVal,
        waste: wasteVal,
        add_eye_marks: rollCanvas.showEyeMarks,
        add_cut_lines: rollCanvas.showCutContour,
        add_info_banner: true,
        include_cmyk_scale: rollCanvas.showColorStrip,
        add_print_direction: false
      })
    });
    const data = await res.json();
    if (data.download_url) {
      // Trigger download with clean filename
      const link = document.createElement('a');
      link.href = data.download_url;
      link.download = data.filename || `${cleanOriginalName}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      alert(`Помилка експорту: ${data.error}`);
    }
  } catch (err) {
    console.error('Export failed:', err);
    alert('Не вдалося експортувати PDF.');
  } finally {
    btn.innerHTML = originalHtml;
    btn.disabled = false;
  }
}

function openTechPassportModal() {
  if (!currentLayout) return;
  const p = currentLayout.params;
  const a = currentLayout.active;
  const cleanFileName = currentFile?.original_filename || document.getElementById('currentFileName')?.innerText || 'етикетка.pdf';

  const circInput = document.getElementById('calcCirculationInput');
  const circulation = Math.max(1, parseInt(circInput?.value) || 10000);
  const lanes = Math.max(1, a.lanes || 1);
  const rowsNeeded = Math.ceil(circulation / lanes);
  const stepX = a.step_x || 26.0;
  const metersNet = (rowsNeeded * stepX) / 1000.0;
  const wasteSelect = document.getElementById('calcWastePercent');
  const wasteVal = wasteSelect?.value || '5';
  let metersGross = metersNet;
  if (wasteVal.endsWith('m')) {
    metersGross += parseFloat(wasteVal) || 0;
  } else {
    metersGross *= (1.0 + (parseFloat(wasteVal) || 0) / 100.0);
  }
  const sqMeters = (metersGross * (p.roll_width / 1000.0)).toFixed(1);

  const content = document.getElementById('techPassportContent');
  content.innerHTML = `
    <div class="border-b border-[#333333] pb-3 mb-4 flex justify-between items-start">
      <div>
        <h2 class="text-base font-bold text-white tracking-wide">ТЕХНІЧНИЙ ПАСПОРТ РОЗКЛАДКИ</h2>
        <div class="text-[11px] text-[#969696]">Спуск на рулонне полотно 330 мм (довжина 1000 мм)</div>
      </div>
      <div class="text-right font-mono text-xs text-[#969696]">
        Дата: ${new Date().toLocaleDateString('uk-UA')}
      </div>
    </div>

    <div class="grid grid-cols-2 gap-2.5 mb-4 text-xs">
      <div class="bg-[#1c1c1c] p-3 rounded-[4px] border border-[#333333] space-y-1.5">
        <div class="font-bold text-[#5684c9] uppercase text-[10px] tracking-wider mb-2">Параметри висічки</div>
        <div>Файл: <span class="font-mono text-white font-medium">${cleanFileName}</span></div>
        <div>Розмір етикетки: <span class="font-bold text-white font-mono">${p.label_width} × ${p.label_height} мм</span></div>
        <div>Спосіб нанесення: <span class="font-bold text-[#73c991]">${p.application_type === 'manual' ? 'РУЧНЕ' : 'АВТОМАТИЧНЕ'}</span></div>
        ${p.application_type === 'auto' ? `<div>Схема намотки: <span class="text-[#e5c07b] font-bold">Схема №${p.winding_scheme}</span></div>` : ''}
      </div>

      <div class="bg-[#1c1c1c] p-3 rounded-[4px] border border-[#333333] space-y-1.5">
        <div class="font-bold text-[#5684c9] uppercase text-[10px] tracking-wider mb-2">Параметри спуску на рулон</div>
        <div>Ширина матеріалу: <span class="font-bold text-white font-mono">${p.roll_width} мм</span></div>
        <div>Ширина друку: <span class="font-bold text-white font-mono">${a.layout_width} мм</span> (ліміт: ${p.printable_width} мм)</div>
        <div>Бокові поля рулону: <span class="text-white font-mono">${a.side_margin} мм</span></div>
        <div>Міжструмковий зазор (Y): <span class="text-white font-mono">${p.gap_y} мм</span></div>
        <div>Крок (рапорт X): <span class="font-bold text-white font-mono">${a.step_x} мм</span></div>
      </div>
    </div>

    <div class="bg-[#202020] border border-[#333333] p-4 rounded-[4px] mb-3 text-center">
      <div class="text-[11px] text-[#969696] font-semibold tracking-wider">ГОЛОВНИЙ ПОКАЗНИК ВИХОДУ:</div>
      <div class="text-3xl font-extrabold text-[#5684c9] my-1 font-mono">${a.total_per_meter} <span class="text-sm font-normal text-[#969696]">шт / пог. метр</span></div>
      <div class="text-xs text-[#969696] font-mono">${a.lanes} струмків × ${a.repeats} рядів на 1000 мм · Корисне заповнення: ${a.efficiency_pct}%</div>
    </div>

    <div class="bg-[#1c1c1c] border border-[#333333] p-3.5 rounded-[4px] mb-4">
      <div class="flex items-center justify-between border-b border-[#2d2d2d] pb-2 mb-2.5">
        <div class="text-[11px] text-[#dedede] font-semibold tracking-wider uppercase font-sans">Розрахунок тиражу замовлення:</div>
        <div class="text-sm font-bold font-mono text-[#73c991]">${circulation.toLocaleString('uk-UA')} шт</div>
      </div>
      <div class="grid grid-cols-3 gap-2 text-center">
        <div class="bg-[#181818] p-2 rounded-[4px] border border-[#2b2b2b]">
          <span class="text-[9px] text-[#969696] uppercase block font-sans">Чистий метраж</span>
          <span class="text-base font-bold text-[#e5c07b] font-mono">~${metersNet.toFixed(1)} м</span>
          <span class="text-[9px] text-[#707070] block font-mono">(${rowsNeeded.toLocaleString('uk-UA')} рядів)</span>
        </div>
        <div class="bg-[#181818] p-2 rounded-[4px] border border-[#2b2b2b]">
          <span class="text-[9px] text-[#969696] uppercase block font-sans">З приладкою (+${wasteVal}${wasteVal.endsWith('m') ? '' : '%'})</span>
          <span class="text-base font-bold text-[#73c991] font-mono">~${metersGross.toFixed(1)} м</span>
          <span class="text-[9px] text-[#707070] block font-mono">довжина рулону</span>
        </div>
        <div class="bg-[#181818] p-2 rounded-[4px] border border-[#2b2b2b]">
          <span class="text-[9px] text-[#969696] uppercase block font-sans">Площа матеріалу</span>
          <span class="text-base font-bold text-[#5684c9] font-mono">${sqMeters} м²</span>
          <span class="text-[9px] text-[#707070] block font-mono">рулон ${p.roll_width} мм</span>
        </div>
      </div>
    </div>

    <div class="flex justify-end gap-2 pt-2 border-t border-[#333333]">
      <button onclick="window.print()" class="cad-btn-primary px-3 py-1 text-xs font-semibold active:scale-95 transition flex items-center">
        Друк паспорта
      </button>
      <button onclick="closeTechPassportModal()" class="cad-btn px-3 py-1 text-xs font-medium active:scale-95 transition">
        Закрити
      </button>
    </div>
  `;

  document.getElementById('techPassportModal').classList.remove('hidden');
}

function closeTechPassportModal() {
  document.getElementById('techPassportModal').classList.add('hidden');
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}
