import { useEffect, useId, useRef, useState } from 'react';
import { FileUp, Download, Settings } from 'lucide-react';
import { ErrorState, LoadingState } from '../ui/StateMessage';
import { Textarea } from '../ui/Textarea';
import { ACCEPTED_DOCX } from '../../utils/docx';
import { fetchAuditOpinionDefaultPrompt, fetchAuditOpinionModels } from '../../api/tools';

type AuditOpinionPanelProps = {
  title: string;
  description: string;
  file: File | null;
  onFileChange: (file: File | null) => void;
  prompt: string;
  onPromptChange: (value: string) => void;
  model: string;
  onModelChange: (value: string) => void;
  onProcess: () => void;
  isProcessing: boolean;
  error: string | null;
};

const FALLBACK_PROMPT = `Ты — опытный аудитор внутренней аудита крупной организации. На основе приведённых ниже наблюдений и рекомендаций из аудиторского заключения подготовь текст раздела I «Аудиторское мнение по итогам проверки».

Требования к тексту:
1. Объём — примерно 2–3 страницы А4, связный деловой текст на русском языке.
2. Дай краткое саммари по всем ключевым наблюдениям и рекомендациям.
3. Сформулируй аудиторское мнение в официально-деловом стиле, без markdown.
4. Не включай заголовок «I. Аудиторское мнение по итогам проверки» — верни только тело текста.
5. Разбей текст на абзацы; каждый абзац отделяй пустой строкой.

{OBSERVATIONS}
`;

export function AuditOpinionPanel({
  title,
  description,
  file,
  onFileChange,
  prompt,
  onPromptChange,
  model,
  onModelChange,
  onProcess,
  isProcessing,
  error,
}: AuditOpinionPanelProps) {
  const [promptLoading, setPromptLoading] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const settingsMenuId = useId();

  useEffect(() => {
    let cancelled = false;
    fetchAuditOpinionDefaultPrompt()
      .then((value) => {
        if (!cancelled) {
          onPromptChange(value);
        }
      })
      .catch(() => {
        if (!cancelled) {
          onPromptChange(FALLBACK_PROMPT);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setPromptLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
    // Load default prompt once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;
    setModelsLoading(true);
    setModelsError(null);
    fetchAuditOpinionModels()
      .then((data) => {
        if (cancelled) {
          return;
        }
        setModels(data.models);
        if (!model && data.default_model) {
          onModelChange(data.default_model);
        } else if (model && data.models.length > 0 && !data.models.includes(model)) {
          onModelChange(data.default_model || data.models[0]);
        }
      })
      .catch((err: unknown) => {
        if (cancelled) {
          return;
        }
        const message =
          err instanceof Error ? err.message : 'Не удалось загрузить список моделей Ollama.';
        setModelsError(message);
        if (!model) {
          onModelChange('qwen3.5:35b');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setModelsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
    // Load models once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!settingsOpen) {
      return;
    }
    const handlePointerDown = (event: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setSettingsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSettingsOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [settingsOpen]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onFileChange(event.target.files?.[0] ?? null);
  };

  const modelOptions = models.length > 0 ? models : model ? [model] : [];

  return (
    <div className="space-y-4 pt-2">
      <div>
        <div className="text-base font-semibold text-gray-900 dark:text-slate-100">{title}</div>
        <p className="mt-1 text-base text-gray-500 dark:text-slate-300">{description}</p>
      </div>

      <div className="relative w-full">
        <div className="mb-1 flex items-center justify-between gap-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">
            Промпт для модели (можно редактировать)
          </label>
          <div className="relative" ref={settingsRef}>
            <button
              type="button"
              onClick={() => setSettingsOpen((open) => !open)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition hover:border-sber-dark/40 hover:text-sber-dark dark:border-slate-600 dark:text-slate-400 dark:hover:border-sber-light/70 dark:hover:text-sber-light"
              aria-label="Настройки модели"
              title="Настройки модели"
              aria-expanded={settingsOpen}
              aria-controls={settingsMenuId}
            >
              <Settings size={16} />
            </button>
            {settingsOpen && (
              <div
                id={settingsMenuId}
                className="absolute right-0 z-20 mt-2 w-72 rounded-lg border border-gray-200 bg-white p-3 shadow-lg dark:border-slate-600 dark:bg-slate-800"
              >
                <div className="mb-2 text-sm font-medium text-gray-900 dark:text-slate-100">
                  Модель Ollama
                </div>
                <select
                  value={model}
                  onChange={(event) => onModelChange(event.target.value)}
                  disabled={modelsLoading || modelOptions.length === 0}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-sber-dark focus:ring-2 focus:ring-sber-dark/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-sber-light dark:focus:ring-sber-light/25"
                >
                  {modelOptions.length === 0 && (
                    <option value="">{modelsLoading ? 'Загрузка…' : 'Нет доступных моделей'}</option>
                  )}
                  {modelOptions.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
                {modelsError && (
                  <p className="mt-2 text-xs text-red-600 dark:text-red-400">{modelsError}</p>
                )}
                {!modelsError && model && (
                  <p className="mt-2 text-xs text-gray-500 dark:text-slate-400">
                    Выбрано: <span className="font-medium text-gray-700 dark:text-slate-200">{model}</span>
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
        <Textarea
          value={prompt}
          onChange={onPromptChange}
          rows={3}
          className="w-full"
          inputClassName="!min-h-[6.5rem] h-[6.5rem] font-mono text-sm"
          readOnly={promptLoading}
          placeholder={promptLoading ? 'Загрузка промпта…' : undefined}
        />
      </div>
      <p className="w-full text-xs text-gray-500 dark:text-slate-400">
        Плейсхолдер <code className="rounded bg-gray-100 px-1 dark:bg-slate-700">{'{OBSERVATIONS}'}</code> будет
        заменён списком наблюдений и рекомендаций из прикреплённого АЗ. Если удалить плейсхолдер, список
        добавится в конец промпта автоматически.
      </p>

      <div className="w-full max-w-[288px] space-y-4">
        <label className="flex min-h-[6.5rem] w-full cursor-pointer items-center justify-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 transition hover:border-sber-dark/40 hover:bg-white dark:border-slate-600 dark:bg-slate-700/40 dark:hover:border-sber-light/70 dark:hover:bg-slate-700">
          <FileUp size={18} className="shrink-0 text-sber-dark" />
          <span className="truncate text-sm text-gray-700 dark:text-slate-200">
            {file ? file.name : 'Выберите файл .docx'}
          </span>
          <input type="file" accept={ACCEPTED_DOCX} onChange={handleFileChange} className="sr-only" />
        </label>

        <button
          type="button"
          onClick={onProcess}
          disabled={!file || isProcessing || !prompt.trim() || !model.trim()}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-sber-dark px-5 py-2.5 text-sm font-medium text-white transition hover:bg-sber-muted disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Download size={18} />
          {isProcessing ? 'Генерация…' : 'Сгенерировать и скачать'}
        </button>
      </div>

      {error && <ErrorState title="Ошибка обработки" description={error} />}
      {isProcessing && (
        <LoadingState
          title="Генерация аудиторского мнения"
          description="Модель обрабатывает документ — это может занять несколько минут..."
        />
      )}
    </div>
  );
}
