/**
 * Interactive constructor HTML: widgets stay on the 12-col board,
 * charts are embedded SVG/HTML (with hover tooltips), not one screenshot.
 */
import { CONSTRUCTOR_GRID_COLS } from '../components/analytics/constructor/constructorLayout';
import {
  CONSTRUCTOR_SOURCE_LABELS,
  type ConstructorWidget,
} from '../components/analytics/constructor/constructorTypes';
import { clampConstructorGridRect } from './constructorXlsxLayout';
import {
  chartHasPngPayload,
  isUsefulSvgMarkup,
  namespaceSvgMarkupForEmbed,
  type DashboardChartCapture,
} from './dashboardChartRegistry';
import { MATERIALITY_COLORS } from './recommendationAnalytics';

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function resolveConstructorHtmlChartBody(chart: DashboardChartCapture, index: number): string {
  const prefersHtml =
    chart.htmlMarkup?.includes('class="chart-html"')
    || chart.htmlMarkup?.includes('class="kpi-strip"');
  if (prefersHtml && chart.htmlMarkup) {
    return chart.htmlMarkup;
  }
  if (isUsefulSvgMarkup(chart.svgMarkup)) {
    let namespacedSvg = chart.svgMarkup;
    try {
      namespacedSvg = namespaceSvgMarkupForEmbed(chart.svgMarkup, `chart-${index}-${chart.id}`);
    } catch {
      // DOMParser is unavailable in some test/runtime hosts; raw SVG still embeds.
    }
    return `<div class="chart-svg" data-chart-index="${index}">${namespacedSvg}</div>`;
  }
  if (chart.htmlMarkup) {
    return chart.htmlMarkup;
  }
  if (chartHasPngPayload(chart.dataUrl)) {
    return `<img class="chart-img" src="${chart.dataUrl}" alt="${escapeHtml(chart.title)}" width="${chart.width}" height="${chart.height}" />`;
  }
  return '<p class="chart-empty">Не удалось отобразить график</p>';
}

export function constructorHtmlGridStyle(layout: { x: number; y: number; w: number; h: number }): string {
  const { x, y, w, h } = clampConstructorGridRect(layout);
  return `grid-column:${x + 1} / span ${w};grid-row:${y + 1} / span ${h}`;
}

