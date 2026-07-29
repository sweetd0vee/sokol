import { api } from './client';
import { getBlobErrorMessage } from './errors';

const DOCX_TOOL_TIMEOUT_MS = 120_000;
const AUDIT_OPINION_TIMEOUT_MS = 600_000;

async function postDocxTool(
  file: File,
  endpoint: string,
  timeoutMs = DOCX_TOOL_TIMEOUT_MS,
  extraFields?: Record<string, string>,
): Promise<Blob> {
  const formData = new FormData();
  formData.append('file', file);
  if (extraFields) {
    for (const [key, value] of Object.entries(extraFields)) {
      formData.append(key, value);
    }
  }
  try {
    const response = await api.post(endpoint, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      responseType: 'blob',
      timeout: timeoutMs,
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

export async function fetchAuditOpinionDefaultPrompt(): Promise<string> {
  const response = await api.get<{ prompt: string }>('/api/v1/tools/audit-opinion/default-prompt');
  return response.data.prompt;
}

export type AuditOpinionModelsResponse = {
  models: string[];
  default_model: string;
};

export async function fetchAuditOpinionModels(): Promise<AuditOpinionModelsResponse> {
  const response = await api.get<AuditOpinionModelsResponse>('/api/v1/tools/audit-opinion/models');
  return response.data;
}

export async function generateAuditOpinion(
  file: File,
  prompt: string,
  model?: string,
): Promise<Blob> {
  const extraFields: Record<string, string> = { prompt };
  if (model?.trim()) {
    extraFields.model = model.trim();
  }
  return postDocxTool(file, '/api/v1/tools/audit-opinion', AUDIT_OPINION_TIMEOUT_MS, extraFields);
}
