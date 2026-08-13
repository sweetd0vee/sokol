import type { ReactNode } from 'react';
import { MultiCheckboxSelect, type MultiCheckboxOption } from '../ui/MultiCheckboxSelect';
import { ANALYTICS_EXPORT_FORMATS, type AnalyticsExportFormat } from '../../utils/analyticsExport';
import {
  FORM_EQUAL_CONTROL_CLASS,
  FORM_LABEL_CLASS,
  FORM_OUTLINE_BUTTON_CLASS,
  FORM_SAVE_BUTTON_CLASS,
} from '../../constants/formLayout';

export type AnalyticsPeriodSlice = 'year' | 'quarter' | 'month';

export type AnalyticsFilterSidebarProps = {
  periodSlice: AnalyticsPeriodSlice;
  onPeriodSliceChange: (next: AnalyticsPeriodSlice) => void;
  yearOptions: MultiCheckboxOption[];
  quarterOptions: MultiCheckboxOption[];
  monthOptions: MultiCheckboxOption[];
  selectedYears: string[];
  selectedQuarters: string[];
  selectedMonths: string[];
  onYearsChange: (next: string[]) => void;
  onQuartersChange: (next: string[]) => void;
  onMonthsChange: (next: string[]) => void;
  auditorOptions?: MultiCheckboxOption[];
  selectedAuditors?: string[];
  onAuditorsChange?: (next: string[]) => void;
  departmentOptions?: MultiCheckboxOption[];
  selectedDepartments?: string[];
  onDepartmentsChange?: (next: string[]) => void;
  children?: ReactNode;
  selectionSummary?: ReactNode;
  onResetFilters: () => void;
  exportFormat: AnalyticsExportFormat;
  onExportFormatChange: (format: AnalyticsExportFormat) => void;
  isExporting: boolean;
  canExport: boolean;
  onExport: () => void;
  exportSelectedCount: number;
  exportTotalCount: number;
  onSelectAllExport: () => void;
  onClearExport: () => void;
};

function SidebarSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium leading-relaxed text-gray-900">
        {title}
      </p>
      <div className="space-y-2.5">{children}</div>
    </div>
  );
}

const FILTER_SELECT_CLASS = FORM_EQUAL_CONTROL_CLASS;
const FILTER_LABEL_CLASS = FORM_LABEL_CLASS;

const PERIOD_SLICE_OPTIONS: { value: AnalyticsPeriodSlice; label: string }[] = [
  { value: 'year', label: 'Год' },
  { value: 'quarter', label: 'Квартал' },
  { value: 'month', label: 'Месяц' },
];

export function AnalyticsFilterSidebar({
  periodSlice,
  onPeriodSliceChange,
  yearOptions,
  quarterOptions,
  monthOptions,
  selectedYears,
  selectedQuarters,
  selectedMonths,
  onYearsChange,
  onQuartersChange,
  onMonthsChange,
  auditorOptions = [],
  selectedAuditors = [],
  onAuditorsChange,
  departmentOptions = [],
  selectedDepartments = [],
  onDepartmentsChange,
  children,
  selectionSummary,
  onResetFilters,
  exportFormat,
  onExportFormatChange,
  isExporting,
  canExport,
  onExport,
}: AnalyticsFilterSidebarProps) {
  return (
    <aside className="w-full shrink-0 space-y-5 lg:sticky lg:top-4 lg:w-80">
      <section className="overflow-visible rounded-lg bg-gray-100 p-3.5 text-left leading-relaxed">
        <div className="mb-3 flex items-center gap-2">
          <div>
            <h3 className="text-base font-semibold text-gray-900">Метрики</h3>
          </div>
        </div>

        <div className="space-y-6">
          <SidebarSection title="Период">
            <div>
              <div className="grid grid-cols-3 gap-1.5">
                {PERIOD_SLICE_OPTIONS.map((option) => {
                  const isActive = option.value === periodSlice;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => onPeriodSliceChange(option.value)}
                      className={`rounded-lg border px-2 py-2 text-xs font-medium transition ${
                        isActive
                          ? 'border-sber-dark bg-sber-dark text-white shadow-sm '
                          : 'border-gray-300 bg-white text-gray-700 hover:border-sber-dark/50 hover:text-sber-dark '
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {periodSlice === 'year' ? (
              <MultiCheckboxSelect
                label="Даты"
                options={yearOptions}
                value={selectedYears}
                onChange={onYearsChange}
                placeholder="Поиск"
                emptyMessage="Нет годов"
                inputClassName={FILTER_SELECT_CLASS}
                labelClassName={FILTER_LABEL_CLASS}
              />
            ) : null}

            {periodSlice === 'quarter' ? (
              <MultiCheckboxSelect
                label="Даты"
                options={quarterOptions}
                value={selectedQuarters}
                onChange={onQuartersChange}
                placeholder="Поиск"
                emptyMessage="Нет кварталов"
                inputClassName={FILTER_SELECT_CLASS}
                labelClassName={FILTER_LABEL_CLASS}
              />
            ) : null}

            {periodSlice === 'month' ? (
              <MultiCheckboxSelect
                label="Даты"
                options={monthOptions}
                value={selectedMonths}
                onChange={onMonthsChange}
                placeholder="Поиск"
                emptyMessage="Нет месяцев"
                inputClassName={FILTER_SELECT_CLASS}
                labelClassName={FILTER_LABEL_CLASS}
              />
            ) : null}
          </SidebarSection>

          {onAuditorsChange ? (
            <SidebarSection title="Аудиторы">
              <MultiCheckboxSelect
                options={auditorOptions}
                value={selectedAuditors}
                onChange={onAuditorsChange}
                placeholder="Поиск"
                emptyMessage="Нет аудиторов"
                inputClassName={FILTER_SELECT_CLASS}
                labelClassName={FILTER_LABEL_CLASS}
              />
            </SidebarSection>
          ) : null}

          {onDepartmentsChange ? (
            <SidebarSection title="Департаменты">
              <MultiCheckboxSelect
                options={departmentOptions}
                value={selectedDepartments}
                onChange={onDepartmentsChange}
                placeholder="Поиск"
                emptyMessage="Нет объектов аудита"
                inputClassName={FILTER_SELECT_CLASS}
                labelClassName={FILTER_LABEL_CLASS}
              />
            </SidebarSection>
          ) : null}

          {children}

          <button
            type="button"
            onClick={onResetFilters}
            className={FORM_OUTLINE_BUTTON_CLASS}
          >
            Сбросить фильтры
          </button>
        </div>
      </section>

      {selectionSummary}

      <section className="rounded-lg bg-gray-100 p-3.5 text-left leading-relaxed">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onExport}
            disabled={isExporting || !canExport}
            className={`${FORM_SAVE_BUTTON_CLASS} disabled:cursor-not-allowed disabled:opacity-50`}
          >
            {isExporting ? 'Экспорт...' : 'Экспорт'}
          </button>
          <select
            value={exportFormat}
            onChange={(event) => onExportFormatChange(event.target.value as AnalyticsExportFormat)}
            className={`w-32 rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 outline-none transition focus:border-sber-dark focus:ring-2 focus:ring-sber-dark/20 ${FORM_EQUAL_CONTROL_CLASS}`}
          >
            {ANALYTICS_EXPORT_FORMATS.map((format) => (
              <option key={format.value} value={format.value}>
                {format.label}
              </option>
            ))}
          </select>
        </div>
      </section>
    </aside>
  );
}
