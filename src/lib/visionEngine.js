/**
 * VisionEngine.js
 * Specialized image recognition for Master Duel using fixed ROI matching.
 */

// ROI definitions (relative to screen width/height)
export const ROIS = {
  TURN: { x: 0.35, y: 0.63, w: 0.30, h: 0.08 },    // あなたが先攻/後攻です (縦横にタイト)
  RESULT: { x: 0.10, y: 0.35, w: 0.80, h: 0.30 }, // Wide version for better stability
  RATING: { x: 0.38, y: 0.70, w: 0.24, h: 0.10 },   // Rating Result Value (画面中央右側)
  DC_POINTS: { x: 0.57, y: 0.52, w: 0.16, h: 0.08 } // DC Points (桁数増加に備えて少し広く設定)
};

export const DIGIT_TEMPLATES = {
  "0": { h: [31, 12, 13, 12, 12, 13, 12, 31], v: [29, 24, 7, 8, 8, 7, 18, 32], q: [18, 17, 17, 16] },
  "1": { h: [18, 11, 10, 9, 9, 10, 9, 32], v: [6, 8, 10, 30, 29, 19, 4, 4], q: [15, 10, 15, 15] },
  "2": { h: [30, 15, 9, 9, 17, 12, 6, 32], v: [21, 20, 12, 13, 13, 12, 19, 22], q: [13, 19, 21, 13] },
  "3": { h: [28, 15, 6, 17, 10, 8, 13, 31], v: [13, 16, 9, 13, 13, 13, 27, 26], q: [13, 20, 13, 18] },
  "4": { h: [9, 11, 11, 12, 11, 13, 26, 5], v: [7, 10, 10, 11, 10, 15, 31, 4], q: [6, 15, 13, 15] },
  "5": { h: [30, 5, 5, 26, 11, 8, 12, 31], v: [23, 19, 13, 11, 11, 13, 16, 23], q: [20, 13, 14, 17] },
  "6": { h: [28, 12, 8, 23, 18, 13, 12, 29], v: [29, 26, 10, 12, 12, 10, 20, 25], q: [21, 16, 18, 17] },
  "7": { h: [30, 16, 10, 8, 7, 8, 7, 8], v: [10, 11, 12, 13, 13, 13, 14, 10], q: [13, 19, 10, 6] },
  "8": { h: [26, 10, 10, 25, 17, 10, 10, 31], v: [24, 24, 12, 12, 10, 12, 21, 25], q: [18, 17, 17, 17] },
  "9": { h: [29, 11, 11, 24, 17, 7, 11, 28], v: [24, 20, 11, 11, 10, 11, 21, 30], q: [19, 19, 14, 17] },
  ".": { h: [0, 0, 0, 0, 0, 0, 8, 8], v: [0, 0, 0, 0, 0, 0, 0, 0], q: [0, 0, 20, 20] } // Dot for decimals
};

/**
 * Calculates the Mean Squared Error (MSE) between two grayscale buffers.
 * Returns a score where lower is more similar.
 */
export const calculateSSD = (buf1, buf2) => {
  if (!buf1 || !buf2 || buf1.length !== buf2.length) return Infinity;
  let sum = 0;
  for (let i = 0; i < buf1.length; i++) {
    const diff = buf1[i] - buf2[i];
    sum += diff * diff;
  }
  return sum / buf1.length;
};

/**
 * Extracts and processes an ROI from a video/canvas source.
 */
export const getROIData = (ctx, videoEl, roi, targetW, targetH) => {
  const vw = videoEl.videoWidth;
  const vh = videoEl.videoHeight;

  // Create a temporary canvas if needed, or use the provided ctx
  const rx = vw * roi.x;
  const ry = vh * roi.y;
  const rw = vw * roi.w;
  const rh = vh * roi.h;

  const tmpCanvas = document.createElement('canvas');
  tmpCanvas.width = targetW;
  tmpCanvas.height = targetH;
  const tctx = tmpCanvas.getContext('2d');

  tctx.drawImage(videoEl, rx, ry, rw, rh, 0, 0, targetW, targetH);
  return tctx.getImageData(0, 0, targetW, targetH);
};

/**
 * Grayscale conversion
 */
export const toGrayscale = (imageData) => {
  const data = imageData.data;
  const gray = new Uint8Array(imageData.width * imageData.height);
  for (let i = 0; i < gray.length; i++) {
    gray[i] = data[i * 4] * 0.299 + data[i * 4 + 1] * 0.587 + data[i * 4 + 2] * 0.114;
  }
  return gray;
};

