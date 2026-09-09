import { toPng } from 'html-to-image';

function captureNodePng(node: HTMLElement) {
  return toPng(node, {
    cacheBust: true,
    pixelRatio: 2,
    backgroundColor: '#ffffff',
  });
}

function loadImage(dataUrl: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Не удалось подготовить изображение графика'));
    image.src = dataUrl;
  });
}

function wrapText(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
) {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return [''];
  }

  const lines: string[] = [];
  let current = words[0] ?? '';
  for (let index = 1; index < words.length; index += 1) {
    const word = words[index] ?? '';
    const next = `${current} ${word}`;
    if (context.measureText(next).width <= maxWidth) {
      current = next;
    } else {
      lines.push(current);
      current = word;
    }
  }
  lines.push(current);
  return lines;
}

export async function captureChartPngWithFilters(
  chartNode: HTMLElement,
  title: string,
  filterCaption: string,
) {
  const chartDataUrl = await captureNodePng(chartNode);
  const chartImage = await loadImage(chartDataUrl);
  const pixelRatio = 2;
  const padding = 12 * pixelRatio;
  const gap = 10 * pixelRatio;
  const titleSize = 14 * pixelRatio;
  const captionSize = 12 * pixelRatio;
  const contentWidth = chartImage.naturalWidth;
  const textMaxWidth = Math.max(1, contentWidth - padding * 2);

  const measure = document.createElement('canvas').getContext('2d');
  if (!measure) {
    throw new Error('Canvas недоступен для сборки снимка');
  }

  measure.font = `600 ${titleSize}px system-ui, -apple-system, sans-serif`;
  const titleLines = wrapText(measure, title, textMaxWidth);
  measure.font = `400 ${captionSize}px system-ui, -apple-system, sans-serif`;
  const captionLines = filterCaption ? wrapText(measure, filterCaption, textMaxWidth) : [];

  const titleBlockHeight = titleLines.length * Math.round(titleSize * 1.3);
  const captionBlockHeight = captionLines.length > 0
    ? 4 * pixelRatio + captionLines.length * Math.round(captionSize * 1.35)
    : 0;
  const bannerHeight = titleBlockHeight + captionBlockHeight + gap;
  const canvasWidth = contentWidth + padding * 2;
  const canvasHeight = padding + bannerHeight + chartImage.naturalHeight + padding;

  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Canvas недоступен для сборки снимка');
  }

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvasWidth, canvasHeight);

  let textY = padding + titleSize;
  context.fillStyle = '#003366';
  context.font = `600 ${titleSize}px system-ui, -apple-system, sans-serif`;
  context.textBaseline = 'alphabetic';
  for (const line of titleLines) {
    context.fillText(line, padding, textY);
    textY += Math.round(titleSize * 1.3);
  }

  if (captionLines.length > 0) {
    textY = padding + titleBlockHeight + 4 * pixelRatio + captionSize * 0.85;
    context.fillStyle = '#64748b';
    context.font = `400 ${captionSize}px system-ui, -apple-system, sans-serif`;
    for (const line of captionLines) {
      context.fillText(line, padding, textY);
      textY += Math.round(captionSize * 1.35);
    }
  }

  const dividerY = padding + bannerHeight - gap / 2;
  context.strokeStyle = '#e5e7eb';
  context.lineWidth = Math.max(1, pixelRatio / 2);
  context.beginPath();
  context.moveTo(padding, dividerY);
  context.lineTo(canvasWidth - padding, dividerY);
  context.stroke();

  context.drawImage(chartImage, padding, padding + bannerHeight);

  return canvas.toDataURL('image/png');
}
