import { EXPORT_FORMATS, type ExportFormat } from '../../utils/exports';

type ListExportControlsProps = {
  onExport: () => void;
  disabled: boolean;
  isExporting: boolean;
  format: ExportFormat;
  onFormatChange: (format: ExportFormat) => void;
  selectClassName?: string;
};

export function ListExportControls({
  onExport,
  disabled,
  isExporting,
  format,
  onFormatChange,
  selectClassName = 'rounded-lg border border-gray-300 bg-white px-2 py-1 text-sm text-gray-700 outline-none transition focus:border-sber-dark focus:ring-2 focus:ring-sber-dark/20',
}: ListExportControlsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={onExport}
        disabled={disabled}
        className="inline-flex w-[160px] items-center justify-center whitespace-nowrap rounded-lg bg-[#90EE90] px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-[#7fdc7f] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isExporting ? 'Экспорт...' : 'Экспорт'}
      </button>
      <select
        value={format}
        onChange={(event) => onFormatChange(event.target.value as ExportFormat)}
        className={selectClassName}
      >
        {EXPORT_FORMATS.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
    </div>
  );
}