/**
 * Matches a pre-loaded template against the current frame ROI.
 * templates: Object containing pre-processed grayscale buffers.
 */
export const matchAgainstTemplates = (currentGray, templates) => {
  let bestKey = null;
  let minDiff = Infinity;

  for (const [key, templateBuffer] of Object.entries(templates)) {
    const diff = calculateSSD(currentGray, templateBuffer);
    if (diff < minDiff) {
      minDiff = diff;
      bestKey = key;
    }
  }

  return { key: bestKey, score: minDiff };
};

/**
 * Extracts and normalizes the precise bounding box of the non-zero (white text) content
 * to eliminate aspect-ratio distortions caused by different ROI margins.
 */
/**
 * Draws a binarized array (0/1) to a canvas context for debugging.
 */
export const drawBinarizedToCanvas = (bin, canvasCtx, w = 128, h = 32) => {
  if (!canvasCtx || !bin) return;
  const imgData = canvasCtx.createImageData(w, h);
  for (let i = 0; i < bin.length; i++) {
    const val = bin[i] === 1 ? 255 : 0;
    imgData.data[i * 4] = val; // R
    imgData.data[i * 4 + 1] = val; // G
    imgData.data[i * 4 + 2] = val; // B
    imgData.data[i * 4 + 3] = 255; // Alpha
  }
  canvasCtx.putImageData(imgData, 0, 0);
};

/**
 * Creates a canvas element from a binarized array, optimized for OCR (black text on white).
 */
