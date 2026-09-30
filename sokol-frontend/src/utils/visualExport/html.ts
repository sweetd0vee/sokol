import {
  chartHasPngPayload,
  isUsefulSvgMarkup,
  namespaceSvgMarkupForEmbed,
  type DashboardChartCapture,
} from '../dashboardChartRegistry';
import { RECOMMENDATIONS_MATERIALITY_CHART_COLORS } from '../../constants/analyticsPalette';
import { escapeHtml, stamp } from './shared';
import type { VisualExportMetaRow } from './types';

function resolveHtmlChartBody(chart: DashboardChartCapture, index: number): string {
  const prefersHtml =
    chart.id === 'effectivenessMatrix'
    || chart.id === 'materialityMatrix'
    || chart.id === 'statusMatrix'
    || chart.htmlMarkup?.includes('class="chart-html"')
    || chart.htmlMarkup?.includes('class="kpi-strip"');
  if (prefersHtml && chart.htmlMarkup) {
    return chart.htmlMarkup;
  }
  if (isUsefulSvgMarkup(chart.svgMarkup)) {
    const namespacedSvg = namespaceSvgMarkupForEmbed(chart.svgMarkup, `chart-${index}-${chart.id}`);
    return `<div class="chart-svg" data-chart-index="${index}">${namespacedSvg}</div>`;
  }
  if (chart.htmlMarkup) {
    return chart.htmlMarkup;
  }
  if (chartHasPngPayload(chart.dataUrl)) {
    return `<img class="chart-img" src="${chart.dataUrl}" alt="${escapeHtml(chart.title)}" width="${chart.width}" height="${chart.height}" />`;
  }
  return '<p class="chart-empty" style="margin:0;padding:18px 0;text-align:center;color:#64748b;font-size:0.9rem">Не удалось отобразить график</p>';
}

