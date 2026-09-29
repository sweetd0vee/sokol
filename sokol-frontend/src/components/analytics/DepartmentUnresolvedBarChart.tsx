import { useMemo } from 'react';
import type { PlanningUnresolvedDepartmentRow } from '../../api/analytics';
import { formatUnresolvedCheckLine } from '../../utils/dvaAnalytics';
import {
  CHART_AXIS_TICK,
  CHART_CATEGORY_AXIS_TICK,
  CHART_VALUE_LABEL_SIZE,
  CHART_VALUE_LABEL_WEIGHT,
} from './chartTokens';
import { MONITORING_STATUS_COLORS } from './analyticsPalette';
import { axisTicks, niceMax } from './cssBarChartScale';
import { PinnedChartAside } from './PinnedChartAside';
import { usePinnedChartPanel } from './usePinnedChartPanel';

const BAR_COLOR = MONITORING_STATUS_COLORS.unresolved;
const GRID_COLUMNS = 'minmax(0,1fr) minmax(0,1fr)';

function UnresolvedChecksPanel({
  row,
  pinned,
  onPin,
  onPinToggle,
  onClose,
  onKeepOpen,
  onRequestHide,
}: {
  row: PlanningUnresolvedDepartmentRow;
  pinned: boolean;
  onPin: () => void;
  onPinToggle: () => void;
  onClose: () => void;
  onKeepOpen: () => void;
  onRequestHide: () => void;
}) {
  return (
    <PinnedChartAside
      pinned={pinned}
      onPin={onPin}
      onPinToggle={onPinToggle}
      onClose={onClose}
      onKeepOpen={onKeepOpen}
      onRequestHide={onRequestHide}
      header={
        <>
          <p className="text-sm font-semibold text-sber-dark">{row.name}</p>
          <p className="text-sm text-slate-700">Не решено: {row.value}</p>
        </>
      }
    >
      {row.checks.length === 0 ? (
        <p className="text-sm text-slate-500">Нет ключей проверок</p>
      ) : (
        <>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Проверки</p>
          <ul className="space-y-1">
            {row.checks.map((item) => (
              <li key={item.key} className="text-sm leading-snug text-slate-700">
                {formatUnresolvedCheckLine(item)}
              </li>
            ))}
          </ul>
        </>
      )}
    </PinnedChartAside>
  );
}

export function DepartmentUnresolvedBarChart({
  data,
}: {
  data: PlanningUnresolvedDepartmentRow[];
}) {
  const {
    rootRef,
    pinnedName,
    visibleName,
    cancelHide,
    requestHide,
    pinVisible,
    unpin,
    closePanel,
    showRow,
    togglePinnedName,
  } = usePinnedChartPanel();

  const chartData = useMemo(() => data.filter((row) => row.value > 0), [data]);
  const rowsByName = useMemo(() => new Map(chartData.map((row) => [row.name, row])), [chartData]);
  const maxValue = useMemo(
    () => niceMax(Math.max(0, ...chartData.map((row) => row.value))),
    [chartData],
  );
  const ticks = useMemo(() => axisTicks(maxValue), [maxValue]);
  const visibleRow = visibleName ? (rowsByName.get(visibleName) ?? null) : null;

  return (
    <div ref={rootRef} className="relative flex h-full min-h-0 max-h-[18rem] flex-col lg:max-h-none">
      <div className="min-h-0 flex-1 overflow-y-auto px-4" onMouseLeave={requestHide}>
        <div className="flex flex-col">
          {chartData.map((row) => {
            const isActive = visibleName === row.name;
            const muted = Boolean(visibleName) && !isActive;
            const barWidth = `${(row.value / maxValue) * 100}%`;
            return (
              <div
                key={row.name}
                className={`grid cursor-pointer items-stretch gap-x-4 ${
                  isActive ? 'bg-slate-100' : 'bg-white'
                }`}
                style={{ gridTemplateColumns: GRID_COLUMNS }}
                onMouseEnter={() => showRow(row.name)}
                onClick={() => togglePinnedName(row.name)}
              >
                <p
                  className="flex items-center justify-end self-center py-0 text-right leading-tight text-slate-500"
                  style={{ fontSize: CHART_CATEGORY_AXIS_TICK.fontSize }}
                >
                  {row.name}
                </p>
                <div className="relative flex h-[21px] items-center self-center">
                  <div
                    className="relative z-[1] h-[21px] rounded-r-md"
                    style={{
                      width: barWidth,
                      backgroundColor: BAR_COLOR,
                      opacity: muted ? 0.35 : 1,
                    }}
                  />
                  <span
                    className="absolute z-[1] -translate-y-1/2 text-slate-600"
                    style={{
                      top: '50%',
                      left: `calc(${barWidth} + 6px)`,
                      fontSize: CHART_VALUE_LABEL_SIZE,
                      fontWeight: CHART_VALUE_LABEL_WEIGHT,
                    }}
                  >
                    {row.value}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div
        className="grid shrink-0 gap-x-4 px-4 pb-0 pt-0.5"
        style={{ gridTemplateColumns: GRID_COLUMNS }}
      >
        <div />
        <div className="relative h-5">
          {ticks.map((tick) => (
            <span
              key={tick}
              className="absolute top-0 -translate-x-1/2 leading-none text-slate-500 first:translate-x-0 last:translate-x-[-100%]"
              style={{ left: `${(tick / maxValue) * 100}%`, fontSize: CHART_AXIS_TICK.fontSize }}
            >
              {tick}
            </span>
          ))}
        </div>
      </div>
      {visibleRow ? (
        <UnresolvedChecksPanel
          row={visibleRow}
          pinned={pinnedName === visibleRow.name}
          onPin={pinVisible}
          onPinToggle={() => {
            if (pinnedName === visibleRow.name) {
              unpin();
              return;
            }
            pinVisible();
          }}
          onClose={closePanel}
          onKeepOpen={cancelHide}
          onRequestHide={requestHide}
        />
      ) : null}
    </div>
  );
}
