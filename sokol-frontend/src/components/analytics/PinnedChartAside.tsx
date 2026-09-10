import type { ReactNode } from 'react';
import { Pin, X } from 'lucide-react';
import { CHART_TOOLTIP_STYLE } from './chartTokens';

export function PinnedChartAside({
  pinned,
  onPin,
  onPinToggle,
  onClose,
  onKeepOpen,
  onRequestHide,
  header,
  children,
  pinAriaLabel = 'Закрепить список проверок',
  unpinAriaLabel = 'Открепить список проверок',
  closeAriaLabel = 'Закрыть список проверок',
}: {
  pinned: boolean;
  onPin: () => void;
  onPinToggle: () => void;
  onClose: () => void;
  onKeepOpen: () => void;
  onRequestHide: () => void;
  header: ReactNode;
  children: ReactNode;
  pinAriaLabel?: string;
  unpinAriaLabel?: string;
  closeAriaLabel?: string;
}) {
  return (
    <aside
      className="absolute right-1 top-1 z-20 flex max-h-[calc(100%-0.5rem)] w-[min(100%-0.5rem,20rem)] flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg"
      style={CHART_TOOLTIP_STYLE}
      onMouseEnter={onKeepOpen}
      onMouseLeave={pinned ? undefined : onRequestHide}
    >
      <div className="flex shrink-0 items-start gap-2 border-b border-slate-100 px-3 py-2">
        <div className="min-w-0 flex-1">{header}</div>
        <button
          type="button"
          className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition ${
            pinned
              ? 'bg-sber-dark/10 text-sber-dark'
              : 'text-slate-500 hover:bg-slate-100 hover:text-sber-dark'
          }`}
          aria-label={pinned ? unpinAriaLabel : pinAriaLabel}
          aria-pressed={pinned}
          title={pinned ? 'Открепить' : 'Закрепить'}
          onClick={onPinToggle}
        >
          <Pin className="h-3.5 w-3.5" fill={pinned ? 'currentColor' : 'none'} />
        </button>
        {pinned ? (
          <button
            type="button"
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-sber-dark"
            aria-label={closeAriaLabel}
            title="Закрыть"
            onClick={onClose}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-3 py-2" onPointerDown={onPin}>
        {children}
      </div>
    </aside>
  );
}
