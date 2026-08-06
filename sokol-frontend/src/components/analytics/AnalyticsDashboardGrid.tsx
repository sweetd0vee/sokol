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

export function AnalyticsDashboardGrid({ cards }: AnalyticsDashboardGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(1200);
  const summaryCards = useMemo(() => cards.filter((card) => card.id === 'summary'), [cards]);
  const gridCards = useMemo(() => cards.filter((card) => card.id !== 'summary'), [cards]);
  const layout = useMemo(() => {
    if (gridCards.length === 0) {
      return [];
    }
    const minY = Math.min(...gridCards.map((card) => card.defaultLayout.y));
    return gridCards.map((card) => ({
      i: card.id,
      ...card.defaultLayout,
      y: card.defaultLayout.y - minY,
      static: true,
    }));
  }, [gridCards]);

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

  const renderCard = (card: AnalyticsGridCard) => card.render({ resetCardLayout: () => undefined });

  return (
    <div className="flex w-full flex-col gap-2.5">
      {summaryCards.map((card) => (
        <div key={card.id} className="w-full">
          {renderCard(card)}
        </div>
      ))}
      <div className="hidden lg:block" ref={containerRef}>
        <BaseGridLayout
          className="layout"
          layout={layout}
          cols={12}
          width={containerWidth}
          rowHeight={36}
          margin={[2, 2]}
          containerPadding={[0, 0]}
          isDraggable={false}
          isResizable={false}
          compactType="vertical"
        >
          {gridCards.map((card) => (
            <div key={card.id} className="min-h-0 [&>section]:h-full">
              {renderCard(card)}
            </div>
          ))}
        </BaseGridLayout>
      </div>
      <div className="space-y-2.5 lg:hidden">
        {gridCards.map((card) => (
          <div key={card.id}>{renderCard(card)}</div>
        ))}
      </div>
    </div>
  );
}
