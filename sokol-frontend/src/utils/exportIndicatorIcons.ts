/** Lucide-style indicator icons rendered to PNG for document exports. */

const INDICATOR_ICON_COLORS: Record<string, string> = {
  'В процессе': 'EAB308',
  Ожидает: '6B7280',
  'Не решено': 'EF4444',
  Исполнено: '25EB67',
};

const INDICATOR_ICON_SHAPES: Record<string, string> = {
  'В процессе':
    '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  Ожидает:
    '<path d="M5 22h14"/><path d="M5 2h14"/><path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22"/><path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"/>',
  'Не решено':
    '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  Исполнено: '<path d="M20 6 9 17l-5-5"/>',
};

const pngCache = new Map<string, Uint8Array>();

function buildIndicatorSvg(label: string): string | null {
  const color = INDICATOR_ICON_COLORS[label];
  const shapes = INDICATOR_ICON_SHAPES[label];
  if (!color || !shapes) {
    return null;
  }
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none"',
    ` stroke="#${color}" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round">`,
    shapes,
    '</svg>',
  ].join('');
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1] ?? '';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function indicatorIconBytesToDataUrl(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return `data:image/png;base64,${btoa(binary)}`;
}

async function svgToPngBytes(svg: string): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas unavailable'));
          return;
        }
        ctx.clearRect(0, 0, 64, 64);
        ctx.drawImage(image, 0, 0, 64, 64);
        resolve(dataUrlToBytes(canvas.toDataURL('image/png')));
      } catch (error) {
        reject(error);
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to render indicator icon'));
    };
    image.src = url;
  });
}

async function getIndicatorIconPng(label: string): Promise<Uint8Array | null> {
  const text = label.trim();
  if (!text || text === 'Не указан') {
    return null;
  }
  const cached = pngCache.get(text);
  if (cached) {
    return cached;
  }
  const svg = buildIndicatorSvg(text);
  if (!svg) {
    return null;
  }
  const bytes = await svgToPngBytes(svg);
  pngCache.set(text, bytes);
  return bytes;
}

export async function preloadIndicatorIcons(labels: Iterable<string>): Promise<Map<string, Uint8Array>> {
  const map = new Map<string, Uint8Array>();
  await Promise.all(
    [...new Set(labels)].map(async (label) => {
      const bytes = await getIndicatorIconPng(label);
      if (bytes) {
        map.set(label, bytes);
      }
    }),
  );
  return map;
}
