import { toPng } from 'html-to-image';

const EXPORT_PNG_PIXEL_RATIO = 4;

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

const EXPORT_CAPTURE_ATTRIBUTE = 'data-analytics-export-capture-id';
const EXPORT_TITLE_ATTRIBUTE = 'data-analytics-export-title';
const EXPORT_DESCRIPTION_ATTRIBUTE = 'data-analytics-export-description';
const TABLE_EXPORT_CHART_IDS = new Set(['effectivenessMatrix', 'materialityMatrix', 'statusMatrix']);

const chartRegistry = new Map<string, Set<ChartRegistration>>();

function hasPngPayload(dataUrl: string) {
  return chartHasPngPayload(dataUrl);
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function isCaptureableNode(node: HTMLElement | null): node is HTMLElement {
  if (!node || !node.isConnected) {
    return false;
  }
  const style = window.getComputedStyle(node);
  if (style.display === 'none' || style.visibility === 'hidden') {
    return false;
  }
  const rect = node.getBoundingClientRect();
  const width = Math.max(rect.width, node.offsetWidth || 0);
  const height = Math.max(rect.height, node.offsetHeight || 0);
  return width >= 4 && height >= 4;
}

function resolveVisibleRegistration(id: string): { entry: ChartRegistration; node: HTMLElement } | null {
  const entries = chartRegistry.get(id);
  let fallback: { entry: ChartRegistration; node: HTMLElement } | null = null;

  if (entries && entries.size > 0) {
    for (const entry of entries) {
      const node = entry.getNode();
      if (!node?.isConnected) {
        continue;
      }
      if (!fallback) {
        fallback = { entry, node };
      }
      if (isCaptureableNode(node)) {
        return { entry, node };
      }
    }
  }

  const domFallback = resolveDomRegistration(id);
  return domFallback ?? fallback;
}

function resolveDomRegistration(id: string): { entry: ChartRegistration; node: HTMLElement } | null {
  const candidates = [...document.querySelectorAll(`[${EXPORT_CAPTURE_ATTRIBUTE}]`)];
  for (const candidate of candidates) {
    if (!(candidate instanceof HTMLElement) || candidate.getAttribute(EXPORT_CAPTURE_ATTRIBUTE) !== id) {
      continue;
    }
    if (!isCaptureableNode(candidate)) {
      continue;
    }
    const entry: ChartRegistration = {
      id,
      title: candidate.getAttribute(EXPORT_TITLE_ATTRIBUTE) || id,
      description: candidate.getAttribute(EXPORT_DESCRIPTION_ATTRIBUTE) || '',
      getNode: () => candidate,
    };
    return { entry, node: candidate };
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

function svgPaintArea(svg: SVGSVGElement): number {
  const rect = svg.getBoundingClientRect();
  const attrW = Number(svg.getAttribute('width'));
  const attrH = Number(svg.getAttribute('height'));
  const width = Math.max(rect.width, svg.clientWidth || 0, Number.isFinite(attrW) ? attrW : 0, 0);
  const height = Math.max(rect.height, svg.clientHeight || 0, Number.isFinite(attrH) ? attrH : 0, 0);
  return width * height;
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
    const area = svgPaintArea(candidate);
    if (area < 16) {
      continue;
    }
    const hasPaint =
      candidate.querySelector(
        'path, rect, circle, polygon, polyline, ellipse, line, text, .recharts-sector, .recharts-rectangle',
      ) !== null;
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
  const legendMarker = svgMarkup.indexOf('<div class="chart-legend"');
  const svgOnly = legendMarker >= 0 ? svgMarkup.slice(0, legendMarker) : svgMarkup;
  if (!/<svg\b/i.test(svgOnly)) {
    return false;
  }
  // Accept any real chart surface; viewBox is added during extraction when missing.
  const seriesMarks = (svgOnly.match(/<(path|rect|circle|polygon|polyline|ellipse|line|text)\b/gi) ?? [])
    .length;
  return seriesMarks >= 1 || svgOnly.length > 250;
}

function directChildTexts(group: Element): string[] {
  return [...group.children]
    .filter((child) => {
      const tag = child.tagName.toLowerCase();
      return tag === 'text';
    })
    .map((child) => (child.textContent || '').trim())
    .filter(Boolean);
}

function directChildTitles(group: Element): string[] {
  return [...group.children]
    .filter((child) => (child.tagName.toLowerCase() === 'title'))
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
        // Prefer <title> when present: for many Recharts custom contents (e.g. Treemap)
        // <title> already contains the full label (name + value). Concatenating it
        // with <text> leads to duplicated names in HTML export tooltips.
        const titles = directChildTitles(group);
        if (titles.length > 0) {
          element.setAttribute('data-label', titles.join(' · '));
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

/** Re-namespace SVG ids when several chart SVGs are embedded in one HTML page. */
export function namespaceSvgMarkupForEmbed(markup: string, namespace: string): string {
  const safeNamespace = namespace.replace(/[^a-zA-Z0-9_-]/g, '') || 'chart';
  const legendMarker = markup.indexOf('<div class="chart-legend"');
  const svgPart = legendMarker >= 0 ? markup.slice(0, legendMarker) : markup;
  const legendPart = legendMarker >= 0 ? markup.slice(legendMarker) : '';

  if (!/<svg\b/i.test(svgPart)) {
    return markup;
  }

  const doc = new DOMParser().parseFromString(`<body>${svgPart}</body>`, 'text/html');
  const svg = doc.body.querySelector('svg');
  if (!svg) {
    return markup;
  }

  svg.querySelectorAll('[id]').forEach((element) => {
    const id = element.getAttribute('id');
    if (!id || id.startsWith(`${safeNamespace}-`)) {
      return;
    }
    element.setAttribute('id', `${safeNamespace}-${id}`);
  });

  let serialized = rewriteFragmentIds(new XMLSerializer().serializeToString(svg), safeNamespace);
  if (legendPart) {
    serialized = `${serialized}${legendPart}`;
  }
  return serialized;
}

export function chartHasPngPayload(dataUrl: string) {
  return dataUrl.startsWith('data:image/png;base64,') && Boolean(dataUrl.split(',')[1]);
}

function escapeAttr(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeText(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function resolveLegendSwatchColor(item: Element): string {
  const graphic = item.querySelector('path, rect, circle, line, polygon, polyline');
  if (graphic) {
    const fill = graphic.getAttribute('fill');
    if (fill && fill !== 'none' && !fill.startsWith('url(')) {
      return fill;
    }
    const stroke = graphic.getAttribute('stroke');
    if (stroke && stroke !== 'none') {
      return stroke;
    }
  }
  const icon = item.querySelector('.recharts-legend-icon, span');
  if (icon instanceof HTMLElement) {
    const background = window.getComputedStyle(icon).backgroundColor;
    if (background && background !== 'rgba(0, 0, 0, 0)' && background !== 'transparent') {
      return background;
    }
    const color = window.getComputedStyle(icon).color;
    if (color) {
      return color;
    }
  }
  if (item instanceof HTMLElement) {
    return window.getComputedStyle(item).color || '#4f7fa8';
  }
  return '#4f7fa8';
}

/** Rebuild a clean legend — cloned Recharts legend DOM breaks without their CSS. */
function extractLegendHtml(node: HTMLElement): string | undefined {
  const items = [...node.querySelectorAll('.recharts-legend-item')];
  if (items.length === 0) {
    return undefined;
  }

  const entries = items
    .map((item) => {
      const text = (item.textContent || '').replace(/\s+/g, ' ').trim();
      if (!text) {
        return null;
      }
      return { text, color: resolveLegendSwatchColor(item) };
    })
    .filter((entry): entry is { text: string; color: string } => Boolean(entry));

  if (entries.length === 0) {
    return undefined;
  }

  return `<ul class="chart-legend-list">${entries
    .map(
      (entry) =>
        `<li><span class="chart-legend-swatch" style="background:${escapeAttr(entry.color)}"></span><span>${escapeText(entry.text)}</span></li>`,
    )
    .join('')}</ul>`;
}

function extractMaterialityBreakdownLegend(clone: SVGSVGElement): string | undefined {
  const cells = [...clone.querySelectorAll('[data-materiality-high], [data-materiality-medium], [data-materiality-low]')];
  if (cells.length === 0) {
    return undefined;
  }

  const rows = cells
    .map((element) => {
      const name = (element.getAttribute('data-name') || '').trim();
      const valueRaw = (element.getAttribute('data-value') || '').trim();
      if (!name) {
        return null;
      }
      const value = Number(valueRaw);
      return {
        name,
        value: Number.isFinite(value) ? value : 0,
        high: element.getAttribute('data-materiality-high') ?? '0',
        medium: element.getAttribute('data-materiality-medium') ?? '0',
        low: element.getAttribute('data-materiality-low') ?? '0',
      };
    })
    .filter((row): row is { name: string; value: number; high: string; medium: string; low: string } => Boolean(row))
    .sort((left, right) => right.value - left.value || left.name.localeCompare(right.name, 'ru'));

  if (rows.length === 0) {
    return undefined;
  }

  const body = rows
    .map(
      (row) => `<tr>
        <td>${escapeText(row.name)}</td>
        <td>${escapeText(String(row.value))}</td>
        <td>${escapeText(row.high)}</td>
        <td>${escapeText(row.medium)}</td>
        <td>${escapeText(row.low)}</td>
      </tr>`,
    )
    .join('');

  return `<div class="chart-legend"><table class="chart-materiality-legend">
    <caption>Уровни существенности</caption>
    <thead>
      <tr>
        <th>Департамент</th>
        <th>Всего</th>
        <th>Высокий</th>
        <th>Средний</th>
        <th>Низкий</th>
      </tr>
    </thead>
    <tbody>${body}</tbody>
  </table></div>`;
}

function resolveSvgViewBox(svg: SVGSVGElement, fallbackWidth: number, fallbackHeight: number): string {
  const native = svg.getAttribute('viewBox')?.trim();
  if (native) {
    return native;
  }
  const attrWidth = Number(svg.getAttribute('width'));
  const attrHeight = Number(svg.getAttribute('height'));
  if (Number.isFinite(attrWidth) && Number.isFinite(attrHeight) && attrWidth > 0 && attrHeight > 0) {
    return `0 0 ${attrWidth} ${attrHeight}`;
  }
  return `0 0 ${fallbackWidth} ${fallbackHeight}`;
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

    // Keep Recharts' own coordinate system — overwriting viewBox with CSS pixels warps labels.
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('viewBox', resolveSvgViewBox(svg, width, height));
    clone.setAttribute('width', String(width));
    clone.setAttribute('height', String(height));
    clone.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    clone.removeAttribute('style');

    // Drop transient tooltip layers if they were somehow painted into the surface.
    clone.querySelectorAll('.recharts-tooltip-wrapper, .recharts-default-tooltip').forEach((element) => {
      element.remove();
    });

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

    const extras: string[] = [];
    try {
      const legendHtml = extractLegendHtml(node);
      if (legendHtml) {
        extras.push(`<div class="chart-legend">${legendHtml}</div>`);
      }
    } catch (legendError) {
      console.warn('Legend extraction failed', legendError);
    }
    try {
      const materialityLegend = extractMaterialityBreakdownLegend(clone);
      if (materialityLegend) {
        extras.push(materialityLegend);
      }
    } catch (materialityLegendError) {
      console.warn('Materiality legend extraction failed', materialityLegendError);
    }
    return extras.length > 0 ? `${markup}${extras.join('')}` : markup;
  } catch (error) {
    console.warn('SVG extraction failed', error);
    return undefined;
  }
}

/** Rebuild KPI chips with inline styles — Tailwind classes are absent in exported HTML. */
function extractKpiStripMarkup(node: HTMLElement): string | undefined {
  const grid =
    [...node.querySelectorAll('div')].find((candidate) => {
      if (!(candidate instanceof HTMLElement)) {
        return false;
      }
      const kids = [...candidate.children].filter((child) => child instanceof HTMLElement);
      return kids.length >= 2 && kids.every((child) => child.querySelector('p'));
    }) ?? null;

  if (!(grid instanceof HTMLElement)) {
    return undefined;
  }

  const cards = [...grid.children].filter((child): child is HTMLElement => child instanceof HTMLElement);
  const items = cards
    .map((card) => {
      const texts = [...card.querySelectorAll('p')]
        .map((paragraph) => (paragraph.textContent || '').replace(/\s+/g, ' ').trim())
        .filter(Boolean);
      if (texts.length < 2) {
        return null;
      }
      const label = texts[0];
      const value = texts[texts.length - 1];
      const hint = texts.length > 2 ? texts.slice(1, -1).join(' ') : '';
      const computed = window.getComputedStyle(card);
      return {
        label,
        hint,
        value,
        background: computed.backgroundColor || '#f8fafc',
        border: computed.borderColor || '#d7dee7',
        color: computed.color || '#1a2332',
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  if (items.length < 2) {
    return undefined;
  }

  const cardsHtml = items
    .map(
      (item) => `
      <div class="kpi-card" style="background:${escapeAttr(item.background)};border-color:${escapeAttr(item.border)};color:${escapeAttr(item.color)}">
        <div class="kpi-meta">
          <div class="kpi-label">${escapeText(item.label)}</div>
          ${item.hint ? `<div class="kpi-hint">${escapeText(item.hint)}</div>` : ''}
        </div>
        <div class="kpi-value">${escapeText(item.value)}</div>
      </div>`,
    )
    .join('');

  return `<div class="kpi-strip">${cardsHtml}</div>`;
}

function findExportHtmlRoot(node: HTMLElement): HTMLElement | null {
  const exportRoot = node.querySelector('[data-export-html]');
  return exportRoot instanceof HTMLElement ? exportRoot : null;
}

function buildExportHtmlMarkup(node: HTMLElement): string | undefined {
  const exportRoot = findExportHtmlRoot(node);
  if (!exportRoot) {
    return undefined;
  }
  return `<div class="chart-html">${exportRoot.outerHTML}</div>`;
}

function extractHtmlMarkup(node: HTMLElement): string | undefined {
  try {
    const exportHtml = buildExportHtmlMarkup(node);
    if (exportHtml) {
      return exportHtml;
    }
    // Heatmaps / KPI blocks without Recharts — keep real HTML instead of a flat PNG.
    if (pickPrimarySvg(node)) {
      return undefined;
    }
    const table = node.querySelector('table');
    if (table instanceof HTMLTableElement) {
      return `<div class="chart-html">${table.outerHTML}</div>`;
    }
    const kpiMarkup = extractKpiStripMarkup(node);
    if (kpiMarkup) {
      return kpiMarkup;
    }
    // Avoid dumping raw Tailwind markup (classes are missing in the standalone HTML file).
    return undefined;
  } catch (error) {
    console.warn('HTML extraction failed', error);
    return undefined;
  }
}

async function waitForChartPaint(node: HTMLElement) {
  for (let attempt = 0; attempt < 24; attempt += 1) {
    if (
      pickPrimarySvg(node)
      || node.querySelector('[data-export-html]')
      || node.querySelector('table')
      || node.querySelector('p')
    ) {
      return;
    }
    await delay(75);
  }
}

async function captureNodeAsPng(
  node: HTMLElement,
  width: number,
  height: number,
  pixelRatio = EXPORT_PNG_PIXEL_RATIO,
): Promise<string> {
  try {
    return await withClearedAncestorTransforms(node, async () => {
      await delay(40);
      return toPng(node, {
        cacheBust: true,
        pixelRatio,
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
        pixelRatio,
        backgroundColor: '#ffffff',
        width,
        height,
      });
    } finally {
      host.remove();
    }
  }
}

async function captureNode(
  node: HTMLElement,
  options?: { skipPng?: boolean; pixelRatio?: number },
): Promise<{
  dataUrl: string;
  svgMarkup?: string;
  htmlMarkup?: string;
  width: number;
  height: number;
}> {
  await waitForChartPaint(node);
  const rect = node.getBoundingClientRect();
  const width = Math.max(Math.round(rect.width), node.offsetWidth || 0, 1);
  const height = Math.max(Math.round(rect.height), node.offsetHeight || 0, 1);
  const exportHtmlMarkup = buildExportHtmlMarkup(node);
  const svgMarkup = exportHtmlMarkup ? undefined : extractSvgMarkup(node);
  const htmlMarkup = exportHtmlMarkup ?? (isUsefulSvgMarkup(svgMarkup) ? undefined : extractHtmlMarkup(node));
  let dataUrl = '';
  const hasVector = isUsefulSvgMarkup(svgMarkup) || Boolean(htmlMarkup);
  if (!options?.skipPng || !hasVector) {
    try {
      dataUrl = await captureNodeAsPng(node, width, height, options?.pixelRatio);
    } catch (error) {
      console.warn('PNG capture failed', error);
    }
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

export type DashboardChartCaptureOptions = {
  skipPng?: boolean;
  pixelRatio?: number;
};

export async function captureDashboardCharts(
  sectionIds: string[],
  options?: DashboardChartCaptureOptions,
): Promise<DashboardChartCapture[]> {
  const uniqueIds = [...new Set(sectionIds.filter((id) => id && id !== 'source'))];
  const captures: DashboardChartCapture[] = [];
  document.body.classList.add('analytics-export-mode');

  try {
    for (const id of uniqueIds) {
      const resolved = resolveVisibleRegistration(id);
      if (!resolved) {
        console.error(
          `Skipped chart "${id}" because no visible registered node was found. Registered: ${[...chartRegistry.keys()].join(', ') || '(none)'}`,
        );
        continue;
      }
      const { entry, node } = resolved;
      try {
        try {
          node.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' as ScrollBehavior });
        } catch {
          node.scrollIntoView({ block: 'center', inline: 'nearest' });
        }
        await delay(320);
        const captured = await captureNode(node, {
          skipPng: options?.skipPng || TABLE_EXPORT_CHART_IDS.has(id),
          pixelRatio: options?.pixelRatio,
        });
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
          width: Math.max(captured.width, 320),
          height: Math.max(captured.height, 180),
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
