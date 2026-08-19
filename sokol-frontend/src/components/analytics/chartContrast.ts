function parseColor(color?: string): [number, number, number] | null {
  if (!color) {
    return null;
  }
  const normalized = color.trim();
  if (normalized.startsWith('#')) {
    const hex = normalized.slice(1);
    if (hex.length === 3) {
      return [
        Number.parseInt(hex[0] + hex[0], 16),
        Number.parseInt(hex[1] + hex[1], 16),
        Number.parseInt(hex[2] + hex[2], 16),
      ];
    }
    if (hex.length === 6) {
      return [
        Number.parseInt(hex.slice(0, 2), 16),
        Number.parseInt(hex.slice(2, 4), 16),
        Number.parseInt(hex.slice(4, 6), 16),
      ];
    }
  }
  const rgbMatch = normalized.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (rgbMatch) {
    return [Number(rgbMatch[1]), Number(rgbMatch[2]), Number(rgbMatch[3])];
  }
  return null;
}

/** True when the fill is light enough that dark label text is more readable. */
function isLightFill(color?: string, fallbackLight = true) {
  const rgb = parseColor(color);
  if (!rgb) {
    return fallbackLight;
  }
  const [r, g, b] = rgb;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.62;
}

export function contrastLabelColor(fill?: string, fallbackLight = true) {
  return isLightFill(fill, fallbackLight) ? '#1e293b' : '#ffffff';
}
