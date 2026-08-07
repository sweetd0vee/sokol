import { toPng } from 'html-to-image';

export type DashboardChartCapture = {
  id: string;
  title: string;
  description: string;
  dataUrl: string;
  svgMarkup?: string;
  width: number;
  height: number;
};

type ChartRegistration = {
  id: string;
  title: string;
  description: string;
  getNode: () => HTMLElement | null;
};

const chartRegistry = new Map<string, Set<ChartRegistration>>();

function hasPngPayload(dataUrl: string) {
  return dataUrl.startsWith('data:image/png;base64,') && Boolean(dataUrl.split(',')[1]);
}

function isCaptureableNode(node: HTMLElement | null): node is HTMLElement {
  if (!node || !node.isConnected) {
    return false;
  }
  const style = window.getComputedStyle(node);
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
    return false;
  }
  const rect = node.getBoundingClientRect();
  return rect.width >= 8 && rect.height >= 8;
}

function resolveVisibleRegistration(id: string): { entry: ChartRegistration; node: HTMLElement } | null {
  const entries = chartRegistry.get(id);
  if (!entries || entries.size === 0) {
    return null;
  }
  for (const entry of entries) {
    const node = entry.getNode();
    if (isCaptureableNode(node)) {
      return { entry, node };
    }
  }
  // Fallback: any connected node, even if currently zero-sized.
  for (const entry of entries) {
    const node = entry.getNode();
    if (node?.isConnected) {
      return { entry, node };
    }
  }
  return null;
}

function extractSvgMarkup(node: HTMLElement): string | undefined {
  const svg = node.querySelector('svg');
  if (!svg) {
    return undefined;
  }
  const clone = svg.cloneNode(true) as SVGElement;
  if (!clone.getAttribute('xmlns')) {
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  }
  return new XMLSerializer().serializeToString(clone);
}

async function captureNode(node: HTMLElement): Promise<{ dataUrl: string; svgMarkup?: string; width: number; height: number }> {
  const rect = node.getBoundingClientRect();
  const width = Math.max(Math.round(rect.width), 1);
  const height = Math.max(Math.round(rect.height), 1);
  const svgMarkup = extractSvgMarkup(node);

  const host = document.createElement('div');
  Object.assign(host.style, {
    position: 'fixed',
    left: '-10000px',
    top: '0',
    width: `${width}px`,
    height: `${height}px`,
    opacity: '1',
    pointerEvents: 'none',
    zIndex: '0',
    background: '#ffffff',
    overflow: 'hidden',
  });

  const clone = node.cloneNode(true) as HTMLElement;
  clone.style.width = `${width}px`;
  clone.style.height = `${height}px`;
  clone.style.maxHeight = 'none';
  clone.style.transform = 'none';
  clone.style.position = 'relative';
  host.appendChild(clone);
  document.body.appendChild(host);

  try {
    await new Promise((resolve) => window.setTimeout(resolve, 80));
    const dataUrl = await toPng(clone, {
      cacheBust: true,
      pixelRatio: 2,
      backgroundColor: '#ffffff',
      width,
      height,
    });
    return { dataUrl, svgMarkup, width, height };
  } finally {
    host.remove();
  }
}

export function registerDashboardChart(registration: ChartRegistration) {
  const bucket = chartRegistry.get(registration.id) ?? new Set<ChartRegistration>();
  bucket.add(registration);
  chartRegistry.set(registration.id, bucket);

  return () => {
    const current = chartRegistry.get(registration.id);
    if (!current) {
      return;
    }
    current.delete(registration);
    if (current.size === 0) {
      chartRegistry.delete(registration.id);
    }
  };
}

export async function captureDashboardCharts(sectionIds: string[]): Promise<DashboardChartCapture[]> {
  const uniqueIds = [...new Set(sectionIds.filter((id) => id && id !== 'source'))];
  const captures: DashboardChartCapture[] = [];
  document.body.classList.add('analytics-export-mode');

  try {
    for (const id of uniqueIds) {
      const resolved = resolveVisibleRegistration(id);
      if (!resolved) {
        console.error(`Skipped chart "${id}" because no visible registered node was found`);
        continue;
      }
      const { entry, node } = resolved;
      try {
        node.scrollIntoView({ block: 'nearest', behavior: 'instant' as ScrollBehavior });
        await new Promise((resolve) => window.setTimeout(resolve, 60));
        const captured = await captureNode(node);
        if (!hasPngPayload(captured.dataUrl)) {
          console.error(`Skipped chart "${id}" because capture did not produce a PNG image`);
          continue;
        }
        captures.push({
          id,
          title: entry.title,
          description: entry.description,
          dataUrl: captured.dataUrl,
          svgMarkup: captured.svgMarkup,
          width: captured.width,
          height: captured.height,
        });
      } catch (error) {
        console.error(`Failed to capture chart "${id}"`, error);
      }
    }
  } finally {
    document.body.classList.remove('analytics-export-mode');
  }

  return captures;
}
