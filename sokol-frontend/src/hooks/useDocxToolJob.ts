import { useState } from 'react';
import { getErrorMessage } from '../api/errors';
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
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const onFileChange = (next: File | null) => {
    setError(null);
    const validationError = validate?.(next) ?? null;
    if (validationError) {
      setFile(null);
      setError(validationError);
      return;
    }
    setFile(next);
  };

  const run = async () => {
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
      setError(getErrorMessage(err, fallbackError));
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    file,
    error,
    isProcessing,
    onFileChange,
    run,
    setError,
    setIsProcessing,
  };
}
