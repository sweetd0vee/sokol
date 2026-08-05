import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from 'react';
import * as ReactGridLayout from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

type GridLayoutModule = {
  default?: ComponentType<Record<string, unknown>>;
};

const gridLayoutModule = ReactGridLayout as unknown as GridLayoutModule;
const BaseGridLayout = (gridLayoutModule.default ?? ReactGridLayout) as ComponentType<Record<string, unknown>>;

type DashboardLayoutItem = {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
  static?: boolean;
};

export type AnalyticsGridCard = {
  id: string;
  defaultLayout: Omit<DashboardLayoutItem, 'i'>;
  render: (helpers: { resetCardLayout: () => void }) => ReactNode;
};

type AnalyticsDashboardGridProps = {
  storageKey: string;
  cards: AnalyticsGridCard[];
};

function readStoredLayout(storageKey: string): DashboardLayoutItem[] | null {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {return null;}
    const parsed = JSON.parse(raw) as DashboardLayoutItem[];
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function normalizeLayout(cards: AnalyticsGridCard[], stored: DashboardLayoutItem[] | null): DashboardLayoutItem[] {
  const defaults = new Map(
    cards.map((card) => [
      card.id,
      {
        i: card.id,
        ...card.defaultLayout,
      },
    ]),
  );

  const storedById = new Map((stored ?? []).map((item) => [item.i, item]));
  return cards.map((card) => ({
    ...defaults.get(card.id)!,
    ...(storedById.get(card.id) ?? {}),
    i: card.id,
  }));
}

export function AnalyticsDashboardGrid({ storageKey, cards }: AnalyticsDashboardGridProps) {
  const resolvedStorageKey = `${storageKey}.v5`;
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(1200);
  const defaultLayout = useMemo(() => normalizeLayout(cards, null), [cards]);
  const [layout, setLayout] = useState<DashboardLayoutItem[]>(() =>
    normalizeLayout(cards, readStoredLayout(resolvedStorageKey)),
  );

  useEffect(() => {
    const node = containerRef.current;
    if (!node) {
      return undefined;
    }
    const updateWidth = () => {
      setContainerWidth(Math.max(Math.floor(node.getBoundingClientRect().width), 320));
    };
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setLayout(normalizeLayout(cards, readStoredLayout(resolvedStorageKey)));
  }, [cards, resolvedStorageKey]);

  const persistLayout = useCallback(
    (next: DashboardLayoutItem[]) => {
      setLayout(next);
      window.localStorage.setItem(resolvedStorageKey, JSON.stringify(next));
    },
    [resolvedStorageKey],
  );

  const resetCard = (id: string) => {
    const fallback = defaultLayout.find((item) => item.i === id);
    if (!fallback) {return;}
    persistLayout(layout.map((item) => (item.i === id ? { ...fallback } : item)));
  };

  return (
    <div>
      <div className="hidden lg:block" ref={containerRef}>
        <BaseGridLayout
          className="layout"
          layout={layout}
          cols={12}
          width={containerWidth}
          rowHeight={72}
          margin={[10, 10]}
          containerPadding={[0, 0]}
          draggableHandle=".analytics-card-drag-handle"
          onLayoutChange={(next: DashboardLayoutItem[]) => persistLayout(next)}
          resizeHandles={['se']}
          compactType="vertical"
        >
          {cards.map((card) => (
            <div key={card.id} className="min-h-0 [&>section]:h-full">
              {card.render({ resetCardLayout: () => resetCard(card.id) })}
            </div>
          ))}
        </BaseGridLayout>
      </div>
      <div className="space-y-3 lg:hidden">
        {cards.map((card) => (
          <div key={card.id}>{card.render({ resetCardLayout: () => resetCard(card.id) })}</div>
        ))}
      </div>
    </div>
  );
}