export function buildConstructorDashboardHtml(options: {
  title: string;
  meta: Array<[string, string]>;
  widgets: ConstructorWidget[];
  captures: DashboardChartCapture[];
}): string {
  const { title, meta, widgets, captures } = options;
  const byId = new Map(captures.map((item) => [item.id, item]));
  const metaRows = meta
    .map(
      ([label, value]) =>
        `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`,
    )
    .join('');

  const cells = widgets
    .map((widget, index) => {
      const capture = byId.get(widget.instanceId);
      const body = capture
        ? resolveConstructorHtmlChartBody(capture, index)
        : `<p class="chart-empty">${escapeHtml(widget.title)}</p>`;
      const source = CONSTRUCTOR_SOURCE_LABELS[widget.kind];
      return `<article class="widget" style="${constructorHtmlGridStyle(widget.layout)}">
  <header>
    <h2>${escapeHtml(widget.title)}</h2>
    <p>${escapeHtml(source)}${widget.filterCaption ? ` · ${escapeHtml(widget.filterCaption)}` : ''}</p>
  </header>
  <div class="chart-frame">${body}</div>
</article>`;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    :root {
      --ink: #1a2332;
      --muted: #5b6b7c;
      --brand: #003366;
      --brand-soft: #e8eef4;
      --line: #d7dee7;
      --bg: #f3f5f7;
      --card: #ffffff;
      --accent: #4f7fa8;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
      color: var(--ink);
      background: var(--bg);
      line-height: 1.5;
    }
    .page { width: min(1280px, calc(100% - 32px)); margin: 24px auto 48px; }
    .hero {
      background: var(--card);
      border: 1px solid var(--line);
      border-top: 3px solid var(--brand);
      border-radius: 12px;
      padding: 22px 24px;
      margin-bottom: 14px;
    }
    .hero .brand {
      margin: 0 0 8px;
      color: var(--brand);
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }
    h1 { margin: 0; color: var(--brand); font-size: 1.6rem; }
    .meta {
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 12px;
      overflow: hidden;
      margin-bottom: 16px;
    }
    .meta table { width: 100%; border-collapse: collapse; }
    .meta th, .meta td {
      padding: 8px 12px;
      border-bottom: 1px solid var(--line);
      text-align: left;
      font-size: 0.9rem;
    }
    .meta th { width: 220px; color: var(--brand); background: var(--brand-soft); }
    .board {
      display: grid;
      grid-template-columns: repeat(${CONSTRUCTOR_GRID_COLS}, minmax(0, 1fr));
      grid-auto-rows: minmax(92px, auto);
      gap: 12px;
    }
    .widget {
      min-width: 0;
      min-height: 0;
      display: flex;
      flex-direction: column;
      background: var(--card);
      border: 1px solid var(--line);
      overflow: hidden;
    }
    .widget header { padding: 10px 12px 0; }
    .widget header h2 {
      margin: 0;
      color: var(--brand);
      font-size: 0.95rem;
      font-weight: 700;
    }
    .widget header p {
      margin: 2px 0 8px;
      color: var(--muted);
      font-size: 0.75rem;
    }
    .chart-frame {
      flex: 1;
      min-height: 180px;
      padding: 4px 8px 10px;
      overflow: visible;
    }
    .chart-svg, .chart-img, .chart-html, .kpi-strip { display: block; width: 100%; height: 100%; }
    .chart-svg svg, .chart-img {
      display: block;
      width: 100%;
      height: auto;
      max-height: 100%;
      background: #fff;
    }
    .chart-svg svg {
      cursor: crosshair;
      overflow: visible;
    }
    .chart-svg svg text { font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif; }
    .chart-empty { margin: 18px 0; text-align: center; color: var(--muted); font-size: 0.9rem; }
    .chart-legend { margin-top: 8px; display: flex; justify-content: center; }
    .chart-legend-list {
      display: flex; flex-wrap: wrap; justify-content: center; gap: 10px 16px;
      margin: 0; padding: 0; list-style: none;
    }
    .chart-legend-list li {
      display: inline-flex; align-items: center; gap: 6px;
      color: var(--muted); font-size: 0.8rem;
    }
    .chart-legend-swatch { width: 10px; height: 10px; flex-shrink: 0; background: var(--accent); }
    .chart-html { overflow: auto; background: #fff; }
    .chart-html table { width: 100%; border-collapse: collapse; font-size: 0.82rem; }
    .chart-html th, .chart-html td { border: 1px solid var(--line); padding: 6px 8px; }
    .kpi-strip { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 8px; }
    .kpi-card {
      display: flex; align-items: center; justify-content: space-between; gap: 10px;
      min-height: 72px; padding: 12px 14px; border: 1px solid var(--line);
    }
    .kpi-label { font-size: 0.86rem; opacity: 0.82; }
    .kpi-value { font-size: 1.35rem; font-weight: 700; }
    .chart-svg svg .recharts-layer path,
    .chart-svg svg .recharts-layer rect,
    .chart-svg svg .recharts-sector,
    .chart-svg svg .recharts-rectangle { transition: opacity 0.15s ease, filter 0.15s ease; }
    .chart-svg.is-hovering svg .recharts-layer path,
    .chart-svg.is-hovering svg .recharts-layer rect,
    .chart-svg.is-hovering svg .recharts-sector,
    .chart-svg.is-hovering svg .recharts-rectangle { opacity: 0.35; }
    .chart-svg.is-hovering svg .recharts-layer path:hover,
    .chart-svg.is-hovering svg .recharts-layer rect:hover,
    .chart-svg.is-hovering svg .recharts-sector:hover,
    .chart-svg.is-hovering svg .recharts-rectangle:hover,
    .chart-svg svg [data-active="true"] { opacity: 1 !important; filter: brightness(1.05); }
    .tooltip {
      position: fixed; z-index: 20; pointer-events: none; display: none;
      min-width: 120px; max-width: 320px; padding: 8px 10px;
      background: rgba(0, 51, 102, 0.94); color: #fff; font-size: 12px;
      white-space: pre-line; line-height: 1.35;
    }
    @media print { body { background: #fff; } .page { width: 100%; margin: 0; } }
  </style>
</head>
<body>
  <div class="page">
    <section class="hero">
      <p class="brand">SOKOL</p>
      <h1>${escapeHtml(title)}</h1>
    </section>
    <section class="meta"><table>${metaRows}</table></section>
    <section class="board" aria-label="${escapeHtml(title)}">
      ${cells}
    </section>
  </div>
  <div class="tooltip" id="chart-tooltip"></div>
  <script>
    (function () {
      var tooltip = document.getElementById('chart-tooltip');
      var fillTooltip = function (hit, fallbackLabel) {
        if (!tooltip) return;
        var high = hit.getAttribute('data-materiality-high');
        var medium = hit.getAttribute('data-materiality-medium');
        var low = hit.getAttribute('data-materiality-low');
        if (high === null && medium === null && low === null) {
          tooltip.textContent = fallbackLabel || 'Значение графика';
          return;
        }
        tooltip.replaceChildren();
        var name = (hit.getAttribute('data-name') || '').trim();
        var value = (hit.getAttribute('data-value') || '').trim();
        var headline = name && value
          ? name + ': ' + value
          : (fallbackLabel || '').split('\\n')[0] || 'Рекомендации';
        var titleEl = document.createElement('div');
        titleEl.style.fontWeight = '600';
        titleEl.style.marginBottom = '4px';
        titleEl.textContent = headline;
        tooltip.appendChild(titleEl);
        [
          ['Высокий', high, '${MATERIALITY_COLORS.высокий}'],
          ['Средний', medium, '${MATERIALITY_COLORS.средний}'],
          ['Низкий', low, '${MATERIALITY_COLORS.низкий}']
        ].forEach(function (row) {
          var line = document.createElement('div');
          line.style.color = row[2];
          line.style.fontWeight = '600';
          line.textContent = row[0] + ': ' + (row[1] == null || row[1] === '' ? '0' : row[1]);
          tooltip.appendChild(line);
        });
      };
      document.querySelectorAll('.chart-svg').forEach(function (frame) {
        frame.addEventListener('pointerover', function (event) {
          var target = event.target;
          if (!target || !target.closest) return;
          var hit = target.closest('path, rect, circle, polygon, polyline, .recharts-sector, .recharts-rectangle');
          if (!hit || !frame.contains(hit)) return;
          frame.classList.add('is-hovering');
          frame.querySelectorAll('[data-active="true"]').forEach(function (node) {
            node.removeAttribute('data-active');
          });
          hit.setAttribute('data-active', 'true');
          var label =
            hit.getAttribute('data-label') ||
            hit.getAttribute('name') ||
            hit.getAttribute('aria-label') ||
            hit.getAttribute('data-name') ||
            hit.getAttribute('title');
          if (!label) {
            var group = hit.closest('g');
            if (group) {
              var texts = [];
              Array.prototype.forEach.call(group.children || [], function (node) {
                var tag = (node.tagName || '').toLowerCase();
                if (tag !== 'text' && tag !== 'title') return;
                var value = (node.textContent || '').trim();
                if (value) texts.push(value);
              });
              if (texts.length) label = texts.join(' · ');
            }
          }
          fillTooltip(hit, label);
          tooltip.style.display = 'block';
        });
        frame.addEventListener('pointermove', function (event) {
          if (tooltip.style.display === 'none') return;
          tooltip.style.left = event.clientX + 14 + 'px';
          tooltip.style.top = event.clientY + 14 + 'px';
        });
        frame.addEventListener('pointerleave', function () {
          frame.classList.remove('is-hovering');
          frame.querySelectorAll('[data-active="true"]').forEach(function (node) {
            node.removeAttribute('data-active');
          });
          tooltip.style.display = 'none';
        });
      });
    })();
  </script>
</body>
</html>`;
}
