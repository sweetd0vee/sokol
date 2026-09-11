import { useEffect, useState } from 'react';
import { getErrorMessage, getRetryAfterSeconds } from '../api/errors';
import { downloadBlob } from '../utils/download';

const DEFAULT_MISSING_FILE_MESSAGE = 'Выберите файл .docx для обработки.';

type UseDocxToolJobOptions = {
  process: (file: File) => Promise<Blob>;
  outputName: (fileName: string) => string;
  fallbackError: string;
  missingFileMessage?: string;
  validate?: (file: File | null) => string | null;
};

export function useDocxToolJob({
  process,
  outputName,
  fallbackError,
  missingFileMessage = DEFAULT_MISSING_FILE_MESSAGE,
  validate,
}: UseDocxToolJobOptions) {
  const [file, setFile] = useState<File | null>(null);
  const [error, setErrorState] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [retryUntilMs, setRetryUntilMs] = useState<number | null>(null);
  const [retryRemainingSeconds, setRetryRemainingSeconds] = useState(0);

  useEffect(() => {
    if (!retryUntilMs) {
      setRetryRemainingSeconds(0);
      return undefined;
    }
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((retryUntilMs - Date.now()) / 1000));
      setRetryRemainingSeconds(remaining);
      if (remaining === 0) {
        setRetryUntilMs(null);
      }
    };
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [retryUntilMs]);

  const setError = (next: string | null) => {
    setErrorState(next);
    if (next === null) {
      setRetryUntilMs(null);
    }
  };

  const captureError = (err: unknown, fallback = fallbackError) => {
    setErrorState(getErrorMessage(err, fallback));
    const retryAfter = getRetryAfterSeconds(err);
    setRetryUntilMs(retryAfter ? Date.now() + retryAfter * 1000 : null);
  };

  const onFileChange = (next: File | null) => {
    setError(null);
    const validationError = validate?.(next) ?? null;
    if (validationError) {
      setFile(null);
      setErrorState(validationError);
      return;
    }
    setFile(next);
  };

  const run = async () => {
    if (retryRemainingSeconds > 0) {
      return;
    }
    if (!file) {
      setError(missingFileMessage);
      return;
    }
    setError(null);
    setIsProcessing(true);
    try {
      const blob = await process(file);
      downloadBlob(blob, outputName(file.name));
    } catch (err) {
      captureError(err);
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    file,
    error,
    isProcessing,
    retryRemainingSeconds,
    onFileChange,
    run,
    setError,
    captureError,
    setIsProcessing,
  };
}
