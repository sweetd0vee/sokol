import { useMemo, useRef, useState } from 'react';
import { FileUp, Plus } from 'lucide-react';
import { ErrorState, LoadingState } from '../ui/StateMessage';
import type { Recommendation } from '../../types/recommendation';
import { parseRecommendationsFromDocx } from '../../api/recommendations';
import { getErrorMessage } from '../../api/errors';
import { normalizeRecommendationDeadline } from '../../utils/recommendationDeadline';
import { ACCEPTED_DOCX, isDocxFile } from '../../utils/docx';
import { useSokolData } from '../../contexts/sokolData';
import { FORM_SECTION_CLASS, FORM_SECTION_TITLE_CLASS } from '../../constants/formLayout';

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

export function CheckRecommendationsBlock({
  checkKey,
  checkLeader,
  checkSaved,
  onAddManually,
}: CheckRecommendationsBlockProps) {
  const { getRecommendationsByCheckKey, addRecommendation } = useSokolData();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importAzFileName, setImportAzFileName] = useState<string | null>(null);
  const [parsedPreview, setParsedPreview] = useState<Recommendation[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  const canAdd = Boolean(checkKey.trim()) && checkSaved;
  const docxFlowActive = Boolean(importAzFileName || isParsing || parseError || parsedPreview.length > 0);

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
  ): Recommendation => ({
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

  const handleAddParsed = async () => {
    if (!canAdd || parsedPreview.length === 0) {
      return;
    }
    try {
      for (const recommendation of parsedPreview) {
        await addRecommendation(recommendation);
      }
      setParsedPreview([]);
      setParseError(null);
      setImportAzFileName(null);
    } catch (error) {
      setParseError(getErrorMessage(error, 'Не удалось добавить рекомендации.'));
    }
  };

  const recommendationCount = storedRecommendations.length;


  const recommendationWord = useMemo(() => {
    const n = recommendationCount;
    if (n % 10 === 1 && n % 100 !== 11) {
      return 'рекомендация';
    }
    if (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)) {
      return 'рекомендации';
    }
    return 'рекомендаций';
  }, [recommendationCount]);

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
        <div className="space-y-5 border-t border-gray-200 pt-5">
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
              <p className="text-sm leading-relaxed text-gray-600">
                В документе найдено {parsedPreview.length} рекомендаций.
              </p>
              <div className="flex flex-wrap gap-x-[2.75rem] gap-y-3">
                <button
                  type="button"
                  onClick={() => void handleAddParsed()}
                  disabled={!canAdd}
                  className={blueActionButtonClass}
                >
                  <Plus size={16} />
                  Добавить в проверку
                </button>
              </div>
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
