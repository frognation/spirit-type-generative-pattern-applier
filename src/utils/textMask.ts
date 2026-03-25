export function makeTextMask(
  text: string,
  font: string,
  weight: string,
  size: number,
  spacing: number,
  w: number,
  h: number
): Float32Array {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d')!;

  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#fff';
  ctx.font = `${weight} ${size}px ${font}`;
  try { (ctx as any).letterSpacing = `${spacing}px`; } catch (_) {}
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const lines = text.split('\n');
  const lh = size * 1.2;
  const startY = h / 2 - ((lines.length - 1) * lh) / 2;
  lines.forEach((line, i) => ctx.fillText(line, w / 2, startY + i * lh));

  const d = ctx.getImageData(0, 0, w, h).data;
  const mask = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) mask[i] = d[i * 4] / 255;
  return mask;
}

/** Returns array of pixel indices where mask > threshold */
export function getMaskPixels(mask: Float32Array, threshold = 0.5): number[] {
  const px: number[] = [];
  for (let i = 0; i < mask.length; i++) {
    if (mask[i] > threshold) px.push(i);
  }
  return px;
}

/** Returns boundary pixels (mask pixel adjacent to non-mask pixel) */
export function getMaskBoundary(mask: Float32Array, w: number, h: number): number[] {
  const bnd: number[] = [];
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (mask[i] < 0.5) continue;
      const neighbors = [
        mask[(y - 1) * w + x], mask[(y + 1) * w + x],
        mask[y * w + x - 1],   mask[y * w + x + 1],
      ];
      if (neighbors.some(n => n < 0.5)) bnd.push(i);
    }
  }
  return bnd;
}
