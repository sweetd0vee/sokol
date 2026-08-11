import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Expand, FileUp, Minimize2, Plus, Trash2, X } from 'lucide-react';
import { ErrorState, LoadingState } from '../ui/StateMessage';
import type { Recommendation } from '../../types/recommendation';
import { parseRecommendationsFromDocx } from '../../api/recommendations';
import { getErrorMessage } from '../../api/errors';
import { normalizeRecommendationDeadline } from '../../utils/recommendationDeadline';
import { formatRuDate } from '../../utils/dates';
import { ACCEPTED_DOCX, isDocxFile } from '../../utils/docx';
import { useSokolData } from '../../contexts/sokolData';
import { FORM_SECTION_CLASS, FORM_SECTION_TITLE_CLASS } from '../../constants/formLayout';

type CheckRecommendationsBlockProps = {
  checkKey: string;
  checkLeader: string;
  checkSaved: boolean;
  onAddManually: () => void;
};

type ParsedPreviewItem = Recommendation & { previewKey: string };

const actionButtonClass =
  'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium whitespace-nowrap transition disabled:cursor-not-allowed disabled:opacity-50';
const blueActionButtonClass =
  `${actionButtonClass} border-2 border-[#6699FF] text-[#6699FF] hover:bg-[#3B82F6] hover:border-[#3B82F6] hover:text-white`;
const iconToolbarButtonClass =
  'inline-flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 text-gray-600 transition hover:border-sber-dark/40 hover:text-sber-dark';

function pluralRecommendations(n: number): string {
  if (n % 10 === 1 && n % 100 !== 11) {
    return 'рекомендация';
  }
  if (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)) {
    return 'рекомендации';
  }
  return 'рекомендаций';
}

type EditablePreviewField = 'name' | 'audit_object' | 'manager' | 'deadline';

const cellInputClass =
  'w-full rounded-md border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-900 shadow-sm outline-none transition focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/30';
const cellTextareaClass = `${cellInputClass} min-h-[4.5rem] resize-y leading-snug`;