export const createBinarizedCanvas = (bin, w = 128, h = 32, invert = true) => {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  const imgData = ctx.createImageData(w, h);
  for (let i = 0; i < bin.length; i++) {
    const val = bin[i] === 1 ? (invert ? 0 : 255) : (invert ? 255 : 0);
    imgData.data[i * 4] = val;
    imgData.data[i * 4 + 1] = val;
    imgData.data[i * 4 + 2] = val;
    imgData.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(imgData, 0, 0);
  return c;
};

/**
 * Otsu's Method: Automatically calculates the optimal binarize threshold
 */
const calculateOtsuThreshold = (data) => {
  const histogram = new Int32Array(256);
  let totalValid = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue; // Skip transparent pixels
    const l = Math.floor(data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
    histogram[l]++;
    totalValid++;
  }

  if (totalValid === 0) return 128; // Fallback

  let sum = 0;
  for (let t = 0; t < 256; t++) sum += t * histogram[t];

  let sumB = 0;
  let wB = 0;
  let wF = 0;
  let varMax = 0;
  let threshold = 0;

  for (let t = 0; t < 256; t++) {
    wB += histogram[t];
    if (wB === 0) continue;
    wF = totalValid - wB;
    if (wF === 0) break;

    sumB += t * histogram[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;

    const varBetween = wB * wF * (mB - mF) * (mB - mF);

    if (varBetween > varMax) {
      varMax = varBetween;
      threshold = t;
    }
  }
  return threshold;
};

export const normalizeContent = (sourceCanvasOrVideo, sx, sy, sw, sh, IGNORED_W, targetHeight = 60, threshold = 160, angle = 0) => {
  sx = Math.floor(sx);
  sy = Math.floor(sy);
  sw = Math.floor(sw);
  sh = Math.floor(sh);

  const psw = sw + 100;
  const psh = sh + 100;

  const tmpCanvas = document.createElement('canvas');
  tmpCanvas.width = psw;
  tmpCanvas.height = psh;
  const ctx = tmpCanvas.getContext('2d');
  
  if (angle !== 0) {
    ctx.save();
    ctx.translate(psw / 2, psh / 2);
    ctx.rotate((angle * Math.PI) / 180);
    ctx.drawImage(sourceCanvasOrVideo, sx, sy, sw, sh, -sw / 2, -sh / 2, sw, sh);
    ctx.restore();
  } else {
    ctx.drawImage(sourceCanvasOrVideo, sx, sy, sw, sh, (psw - sw) / 2, (psh - sh) / 2, sw, sh);
  }

  const imgData = ctx.getImageData(0, 0, psw, psh);
  const { data } = imgData;

  // Use Otsu's Method if threshold is 0 or below (Offset +25 for balanced extraction)
  const effThreshold = threshold <= 0 ? calculateOtsuThreshold(data) + 25 : threshold;
  // if (angle !== 0) console.log(`ROI Otsu Threshold: ${effThreshold} (Auto: ${threshold <= 0})`);

  const rowSums = new Int32Array(psh);
  const colSums = new Int32Array(psw);
  
  for (let y = 0; y < psh; y++) {
    for (let x = 0; x < psw; x++) {
      const i = (y * psw + x) * 4;
      const lum = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;

      if (lum > effThreshold) {
        rowSums[y]++;
        colSums[x]++;
        data[i] = 255; data[i + 1] = 255; data[i + 2] = 255; // 白
      } else {
        data[i] = 0; data[i + 1] = 0; data[i + 2] = 0; // 黒
      }
      data[i + 3] = 255;
    }
  }
  // ctx.putImageData(imgData, 0, 0); // Removed to keep raw color for better scaling

  const minPixelsPerRow = Math.max(2, Math.floor(psw * 0.01));
  const minPixelsPerCol = Math.max(2, Math.floor(psh * 0.02));

  let minY = 0;
  while (minY < psh && rowSums[minY] < minPixelsPerRow) minY++;

  let maxY = psh - 1;
  while (maxY > minY && rowSums[maxY] < minPixelsPerRow) maxY--;

  let minX = 0;
  while (minX < psw && colSums[minX] < minPixelsPerCol) minX++;

  let maxX = psw - 1;
  while (maxX > minX && colSums[maxX] < minPixelsPerCol) maxX--;

  // If no content found, default to full padded area
  if (minX >= maxX || minY >= Math.max(maxY, psh - 1)) {
    minX = 0; minY = 0; maxX = psw - 1; maxY = psh - 1;
  } else {
    // Add small padding around word
    const padX = Math.floor(psw * 0.02);
    const padY = Math.floor(psh * 0.05);
    minX = Math.max(0, minX - padX);
    maxX = Math.min(psw - 1, maxX + padX);
    minY = Math.max(0, minY - padY);
    maxY = Math.min(psh - 1, maxY + padY);
  }

  const boxW = maxX - minX + 1;
  const boxH = maxY - minY + 1;

  // サイズによるノイズフィルター：想定される文字サイズ（ROIの15%以上）を下回る場合はただのノイズと断定
  if (boxW < psw * 0.15 || boxH < psh * 0.1) {
    return { bin: new Uint8Array(1), width: 1, height: 1, bbox: { x: minX, y: minY, w: boxW, h: boxH } };
  }

  // アスペクト比を維持したまま、ターゲットの高さにスケールアップ（OCR精度向上のため）
  // ただし幅は最大400pxに制限（巨大画像によるOCR負荷を防止）
  let targetWidth = Math.max(1, Math.floor(boxW * (targetHeight / boxH)));
  const MAX_WIDTH = 400;
  if (targetWidth > MAX_WIDTH) {
    targetHeight = Math.floor(targetHeight * (MAX_WIDTH / targetWidth));
    targetWidth = MAX_WIDTH;
  }

  const finalCanvas = document.createElement('canvas');
  finalCanvas.width = targetWidth;
  finalCanvas.height = targetHeight;
  const fctx = finalCanvas.getContext('2d');

  fctx.drawImage(tmpCanvas, minX, minY, boxW, boxH, 0, 0, targetWidth, targetHeight);

  // Returned bin is STILL binarized here for legacy compatibility in other parts of the app,
  // but extracted features will use the raw RGB finalData.
  const finalData = fctx.getImageData(0, 0, targetWidth, targetHeight);
  return { 
    bin: binarizeROI(finalData, effThreshold), 
    width: targetWidth, 
    height: targetHeight, 
    bbox: { x: minX, y: minY, w: boxW, h: boxH },
    raw: finalData // New: return raw RGB data for better downstream binarization
  };
};

/**
 * Binarizes an image for digit recognition (assuming dark digits on light background or vice-versa).
 * For MD Rating Match result: White-ish digits on blue background.
 */
export const binarizeROI = (imageData, threshold = 180) => {
  const data = imageData.data;
  const bin = new Uint8Array(imageData.width * imageData.height);
  for (let i = 0; i < bin.length; i++) {
    const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
    // Slightly weight green for MD's blueish backgrounds
    const lum = r * 0.2126 + g * 0.7152 + b * 0.0722; 
    bin[i] = lum > threshold ? 1 : 0;
  }
  return bin;
};

/**
 * Simple connected component finding for digits.
 */
export const findComponents = (bin, w, h) => {
  const visited = new Uint8Array(w * h);
  const comps = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      if (bin[idx] === 1 && !visited[idx]) {
        let minX = x, maxX = x, minY = y, maxY = y;
        const q = [[x, y]];
        visited[idx] = 1;
        while (q.length > 0) {
          const [qx, qy] = q.shift();
          minX = Math.min(minX, qx); maxX = Math.max(maxX, qx);
          minY = Math.min(minY, qy); maxY = Math.max(maxY, qy);
          const neighbors = [[qx - 1, qy], [qx + 1, qy], [qx, qy - 1], [qx, qy + 1]];
          for (const [nx, ny] of neighbors) {
            const nidx = ny * w + nx;
            if (nx >= 0 && nx < w && ny >= 0 && ny < h && bin[nidx] === 1 && !visited[nidx]) {
              visited[nidx] = 1;
              q.push([nx, ny]);
            }
          }
        }
        const cw = maxX - minX + 1, ch = maxY - minY + 1;
        // サイズフィルタ: 極端に小さいノイズを除外（数字の「.」も通す）
        if (cw > 2 && ch > 4) {
          comps.push({ x: minX, y: minY, w: cw, h: ch, cx: minX + cw / 2, cy: minY + ch / 2 });
        }
      }
    }
  }
  return comps.sort((a, b) => a.x - b.x); // Sort by horizontal position
};

