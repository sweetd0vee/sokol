import { api } from './client';
import { getBlobErrorMessage } from './errors';

const DOCX_TOOL_TIMEOUT_MS = 120_000;

async function postDocxTool(file: File, endpoint: string): Promise<Blob> {
  const formData = new FormData();
  formData.append('file', file);
  try {
    const response = await api.post(endpoint, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      responseType: 'blob',
      timeout: DOCX_TOOL_TIMEOUT_MS,
    });
    return response.data;
  } catch (error) {
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
