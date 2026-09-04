import { createPortal } from 'react-dom';
import { Expand, FileUp, Minimize2, Plus, X } from 'lucide-react';
import { ErrorState, LoadingState } from '../ui/StateMessage';
import { ACCEPTED_DOCX } from '../../utils/docx';
import { pluralRecommendations } from '../../utils/pluralRu';
import { useCheckRecommendationsImport } from '../../hooks/useCheckRecommendationsImport';
import { ParsedPreviewTable } from './ParsedPreviewTable';
import {
  FORM_ACTION_BUTTON_CLASS,
  FORM_SECTION_CLASS,
  FORM_SECTION_TITLE_CLASS,
} from '../../constants/formLayout';

type CheckRecommendationsBlockProps = {
  checkKey: string;
  checkLeader: string;
  checkSaved: boolean;
  onAddManually: () => void;
};

const actionButtonClass =
  'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium whitespace-nowrap transition disabled:cursor-not-allowed disabled:opacity-50';
const blueActionButtonClass =
  `${actionButtonClass} border-2 border-[#6699FF] text-[#6699FF] hover:bg-[#3B82F6] hover:border-[#3B82F6] hover:text-white`;
const addRecommendationButtonClass = `${blueActionButtonClass} w-[220px]`;
const formSizedBlueActionButtonClass =
  `inline-flex items-center gap-2 rounded-lg border-2 border-[#6699FF] px-3 py-1.5 text-sm font-medium text-[#6699FF] transition hover:bg-[#3B82F6] hover:border-[#3B82F6] hover:text-white disabled:cursor-not-allowed disabled:opacity-50 ${FORM_ACTION_BUTTON_CLASS}`;
const iconToolbarButtonClass =
  'inline-flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 text-gray-600 transition hover:border-sber-dark/40 hover:text-sber-dark';

