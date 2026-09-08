/** Shared try/catch wrapper for analytics dashboard export actions. */
export async function runAnalyticsExport(
  setIsExporting: (value: boolean) => void,
  action: () => Promise<void>,
  logLabel = 'Analytics export failed',
) {
  setIsExporting(true);
  try {
    await action();
  } catch (error) {
    console.error(logLabel, error);
    window.alert(
      `Не удалось экспортировать отчёт: ${error instanceof Error ? error.message : 'неизвестная ошибка'}`,
    );
  } finally {
    setIsExporting(false);
  }
}
