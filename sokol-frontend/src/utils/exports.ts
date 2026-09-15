import type { Check } from '../types/check';
import type { Recommendation } from '../types/recommendation';
import { buildCheckYearlyNumbers } from './checkYearlyNumber';
import { buildRecommendationYearlyNumbers } from './recommendationYearlyNumber';
import { exportChecksDocx, exportRecommendationsTableDocx } from './tableExport/docx';
import { exportChecksHtml, exportRecommendationsTableHtml } from './tableExport/html';
import { exportChecksPdf, exportRecommendationsTablePdf } from './tableExport/pdf';
import { exportChecksXlsx, exportRecommendationsTableXlsx } from './tableExport/xlsx';
import type { ExportFormat } from './tableExport/types';

export { EXPORT_FORMATS, type ExportFormat } from './tableExport/types';

export async function exportChecks(
  checks: Check[],
  format: ExportFormat,
  filenameBase: string,
  allChecksForNumbering: Check[] = checks,
) {
  const yearlyNumbers = buildCheckYearlyNumbers(allChecksForNumbering);
  const filename = `${filenameBase}.${format}`;
  switch (format) {
    case 'xlsx':
      await exportChecksXlsx(checks, filename, yearlyNumbers);
      break;
    case 'docx':
      await exportChecksDocx(checks, filename, yearlyNumbers);
      break;
    case 'pdf':
      exportChecksPdf(checks, filename, yearlyNumbers);
      break;
    case 'html':
      exportChecksHtml(checks, filename, yearlyNumbers);
      break;
  }
}

export async function exportRecommendationsTable(
  recommendations: Recommendation[],
  allRecommendationsForNumbering: Recommendation[],
  checks: Check[],
  format: ExportFormat,
  filenameBase: string,
) {
  const filename = `${filenameBase}.${format}`;
  const yearlyNumbers = buildRecommendationYearlyNumbers(allRecommendationsForNumbering);
  switch (format) {
    case 'xlsx':
      await exportRecommendationsTableXlsx(recommendations, checks, filename, yearlyNumbers);
      break;
    case 'docx':
      await exportRecommendationsTableDocx(recommendations, checks, filename, yearlyNumbers);
      break;
    case 'pdf':
      await exportRecommendationsTablePdf(recommendations, checks, filename, yearlyNumbers);
      break;
    case 'html':
      await exportRecommendationsTableHtml(recommendations, checks, filename, yearlyNumbers);
      break;
  }
}
