import { toPng } from 'html-to-image';

export type DashboardChartCapture = {
  id: string;
  title: string;
  description: string;
  dataUrl: string;
  width: number;
  height: number;
};

type ChartRegistration = {
  id: string;
  title: string;
  description: string;
  getNode: () => HTMLElement | null;
};

const chartRegistry = new Map<string, ChartRegistration>();

function hasPngPayload(dataUrl: string) {
  return dataUrl.startsWith('data:image/png;base64,') && Boolean(dataUrl.split(',')[1]);
}

export function registerDashboardChart(registration: ChartRegistration) {
  chartRegistry.set(registration.id, registration);
  return () => {
    const current = chartRegistry.get(registration.id);
    if (current === registration || current?.getNode === registration.getNode) {
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
      const entry = chartRegistry.get(id);
      if (!entry) {
        continue;
      }
      const node = entry.getNode();
      if (!node) {
        continue;
      }
      node.scrollIntoView({ block: 'nearest', behavior: 'instant' as ScrollBehavior });
      await new Promise((resolve) => window.setTimeout(resolve, 120));
      try {
        const dataUrl = await toPng(node, {
          cacheBust: true,
          pixelRatio: 2,
          backgroundColor: '#ffffff',
        });
        if (!hasPngPayload(dataUrl)) {
          console.error(`Skipped chart "${id}" because capture did not produce a PNG image`);
          continue;
        }
        const rect = node.getBoundingClientRect();
        captures.push({
          id,
          title: entry.title,
          description: entry.description,
          dataUrl,
          width: Math.max(Math.round(rect.width), 1),
          height: Math.max(Math.round(rect.height), 1),
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
