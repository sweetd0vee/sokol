import { api } from './client';
import { getBlobErrorMessage, toApiError } from './errors';
import { DOCX_TOOL_TIMEOUT_MS } from '../utils/docx';

export { DOCX_TOOL_TIMEOUT_MS };

type DocxToolExtraFields = Record<string, string>;

const DOCX_TIMEOUT_MESSAGE =
  'Обработка документа заняла слишком много времени. Попробуйте ещё раз; большие файлы могут обрабатываться несколько минут.';

async function postDocxTool(file: File, endpoint: string, extraFields?: DocxToolExtraFields): Promise<Blob> {
  const formData = new FormData();
  formData.append('file', file);
  Object.entries(extraFields ?? {}).forEach(([key, value]) => {
    formData.append(key, value);
  });
  try {
    const response = await api.post(endpoint, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      responseType: 'blob',
      timeout: DOCX_TOOL_TIMEOUT_MS,
    });
    return response.data;
  } catch (error) {
    if (toApiError(error).code === 'timeout') {
      throw new Error(DOCX_TIMEOUT_MESSAGE);
    }
    const message = await getBlobErrorMessage(error);
    if (message) {
      throw new Error(message);
    }
    throw error;
  }
}

export async function generateSectionIITemplate(file: File): Promise<Blob> {
  return postDocxTool(file, '/api/v1/tools/section-ii');
}

export async function generateSectionIIWithLinks(file: File): Promise<Blob> {
  return postDocxTool(file, '/api/v1/tools/section-ii-links');
}

export async function generateMemorandum(file: File): Promise<Blob> {
  return postDocxTool(file, '/api/v1/tools/memorandum');
}

export async function generateControlFile(
  file: File,
  payload: { checkLeader: string; checkDate: string },
): Promise<Blob> {
  return postDocxTool(file, '/api/v1/tools/control-file', {
    check_leader: payload.checkLeader,
    check_date: payload.checkDate,
  });
}

export async function downloadControlFileTemplate(): Promise<Blob> {
  const response = await api.get('/api/v1/tools/control-file-template', {
    responseType: 'blob',
    timeout: DOCX_TOOL_TIMEOUT_MS,
  });
  return response.data;
}
