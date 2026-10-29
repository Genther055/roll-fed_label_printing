class RollCanvas {
  constructor(canvasId, containerId) {
    this.canvas = document.getElementById(canvasId);
    this.container = document.getElementById(containerId);
    this.ctx = this.canvas.getContext('2d');

    // Pan & Zoom state
    this.scale = 1.0;
    this.offsetX = 0;
    this.offsetY = 0;

    // Drag interaction tracking
    this.isDragging = false;
    this.dragStartX = 0;
    this.dragStartY = 0;
    this.dragInitOffsetX = 0;
    this.dragInitOffsetY = 0;

    // View settings
    this.webOrientation = 'horizontal'; // 'horizontal' or 'vertical'
    this.showCutContour = true;
    this.showRulers = true;
    this.showPrintDirection = true;
    this.showColorStrip = true;
    this.showPrintableZone = true;
    this.showEyeMarks = true;
    this.showBleed = true;

    // Machine Sheet & CMYK Calibration settings (1 sheet ≈ 250 mm)
    this.cmykSheetMode = 'sheet5'; // 'sheet5' (on 5th sheet) or 'all'
    this.previewSheet = 5;         // 5 (Sheet 5 with CMYK) or 1 (Sheets 1-4 without CMYK)
    this.sheetLength = 250.0;      // 1 sheet = ~250 mm
    this.showSheetDividers = true; // Visualise 250 mm sheet boundaries

    // Data
    this.layout = null;
    this.previewImg = null;
    this.hoveredItem = null;

    this.initEvents();
    this.setupResizeObserver();
  }

  setupResizeObserver() {
    this.resizeObserver = new ResizeObserver(() => {
      this.resize();
    });
    this.resizeObserver.observe(this.container);
  }

  initEvents() {
    // Mouse Drag (Pan)
    this.container.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return; // Only left click
      this.isDragging = true;
      this.dragStartX = e.clientX;
      this.dragStartY = e.clientY;
      this.dragInitOffsetX = this.offsetX;
      this.dragInitOffsetY = this.offsetY;
      this.container.style.cursor = 'grabbing';
    });

    window.addEventListener('mouseup', () => {
      if (this.isDragging) {
        this.isDragging = false;
        this.container.style.cursor = 'grab';
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (this.isDragging) {
        const dx = e.clientX - this.dragStartX;
        const dy = e.clientY - this.dragStartY;
        this.offsetX = this.dragInitOffsetX + dx;
        this.offsetY = this.dragInitOffsetY + dy;
        this.render();
      } else {
        this.handleHover(e);
      }
    });

    this.container.addEventListener('mouseleave', () => {
      if (this.hoveredItem !== null) {
        this.hoveredItem = null;
        this.render();
        this.updateHoverHud(null);
      }
    });

    // Smooth Mouse Wheel Zoom (centered on cursor)
    this.container.addEventListener('wheel', (e) => {
      e.preventDefault();

      const rect = this.container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // Smooth exponential zoom factor
      const delta = Math.max(-120, Math.min(120, e.deltaY));
      const zoomMultiplier = Math.exp(-delta * 0.002);
      const newScale = Math.max(0.15, Math.min(12.0, this.scale * zoomMultiplier));

      if (Math.abs(newScale - this.scale) > 0.0001) {
        // Zoom relative to mouse position
        this.offsetX = mouseX - (mouseX - this.offsetX) * (newScale / this.scale);
        this.offsetY = mouseY - (mouseY - this.offsetY) * (newScale / this.scale);
        this.scale = newScale;
        this.render();
      }
    }, { passive: false });

    // Touch Events for Mobile / iPhone / Tablets (Pan & Pinch-to-Zoom)
    this.container.style.touchAction = 'none';
    let touchStartX = 0;
    let touchStartY = 0;
    let touchInitOffsetX = 0;
    let touchInitOffsetY = 0;
    let isTouching = false;
    let initialPinchDist = 0;
    let initialPinchScale = 1;
    let pinchCenterX = 0;
    let pinchCenterY = 0;

    this.container.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        isTouching = true;
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        touchInitOffsetX = this.offsetX;
        touchInitOffsetY = this.offsetY;
        initialPinchDist = 0;
      } else if (e.touches.length === 2) {
        isTouching = false;
        const rect = this.container.getBoundingClientRect();
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        initialPinchDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
        initialPinchScale = this.scale;
        pinchCenterX = (t1.clientX + t2.clientX) / 2 - rect.left;
        pinchCenterY = (t1.clientY + t2.clientY) / 2 - rect.top;
      }
    }, { passive: false });

    this.container.addEventListener('touchmove', (e) => {
      if (e.touches.length === 1 && isTouching) {
        e.preventDefault();
        const dx = e.touches[0].clientX - touchStartX;
        const dy = e.touches[0].clientY - touchStartY;
        this.offsetX = touchInitOffsetX + dx;
        this.offsetY = touchInitOffsetY + dy;
        this.render();
      } else if (e.touches.length === 2 && initialPinchDist > 0) {
        e.preventDefault();
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
        const factor = dist / initialPinchDist;
        const newScale = Math.max(0.15, Math.min(12.0, initialPinchScale * factor));
        if (Math.abs(newScale - this.scale) > 0.0001) {
          this.offsetX = pinchCenterX - (pinchCenterX - this.offsetX) * (newScale / this.scale);
          this.offsetY = pinchCenterY - (pinchCenterY - this.offsetY) * (newScale / this.scale);
          this.scale = newScale;
          this.render();
        }
      }
    }, { passive: false });

    this.container.addEventListener('touchend', (e) => {
      if (e.touches.length === 0) {
        isTouching = false;
        initialPinchDist = 0;
      } else if (e.touches.length === 1) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        touchInitOffsetX = this.offsetX;
        touchInitOffsetY = this.offsetY;
        isTouching = true;
        initialPinchDist = 0;
      }
    }, { passive: true });
  }

  resize() {
    const rect = this.container.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const dpr = window.devicePixelRatio || 1;
    const targetW = Math.round(rect.width * dpr);
    const targetH = Math.round(rect.height * dpr);

    if (this.canvas.width !== targetW || this.canvas.height !== targetH) {
      this.canvas.width = targetW;
      this.canvas.height = targetH;
    }

    this.render();
  }

  setData(layoutData, previewDataUrl) {
    this.layout = layoutData;
    if (previewDataUrl) {
      this.previewImg = new Image();
      this.previewImg.onload = () => this.render();
      this.previewImg.src = previewDataUrl;
    } else {
      this.previewImg = null;
      this.render();
    }
    this.fitMeter();
  }

  fitMeter() {
    if (!this.layout) return;

    const rect = this.container.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const rollW = this.layout.params.roll_width; // 330 mm
    const meterL = this.layout.params.meter_length; // 1000 mm

    let webW, webH;
    if (this.webOrientation === 'horizontal') {
      webW = meterL; // 1000 mm
      webH = rollW;  // 330 mm
    } else {
      webW = rollW;  // 330 mm
      webH = meterL; // 1000 mm
    }

    // Leave generous padding for rulers, top scale, lane labels, and direction arrow
    const extraMmX = 90;
    const extraMmY = 55;
    const availW = Math.max(100, rect.width - 50);
    const availH = Math.max(100, rect.height - 50);

    this.scale = Math.min(availW / (webW + extraMmX), availH / (webH + extraMmY));

    // Center the roll inside the container with offset consideration for left rulers
    this.offsetX = (rect.width - webW * this.scale) / 2 + (this.webOrientation === 'horizontal' ? 22 * this.scale : 0);
    this.offsetY = (rect.height - webH * this.scale) / 2 + (this.webOrientation === 'vertical' ? 16 * this.scale : 0);

    this.render();
  }

  render() {
    const ctx = this.ctx;
    const dpr = window.devicePixelRatio || 1;
    const cw = this.canvas.width / dpr;
    const ch = this.canvas.height / dpr;

    // Reset transform to identity + DPR scaling
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cw, ch);

    if (!this.layout) {
      ctx.fillStyle = '#64748b';
      ctx.font = '13px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Завантажте етикетку або виберіть зразок ліворуч', cw / 2, ch / 2);
      return;
    }

    ctx.save();
    ctx.translate(this.offsetX, this.offsetY);
    ctx.scale(this.scale, this.scale);

    const rollW = this.layout.params.roll_width; // 330 mm
    const meterL = this.layout.params.meter_length; // 1000 mm
    const printableW = this.layout.params.printable_width; // 305 mm
    const isHoriz = this.webOrientation === 'horizontal';

    const webLength = meterL; // 1000 mm
    const webWidth = rollW;   // 330 mm

    // 1. Draw Roll Material Background (White Paper with Clean Edge Border)
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 16 / this.scale;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 4 / this.scale;

    ctx.fillStyle = '#ffffff';
    if (isHoriz) {
      ctx.fillRect(0, 0, webLength, webWidth);
    } else {
      ctx.fillRect(0, 0, webWidth, webLength);
    }
    ctx.shadowColor = 'transparent';

    // Outer edge stroke
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1 / this.scale;
    if (isHoriz) {
      ctx.strokeRect(0, 0, webLength, webWidth);
    } else {
      ctx.strokeRect(0, 0, webWidth, webLength);
    }

    // 2. Draw Printable Area Guidelines (305 mm centered on 330 mm -> 12.5 mm margins)
    if (this.showPrintableZone) {
      const pMargin = (rollW - printableW) / 2; // 12.5 mm
      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 1.2 / this.scale;
      ctx.setLineDash([4 / this.scale, 3 / this.scale]);

      if (isHoriz) {
        // Top guide (y = 12.5 mm)
        ctx.beginPath();
        ctx.moveTo(0, pMargin);
        ctx.lineTo(webLength, pMargin);
        ctx.stroke();

        // Bottom guide (y = 330 - 12.5 mm)
        ctx.beginPath();
        ctx.moveTo(0, rollW - pMargin);
        ctx.lineTo(webLength, rollW - pMargin);
        ctx.stroke();
      } else {
        // Left guide (x = 12.5 mm)
        ctx.beginPath();
        ctx.moveTo(pMargin, 0);
        ctx.lineTo(pMargin, webLength);
        ctx.stroke();

        // Right guide (x = 330 - 12.5 mm)
        ctx.beginPath();
        ctx.moveTo(rollW - pMargin, 0);
        ctx.lineTo(rollW - pMargin, webLength);
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }

    // 3. Draw Eye-Marks (фотометки для датчика висічки)
    if (this.showEyeMarks && this.layout.active.repeats > 0) {
      const pMargin = (rollW - printableW) / 2;
      const stepX = this.layout.active.step_x;
      const startX = (this.layout.positions[0] && this.layout.positions[0].x) || 2;
      ctx.fillStyle = '#0f172a';

      for (let r = 0; r < this.layout.active.repeats; r++) {
        const markPos = startX + r * stepX;
        if (isHoriz) {
          ctx.fillRect(markPos, pMargin / 2 - 2, 4, 3);
        } else {
          ctx.fillRect(pMargin / 2 - 2, markPos, 3, 4);
        }
      }
    }

    // 3.1 Draw CMYK Control Calibration Strip (Шкала контролю кольорів CMYK зверху)
    if (this.showColorStrip) {
      this.drawCMYKStrip(ctx, isHoriz, webLength, webWidth);
    }

    // 3.2 Draw Print Direction Arrow inside the sheet's bottom margin
    // Print direction arrow removed

    // 4. Draw Labels
    const positions = this.layout.positions;

    for (let i = 0; i < positions.length; i++) {
      const pos = positions[i];
      let renderX, renderY, renderW, renderH;

      if (isHoriz) {
        // Horizontal roll: X is length (0..1000 mm), Y is width (0..330 mm)
        renderX = pos.x;
        renderY = pos.y;
        renderW = pos.width;
        renderH = pos.height;
      } else {
        // Vertical roll: X is width (0..330 mm), Y is length (0..1000 mm)
        renderX = pos.y;
        renderY = pos.x;
        renderW = pos.height;
        renderH = pos.width;
      }

      // Draw label image centered at (cx, cy)
      ctx.save();
      const cx = renderX + renderW / 2;
      const cy = renderY + renderH / 2;
      ctx.translate(cx, cy);

      // Label rotation: match PDF imposition rotation exactly
      let finalRotation = pos.rotation;
      if (isHoriz) {
        finalRotation = (pos.rotation + 270) % 360;
      }
      ctx.rotate((finalRotation * Math.PI) / 180);

      const drawW = (finalRotation % 180 === 0) ? renderW : renderH;
      const drawH = (finalRotation % 180 === 0) ? renderH : renderW;

      if (this.previewImg && this.previewImg.complete) {
        ctx.drawImage(this.previewImg, -drawW / 2, -drawH / 2, drawW, drawH);
      } else {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-drawW / 2, -drawH / 2, drawW, drawH);
        // Technical die-cut label blank with centered size
        if (drawW >= 10 && drawH >= 8) {
          ctx.save();
          ctx.fillStyle = '#64748b';
          const fontPx = Math.min(drawW * 0.22, drawH * 0.22, 5.0);
          ctx.font = `600 ${fontPx}px JetBrains Mono, monospace`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const origW = this.layout.params.label_width;
          const origH = this.layout.params.label_height;
          ctx.fillText(`${origW}×${origH}`, 0, 0);
          ctx.restore();
        }
      }
      ctx.restore();

      // Cut contour line (Pink 100% Magenta) - exactly at label cut boundary
      if (this.showCutContour) {
        ctx.strokeStyle = '#ec4899';
        ctx.lineWidth = 0.8 / this.scale;
        ctx.strokeRect(renderX, renderY, renderW, renderH);
      }

      // Highlight on hover (Blender Viewport Selection Highlight)
      if (this.hoveredItem === pos) {
        ctx.strokeStyle = '#4772b3';
        ctx.lineWidth = 2.0 / this.scale;
        ctx.strokeRect(renderX, renderY, renderW, renderH);
        ctx.fillStyle = 'rgba(71, 114, 179, 0.22)';
        ctx.fillRect(renderX, renderY, renderW, renderH);
      }
    }

    // 5. Draw Lane Labels ("Струмок 1", "Струмок 2"...)
    const lanes = this.layout.active.lanes;
    if (lanes > 0) {
      ctx.save();
      for (let l = 1; l <= lanes; l++) {
        const firstPos = positions.find(p => p.lane === l && p.repeat === 1);
        if (!firstPos) continue;

        if (isHoriz) {
          // Horizontal Mode:
          // Lanes run along Y-axis across roll width (0..330 mm).
          // firstPos.y is the top of this lane, firstPos.height is lane height across roll width.
          const laneCenterY = firstPos.y + firstPos.height / 2;
          const fontMm = Math.min(4.5, Math.max(3.2, firstPos.height * 0.14));

          // Precision guide line connecting the lane center to the label
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
          ctx.lineWidth = 0.7 / this.scale;
          ctx.setLineDash([1.5 / this.scale, 1.5 / this.scale]);
          ctx.beginPath();
          ctx.moveTo(-2, laneCenterY);
          ctx.lineTo(-19, laneCenterY);
          ctx.stroke();
          ctx.setLineDash([]);

          // Tiny marker dot at the ruler edge
          ctx.fillStyle = '#38bdf8';
          ctx.beginPath();
          ctx.arc(-2, laneCenterY, 0.8 / this.scale, 0, Math.PI * 2);
          ctx.fill();

          // Lane label text
          ctx.fillStyle = '#7dd3fc';
          ctx.font = `bold ${fontMm}px JetBrains Mono, monospace`;
          ctx.textAlign = 'right';
          ctx.textBaseline = 'middle';
          ctx.fillText(`Струмок ${l}`, -21, laneCenterY);

        } else {
          // Vertical Mode:
          // Lanes run along X-axis across roll width (0..330 mm).
          // firstPos.y is the left coordinate across width, firstPos.height is lane dimension across width.
          const laneCenterX = firstPos.y + firstPos.height / 2;
          const fontMm = Math.min(4.5, Math.max(3.2, firstPos.height * 0.14));

          // Precision guide line connecting the lane center to the label
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
          ctx.lineWidth = 0.7 / this.scale;
          ctx.setLineDash([1.5 / this.scale, 1.5 / this.scale]);
          ctx.beginPath();
          ctx.moveTo(laneCenterX, -2);
          ctx.lineTo(laneCenterX, -17);
          ctx.stroke();
          ctx.setLineDash([]);

          // Tiny marker dot at the ruler edge
          ctx.fillStyle = '#38bdf8';
          ctx.beginPath();
          ctx.arc(laneCenterX, -2, 0.8 / this.scale, 0, Math.PI * 2);
          ctx.fill();

          // Lane label text
          ctx.fillStyle = '#7dd3fc';
          ctx.font = `bold ${fontMm}px JetBrains Mono, monospace`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillText(`Струмок ${l}`, laneCenterX, -19);
        }
      }
      ctx.restore();
    }

    // 6. Draw Millimeter Rulers & Top Metric Scale
    if (this.showRulers) {
      this.drawRulers(ctx, isHoriz, webLength, webWidth);
    }

    // 7. Draw External Print Direction Indicator Guide
    if (this.showPrintDirection) {
      this.drawExternalPrintDirectionBanner(ctx, isHoriz, webLength, webWidth);
    }

    ctx.restore();
  }

  drawSheetDividers(ctx, isHoriz, webLength, webWidth) {
    ctx.save();
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
    ctx.lineWidth = 0.8 / this.scale;
    ctx.setLineDash([4 / this.scale, 3 / this.scale]);

    const sheetSize = 250.0; // 1 sheet ≈ 250 mm
    const fontMm = 3.6;
    ctx.font = `bold ${fontMm}px JetBrains Mono, monospace`;
    ctx.fillStyle = '#64748b';

    if (isHoriz) {
      for (let s = 1; s <= 3; s++) {
        const sx = s * sheetSize;
        ctx.beginPath();
        ctx.moveTo(sx, 0);
        ctx.lineTo(sx, webWidth);
        ctx.stroke();

        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(`Лист ${s} | Лист ${s + 1} (${sx} мм)`, sx, webWidth - 14.0);
      }
    } else {
      for (let s = 1; s <= 3; s++) {
        const sy = s * sheetSize;
        ctx.beginPath();
        ctx.moveTo(0, sy);
        ctx.lineTo(webWidth, sy);
        ctx.stroke();

        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillText(`Лист ${s} | Лист ${s + 1} (${sy} мм)`, 15.0, sy - 1.5);
      }
    }
    ctx.setLineDash([]);
    ctx.restore();
  }

  drawCMYKStrip(ctx, isHoriz, webLength, webWidth) {
    ctx.save();

    // Prepress digital & flexo calibration strip
    const colors = [
      { name: 'Red', solid: '#d9381e', r: 217, g: 56, b: 30 },
      { name: 'Black', solid: '#18181b', r: 24, g: 24, b: 27 },
      { name: 'Cyan', solid: '#009fe3', r: 0, g: 159, b: 227 },
      { name: 'Magenta', solid: '#e6007e', r: 230, g: 0, b: 126 },
      { name: 'Yellow', solid: '#ffea00', r: 255, g: 234, b: 0 }
    ];

    const patchLen = 14.0; // mm along web feed
    const patchThickness = 3.8; // mm across margin
    const patchGap = 1.2;

    if (isHoriz) {
      // Top margin of roll (y = 2.5 to 6.3 mm)
      const stripY = 2.6;
      const cycleLen = colors.length * (patchLen + patchGap) + 16.0; // ~92 mm

      for (let cycleX = 8.0; cycleX < webLength - 50; cycleX += cycleLen) {
        let curX = cycleX;

        // 1. Red patch
        drawGradientPatch(ctx, curX, stripY, patchLen, patchThickness, colors[0], true);
        curX += patchLen + patchGap;

        // Thin black alignment dash between Red and Black
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(curX, stripY + patchThickness / 2 - 0.4, 3.0, 0.8);
        curX += 4.5;

        // 2. Black, Cyan, Magenta, Yellow patches
        for (let i = 1; i < colors.length; i++) {
          drawGradientPatch(ctx, curX, stripY, patchLen, patchThickness, colors[i], true);
          curX += patchLen + patchGap;
        }

        // 3. CMYK Registration Micro-Mark (мікромітка суміщення кольорів)
        const markX = curX + 1.0;
        const markMidY = stripY + patchThickness / 2;

        // Top black alignment dash
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(markX, stripY, 4.2, 0.7);

        // 4 color micro-dots in the center
        const dotR = 0.65;
        // Cyan dot
        ctx.fillStyle = '#009fe3';
        ctx.beginPath();
        ctx.arc(markX + 1.2, markMidY - 0.7, dotR, 0, Math.PI * 2);
        ctx.fill();

        // Magenta dot
        ctx.fillStyle = '#e6007e';
        ctx.beginPath();
        ctx.arc(markX + 3.0, markMidY - 0.7, dotR, 0, Math.PI * 2);
        ctx.fill();

        // Yellow dot
        ctx.fillStyle = '#ffea00';
        ctx.beginPath();
        ctx.arc(markX + 1.2, markMidY + 0.7, dotR, 0, Math.PI * 2);
        ctx.fill();

        // Black dot
        ctx.fillStyle = '#18181b';
        ctx.beginPath();
        ctx.arc(markX + 3.0, markMidY + 0.7, dotR, 0, Math.PI * 2);
        ctx.fill();

        // Bottom black alignment dash
        ctx.fillRect(markX, stripY + patchThickness - 0.7, 4.2, 0.7);
      }

    } else {
      // Vertical mode: left margin of roll (x = 2.5 to 6.3 mm)
      const stripX = 2.6;
      const cycleLen = colors.length * (patchLen + patchGap) + 16.0;

      for (let cycleY = 8.0; cycleY < webLength - 50; cycleY += cycleLen) {
        let curY = cycleY;

        drawGradientPatch(ctx, stripX, curY, patchThickness, patchLen, colors[0], false);
        curY += patchLen + patchGap;

        ctx.fillStyle = '#0f172a';
        ctx.fillRect(stripX + patchThickness / 2 - 0.4, curY, 0.8, 3.0);
        curY += 4.5;

        for (let i = 1; i < colors.length; i++) {
          drawGradientPatch(ctx, stripX, curY, patchThickness, patchLen, colors[i], false);
          curY += patchLen + patchGap;
        }

        const markY = curY + 1.0;
        const markMidX = stripX + patchThickness / 2;

        ctx.fillStyle = '#0f172a';
        ctx.fillRect(stripX, markY, 0.7, 4.2);

        const dotR = 0.65;
        ctx.fillStyle = '#009fe3';
        ctx.beginPath();
        ctx.arc(markMidX - 0.7, markY + 1.2, dotR, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#e6007e';
        ctx.beginPath();
        ctx.arc(markMidX + 0.7, markY + 1.2, dotR, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffea00';
        ctx.beginPath();
        ctx.arc(markMidX - 0.7, markY + 3.0, dotR, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#18181b';
        ctx.beginPath();
        ctx.arc(markMidX + 0.7, markY + 3.0, dotR, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillRect(stripX + patchThickness - 0.7, markY, 0.7, 4.2);
      }
    }

    ctx.restore();

    function drawGradientPatch(c, x, y, w, h, col, isH) {
      const grad = isH ? c.createLinearGradient(x, 0, x + w, 0) : c.createLinearGradient(0, y, 0, y + h);
      const rgbaFade = `rgba(${col.r}, ${col.g}, ${col.b}, 0.25)`;
      grad.addColorStop(0, rgbaFade);
      grad.addColorStop(0.12, col.solid);
      grad.addColorStop(0.88, col.solid);
      grad.addColorStop(1, rgbaFade);

      c.fillStyle = grad;
      c.fillRect(x, y, w, h);
    }
  }

  drawPrintDirection(ctx, isHoriz, webLength, webWidth) {}

  drawExternalPrintDirectionBanner(ctx, isHoriz, webLength, webWidth) {
    ctx.save();
    ctx.strokeStyle = '#ef4444';
    ctx.fillStyle = '#ef4444';

    if (isHoriz) {
      // Horizontal mode: arrow below the roll in the dark workspace
      const arrowY = webWidth + 18.0;
      const startX = 60.0;
      const endX = webLength - 40.0;

      // Solid arrow shaft line
      ctx.lineWidth = 1.4 / this.scale;
      ctx.beginPath();
      ctx.moveTo(startX, arrowY);
      ctx.lineTo(endX, arrowY);
      ctx.stroke();

      // Filled arrowhead at endX pointing right
      const headL = 9.0;
      const headW = 4.2;
      ctx.beginPath();
      ctx.moveTo(endX, arrowY);
      ctx.lineTo(endX - headL, arrowY - headW);
      ctx.lineTo(endX - headL * 0.7, arrowY);
      ctx.lineTo(endX - headL, arrowY + headW);
      ctx.closePath();
      ctx.fill();

      // Chevrons along line
      ctx.lineWidth = 1.2 / this.scale;
      for (let cx = startX + 160; cx < endX - 80; cx += 220) {
        ctx.beginPath();
        ctx.moveTo(cx - 4, arrowY - 2.8);
        ctx.lineTo(cx + 2, arrowY);
        ctx.lineTo(cx - 4, arrowY + 2.8);
        ctx.stroke();
      }

      // Label below the arrow: "напрямок друку"
      const fontMm = 4.2;
      ctx.font = `bold ${fontMm}px JetBrains Mono, monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText('напрямок друку', (startX + endX) / 2, arrowY + 4.5);

    } else {
      // Vertical mode: arrow to the right of the roll pointing UP
      const arrowX = webWidth + 18.0;
      const startY = webLength - 60.0;
      const endY = 40.0;

      // Solid arrow shaft line pointing UP
      ctx.lineWidth = 1.4 / this.scale;
      ctx.beginPath();
      ctx.moveTo(arrowX, startY);
      ctx.lineTo(arrowX, endY);
      ctx.stroke();

      // Filled arrowhead at endY pointing UP
      const headL = 9.0;
      const headW = 4.2;
      ctx.beginPath();
      ctx.moveTo(arrowX, endY);
      ctx.lineTo(arrowX - headW, endY + headL);
      ctx.lineTo(arrowX, endY + headL * 0.7);
      ctx.lineTo(arrowX + headW, endY + headL);
      ctx.closePath();
      ctx.fill();

      // Chevrons pointing UP
      ctx.lineWidth = 1.2 / this.scale;
      for (let cy = startY - 160; cy > endY + 80; cy -= 220) {
        ctx.beginPath();
        ctx.moveTo(arrowX - 2.8, cy + 4);
        ctx.lineTo(arrowX, cy - 2);
        ctx.lineTo(arrowX + 2.8, cy + 4);
        ctx.stroke();
      }

      // Label alongside the arrow
      ctx.save();
      const fontMm = 4.2;
      ctx.font = `bold ${fontMm}px JetBrains Mono, monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.translate(arrowX + 5.5, (startY + endY) / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText('напрямок друку', 0, 0);
      ctx.restore();
    }
    ctx.restore();
  }

  drawRulers(ctx, isHoriz, webLength, webWidth) {
    ctx.save();
    ctx.lineWidth = 0.8 / this.scale;

    if (isHoriz) {
      // 1. TOP MILLIMETER RULER & DIMENSION CALLOUT
      const topY = -2;

      // Base line for ruler
      ctx.strokeStyle = '#38bdf8';
      ctx.beginPath();
      ctx.moveTo(0, topY);
      ctx.lineTo(webLength, topY);
      ctx.stroke();

      // Ticks every 10, 50, 100 mm
      for (let mm = 0; mm <= webLength; mm += 10) {
        let tLen = 2.5;
        let strokeCol = '#64748b';

        if (mm % 100 === 0) {
          tLen = 7.5;
          strokeCol = '#38bdf8';
        } else if (mm % 50 === 0) {
          tLen = 5.0;
          strokeCol = '#38bdf8';
        }

        ctx.strokeStyle = strokeCol;
        ctx.beginPath();
        ctx.moveTo(mm, topY);
        ctx.lineTo(mm, topY - tLen);
        ctx.stroke();

        // Numerals
        if (mm % 100 === 0) {
          ctx.fillStyle = '#38bdf8';
          ctx.font = 'bold 4.5px JetBrains Mono, monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillText(`${mm}`, mm, topY - tLen - 1.2);
        } else if (mm % 50 === 0 && this.scale > 0.6) {
          ctx.fillStyle = '#94a3b8';
          ctx.font = '3.8px JetBrains Mono, monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillText(`${mm}`, mm, topY - tLen - 1.0);
        }
      }

      // Top Dimension Bar (1000 mm / 1 пог. м) at y = -17 mm
      const dimY = -17.0;
      ctx.strokeStyle = '#0284c7';
      ctx.fillStyle = '#0284c7';
      ctx.lineWidth = 0.9 / this.scale;

      // End tick marks
      ctx.beginPath();
      ctx.moveTo(0, dimY - 3);
      ctx.lineTo(0, dimY + 3);
      ctx.moveTo(webLength, dimY - 3);
      ctx.lineTo(webLength, dimY + 3);
      // Span line
      ctx.moveTo(0, dimY);
      ctx.lineTo(webLength, dimY);
      ctx.stroke();

      // Dimension Arrowheads
      ctx.beginPath();
      ctx.moveTo(0, dimY);
      ctx.lineTo(5.0, dimY - 2.2);
      ctx.lineTo(5.0, dimY + 2.2);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(webLength, dimY);
      ctx.lineTo(webLength - 5.0, dimY - 2.2);
      ctx.lineTo(webLength - 5.0, dimY + 2.2);
      ctx.closePath();
      ctx.fill();

      // 2. LEFT WIDTH RULER (0 to 330 mm)
      const leftX = -2;
      ctx.strokeStyle = '#64748b';
      ctx.beginPath();
      ctx.moveTo(leftX, 0);
      ctx.lineTo(leftX, webWidth);
      ctx.stroke();

      for (let mm = 0; mm <= webWidth; mm += 10) {
        let tLen = 2.5;
        let strokeCol = '#64748b';

        if (mm % 50 === 0) {
          tLen = 5.0;
          strokeCol = '#38bdf8';
        }

        ctx.strokeStyle = strokeCol;
        ctx.beginPath();
        ctx.moveTo(leftX, mm);
        ctx.lineTo(leftX - tLen, mm);
        ctx.stroke();

        if (mm % 50 === 0) {
          ctx.fillStyle = '#94a3b8';
          ctx.font = '4.0px JetBrains Mono, monospace';
          ctx.textAlign = 'right';
          ctx.textBaseline = 'middle';
          ctx.fillText(`${mm}`, leftX - tLen - 1.5, mm);
        }
      }

      // Highlights for 12.5 mm and 317.5 mm (Printable zone margins)
      const pMargin = (webWidth - 305) / 2; // 12.5 mm
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 3.8px JetBrains Mono, monospace';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText('12.5', leftX - 7, pMargin);
      ctx.fillText('317.5', leftX - 7, webWidth - pMargin);

      // Width Dimension Callout at x = -48 mm (placed cleanly outside the lane labels corridor)
      const wDimX = -48.0;
      ctx.strokeStyle = '#0284c7';
      ctx.fillStyle = '#0284c7';
      ctx.lineWidth = 0.9 / this.scale;

      ctx.beginPath();
      ctx.moveTo(wDimX - 3, 0);
      ctx.lineTo(wDimX + 3, 0);
      ctx.moveTo(wDimX - 3, webWidth);
      ctx.lineTo(wDimX + 3, webWidth);
      ctx.moveTo(wDimX, 0);
      ctx.lineTo(wDimX, webWidth);
      ctx.stroke();

      ctx.save();
      ctx.translate(wDimX - 4, webWidth / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.font = 'bold 4.8px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText('ПОЛОТНО: 330 мм (ДРУК: 305 мм)', 0, 0);
      ctx.restore();

    } else {
      // VERTICAL WEB MODE RULERS
      // Width along Top (0 to 330 mm)
      const topY = -2;
      ctx.strokeStyle = '#38bdf8';
      ctx.beginPath();
      ctx.moveTo(0, topY);
      ctx.lineTo(webWidth, topY);
      ctx.stroke();

      for (let mm = 0; mm <= webWidth; mm += 10) {
        let tLen = (mm % 50 === 0) ? 5.0 : 2.5;
        ctx.beginPath();
        ctx.moveTo(mm, topY);
        ctx.lineTo(mm, topY - tLen);
        ctx.stroke();

        if (mm % 50 === 0) {
          ctx.fillStyle = '#38bdf8';
          ctx.font = '4.2px JetBrains Mono, monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillText(`${mm}`, mm, topY - tLen - 1);
        }
      }

      // Length along Left (0 to 1000 mm)
      const leftX = -2;
      ctx.strokeStyle = '#64748b';
      ctx.beginPath();
      ctx.moveTo(leftX, 0);
      ctx.lineTo(leftX, webLength);
      ctx.stroke();

      for (let mm = 0; mm <= webLength; mm += 10) {
        let tLen = (mm % 100 === 0) ? 7.5 : ((mm % 50 === 0) ? 5.0 : 2.5);
        ctx.beginPath();
        ctx.moveTo(leftX, mm);
        ctx.lineTo(leftX - tLen, mm);
        ctx.stroke();

        if (mm % 100 === 0) {
          ctx.fillStyle = '#38bdf8';
          ctx.font = 'bold 4.5px JetBrains Mono, monospace';
          ctx.textAlign = 'right';
          ctx.textBaseline = 'middle';
          ctx.fillText(`${mm}`, leftX - tLen - 1.5, mm);
        }
      }
    }
    ctx.restore();
  }

  handleHover(e) {
    if (!this.layout) return;

    const rect = this.container.getBoundingClientRect();
    if (
      e.clientX < rect.left || e.clientX > rect.right ||
      e.clientY < rect.top || e.clientY > rect.bottom
    ) {
      if (this.hoveredItem !== null) {
        this.hoveredItem = null;
        this.render();
        this.updateHoverHud(null);
      }
      return;
    }

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const mmX = (mouseX - this.offsetX) / this.scale;
    const mmY = (mouseY - this.offsetY) / this.scale;

    const isHoriz = this.webOrientation === 'horizontal';
    const positions = this.layout.positions;

    let found = null;
    for (let i = 0; i < positions.length; i++) {
      const p = positions[i];
      let rx = isHoriz ? p.x : p.y;
      let ry = isHoriz ? p.y : p.x;
      let rw = isHoriz ? p.width : p.height;
      let rh = isHoriz ? p.height : p.width;

      if (mmX >= rx && mmX <= rx + rw && mmY >= ry && mmY <= ry + rh) {
        found = p;
        break;
      }
    }

    if (found !== this.hoveredItem) {
      this.hoveredItem = found;
      this.render();
      this.updateHoverHud(found);
    }
  }

  updateHoverHud(item) {
    const hud = document.getElementById('canvasHud');
    if (!hud) return;

    if (!item) {
      hud.classList.add('opacity-0');
      return;
    }

    hud.innerHTML = `
      <div class="font-bold text-blue-400">Струмок ${item.lane} · Ряд ${item.repeat}</div>
      <div class="text-[11px] text-slate-300 font-mono">Розмір: ${item.width} × ${item.height} мм</div>
      <div class="text-[10px] text-slate-400 font-mono">X: ${item.x.toFixed(1)} мм, Y: ${item.y.toFixed(1)} мм</div>
    `;
    hud.classList.remove('opacity-0');
  }

  zoomIn() {
    const rect = this.container.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const newScale = Math.min(12.0, this.scale * 1.3);

    this.offsetX = cx - (cx - this.offsetX) * (newScale / this.scale);
    this.offsetY = cy - (cy - this.offsetY) * (newScale / this.scale);
    this.scale = newScale;
    this.render();
  }

  zoomOut() {
    const rect = this.container.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const newScale = Math.max(0.15, this.scale / 1.3);

    this.offsetX = cx - (cx - this.offsetX) * (newScale / this.scale);
    this.offsetY = cy - (cy - this.offsetY) * (newScale / this.scale);
    this.scale = newScale;
    this.render();
  }

  setOrientation(mode) {
    this.webOrientation = mode;
    this.fitMeter();
  }
}
