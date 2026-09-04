import { useState } from 'react';
import type { ExportFormat } from '../utils/exports';

export function useListExport() {
  const [format, setFormat] = useState<ExportFormat>('xlsx');
  const [isExporting, setIsExporting] = useState(false);

  const runExport = async (action: () => Promise<void>) => {
    setIsExporting(true);
    try {
      await action();
    } finally {
      setIsExporting(false);
    }
  };

  return { format, setFormat, isExporting, runExport };
}
