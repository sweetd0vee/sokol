import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Recommendation } from '../../types/recommendation';
import { getRecommendationExecutionInfo } from '../../constants/recommendationClosure';

const CARD_MAX_WIDTH = 1280;
const CARD_GAP = 8;
const VIEWPORT_PADDING = 12;

type CardPosition = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
};

function getCardPosition(anchor: DOMRect): CardPosition {
  const width = Math.min(CARD_MAX_WIDTH, window.innerWidth - VIEWPORT_PADDING * 2);
  const spaceBelow = window.innerHeight - anchor.bottom - VIEWPORT_PADDING;
  const spaceAbove = anchor.top - VIEWPORT_PADDING;
  const placeBelow = spaceBelow >= 180 || spaceBelow >= spaceAbove;
  const maxHeight = Math.max(160, Math.min(420, placeBelow ? spaceBelow - CARD_GAP : spaceAbove - CARD_GAP));
  const left = Math.min(
    Math.max(VIEWPORT_PADDING, anchor.left),
    window.innerWidth - width - VIEWPORT_PADDING,
  );

  return {
    top: placeBelow ? anchor.bottom + CARD_GAP : Math.max(VIEWPORT_PADDING, anchor.top - CARD_GAP - maxHeight),
    left,
    width,
    maxHeight,
  };
}

function HoverCardColumn({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0 px-4 py-1 first:pl-0 last:pr-0">
      <p className="text-sm font-medium text-sber-dark">{label}</p>
      <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-black">{value || '—'}</p>
    </div>
  );
}

export function RecommendationNameHoverCard({ recommendation }: { recommendation: Recommendation }) {
  const cellRef = useRef<HTMLTableCellElement>(null);
  const [position, setPosition] = useState<CardPosition | null>(null);
  const executionInfo = getRecommendationExecutionInfo(recommendation);

  const close = () => setPosition(null);

  const open = () => {
    const rect = cellRef.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }
    setPosition(getCardPosition(rect));
  };

  useEffect(() => {
    if (!position) {
      return undefined;
    }
    const handleClose = () => close();
    window.addEventListener('scroll', handleClose, true);
    window.addEventListener('resize', handleClose);
    return () => {
      window.removeEventListener('scroll', handleClose, true);
      window.removeEventListener('resize', handleClose);
    };
  }, [position]);

  return (
    <td
      ref={cellRef}
      className="px-4 py-3"
      onMouseEnter={open}
      onMouseLeave={close}
    >
      <div className="min-w-0 space-y-1">
        <div className="truncate">{recommendation.name}</div>
        {recommendation.observation_name ? (
          <div className="truncate text-sm leading-snug text-gray-500">{recommendation.observation_name}</div>
        ) : null}
      </div>
      {position
        ? createPortal(
            <div
              role="tooltip"
              className="pointer-events-none fixed z-[10000] rounded-lg border border-gray-200 bg-white p-4 text-left shadow-lg"
              style={{
                top: position.top,
                left: position.left,
                width: position.width,
                maxHeight: position.maxHeight,
              }}
            >
              <div
                className="grid grid-cols-3 divide-x divide-gray-200 overflow-y-auto"
                style={{ maxHeight: position.maxHeight - 16 }}
              >
                <HoverCardColumn
                  label="Название рекомендации:"
                  value={recommendation.name}
                />
                <HoverCardColumn
                  label="Название наблюдения:"
                  value={recommendation.observation_name ?? ''}
                />
                <HoverCardColumn
                  label="Информация о выполнении:"
                  value={executionInfo}
                />
              </div>
            </div>,
            document.body,
          )
        : null}
    </td>
  );
}
