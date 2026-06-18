const CANVAS_SIZE = 50;

export function hexToRgb(hex: string): [number, number, number] {
  const cleanHex = hex.replace("#", "");
  const r = parseInt(cleanHex.substring(0, 2), 16) || 0;
  const g = parseInt(cleanHex.substring(2, 4), 16) || 0;
  const b = parseInt(cleanHex.substring(4, 6), 16) || 0;
  return [r, g, b];
}

export function drawFullCanvas(
  ctx: CanvasRenderingContext2D,
  pixels: string[],
  size = CANVAS_SIZE,
) {
  const imgData = ctx.createImageData(size, size);
  for (let i = 0; i < pixels.length; i++) {
    const [r, g, b] = hexToRgb(pixels[i]);
    const idx = i * 4;
    imgData.data[idx] = r;
    imgData.data[idx + 1] = g;
    imgData.data[idx + 2] = b;
    imgData.data[idx + 3] = 255;
  }
  ctx.putImageData(imgData, 0, 0);
}

export function drawPixelOnCanvas(
  ctx: CanvasRenderingContext2D,
  index: number,
  color: string,
  size = CANVAS_SIZE,
) {
  const x = index % size;
  const y = Math.floor(index / size);
  const [r, g, b] = hexToRgb(color);
  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.fillRect(x, y, 1, 1);
}

export { CANVAS_SIZE };