/**
 * Merges components that are horizontally overlapping or extremely close.
 * Essential for stylized/decorative text where a single character might be split.
 */
export const mergeNearbyComponents = (comps, xThreshold = 0.5) => {
  if (comps.length <= 1) return comps;
  
  const merged = [];
  let current = { ...comps[0] };
  
  for (let i = 1; i < comps.length; i++) {
    const next = comps[i];
    // Check for horizontal proximity/overlap
    const isClose = next.x <= (current.x + current.w + xThreshold);
    
    if (isClose) {
      // Merge: Update current bounding box
      const newX = Math.min(current.x, next.x);
      const newY = Math.min(current.y, next.y);
      const newMaxX = Math.max(current.x + current.w, next.x + next.w);
      const newMaxY = Math.max(current.y + current.h, next.y + next.h);
      
      current.x = newX;
      current.y = newY;
      current.w = newMaxX - newX;
      current.h = newMaxY - newY;
      current.cx = current.x + current.w / 2;
      current.cy = current.y + current.h / 2;
    } else {
      merged.push(current);
      current = { ...next };
    }
  }
  merged.push(current);
  return merged;
};

/**
 * Extracts 8x8 features (profiles) from a single component.
 * Renamed to extractComponentFeatures for general use (letters, icons, etc.)
 */
export const extractComponentFeatures = (bin, w, h, comp) => {
  const { x, y, w: cw, h: ch } = comp;
  const hFeat = new Array(8).fill(0);
  const vFeat = new Array(8).fill(0);

  const qFeat = new Array(4).fill(0); // [TL, TR, BL, BR]

  for (let py = y; py < y + ch; py++) {
    for (let px = x; px < x + cw; px++) {
      if (bin[py * w + px]) {
        if (py < y + ch / 2) {
          if (px < x + cw / 2) qFeat[0]++;
          else qFeat[1]++;
        } else {
          if (px < x + cw / 2) qFeat[2]++;
          else qFeat[3]++;
        }
      }
    }
  }

  // Scale quadrant features (0-32 range relative to quadrant area)
  const quadArea = (cw / 2) * (ch / 2) || 1;
  for (let i = 0; i < 4; i++) {
    qFeat[i] = Math.min(Math.round((qFeat[i] / quadArea) * 32), 32);
  }

  // Normalize to 128x128-like grid internally or just slice into 8 sections
  for (let i = 0; i < 8; i++) {
    const yStart = y + Math.floor(ch * i / 8);
    const yEnd = y + Math.floor(ch * (i + 1) / 8);
    const xStart = x + Math.floor(cw * i / 8);
    const xEnd = x + Math.floor(cw * (i + 1) / 8);

    // Horizontal profile for section i
    for (let py = yStart; py < yEnd; py++) {
      for (let px = x; px < x + cw; px++) {
        if (bin[py * w + px]) hFeat[i]++;
      }
    }
    // Vertical profile for section i
    for (let px = xStart; px < xEnd; px++) {
      for (let py = y; py < y + ch; py++) {
        if (bin[py * w + px]) vFeat[i]++;
      }
    }
    // Scale features to roughly match templates (0-32 range)
    hFeat[i] = Math.min(Math.round(hFeat[i] / (ch / 8) * (32 / cw)) || 0, 32);
    vFeat[i] = Math.min(Math.round(vFeat[i] / (cw / 8) * (32 / ch)) || 0, 32);
  }
  return { h: hFeat, v: vFeat, q: qFeat };
};

