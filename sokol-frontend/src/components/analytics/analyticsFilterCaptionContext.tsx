import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { buildConstructorFilterCaption } from './constructor/constructorFilterCaption';

const AnalyticsFilterCaptionContext = createContext('');

export function useAnalyticsFilterCaption() {
  return useContext(AnalyticsFilterCaptionContext);
}

export function AnalyticsFilterCaptionProvider({
  periodSliceLabel,
  periods,
  auditors,
  departments,
  children,
}: {
  periodSliceLabel: string;
  periods: string[];
  auditors: string[];
  departments: string[];
  children: ReactNode;
}) {
  const value = useMemo(
    () =>
      buildConstructorFilterCaption({
        periodSliceLabel,
        periods,
        auditors,
        departments,
      }),
    [auditors, departments, periodSliceLabel, periods],
  );

  return (
    <AnalyticsFilterCaptionContext.Provider value={value}>
      {children}
    </AnalyticsFilterCaptionContext.Provider>
  );
}
