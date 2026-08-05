import { useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from 'react';
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

function buildStaticLayout(cards: AnalyticsGridCard[]): DashboardLayoutItem[] {
  return cards.map((card) => ({
    i: card.id,
    ...card.defaultLayout,
    static: true,
  }));
}

export function AnalyticsDashboardGrid({ cards }: AnalyticsDashboardGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(1200);
  const layout = useMemo(() => buildStaticLayout(cards), [cards]);

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

  return (
    <div>
      <div className="hidden lg:block" ref={containerRef}>
        <BaseGridLayout
          className="layout"
          layout={layout}
          cols={12}
          width={containerWidth}
          rowHeight={64}
          margin={[8, 8]}
          containerPadding={[0, 0]}
          isDraggable={false}
          isResizable={false}
          compactType="vertical"
        >
          {cards.map((card) => (
            <div key={card.id} className="min-h-0 [&>section]:h-full">
              {card.render({ resetCardLayout: () => undefined })}
            </div>
          ))}
        </BaseGridLayout>
      </div>
      <div className="space-y-3 lg:hidden">
        {cards.map((card) => (
          <div key={card.id}>{card.render({ resetCardLayout: () => undefined })}</div>
        ))}
      </div>
    </div>
  );
}
