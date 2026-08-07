import { toPng } from 'html-to-image';

export type DashboardChartCapture = {
  id: string;
  title: string;
  description: string;
  dataUrl: string;
  /** Standalone chart SVG for light interactivity in HTML export. */
  svgMarkup?: string;
  /** Non-SVG interactive HTML (tables, KPI blocks) when SVG is unavailable. */
  htmlMarkup?: string;
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

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
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
  for (const entry of entries) {
    const node = entry.getNode();
    if (node?.isConnected) {
      return { entry, node };
    }
  }
  return null;
}

function withClearedAncestorTransforms<T>(node: HTMLElement, run: () => Promise<T>): Promise<T> {
  const restored: Array<{ element: HTMLElement; transform: string; willChange: string }> = [];
  let current: HTMLElement | null = node.parentElement;
  while (current) {
    const computed = window.getComputedStyle(current);
    if (computed.transform && computed.transform !== 'none') {
      restored.push({
        element: current,
        transform: current.style.transform,
        willChange: current.style.willChange,
      });
      current.style.transform = 'none';
      current.style.willChange = 'auto';
    }
    current = current.parentElement;
  }

  return run().finally(() => {
    restored.forEach(({ element, transform, willChange }) => {
      element.style.transform = transform;
      element.style.willChange = willChange;
    });
  });
}

/** Prefer the largest painted Recharts surface (avoid tiny legend/icon SVGs). */
function pickPrimarySvg(node: HTMLElement): SVGSVGElement | null {
  const candidates = [
    ...node.querySelectorAll('svg.recharts-surface'),
    ...node.querySelectorAll('.recharts-wrapper > svg'),
    ...node.querySelectorAll('svg'),
  ];
  const seen = new Set<SVGSVGElement>();
  let best: SVGSVGElement | null = null;
  let bestArea = 0;

  for (const candidate of candidates) {
    if (!(candidate instanceof SVGSVGElement) || seen.has(candidate)) {
      continue;
    }
    seen.add(candidate);
    const rect = candidate.getBoundingClientRect();
    const area = rect.width * rect.height;
    if (area < 40) {
      continue;
    }
    const hasPaint =
      candidate.querySelector(
        'path, rect, circle, polygon, polyline, ellipse, line, text, .recharts-sector, .recharts-rectangle',
      ) != null;
    if (!hasPaint) {
      continue;
    }
    if (area > bestArea) {
      best = candidate;
      bestArea = area;
    }
  }

  return best;
}

export function isUsefulSvgMarkup(svgMarkup: string | undefined): svgMarkup is string {
  if (!svgMarkup) {
    return false;
  }
  // Legend HTML may be appended after the <svg>; validate only the SVG portion.
  const legendStart = svgMarkup.indexOf('<div');
  const svgOnly = legendStart >= 0 ? svgMarkup.slice(0, legendStart) : svgMarkup;
  if (!/<svg\b/i.test(svgOnly) || !/viewBox\s*=/.test(svgOnly)) {
    return false;
  }
  // Grid lines alone are not enough; need at least one painted series mark or label.
  const seriesMarks = (svgOnly.match(/<(path|rect|circle|polygon|polyline|ellipse)\b/gi) ?? []).length;
  const hasText = /<text\b/i.test(svgOnly);
  return seriesMarks >= 1 || (hasText && svgOnly.length > 300);
}

function directChildTexts(group: Element): string[] {
  return [...group.children]
    .filter((child) => {
      const tag = child.tagName.toLowerCase();
      return tag === 'text' || tag === 'title';
    })
    .map((child) => (child.textContent || '').trim())
    .filter(Boolean);
}

function annotateInteractiveLabels(clone: SVGSVGElement) {
  try {
    const marks = clone.querySelectorAll(
      'path, rect, circle, polygon, polyline, ellipse, .recharts-sector, .recharts-rectangle',
    );
    marks.forEach((element) => {
      try {
        if (
          typeof element.closest === 'function' &&
          element.closest(
            '.recharts-cartesian-grid, .recharts-brush, .recharts-reference-line, .recharts-reference-area',
          )
        ) {
          return;
        }
        const existing =
          element.getAttribute('data-label') ||
          element.getAttribute('name') ||
          element.getAttribute('aria-label') ||
          element.getAttribute('title');
        if (existing?.trim()) {
          element.setAttribute('data-label', existing.trim());
          return;
        }

        const group = element.parentElement;
        if (!group) {
          return;
        }
        const texts = directChildTexts(group);
        if (texts.length > 0) {
          element.setAttribute('data-label', texts.join(' · '));
        }
      } catch {
        // Ignore a single mark annotation failure.
      }
    });
  } catch (error) {
    console.warn('SVG label annotation failed', error);
  }
}