/**
 * Calculates the comparison error between two feature sets.
 * Used for both digits and letter/icon sequences.
 */
export const compareComponentFeatures = (f1, f2) => {
  let err = 0;
  if (!f1 || !f2) return 999;
  for (let i = 0; i < 8; i++) {
    err += Math.abs((f1.h[i] || 0) - (f2.h[i] || 0)) + Math.abs((f1.v[i] || 0) - (f2.v[i] || 0));
  }
  for (let i = 0; i < 4; i++) {
    err += Math.abs((f1.q[i] || 0) - (f2.q ? (f2.q[i] || 0) : 0));
  }
  return err;
};

export const matchDigit = (features, templates) => {
  let best = '?';
  let minErr = Infinity;
  for (const [char, pt] of Object.entries(templates)) {
    const err = compareComponentFeatures(features, pt);
    if (err < minErr) {
      minErr = err;
      best = char;
    }
  }
  return { char: best, error: minErr };
};

/**
 * Compares a dynamic sequence of features (like V-I-C-T-O-R-Y) against a template sequence.
 */
export const matchSequence = (liveSeq, templateSeq, maxTotalErr = 400) => {
  // If component counts are drastically different, the match is unlikely
  if (Math.abs(liveSeq.length - templateSeq.length) > 1) return { match: false, error: 999 };
  
  // Basic sequence alignment (assuming mostly perfect order for MD status words)
  let totalErr = 0;
  const count = Math.min(liveSeq.length, templateSeq.length);
  for (let i = 0; i < count; i++) {
    totalErr += compareComponentFeatures(liveSeq[i], templateSeq[i]);
  }

  // Handle case where one char is missing or extra (simple offset check)
  const avgErr = totalErr / count;
  return { 
    match: avgErr < (maxTotalErr / count), 
    error: avgErr,
    confidence: Math.max(0, 100 - (avgErr * 2)) 
  };
};

/**
 * High-level helper: extracts all component features from an image.
 */
export const extractSequenceFeatures = (imageData, threshold = 0, angle = 0) => {
  const w = imageData.width, h = imageData.height;
  
  // Padding to avoid clipping during rotation
  const pad = angle !== 0 ? Math.floor(Math.max(w, h) * 0.3) : 0;
  const pw = w + pad * 2, ph = h + pad * 2;
  
  let processedImageData = imageData;
  let finalW = w, finalH = h;
  
  const tmpCanvas = document.createElement('canvas');
  tmpCanvas.width = pw; tmpCanvas.height = ph;
  const tctx = tmpCanvas.getContext('2d');

  if (angle !== 0) {
    tctx.save();
    tctx.translate(pw / 2, ph / 2);
    tctx.rotate((angle * Math.PI) / 180);
    const off = document.createElement('canvas');
    off.width = w; off.height = h;
    off.getContext('2d').putImageData(imageData, 0, 0);
    tctx.drawImage(off, -w / 2, -h / 2);
    tctx.restore();
    processedImageData = tctx.getImageData(0, 0, pw, ph);
    finalW = pw; finalH = ph;
  } else {
    // Just wrap in ImageData for consistency if not rotated
    tctx.putImageData(imageData, 0, 0);
    processedImageData = tctx.getImageData(0, 0, w, h);
    finalW = w; finalH = h;
  }

  // Dynamic thresholding for extraction (Otsu + Safety Offset)
  let effThreshold = threshold;
  if (threshold <= 0) {
    const otsu = calculateOtsuThreshold(processedImageData.data);
    // Add offset (+25) for more precise character separation
    effThreshold = Math.max(60, Math.min(240, otsu + 25));
    // if (angle !== 0) console.log(`Extraction Otsu: ${otsu} -> Final: ${effThreshold}`);
  }

  const bin = binarizeROI(processedImageData, effThreshold);
  const rawComps = findComponents(bin, finalW, finalH);
  // Balanced merge distance for 120px target height (back to sweet spot)
  const mergedComps = mergeNearbyComponents(rawComps, 1.0); 
  
  return {
    features: mergedComps.map(c => extractComponentFeatures(bin, finalW, finalH, c)),
    comps: mergedComps,
    bin: bin, // For debug visualization
    width: finalW,
    height: finalH
  };
};

/**
 * Detects entire rating string from a ROI imageData.
 */
