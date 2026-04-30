/**
 * wallDetector.js
 *
 * Floorplan wall detection with furniture removal pipeline:
 *   1. Grayscale
 *   2. Dark-pixel mask        — walls are black lines in floorplans
 *   3. Morphological open     — removes thin furniture outlines & small dots
 *   4. Connected-component filter — removes small isolated blobs (furniture)
 *   5. Morphological close    — fills small gaps in wall lines
 *   6. Zhang-Suen thinning    — reduces thick walls to 1-pixel skeleton
 *   7. Segment scan           — H + V + diagonal runs
 *   8. Segment merge          — collapses collinear / nearby duplicates
 *
 * Returns { walls, points, cleanedData, width, height }
 *   cleanedData — RGBA Uint8ClampedArray preview of cleaned wall mask
 */

export function detectWalls(imageData, options = {}) {
  const {
    darkThreshold    = 50,   // gray < this → wall candidate (0-255)
    minLength        = 20,   // minimum segment length in pixels
    minComponentArea = 500,  // min dark-blob px count to keep (removes furniture)
    morphRadius      = 2,    // structuring-element radius for open/close
  } = options;

  const { width: w, height: h, data } = imageData;

  // 1. Grayscale
  const gray = toGray(data, w, h);

  // 2. Dark-pixel mask — target the black wall ink
  const raw = new Uint8ClampedArray(w * h);
  for (let i = 0; i < w * h; i++) raw[i] = gray[i] < darkThreshold ? 1 : 0;

  // 3. Morphological open — erode then dilate (kills thin furniture lines / dots)
  let mask = erode(raw, w, h, morphRadius);
  mask     = dilate(mask, w, h, morphRadius);

  // 4. Connected-component filter — remove small isolated dark blobs (furniture, text)
  mask = filterByComponentSize(mask, w, h, minComponentArea);

  // 5. Morphological close — dilate then erode (fills small gaps between wall pixels)
  mask = dilate(mask, w, h, 1);
  mask = erode(mask, w, h, 1);

  // Build preview from cleaned mask (before thinning — easier to visually inspect)
  const cleanedData = buildPreview(gray, mask, w, h);

  // 6. Zhang-Suen thinning — 1-pixel-wide skeleton for clean segment extraction
  const thin = zhangSuenThin(mask, w, h);

  // 7. Extract segments (H + V + 45° + 135°)
  const segments = extractSegments(thin, w, h, minLength);

  // 8. Merge collinear / nearby segments
  const merged = mergeSegments(segments, 8, 15);

  // Collect unique corner points
  const points = collectPoints(merged);

  return { walls: merged, points, cleanedData, width: w, height: h };
}

// ── Grayscale ──────────────────────────────────────────────────────────────
function toGray(data, w, h) {
  const g = new Uint8ClampedArray(w * h);
  for (let i = 0; i < w * h; i++) {
    g[i] = (data[i * 4] * 77 + data[i * 4 + 1] * 150 + data[i * 4 + 2] * 29) >> 8;
  }
  return g;
}

// ── Separable morphological erosion ───────────────────────────────────────
function erode(src, w, h, r) {
  // Horizontal pass
  const tmp = new Uint8ClampedArray(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = r; x < w - r; x++) {
      let v = 1;
      for (let d = -r; d <= r; d++) { if (!src[y * w + x + d]) { v = 0; break; } }
      tmp[y * w + x] = v;
    }
  }
  // Vertical pass
  const out = new Uint8ClampedArray(w * h);
  for (let y = r; y < h - r; y++) {
    for (let x = 0; x < w; x++) {
      let v = 1;
      for (let d = -r; d <= r; d++) { if (!tmp[(y + d) * w + x]) { v = 0; break; } }
      out[y * w + x] = v;
    }
  }
  return out;
}

// ── Separable morphological dilation ──────────────────────────────────────
function dilate(src, w, h, r) {
  const tmp = new Uint8ClampedArray(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = r; x < w - r; x++) {
      let v = 0;
      for (let d = -r; d <= r; d++) { if (src[y * w + x + d]) { v = 1; break; } }
      tmp[y * w + x] = v;
    }
  }
  const out = new Uint8ClampedArray(w * h);
  for (let y = r; y < h - r; y++) {
    for (let x = 0; x < w; x++) {
      let v = 0;
      for (let d = -r; d <= r; d++) { if (tmp[(y + d) * w + x]) { v = 1; break; } }
      out[y * w + x] = v;
    }
  }
  return out;
}