function rewriteFragmentIds(markup: string, uid: string): string {
  let next = markup.replace(/url\(#([^)]+)\)/g, (_match, id: string) =>
    id.startsWith(`${uid}-`) ? `url(#${id})` : `url(#${uid}-${id})`,
  );
  next = next.replace(/((?:xlink:)?href=["']#)([^"']+)(["'])/g, (_match, prefix: string, id: string, suffix: string) =>
    id.startsWith(`${uid}-`) ? `${prefix}${id}${suffix}` : `${prefix}${uid}-${id}${suffix}`,
  );
  return next;
}

function extractLegendHtml(node: HTMLElement): string | undefined {
  const legend = node.querySelector('.recharts-legend-wrapper');
  if (!(legend instanceof HTMLElement)) {
    return undefined;
  }
  const rect = legend.getBoundingClientRect();
  if (rect.width < 8 || rect.height < 4) {
    return undefined;
  }
  const clone = legend.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('[style]').forEach((element) => {
    // Keep inline styles from Recharts legend swatches.
    if (!(element instanceof HTMLElement)) {
      return;
    }
    const computed = window.getComputedStyle(element);
    if (!element.style.color && computed.color) {
      element.style.color = computed.color;
    }
  });
  return clone.outerHTML;
}

function extractSvgMarkup(node: HTMLElement): string | undefined {
  try {
    const svg = pickPrimarySvg(node);
    if (!svg) {
      return undefined;
    }

    const clone = svg.cloneNode(true) as SVGSVGElement;
    const rect = svg.getBoundingClientRect();
    const width = Math.max(Math.round(rect.width), 1);
    const height = Math.max(Math.round(rect.height), 1);
    const uid = `svg${Math.random().toString(36).slice(2, 9)}`;

    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('width', String(width));
    clone.setAttribute('height', String(height));
    clone.setAttribute('viewBox', `0 0 ${width} ${height}`);
    clone.removeAttribute('style');
    annotateInteractiveLabels(clone);

    clone.querySelectorAll('[id]').forEach((element) => {
      const id = element.getAttribute('id');
      if (!id) {
        return;
      }
      element.setAttribute('id', `${uid}-${id}`);
    });

    let markup = new XMLSerializer().serializeToString(clone);
    markup = rewriteFragmentIds(markup, uid);

    try {
      const legendHtml = extractLegendHtml(node);
      if (legendHtml) {
        return `${markup}<div class="chart-legend">${legendHtml}</div>`;
      }
    } catch (legendError) {
      console.warn('Legend extraction failed', legendError);
    }
    return markup;
  } catch (error) {
    console.warn('SVG extraction failed', error);
    return undefined;
  }
}

function extractHtmlMarkup(node: HTMLElement): string | undefined {
  try {
    // Heatmaps / KPI blocks without Recharts — keep real HTML instead of a flat PNG.
    if (pickPrimarySvg(node)) {
      return undefined;
    }
    const table = node.querySelector('table');
    if (table instanceof HTMLTableElement) {
      return `<div class="chart-html">${table.outerHTML}</div>`;
    }
    const clone = node.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('[data-chart-toolbar]').forEach((toolbar) => toolbar.remove());
    const text = (clone.textContent || '').replace(/\s+/g, ' ').trim();
    if (text.length < 8) {
      return undefined;
    }
    return `<div class="chart-html">${clone.innerHTML}</div>`;
  } catch (error) {
    console.warn('HTML extraction failed', error);
    return undefined;
  }
}

async function waitForChartPaint(node: HTMLElement) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    if (pickPrimarySvg(node) || node.querySelector('table')) {
      return;
    }
    await delay(50);
  }
}

async function captureNodeAsPng(node: HTMLElement, width: number, height: number): Promise<string> {
  try {
    return await withClearedAncestorTransforms(node, async () => {
      await delay(40);
      return toPng(node, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        width,
        height,
        style: { transform: 'none' },
        filter: (domNode) => {
          if (!(domNode instanceof HTMLElement)) {
            return true;
          }
          return !domNode.closest('[data-chart-toolbar]');
        },
      });
    });
  } catch (liveError) {
    console.warn('Live chart capture failed, falling back to isolated clone', liveError);
    const host = document.createElement('div');
    Object.assign(host.style, {
      position: 'fixed',
      left: '-10000px',
      top: '0',
      width: `${width}px`,
      height: `${height}px`,
      background: '#ffffff',
      overflow: 'hidden',
      pointerEvents: 'none',
    });
    const clone = node.cloneNode(true) as HTMLElement;
    clone.style.width = `${width}px`;
    clone.style.height = `${height}px`;
    clone.style.transform = 'none';
    host.appendChild(clone);
    document.body.appendChild(host);
    try {
      await delay(80);
      return await toPng(clone, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        width,
        height,
      });
    } finally {
      host.remove();
    }
  }
}

async function captureNode(node: HTMLElement): Promise<{
  dataUrl: string;
  svgMarkup?: string;
  htmlMarkup?: string;
  width: number;
  height: number;
}> {
  await waitForChartPaint(node);
  const rect = node.getBoundingClientRect();
  const width = Math.max(Math.round(rect.width), 1);
  const height = Math.max(Math.round(rect.height), 1);
  // Never let SVG/HTML enrichment fail the whole card — PNG is the safety net.
  const svgMarkup = extractSvgMarkup(node);
  const htmlMarkup = isUsefulSvgMarkup(svgMarkup) ? undefined : extractHtmlMarkup(node);
  let dataUrl = '';
  try {
    dataUrl = await captureNodeAsPng(node, width, height);
  } catch (error) {
    console.warn('PNG capture failed', error);
  }
  return { dataUrl, svgMarkup, htmlMarkup, width, height };
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
        try {
          node.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' as ScrollBehavior });
        } catch {
          node.scrollIntoView({ block: 'center', inline: 'nearest' });
        }
        await delay(160);
        const captured = await captureNode(node);
        const hasSvg = isUsefulSvgMarkup(captured.svgMarkup);
        const hasHtml = Boolean(captured.htmlMarkup);
        const hasPng = hasPngPayload(captured.dataUrl);
        if (!hasPng && !hasSvg && !hasHtml) {
          console.error(`Skipped chart "${id}" because capture produced no usable payload`);
          continue;
        }
        captures.push({
          id,
          title: entry.title,
          description: entry.description,
          // Keep a placeholder data URL so PDF/XLSX/DOCX paths can still skip safely.
          dataUrl: hasPng ? captured.dataUrl : 'data:image/png;base64,',
          svgMarkup: hasSvg ? captured.svgMarkup : undefined,
          htmlMarkup: hasHtml ? captured.htmlMarkup : undefined,
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