export function CheckRecommendationsBlock({
  checkKey,
  checkLeader,
  checkSaved,
  onAddManually,
}: CheckRecommendationsBlockProps) {
  const importFlow = useCheckRecommendationsImport({ checkKey, checkLeader, checkSaved });
  const recommendationWord = pluralRecommendations(importFlow.storedCount);

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

      <div className="flex flex-wrap gap-x-4 gap-y-3">
        <button
          type="button"
          onClick={onAddManually}
          disabled={!importFlow.canAdd}
          className={addRecommendationButtonClass}
        >
          <Plus size={16} className="shrink-0" />
          Добавить вручную
        </button>
        <button
          type="button"
          onClick={importFlow.handleLoadFromAz}
          disabled={!importFlow.canAdd || importFlow.isParsing}
          className={formSizedBlueActionButtonClass}
        >
          <FileUp size={16} />
          Загрузить из АЗ
        </button>
      </div>

      {importFlow.docxFlowActive && (
        <div className="space-y-4 border-t border-gray-200 pt-5">
          {importFlow.importAzFileName && !importFlow.isParsing && (
            <p className="text-sm leading-relaxed text-gray-600">
              Файл: <span className="font-medium text-gray-800">{importFlow.importAzFileName}</span>
            </p>
          )}
          {importFlow.isParsing && (
            <LoadingState
              title="Разбор аудиторского заключения"
              description="Большие документы могут обрабатываться несколько минут."
            />
          )}
          {importFlow.parseError && <ErrorState title="Ошибка" description={importFlow.parseError} />}
          {importFlow.recentUpload && importFlow.parsedPreview.length === 0 && !importFlow.isParsing && (
            <div className="space-y-3">
              <div className="rounded-xl border border-gray-200 bg-gray-100 px-4 py-3">
                <p className="text-sm leading-relaxed text-gray-600">
                  В проверку добавлено{' '}
                  <span className="font-semibold">{importFlow.recentUpload.count}</span>{' '}
                  {pluralRecommendations(importFlow.recentUpload.count)}
                  {importFlow.recentUpload.fileName ? (
                    <>
                      {' '}
                      из файла <span className="font-medium">{importFlow.recentUpload.fileName}</span>
                    </>
                  ) : null}
                  . Если это произошло по ошибке, можно отменить загрузку — рекомендации будут удалены
                  из базы.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void importFlow.handleCancel()}
                disabled={importFlow.isUndoingUpload}
                className={formSizedBlueActionButtonClass}
              >
                {importFlow.isUndoingUpload ? 'Отмена загрузки...' : 'Отменить'}
              </button>
            </div>
          )}
          {importFlow.parsedPreview.length > 0 && !importFlow.isParsing && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <p className="text-sm leading-relaxed text-gray-600">
                  В документе найдено{' '}
                  <span className="font-semibold text-gray-800">{importFlow.parsedPreview.length}</span>{' '}
                  {pluralRecommendations(importFlow.parsedPreview.length)}.
                </p>
                <button
                  type="button"
                  onClick={() => importFlow.setIsFullscreen(true)}
                  className={iconToolbarButtonClass}
                  title="На весь экран"
                  aria-label="На весь экран"
                >
                  <Expand className="h-3.5 w-3.5" />
                </button>
              </div>

              {importFlow.isFullscreen ? (
                <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-gray-200 text-xs text-gray-400">
                  Открыто на весь экран
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                  <div className="max-h-[22rem] overflow-auto">
                    <ParsedPreviewTable
                      items={importFlow.parsedPreview}
                      expanded={false}
                      onRemove={importFlow.handleRemovePreview}
                    />
                  </div>
                </div>
              )}

              {!importFlow.isFullscreen && (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
                  <button
                    type="button"
                    onClick={() => void importFlow.handleAddParsed()}
                    disabled={!importFlow.canAdd || importFlow.isUndoingUpload}
                    className={addRecommendationButtonClass}
                  >
                    <Plus size={16} className="shrink-0" />
                    Добавить в проверку ({importFlow.parsedPreview.length})
                  </button>
                  <button
                    type="button"
                    onClick={importFlow.handleCancel}
                    disabled={!importFlow.canCancelUpload || importFlow.isUndoingUpload}
                    className={formSizedBlueActionButtonClass}
                  >
                    Отменить
                  </button>
                </div>
              )}

              {importFlow.isFullscreen &&
                createPortal(
                  <div
                    className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-[1px]"
                    onClick={() => importFlow.setIsFullscreen(false)}
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
                            {importFlow.importAzFileName ? `Файл: ${importFlow.importAzFileName}` : null}
                            {importFlow.importAzFileName ? ' · ' : null}
                            {importFlow.parsedPreview.length} {pluralRecommendations(importFlow.parsedPreview.length)}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => importFlow.setIsFullscreen(false)}
                            className={iconToolbarButtonClass}
                            title="Свернуть"
                            aria-label="Свернуть"
                          >
                            <Minimize2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => importFlow.setIsFullscreen(false)}
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
                            items={importFlow.parsedPreview}
                            expanded
                            onRemove={importFlow.handleRemovePreview}
                            onChange={importFlow.handleChangePreview}
                          />
                        </div>
                      </div>

                      <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-3 border-t border-gray-100 px-5 py-4">
                        <button
                          type="button"
                          onClick={() => void importFlow.handleAddParsed()}
                          disabled={!importFlow.canAdd || importFlow.isUndoingUpload}
                          className={addRecommendationButtonClass}
                        >
                          <Plus size={16} className="shrink-0" />
                          Добавить в проверку ({importFlow.parsedPreview.length})
                        </button>
                        <button
                          type="button"
                          onClick={importFlow.handleCancel}
                          disabled={!importFlow.canCancelUpload || importFlow.isUndoingUpload}
                          className={formSizedBlueActionButtonClass}
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
          importFlow.storedCount > 0 ? 'text-gray-800' : 'text-gray-500'
        }`}
      >
        {importFlow.storedCount > 0 ? (
          <>
            Всего <span className="font-semibold text-[#003366]">{importFlow.storedCount}</span>{' '}
            {recommendationWord}
          </>
        ) : (
          'Рекомендации пока не добавлены'
        )}
      </p>

      <input
        ref={importFlow.fileInputRef}
        type="file"
        accept={ACCEPTED_DOCX}
        hidden
        onChange={(event) => importFlow.handleImportFileChange(event.target.files?.[0] ?? null)}
      />
    </div>
  );
}
