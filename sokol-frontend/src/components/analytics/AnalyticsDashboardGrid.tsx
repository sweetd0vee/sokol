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

const GRID_MARGIN_Y = 2;
const MIN_ROW_HEIGHT = 48;

export function AnalyticsDashboardGrid({ cards }: AnalyticsDashboardGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gridAreaRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(1200);
  const [rowHeight, setRowHeight] = useState(MIN_ROW_HEIGHT);
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 1024px)').matches : true,
  );
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

  const rowSpan = useMemo(() => {
    if (layout.length === 0) {
      return 1;
    }
    return Math.max(...layout.map((item) => item.y + item.h), 1);
  }, [layout]);

  useEffect(() => {
    const media = window.matchMedia('(min-width: 1024px)');
    const onChange = () => setIsDesktop(media.matches);
    onChange();
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    if (!isDesktop) {
      return undefined;
    }
    const widthNode = containerRef.current;
    const heightNode = gridAreaRef.current;
    if (!widthNode || !heightNode) {
      return undefined;
    }

    const update = () => {
      setContainerWidth(Math.max(Math.floor(widthNode.getBoundingClientRect().width), 320));
      const available = Math.floor(heightNode.getBoundingClientRect().height);
      if (available < 80) {
        return;
      }
      const next = Math.floor((available - GRID_MARGIN_Y * Math.max(rowSpan - 1, 0)) / rowSpan);
      setRowHeight(Math.max(MIN_ROW_HEIGHT, next));
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(widthNode);
    observer.observe(heightNode);
    return () => observer.disconnect();
  }, [isDesktop, rowSpan]);

  const renderCard = (card: AnalyticsGridCard) => card.render({ resetCardLayout: () => undefined });

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col gap-2.5">
      {summaryCards.map((card) => (
        <div key={card.id} className="w-full shrink-0">
          {renderCard(card)}
        </div>
      ))}
      {isDesktop ? (
        <div className="min-h-0 flex-1" ref={gridAreaRef}>
          <div ref={containerRef} className="h-full w-full">
            <BaseGridLayout
              className="layout h-full"
              layout={layout}
              cols={12}
              width={containerWidth}
              rowHeight={rowHeight}
              margin={[GRID_MARGIN_Y, GRID_MARGIN_Y]}
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
        </div>
      ) : (
        <div className="space-y-2.5">
          {gridCards.map((card) => (
            <div key={card.id}>{renderCard(card)}</div>
          ))}
        </div>
      )}
    </div>
  );
}
