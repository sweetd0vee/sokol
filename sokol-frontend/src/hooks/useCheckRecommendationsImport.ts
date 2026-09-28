import { useEffect, useMemo, useRef, useState } from 'react';
import { parseRecommendationsFromDocx } from '../api/recommendations';
import { getErrorMessage } from '../api/errors';
import { normalizeRecommendationDeadline } from '../utils/recommendationDeadline';
import { formatRecommendationAuditObjects } from '../utils/auditObjects';
import { isDocxFile } from '../utils/docx';
import { useSokolData } from '../contexts/sokolData';
import {
  buildParsedPreviewItem,
  isCompletedDuringAudit,
  patchPreviewItem,
  toRecommendationPayload,
  type EditablePreviewField,
  type ParsedPreviewItem,
  type RecentUploadSession,
} from '../utils/checkRecommendationsPreview';

export function useCheckRecommendationsImport({
  checkKey,
  checkLeader,
  checkSaved,
}: {
  checkKey: string;
  checkLeader: string;
  checkSaved: boolean;
}) {
  const { getRecommendationsByCheckKey, addRecommendationsForCheck, removeRecommendationsByIds } =
    useSokolData();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importAzFileName, setImportAzFileName] = useState<string | null>(null);
  const [parsedPreview, setParsedPreview] = useState<ParsedPreviewItem[]>([]);
  const [recentUpload, setRecentUpload] = useState<RecentUploadSession | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isUndoingUpload, setIsUndoingUpload] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const canAdd = Boolean(checkKey.trim()) && checkSaved;
  const docxFlowActive = Boolean(
    importAzFileName
    || isParsing
    || parseError
    || parsedPreview.length > 0
    || recentUpload,
  );
  const canCancelUpload = parsedPreview.length > 0 || Boolean(recentUpload);

  useEffect(() => {
    setRecentUpload(null);
    setParsedPreview([]);
    setImportAzFileName(null);
    setParseError(null);
    setIsFullscreen(false);
  }, [checkKey]);

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

  const parseAzFile = async (file: File) => {
    setParseError(null);
    setParsedPreview([]);
    setRecentUpload(null);
    setImportAzFileName(file.name);
    setIsParsing(true);
    try {
      const parsed = await parseRecommendationsFromDocx(file);
      setParsedPreview(
        parsed.map((item, index) =>
          buildParsedPreviewItem(
            {
              name: item.name,
              observation_name: item.observation_name ?? '',
              audit_object: formatRecommendationAuditObjects(item.audit_object),
              deadline: normalizeRecommendationDeadline(item.deadline),
              auditor: checkLeader,
              manager: item.manager,
              status: 'on_control',
              additional_status: 'on_control',
              completed_during_audit:
                Boolean(item.completed_during_audit) || isCompletedDuringAudit(item.deadline),
            },
            index,
            checkKey,
            storedRecommendations.length,
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
      prev.map((item) =>
        item.previewKey === previewKey
          ? patchPreviewItem(item, field, value, normalizeRecommendationDeadline)
          : item,
      ),
    );
  };

  const handleClearPreview = () => {
    setParsedPreview([]);
    setImportAzFileName(null);
    setParseError(null);
    setIsFullscreen(false);
  };

  const handleUndoRecentUpload = async () => {
    if (!recentUpload || recentUpload.ids.length === 0 || isUndoingUpload) {
      return;
    }
    setIsUndoingUpload(true);
    setParseError(null);
    try {
      await removeRecommendationsByIds(recentUpload.ids);
      setRecentUpload(null);
      setImportAzFileName(null);
      setIsFullscreen(false);
    } catch (error) {
      setParseError(getErrorMessage(error, 'Не удалось отменить загрузку рекомендаций.'));
    } finally {
      setIsUndoingUpload(false);
    }
  };

  const handleCancel = () => {
    if (parsedPreview.length > 0) {
      handleClearPreview();
      return;
    }
    if (recentUpload) {
      void handleUndoRecentUpload();
    }
  };

  const handleAddParsed = async () => {
    if (!canAdd || parsedPreview.length === 0) {
      return;
    }
    try {
      const created = await addRecommendationsForCheck(
        checkKey,
        parsedPreview.map(toRecommendationPayload),
      );
      setRecentUpload({
        ids: created.map((item) => String(item.id)),
        count: created.length,
        fileName: importAzFileName,
      });
      setParsedPreview([]);
      setParseError(null);
      setIsFullscreen(false);
    } catch (error) {
      setParseError(getErrorMessage(error, 'Не удалось добавить рекомендации.'));
    }
  };

  return {
    fileInputRef,
    importAzFileName,
    parsedPreview,
    recentUpload,
    isParsing,
    isUndoingUpload,
    parseError,
    isFullscreen,
    setIsFullscreen,
    canAdd,
    docxFlowActive,
    canCancelUpload,
    storedCount: storedRecommendations.length,
    handleImportFileChange,
    handleLoadFromAz,
    handleRemovePreview,
    handleChangePreview,
    handleCancel,
    handleAddParsed,
  };
}