// ── Connected-component filter (BFS, keeps large blobs only) ──────────────
function filterByComponentSize(src, w, h, minArea) {
  const labels = new Int32Array(w * h).fill(-1);
  const sizes  = [];
  let nextLabel = 0;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const start = y * w + x;
      if (!src[start] || labels[start] !== -1) continue;

      const queue = [start];
      labels[start] = nextLabel;
      let head = 0, count = 0;

      while (head < queue.length) {
        const idx = queue[head++];
        count++;
        const cx = idx % w, cy = (idx / w) | 0;
        const ns = [
          cy > 0     ? idx - w : -1,
          cy < h - 1 ? idx + w : -1,
          cx > 0     ? idx - 1 : -1,
          cx < w - 1 ? idx + 1 : -1,
        ];
        for (const ni of ns) {
          if (ni >= 0 && src[ni] && labels[ni] === -1) {
            labels[ni] = nextLabel;
            queue.push(ni);
          }
        }
      }
      sizes[nextLabel++] = count;
    }
  }

  const out = new Uint8ClampedArray(w * h);
  for (let i = 0; i < w * h; i++) {
    if (labels[i] >= 0 && sizes[labels[i]] >= minArea) out[i] = 1;
  }
  return out;
}

// ── Zhang-Suen thinning (skeletonization) ─────────────────────────────────
function zhangSuenThin(src, w, h) {
  const data = new Uint8ClampedArray(src);
  let changed = true;

  while (changed) {
    changed = false;

    // Sub-iteration 1
    const del1 = [];
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        if (!data[y * w + x]) continue;
        const nb = nb8(data, x, y, w);
        const B = nb[0]+nb[1]+nb[2]+nb[3]+nb[4]+nb[5]+nb[6]+nb[7];
        if (B < 2 || B > 6) continue;
        if (trans01(nb) !== 1) continue;
        if (nb[0] * nb[2] * nb[4]) continue; // p2*p4*p6
        if (nb[2] * nb[4] * nb[6]) continue; // p4*p6*p8
        del1.push(y * w + x);
      }
    }
    for (const i of del1) { data[i] = 0; changed = true; }

    // Sub-iteration 2
    const del2 = [];
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        if (!data[y * w + x]) continue;
        const nb = nb8(data, x, y, w);
        const B = nb[0]+nb[1]+nb[2]+nb[3]+nb[4]+nb[5]+nb[6]+nb[7];
        if (B < 2 || B > 6) continue;
        if (trans01(nb) !== 1) continue;
        if (nb[0] * nb[2] * nb[6]) continue; // p2*p4*p8
        if (nb[0] * nb[4] * nb[6]) continue; // p2*p6*p8
        del2.push(y * w + x);
      }
    }
    for (const i of del2) { data[i] = 0; changed = true; }
  }
  return data;
}

// neighbors in order: N, NE, E, SE, S, SW, W, NW
function nb8(d, x, y, w) {
  return [
    d[(y-1)*w+x], d[(y-1)*w+x+1], d[y*w+x+1],   d[(y+1)*w+x+1],
    d[(y+1)*w+x], d[(y+1)*w+x-1], d[y*w+x-1],   d[(y-1)*w+x-1],
  ];
}
function trans01(nb) {
  const s = [...nb, nb[0]];
  let n = 0;
  for (let i = 0; i < 8; i++) if (!s[i] && s[i+1]) n++;
  return n;
}

// ── Segment extraction ────────────────────────────────────────────────────
function extractSegments(thin, w, h, minLen) {
  const segs = [];

  // Horizontal runs
  for (let y = 0; y < h; y++) {
    let sx = -1;
    for (let x = 0; x <= w; x++) {
      const on = x < w && thin[y * w + x];
      if (on && sx < 0) { sx = x; }
      else if (!on && sx >= 0) {
        if (x - sx >= minLen) segs.push({ x1: sx, y1: y, x2: x - 1, y2: y });
        sx = -1;
      }
    }
  }

  // Vertical runs
  for (let x = 0; x < w; x++) {
    let sy = -1;
    for (let y = 0; y <= h; y++) {
      const on = y < h && thin[y * w + x];
      if (on && sy < 0) { sy = y; }
      else if (!on && sy >= 0) {
        if (y - sy >= minLen) segs.push({ x1: x, y1: sy, x2: x, y2: y - 1 });
        sy = -1;
      }
    }
  }

  // ↘ diagonal runs (45°)
  for (let d = -(h - 1); d < w; d++) {
    let sx = -1, sy = -1, run = 0;
    for (let t = 0; ; t++) {
      const x = d + t, y = t;
      if (y >= h) break;
      if (x < 0) continue;
      if (x >= w) break;
      if (thin[y * w + x]) {
        if (sx < 0) { sx = x; sy = y; }
        run++;
      } else {
        if (run >= minLen) segs.push({ x1: sx, y1: sy, x2: x - 1, y2: y - 1 });
        sx = -1; sy = -1; run = 0;
      }
    }
    if (run >= minLen) segs.push({ x1: sx, y1: sy, x2: sx + run - 1, y2: sy + run - 1 });
  }

  // ↙ diagonal runs (135°)
  for (let d = 0; d < w + h - 1; d++) {
    let sx = -1, sy = -1, run = 0;
    for (let t = 0; ; t++) {
      const x = d - t, y = t;
      if (y >= h) break;
      if (x >= w) continue;
      if (x < 0) break;
      if (thin[y * w + x]) {
        if (sx < 0) { sx = x; sy = y; }
        run++;
      } else {
        if (run >= minLen) segs.push({ x1: sx, y1: sy, x2: x + 1, y2: y - 1 });
        sx = -1; sy = -1; run = 0;
      }
    }
    if (run >= minLen) segs.push({ x1: sx, y1: sy, x2: sx - run + 1, y2: sy + run - 1 });
  }

  return segs;
}