export async function buildVisualHtml(options: {
  documentTitle: string;
  meta: VisualExportMetaRow[];
  charts: DashboardChartCapture[];
  filenamePrefix: string;
}) {
  const { documentTitle, meta, charts, filenamePrefix } = options;
  const metaRows = meta
    .map(
      ([label, value]) => `
        <tr>
          <th>${escapeHtml(label)}</th>
          <td>${escapeHtml(value)}</td>
        </tr>`,
    )
    .join('');

  const chartSections = charts
    .map((chart, index) => {
      const chartBody = resolveHtmlChartBody(chart, index);
      return `
      <section class="card" id="chart-${escapeHtml(chart.id)}">
        <header>
          <h2>${escapeHtml(chart.title)}</h2>
          <p>${escapeHtml(chart.description)}</p>
        </header>
        <div class="chart-frame">
          ${chartBody}
        </div>
      </section>`;
    })
    .join('\n');

  const html = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(documentTitle)}</title>
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
      background-color: var(--bg);
      background-image:
        linear-gradient(180deg, #e9eef3 0%, var(--bg) 180px);
      line-height: 1.5;
    }
    .page {
      width: min(880px, calc(100% - 32px));
      margin: 24px auto 48px;
    }
    .hero {
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 12px;
      border-top: 3px solid var(--brand);
      padding: 22px 24px 18px;
      margin-bottom: 14px;
    }
    .hero .brand {
      margin: 0 0 10px;
      color: var(--brand);
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }
    .hero h1 {
      margin: 0;
      color: var(--brand);
      font-size: 1.65rem;
      font-weight: 700;
      letter-spacing: -0.02em;
    }
    .meta {
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 12px;
      overflow: hidden;
      margin-bottom: 16px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th, td {
      padding: 11px 16px;
      border-bottom: 1px solid var(--line);
      text-align: left;
      vertical-align: top;
      font-size: 0.92rem;
    }
    th {
      width: 30%;
      color: var(--brand);
      background: var(--brand-soft);
      font-weight: 650;
    }
    tr:last-child th, tr:last-child td { border-bottom: 0; }
    .toc {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin: 0 0 18px;
    }
    .toc a {
      text-decoration: none;
      color: var(--brand);
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 6px 11px;
      font-size: 0.82rem;
      transition: border-color 0.15s ease, background 0.15s ease;
    }
    .toc a:hover {
      border-color: var(--accent);
      background: var(--brand-soft);
    }
    .card {
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 14px 16px 12px;
      margin-bottom: 12px;
    }
    .card header h2 {
      margin: 0 0 2px;
      color: var(--brand);
      font-size: 1.05rem;
      font-weight: 700;
    }
    .card header p {
      margin: 0 0 10px;
      color: var(--muted);
      font-size: 0.84rem;
    }
    .chart-frame {
      border: 1px solid var(--line);
      border-radius: 10px;
      background: #fafbfc;
      padding: 10px 12px;
      overflow: visible;
    }
    .chart-svg, .chart-img {
      display: block;
      margin: 0 auto;
    }
    .chart-svg {
      width: min(100%, 640px);
    }
    .chart-svg svg, .chart-img {
      display: block;
      width: 100%;
      max-width: 640px;
      height: auto;
      max-height: 300px;
      margin: 0 auto;
      object-fit: contain;
      background: #fff;
      border-radius: 6px;
    }
    .chart-svg svg {
      cursor: crosshair;
      overflow: visible;
    }
    .chart-svg svg text {
      font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
    }
    .chart-legend {
      margin-top: 8px;
      display: flex;
      justify-content: center;
    }
    .chart-legend:has(.chart-materiality-legend) {
      display: block;
      width: 100%;
      overflow: auto;
    }
    .chart-materiality-legend {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.78rem;
      color: var(--ink);
    }
    .chart-materiality-legend caption {
      caption-side: top;
      text-align: left;
      font-weight: 600;
      color: var(--brand);
      margin-bottom: 6px;
    }
    .chart-materiality-legend th,
    .chart-materiality-legend td {
      border: 1px solid var(--line);
      padding: 5px 8px;
      text-align: left;
      background: #fff;
    }
    .chart-materiality-legend th:not(:first-child),
    .chart-materiality-legend td:not(:first-child) {
      text-align: center;
      white-space: nowrap;
    }
    .chart-svg:has(.chart-materiality-legend) {
      width: 100%;
    }
    .chart-svg:has(.chart-materiality-legend) svg {
      max-width: 960px;
      max-height: 360px;
    }
    .chart-legend-list {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 10px 16px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .chart-legend-list li {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      color: var(--muted);
      font-size: 0.8rem;
      line-height: 1.2;
    }
    .chart-legend-swatch {
      width: 10px;
      height: 10px;
      border-radius: 2px;
      flex-shrink: 0;
      background: var(--accent);
    }
    .chart-html {
      overflow: auto;
      background: #fff;
      border-radius: 6px;
    }
    .chart-html table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.82rem;
    }
    .chart-html th, .chart-html td {
      border: 1px solid var(--line);
      padding: 6px 8px;
      background: transparent;
      width: auto;
      font-weight: inherit;
    }
    .chart-html [data-export-html] {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .chart-html [data-effectiveness-matrix-footer] {
      background: #f8fafc;
    }
    .chart-html [data-effectiveness-matrix-footer] th,
    .chart-html [data-effectiveness-matrix-footer] td {
      border-top: 1px solid var(--line);
      vertical-align: top;
      background: #f8fafc;
    }
    .chart-html [data-effectiveness-matrix-footer] td {
      text-align: center;
    }
    .chart-html [data-effectiveness-matrix-legend] {
      display: flex;
      flex-wrap: wrap;
      gap: 8px 12px;
      list-style: none;
      padding: 0;
      margin: 0;
      font-size: 0.78rem;
      color: var(--muted);
    }
    .chart-html [data-effectiveness-matrix-legend] li {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .chart-html svg.recharts-surface {
      display: block;
      margin: 0 auto;
    }
    .kpi-strip {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 8px;
    }
    .kpi-card {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      min-height: 72px;
      padding: 12px 14px;
      border: 1px solid var(--line);
      border-radius: 10px;
    }
    .kpi-meta { min-width: 0; }
    .kpi-label {
      font-size: 0.86rem;
      line-height: 1.2;
      opacity: 0.82;
    }
    .kpi-hint {
      margin-top: 3px;
      font-size: 0.75rem;
      line-height: 1.2;
      opacity: 0.6;
    }
    .kpi-value {
      flex-shrink: 0;
      font-size: 1.35rem;
      font-weight: 700;
      line-height: 1;
      letter-spacing: -0.02em;
    }
    .chart-svg svg .recharts-layer path,
    .chart-svg svg .recharts-layer rect,
    .chart-svg svg .recharts-sector,
    .chart-svg svg .recharts-rectangle {
      transition: opacity 0.15s ease, filter 0.15s ease;
    }
    .chart-svg.is-hovering svg .recharts-layer path,
    .chart-svg.is-hovering svg .recharts-layer rect,
    .chart-svg.is-hovering svg .recharts-sector,
    .chart-svg.is-hovering svg .recharts-rectangle {
      opacity: 0.35;
    }
    .chart-svg.is-hovering svg .recharts-layer path:hover,
    .chart-svg.is-hovering svg .recharts-layer rect:hover,
    .chart-svg.is-hovering svg .recharts-sector:hover,
    .chart-svg.is-hovering svg .recharts-rectangle:hover,
    .chart-svg svg [data-active="true"] {
      opacity: 1 !important;
      filter: brightness(1.05);
    }
    .tooltip {
      position: fixed;
      z-index: 20;
      pointer-events: none;
      display: none;
      min-width: 120px;
      max-width: 320px;
      padding: 8px 10px;
      border-radius: 8px;
      background: rgba(0, 51, 102, 0.94);
      color: #fff;
      font-size: 12px;
      white-space: pre-line;
      line-height: 1.35;
    }
    .footnote {
      margin-top: 10px;
      color: var(--muted);
      font-size: 0.82rem;
      text-align: center;
    }
    .to-top {
      position: fixed;
      right: 20px;
      bottom: 20px;
      z-index: 30;
      width: 40px;
      height: 40px;
      border: 1px solid var(--line);
      border-radius: 10px;
      background: var(--card);
      color: var(--brand);
      box-shadow: 0 4px 14px rgba(26, 35, 50, 0.12);
      cursor: pointer;
      opacity: 0;
      visibility: hidden;
      transform: translateY(6px);
      transition: opacity 0.18s ease, visibility 0.18s ease, transform 0.18s ease, background 0.15s ease;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      line-height: 1;
      padding: 0;
    }
    .to-top.is-visible {
      opacity: 1;
      visibility: visible;
      transform: translateY(0);
    }
    .to-top:hover {
      background: var(--brand-soft);
    }
    .to-top:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
    }
    @media print {
      body { background: #fff; }
      .page { width: 100%; margin: 0; }
      .toc, .to-top { display: none; }
      .card, .meta, .hero { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="page" id="top">
    <section class="hero">
      <p class="brand">SOKOL</p>
      <h1>${escapeHtml(documentTitle)}</h1>
    </section>
    <section class="meta">
      <table>
        <tbody>${metaRows}</tbody>
      </table>
    </section>
    <nav class="toc">
      ${charts
        .map((chart) => `<a href="#chart-${escapeHtml(chart.id)}">${escapeHtml(chart.title)}</a>`)
        .join('')}
    </nav>
    ${chartSections}
    <p class="footnote">SOKOL: Сформировано ${escapeHtml(new Date().toLocaleString('ru-RU'))}</p>
  </div>
  <button type="button" class="to-top" id="to-top" aria-label="Наверх" title="Наверх">↑</button>
  <div class="tooltip" id="chart-tooltip"></div>
  <script>
    (function () {
      var toTop = document.getElementById('to-top');
      if (toTop) {
        var toggleToTop = function () {
          if (window.scrollY > 280) toTop.classList.add('is-visible');
          else toTop.classList.remove('is-visible');
        };
        window.addEventListener('scroll', toggleToTop, { passive: true });
        toggleToTop();
        toTop.addEventListener('click', function () {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        });
      }
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
          ['Высокий', high, '${RECOMMENDATIONS_MATERIALITY_CHART_COLORS.высокий}'],
          ['Средний', medium, '${RECOMMENDATIONS_MATERIALITY_CHART_COLORS.средний}'],
          ['Низкий', low, '${RECOMMENDATIONS_MATERIALITY_CHART_COLORS.низкий}']
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

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filenamePrefix}-${stamp()}.html`;
  link.click();
  URL.revokeObjectURL(url);
}