export const detectRating = (roiImageData, debug = false, threshold = 200) => {
  const w = roiImageData.width, h = roiImageData.height;
  const bin = binarizeROI(roiImageData, threshold);

  // --- Excess trimming ---
  const rowSums = new Int32Array(h);
  const colSums = new Int32Array(w);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (bin[y * w + x]) { rowSums[y]++; colSums[x]++; }
    }
  }
  const minPx = 2; // Restore previous stable threshold
  let minY = 0; while (minY < h && rowSums[minY] < minPx) minY++;
  let maxY = h - 1; while (maxY > minY && rowSums[maxY] < minPx) maxY--;
  let minX = 0; while (minX < w && colSums[minX] < minPx) minX++;
  let maxX = w - 1; while (maxX > minX && colSums[maxX] < minPx) maxX--;

  if (minX >= maxX || minY >= maxY) {
    return debug ? { result: "", debugLog: "No content after trimming", comps: [] } : "";
  }

  const pad = 2;
  minX = Math.max(0, minX - pad); maxX = Math.min(w - 1, maxX + pad);
  minY = Math.max(0, minY - pad); maxY = Math.min(h - 1, maxY + pad);

  const tw = maxX - minX + 1, th = maxY - minY + 1;
  const trimmedBin = new Uint8Array(tw * th);
  for (let y = 0; y < th; y++) {
    for (let x = 0; x < tw; x++) {
      trimmedBin[y * tw + x] = bin[(y + minY) * w + (x + minX)];
    }
  }

  const comps = findComponents(trimmedBin, tw, th);
  if (comps.length === 0) return debug ? { result: "", debugLog: "No components", comps: [] } : "";

  // Medians and stabilized sizing filters
  const heights = comps.map(c => c.h).sort((a, b) => a - b);
  const medianH = heights[Math.floor(heights.length / 2)];
  const validComps = comps.filter(c => c.h > medianH * 0.3 && c.h < medianH * 2.5); // Reverted to loose gate

  let result = "";
  let totalError = 0;
  const compDetails = [];
  
  for (const comp of validComps) {
    const feats = extractComponentFeatures(trimmedBin, tw, th, comp);
    const { char, error } = matchDigit(feats, DIGIT_TEMPLATES);
    const accepted = error < 120; // Reverted to 120
    if (accepted) {
      result += char; 
      totalError += error;
    }
    const tmpl = DIGIT_TEMPLATES[char];
    compDetails.push({ char, error, accepted, x: comp.x + minX, y: comp.y + minY, w: comp.w, h: comp.h });
  }

  const avgError = validComps.length > 0 ? (totalError / validComps.length) : 999;
  
  // Format check 3-7 digits
  const cleanResult = result.replace(/\./g, '');
  if (cleanResult.length < 3 || cleanResult.length > 7) {
    return debug ? { result: "", debugLog: `Bad digit count: ${cleanResult.length}`, comps: compDetails, avgError } : "";
  }

  return debug ? { result, debugLog: `SUCCESS (${avgError.toFixed(1)})`, comps: compDetails, avgError, trimOffset: { x: minX, y: minY } } : result;
};

/**
 * Multi-threshold voting for points recognition to eliminate misreads.
 */
export const multiThresholdDetectRating = (roiImageData) => {
  const thresholds = [180, 200, 220];
  const votes = {};
  const details = [];

  for (const t of thresholds) {
    const res = detectRating(roiImageData, true, t);
    if (res.result) {
      votes[res.result] = (votes[res.result] || 0) + 1;
      details.push(res);
    }
  }

  // Find most voted result
  let bestValue = "";
  let maxVotes = 0;
  for (const [val, count] of Object.entries(votes)) {
    if (count > maxVotes) {
      maxVotes = count;
      bestValue = val;
    }
  }

  // If no votes, just return null
  if (!bestValue) return { result: "", debugLog: "No consensus among thresholds" };

  // Return the result with the lowest average error among the winners
  const bestDetail = details.filter(d => d.result === bestValue).sort((a, b) => a.avgError - b.avgError)[0];
  return { ...bestDetail, votes: maxVotes };
};

/**
 * Detection State machine constants
 */
export const STATES = {
  IDLE: 'IDLE',
  DETECTING_TURN: 'DETECTING_TURN',
  IN_MATCH: 'IN_MATCH',
  DETECTING_RESULT: 'DETECTING_RESULT',
  DETECTING_RATING: 'DETECTING_RATING',
  NEXT_MATCH_STANDBY: 'NEXT_MATCH_STANDBY',
  RECORDING: 'RECORDING'
};