// ── Segment merging ───────────────────────────────────────────────────────
function mergeSegments(segs, angleTol, distTol) {
  if (!segs.length) return [];
  const used = new Uint8Array(segs.length);
  const result = [];

  for (let i = 0; i < segs.length; i++) {
    if (used[i]) continue;
    let seg = segs[i];
    used[i] = 1;
    let again = true;
    while (again) {
      again = false;
      for (let j = 0; j < segs.length; j++) {
        if (used[j]) continue;
        if (canMerge(seg, segs[j], angleTol, distTol)) {
          seg = mergeTwo(seg, segs[j]);
          used[j] = 1; again = true;
        }
      }
    }
    result.push(seg);
  }
  return result;
}

function segAngle(s) {
  return Math.atan2(s.y2 - s.y1, s.x2 - s.x1);
}

function ptLineDist(px, py, s) {
  const dx = s.x2 - s.x1, dy = s.y2 - s.y1;
  const len = Math.hypot(dx, dy);
  if (!len) return Math.hypot(px - s.x1, py - s.y1);
  return Math.abs(dy * px - dx * py + s.x2 * s.y1 - s.y2 * s.x1) / len;
}

function canMerge(a, b, aTol, dTol) {
  let diff = Math.abs(segAngle(a) - segAngle(b)) * (180 / Math.PI);
  if (diff > 90) diff = 180 - diff;
  if (diff > aTol) return false;

  const endDist = Math.min(
    Math.hypot(a.x2 - b.x1, a.y2 - b.y1),
    Math.hypot(a.x1 - b.x2, a.y1 - b.y2),
    Math.hypot(a.x1 - b.x1, a.y1 - b.y1),
    Math.hypot(a.x2 - b.x2, a.y2 - b.y2),
  );
  if (endDist > dTol * 4) return false;

  return Math.min(ptLineDist(b.x1, b.y1, a), ptLineDist(b.x2, b.y2, a)) < dTol;
}

function mergeTwo(a, b) {
  const pts = [{ x: a.x1, y: a.y1 }, { x: a.x2, y: a.y2 }, { x: b.x1, y: b.y1 }, { x: b.x2, y: b.y2 }];
  let max = 0, p1 = pts[0], p2 = pts[1];
  for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) {
    const d = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y);
    if (d > max) { max = d; p1 = pts[i]; p2 = pts[j]; }
  }
  return { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y };
}

function collectPoints(walls) {
  const seen = new Set();
  const pts = [];
  const snap = v => Math.round(v / 4) * 4;
  for (const w of walls) {
    for (const [x, y] of [[w.x1, w.y1], [w.x2, w.y2]]) {
      const k = `${snap(x)},${snap(y)}`;
      if (!seen.has(k)) { seen.add(k); pts.push({ x: snap(x), y: snap(y) }); }
    }
  }
  return pts;
}

// ── Preview: cleaned wall mask overlaid on lightened grayscale ─────────────
function buildPreview(gray, mask, w, h) {
  const rgba = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    if (mask[i]) {
      // Wall pixel — deep blue
      rgba[i * 4]     = 20;
      rgba[i * 4 + 1] = 80;
      rgba[i * 4 + 2] = 200;
    } else {
      // Non-wall — lightened grayscale so background is clearly visible
      const g = Math.min(255, gray[i] + 80);
      rgba[i * 4] = rgba[i * 4 + 1] = rgba[i * 4 + 2] = g;
    }
    rgba[i * 4 + 3] = 255;
  }
  return rgba;
}
