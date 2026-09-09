import { LIST_EXPORT_BUTTON_CLASS } from '../../constants/formLayout';
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
        className={LIST_EXPORT_BUTTON_CLASS}
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