function ParsedPreviewTable({
  items,
  expanded,
  onRemove,
  onChange,
}: {
  items: ParsedPreviewItem[];
  expanded: boolean;
  onRemove: (previewKey: string) => void;
  onChange?: (previewKey: string, field: EditablePreviewField, value: string) => void;
}) {
  const nameClamp = expanded ? '' : 'line-clamp-3';
  const cellClamp = expanded ? '' : 'line-clamp-2';
  const editable = Boolean(expanded && onChange);

  return (
    <table className={`w-full table-fixed ${expanded ? 'text-base' : 'text-sm'}`}>
      <colgroup>
        <col className={expanded ? 'w-14' : 'w-12'} />
        <col />
        <col className={expanded ? 'w-[20%]' : 'w-[18%]'} />
        <col className={expanded ? 'w-[18%]' : 'w-[16%]'} />
        <col className={expanded ? 'w-44' : 'w-[8.5rem]'} />
        <col className="w-12" />
      </colgroup>
      <thead className="sticky top-0 z-10">
        <tr className="bg-gray-100 text-gray-800">
          <th className="px-3 py-2.5 text-left font-medium">№</th>
          <th className="px-3 py-2.5 text-left font-medium">Рекомендация</th>
          <th className="px-3 py-2.5 text-left font-medium">Объект аудита</th>
          <th className="px-3 py-2.5 text-left font-medium">Руководитель</th>
          <th className="px-3 py-2.5 text-left font-medium">Срок исполнения</th>
          <th className="px-2 py-2.5 text-center font-medium">
            <span className="sr-only">Удалить</span>
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {items.map((item, index) => (
          <tr key={item.previewKey} className="bg-white transition hover:bg-slate-50">
            <td className="px-3 py-2.5 align-top tabular-nums text-gray-500">{index + 1}</td>
            <td className="px-3 py-2.5 align-top text-gray-900">
              {editable ? (
                <textarea
                  value={item.name}
                  onChange={(event) => onChange?.(item.previewKey, 'name', event.target.value)}
                  rows={3}
                  className={cellTextareaClass}
                  aria-label={`Рекомендация ${index + 1}`}
                />
              ) : (
                <p className={`${nameClamp} whitespace-pre-wrap break-words leading-snug`}>
                  {item.name || '—'}
                </p>
              )}
            </td>
            <td className="px-3 py-2.5 align-top text-gray-700">
              {editable ? (
                <textarea
                  value={item.audit_object}
                  onChange={(event) =>
                    onChange?.(item.previewKey, 'audit_object', event.target.value)
                  }
                  rows={2}
                  className={cellTextareaClass}
                  aria-label={`Объект аудита ${index + 1}`}
                />
              ) : (
                <span className={`${cellClamp} break-words`}>{item.audit_object}</span>
              )}
            </td>
            <td className="px-3 py-2.5 align-top text-gray-700">
              {editable ? (
                <input
                  type="text"
                  value={item.manager}
                  onChange={(event) => onChange?.(item.previewKey, 'manager', event.target.value)}
                  className={cellInputClass}
                  aria-label={`Руководитель ${index + 1}`}
                />
              ) : (
                <span className={`${cellClamp} break-words`}>{item.manager}</span>
              )}
            </td>
            <td className="px-3 py-2.5 align-top whitespace-nowrap text-gray-700">
              {editable ? (
                <input
                  type="date"
                  value={item.deadline || ''}
                  onChange={(event) => onChange?.(item.previewKey, 'deadline', event.target.value)}
                  className={cellInputClass}
                  aria-label={`Срок ${index + 1}`}
                />
              ) : (
                formatRuDate(item.deadline)
              )}
            </td>
            <td className="px-2 py-2.5 align-top text-center">
                <button
                  type="button"
                  onClick={() => onRemove(item.previewKey)}
                  title="Убрать из списка"
                  aria-label={`Убрать рекомендацию ${index + 1}`}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-400 transition hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-200"
                >
                  <Trash2 size={14} />
                </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function CheckRecommendationsBlock({
  checkKey,
  checkLeader,
  checkSaved,
  onAddManually,
}: CheckRecommendationsBlockProps) {
  const { getRecommendationsByCheckKey, addRecommendation } = useSokolData();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importAzFileName, setImportAzFileName] = useState<string | null>(null);
  const [parsedPreview, setParsedPreview] = useState<ParsedPreviewItem[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const canAdd = Boolean(checkKey.trim()) && checkSaved;
  const docxFlowActive = Boolean(importAzFileName || isParsing || parseError || parsedPreview.length > 0);

  useEffect(() => {
    if (parsedPreview.length === 0) {
      setIsFullscreen(false);
    }
  }, [parsedPreview.length]);

  useEffect(() => {
    if (!isFullscreen) {
      return undefined;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFullscreen]);

  const storedRecommendations = useMemo(
    () => (checkKey ? getRecommendationsByCheckKey(checkKey) : []),
    [checkKey, getRecommendationsByCheckKey],
  );

  const buildRecommendation = (
    draft: Pick<
      Recommendation,
      'name' | 'audit_object' | 'deadline' | 'auditor' | 'manager' | 'status' | 'additional_status'
    >,
    index: number,
  ): ParsedPreviewItem => ({
    previewKey: `preview-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
    id: '0',
    serial_number: checkKey,
    sequence_number: storedRecommendations.length + index + 1,
    name: draft.name.trim(),
    description: draft.name.trim(),
    indicator: 'не указан',
    materiality_level: 'средний',
    audit_object: (draft.audit_object.trim() || 'Не указан').slice(0, 255),
    deadline: draft.deadline,
    auditor: (draft.auditor.trim() || 'Не указан').slice(0, 255),
    manager: (draft.manager.trim() || 'Не указан').slice(0, 255),
    status: draft.status,
    additional_status: draft.additional_status,
    created_at: new Date().toISOString().slice(0, 10),
  });

  const parseAzFile = async (file: File) => {
    setParseError(null);
    setParsedPreview([]);
    setImportAzFileName(file.name);
    setIsParsing(true);
    try {
      const parsed = await parseRecommendationsFromDocx(file);
      setParsedPreview(
        parsed.map((item, index) =>
          buildRecommendation(
            {
              name: item.name,
              audit_object: item.audit_object,
              deadline: normalizeRecommendationDeadline(item.deadline),
              auditor: checkLeader,
              manager: item.manager,
              status: 'on_control',
              additional_status: 'on_control',
            },
            index,
          ),
        ),
      );
    } catch (error) {
      setParsedPreview([]);
      setParseError(getErrorMessage(error, 'Не удалось разобрать аудиторское заключение.'));
    } finally {
      setIsParsing(false);
    }
  };

  const handleImportFileChange = (file: File | null) => {
    if (!file) {
      return;
    }
    if (!isDocxFile(file)) {
      setImportAzFileName(null);
      setParseError('Файл должен быть в формате .docx.');
      return;
    }
    if (!canAdd) {
      return;
    }
    void parseAzFile(file);
  };

  const handleLoadFromAz = () => {
    if (!canAdd) {
      if (!checkSaved) {
        setParseError('Сначала сохраните проверку, чтобы добавлять рекомендации.');
      } else {
        setParseError('Сначала заполните поля проверки, чтобы сформировался ключ.');
      }
      return;
    }
    setParseError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleRemovePreview = (previewKey: string) => {
    setParsedPreview((prev) => {
      const next = prev.filter((item) => item.previewKey !== previewKey);
      if (next.length === 0) {
        setImportAzFileName(null);
      }
      return next;
    });
  };

  const handleChangePreview = (
    previewKey: string,
    field: EditablePreviewField,
    value: string,
  ) => {
    setParsedPreview((prev) =>
      prev.map((item) => {
        if (item.previewKey !== previewKey) {
          return item;
        }
        if (field === 'name') {
          const name = value;
          return { ...item, name, description: name.trim() };
        }
        if (field === 'deadline') {
          return { ...item, deadline: normalizeRecommendationDeadline(value) || value };
        }
        if (field === 'audit_object') {
          return { ...item, audit_object: value.slice(0, 255) };
        }
        return { ...item, manager: value.slice(0, 255) };
      }),
    );
  };

  const handleClearPreview = () => {
    setParsedPreview([]);
    setImportAzFileName(null);
    setParseError(null);
    setIsFullscreen(false);
  };

  const handleAddParsed = async () => {
    if (!canAdd || parsedPreview.length === 0) {
      return;
    }
    try {
      const base = storedRecommendations.length;
      for (const [index, recommendation] of parsedPreview.entries()) {
        const { previewKey: _previewKey, ...payload } = recommendation;
        await addRecommendation({
          ...payload,
          sequence_number: base + index + 1,
        });
      }
      setParsedPreview([]);
      setParseError(null);
      setImportAzFileName(null);
      setIsFullscreen(false);
    } catch (error) {
      setParseError(getErrorMessage(error, 'Не удалось добавить рекомендации.'));
    }
  };

  const recommendationCount = storedRecommendations.length;
  const recommendationWord = useMemo(
    () => pluralRecommendations(recommendationCount),
    [recommendationCount],
  );

  return (
    <div className={FORM_SECTION_CLASS}>
      <div className={FORM_SECTION_TITLE_CLASS}>Добавить рекомендации</div>

      {!checkKey && (
        <p className="text-sm text-amber-700">
          Для привязки рекомендаций укажите дату начала, руководителя и тип проверки — ключ сформируется
          автоматически.
        </p>
      )}
      {checkKey && !checkSaved && (
        <p className="text-sm text-amber-700">
          Сохраните проверку, чтобы добавлять рекомендации и видеть их в общей таблице.
        </p>
      )}

      <div className="flex flex-wrap gap-x-[2.75rem] gap-y-3">
        <button
          type="button"
          onClick={onAddManually}
          disabled={!canAdd}
          className={blueActionButtonClass}
        >
          <Plus size={16} />
          Добавить вручную
        </button>
        <button
          type="button"
          onClick={handleLoadFromAz}
          disabled={!canAdd || isParsing}
          className={blueActionButtonClass}
        >
          <FileUp size={16} />
          Загрузить из АЗ
        </button>
      </div>

      {docxFlowActive && (
        <div className="space-y-4 border-t border-gray-200 pt-5">
          {importAzFileName && !isParsing && (
            <p className="text-sm leading-relaxed text-gray-600">
              Файл: <span className="font-medium text-gray-800">{importAzFileName}</span>
            </p>
          )}
          {isParsing && (
            <LoadingState
              title="Разбор аудиторского заключения"
              description="Извлекаем рекомендации из Раздела II АЗ..."
            />
          )}
          {parseError && <ErrorState title="Ошибка" description={parseError} />}
          {parsedPreview.length > 0 && !isParsing && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <p className="text-sm leading-relaxed text-gray-600">
                  В документе найдено{' '}
                  <span className="font-semibold text-gray-800">{parsedPreview.length}</span>{' '}
                  {pluralRecommendations(parsedPreview.length)}.
                </p>
                <button
                  type="button"
                  onClick={() => setIsFullscreen(true)}
                  className={iconToolbarButtonClass}
                  title="На весь экран"
                  aria-label="На весь экран"
                >
                  <Expand className="h-3.5 w-3.5" />
                </button>
              </div>

              {isFullscreen ? (
                <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-gray-200 text-xs text-gray-400">
                  Открыто на весь экран
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                  <div className="max-h-[22rem] overflow-auto">
                    <ParsedPreviewTable
                      items={parsedPreview}
                      expanded={false}
                      onRemove={handleRemovePreview}
                    />
                  </div>
                </div>
              )}

              {!isFullscreen && (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
                  <button
                    type="button"
                    onClick={() => void handleAddParsed()}
                    disabled={!canAdd}
                    className={blueActionButtonClass}
                  >
                    <Plus size={16} />
                    Добавить в проверку ({parsedPreview.length})
                  </button>
                  <button
                    type="button"
                    onClick={handleClearPreview}
                    className={blueActionButtonClass}
                  >
                    Отменить
                  </button>
                </div>
              )}

              {isFullscreen &&
                createPortal(
                  <div
                    className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-[1px]"
                    onClick={() => setIsFullscreen(false)}
                    role="presentation"
                  >
                    <div
                      className="flex h-[94vh] w-[96vw] max-w-[1600px] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
                        <div className="min-w-0 space-y-1">
                          <h3 className="text-base font-semibold text-[#003366]">
                            Рекомендации из АЗ
                          </h3>
                          <p className="text-sm text-gray-500">
                            {importAzFileName ? `Файл: ${importAzFileName}` : null}
                            {importAzFileName ? ' · ' : null}
                            {parsedPreview.length} {pluralRecommendations(parsedPreview.length)}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setIsFullscreen(false)}
                            className={iconToolbarButtonClass}
                            title="Свернуть"
                            aria-label="Свернуть"
                          >
                            <Minimize2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsFullscreen(false)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-600 transition hover:border-rose-300 hover:text-rose-600"
                            title="Закрыть"
                            aria-label="Закрыть"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      <div className="min-h-0 flex-1 overflow-auto px-4 pb-2 pt-3">
                        <div className="overflow-hidden rounded-xl border border-gray-200">
                          <ParsedPreviewTable
                            items={parsedPreview}
                            expanded
                            onRemove={handleRemovePreview}
                            onChange={handleChangePreview}
                          />
                        </div>
                      </div>

                      <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-3 border-t border-gray-100 px-5 py-4">
                        <button
                          type="button"
                          onClick={() => void handleAddParsed()}
                          disabled={!canAdd}
                          className={blueActionButtonClass}
                        >
                          <Plus size={16} />
                          Добавить в проверку ({parsedPreview.length})
                        </button>
                        <button
                          type="button"
                          onClick={handleClearPreview}
                          className={blueActionButtonClass}
                        >
                          Отменить
                        </button>
                      </div>
                    </div>
                  </div>,
                  document.body,
                )}
            </div>
          )}
        </div>
      )}

      <p
        className={`text-sm leading-relaxed ${
          recommendationCount > 0 ? 'text-gray-800' : 'text-gray-500'
        }`}
      >
        {recommendationCount > 0 ? (
          <>
            Всего <span className="font-semibold text-[#003366]">{recommendationCount}</span>{' '}
            {recommendationWord}
          </>
        ) : (
          'Рекомендации пока не добавлены'
        )}
      </p>

      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_DOCX}
        hidden
        onChange={(event) => handleImportFileChange(event.target.files?.[0] ?? null)}
      />
    </div>
  );
}
