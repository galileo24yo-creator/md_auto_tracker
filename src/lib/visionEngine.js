/**
 * VisionEngine.js
 * Specialized image recognition for Master Duel using fixed ROI matching.
 */

// ROI definitions (relative to screen width/height)
export const ROIS = {
  TURN: { x: 0.35, y: 0.63, w: 0.30, h: 0.08 },    // あなたが先攻/後攻です (縦横にタイト)
  RESULT: { x: 0.10, y: 0.35, w: 0.80, h: 0.30 },  // VICTORY/DEFEAT (画面中央大きく)
  RATING: { x: 0.57, y: 0.52, w: 0.14, h: 0.08 },   // Rating Result Value (画面中央右側)
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

export const normalizeContent = (sourceCanvasOrVideo, sx, sy, sw, sh, IGNORED_W, targetHeight = 60, threshold = 160) => {
  sx = Math.floor(sx);
  sy = Math.floor(sy);
  sw = Math.floor(sw);
  sh = Math.floor(sh);

  const tmpCanvas = document.createElement('canvas');
  tmpCanvas.width = sw;
  tmpCanvas.height = sh;
  const ctx = tmpCanvas.getContext('2d');
  ctx.drawImage(sourceCanvasOrVideo, sx, sy, sw, sh, 0, 0, sw, sh);

  const imgData = ctx.getImageData(0, 0, sw, sh);
  const { data } = imgData;

  const rowSums = new Int32Array(sh);
  const colSums = new Int32Array(sw);

  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      const i = (y * sw + x) * 4;
      const lum = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
      if (lum > threshold) {
        rowSums[y]++;
        colSums[x]++;
        data[i] = 255; data[i + 1] = 255; data[i + 2] = 255; // 白
      } else {
        data[i] = 0; data[i + 1] = 0; data[i + 2] = 0; // 黒
      }
      data[i + 3] = 255;
    }
  }
  ctx.putImageData(imgData, 0, 0); // 二値化結果を書き戻す（スケール時の消失を防ぐため）

  // プロジェクションプロファイル法によるノイズ除去（細い文字を切らないように緩和）
  const minPixelsPerRow = Math.max(2, Math.floor(sw * 0.01)); // 行(横ライン)に必要な白ピクセル
  const minPixelsPerCol = Math.max(2, Math.floor(sh * 0.02)); // 列(縦ライン)に必要な白ピクセル

  let minY = 0;
  while (minY < sh && rowSums[minY] < minPixelsPerRow) minY++;

  let maxY = sh - 1;
  while (maxY > minY && rowSums[maxY] < minPixelsPerRow) maxY--;

  let minX = 0;
  while (minX < sw && colSums[minX] < minPixelsPerCol) minX++;

  let maxX = sw - 1;
  while (maxX > minX && colSums[maxX] < minPixelsPerCol) maxX--;

  // 白文字が規定より少ない（背景ノイズのみ）場合は全領域、またはエラーとして扱う
  if (minX >= maxX || minY >= Math.max(maxY, sh - 1)) {
    minX = 0; minY = 0; maxX = sw - 1; maxY = sh - 1;
  } else {
    // OCRが読みやすいように、周囲に適切な余白（パディング）を追加
    const padX = Math.floor(sw * 0.05);
    const padY = Math.floor(sh * 0.1);
    minX = Math.max(0, minX - padX);
    maxX = Math.min(sw - 1, maxX + padX);
    minY = Math.max(0, minY - padY);
    maxY = Math.min(sh - 1, maxY + padY);
  }

  const boxW = maxX - minX + 1;
  const boxH = maxY - minY + 1;

  // サイズによるノイズフィルター：想定される文字サイズ（ROIの20%以上）を下回る場合はただのノイズと断定
  if (boxW < sw * 0.2 || boxH < sh * 0.2) {
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

  const finalData = fctx.getImageData(0, 0, targetWidth, targetHeight);
  const bin = new Uint8Array(targetWidth * targetHeight);
  for (let i = 0; i < bin.length; i++) {
    // 既に白黒になっているものをスケールしたので、中間値(128)で再二値化する
    bin[i] = finalData.data[i * 4] > 128 ? 1 : 0;
  }

  return { bin, width: targetWidth, height: targetHeight, bbox: { x: minX, y: minY, w: boxW, h: boxH } };
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
 * Extracts 8x8 features (profiles) from a single component.
 */
export const extractDigitFeatures = (bin, w, h, comp) => {
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

export const matchDigit = (features, templates) => {
  let best = '?';
  let minErr = Infinity;
  for (const [char, pt] of Object.entries(templates)) {
    let err = 0;
    for (let i = 0; i < 8; i++) {
      err += Math.abs(features.h[i] - pt.h[i]) + Math.abs(features.v[i] - pt.v[i]);
    }
    for (let i = 0; i < 4; i++) {
      err += Math.abs(features.q[i] - (pt.q ? pt.q[i] : 0));
    }
    if (err < minErr) {
      minErr = err;
      best = char;
    }
  }
  return { char: best, error: minErr };
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
  const minPixelsPerRow = Math.max(2, Math.floor(w * 0.05));
  let minY = 0; while (minY < h && rowSums[minY] < minPixelsPerRow) minY++;
  let maxY = h - 1; while (maxY > minY && rowSums[maxY] < minPixelsPerRow) maxY--;
  let minX = 0; while (minX < w && colSums[minX] < minPixelsPerRow) minX++;
  let maxX = w - 1; while (maxX > minX && colSums[maxX] < minPixelsPerRow) maxX--;

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

  // Medians and strict sizing filters
  const heights = comps.map(c => c.h).sort((a, b) => a - b);
  const medianH = heights[Math.floor(heights.length / 2)];
  const validComps = comps.filter(c => c.h > medianH * 0.4 && c.h < medianH * 1.6); // Stricter gate

  let result = "";
  let totalError = 0;
  const compDetails = [];
  
  for (const comp of validComps) {
    const feats = extractDigitFeatures(trimmedBin, tw, th, comp);
    const { char, error } = matchDigit(feats, DIGIT_TEMPLATES);
    const accepted = error < 100; // Even stricter error threshold for points
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
