import type { ReactNode } from 'react';
import { FileUp, Download } from 'lucide-react';
import { ErrorState, LoadingState } from '../ui/StateMessage';
import { ACCEPTED_DOCX } from '../../utils/docx';

type DocxToolPanelProps = {
  title: string;
  description: string;
  file: File | null;
  onFileChange: (file: File | null) => void;
  onTemplateDownload?: () => void;
  isTemplateDownloading?: boolean;
  onProcess: () => void;
  isProcessing: boolean;
  error: string | null;
  buttonLabel?: string;
  processingLabel?: string;
  templateButtonLabel?: string;
  children?: ReactNode;
  isProcessDisabled?: boolean;
  hideTemplateButton?: boolean;
  extraFieldsClassName?: string;
};

export function DocxToolPanel({
  title,
  description,
  file,
  onFileChange,
  onTemplateDownload,
  isTemplateDownloading = false,
  onProcess,
  isProcessing,
  error,
  buttonLabel = 'Сгенерировать и скачать',
  processingLabel = 'Обработка...',
  templateButtonLabel = 'Скачать шаблон',
  children,
  isProcessDisabled = false,
  hideTemplateButton = false,
  extraFieldsClassName = 'space-y-4',
}: DocxToolPanelProps) {
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onFileChange(event.target.files?.[0] ?? null);
  };

  return (
    <div className="space-y-4 pt-2">
      <div>
        <div className="text-base font-semibold text-gray-900">{title}</div>
        <p className="mt-1 text-base text-gray-500">{description}</p>
      </div>

      {children ? (
        <div className={extraFieldsClassName}>
          {children}
        </div>
      ) : null}

      <div className="w-full max-w-[288px] space-y-4">
        {onTemplateDownload && !hideTemplateButton ? (
          <button
            type="button"
            onClick={onTemplateDownload}
            disabled={isTemplateDownloading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-sber-light px-5 py-2.5 text-sm font-medium text-sber-light transition hover:bg-sber-light hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download size={18} />
            {isTemplateDownloading ? 'Скачивание...' : templateButtonLabel}
          </button>
        ) : null}
        <label className="flex min-h-[6.5rem] w-full cursor-pointer items-center justify-center gap-3 rounded-lg bg-gray-100 px-4 py-3 text-center transition hover:bg-gray-200 focus-within:outline-none focus-within:ring-2 focus-within:ring-gray-300/50">
          <FileUp size={18} className="shrink-0 text-sber-dark" />
          <span className="truncate text-sm text-gray-700">
            {file ? file.name : 'Выберите файл .docx'}
          </span>
          <input type="file" accept={ACCEPTED_DOCX} onChange={handleFileChange} className="sr-only" />
        </label>
        <button
          type="button"
          onClick={onProcess}
          disabled={!file || isProcessing || isProcessDisabled}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-sber-dark px-5 py-2.5 text-sm font-medium text-white transition hover:bg-sber-muted disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Download size={18} />
          {isProcessing ? processingLabel : buttonLabel}
        </button>
      </div>

      {error && <ErrorState title="Ошибка обработки" description={error} />}
      {isProcessing && (
        <LoadingState
          title="Файл обрабатывается"
          description="Большие документы могут обрабатываться несколько минут."
        />
      )}
    </div>
  );
}
