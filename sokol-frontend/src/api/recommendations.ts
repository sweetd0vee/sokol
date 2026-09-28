import { api } from './client';
import { getErrorMessage } from './errors';
import { DOCX_TOOL_TIMEOUT_MS } from '../utils/docx';
import {
  mapRecommendationFromApi,
  mapRecommendationToCreate,
  mapRecommendationToUpdate,
  type ApiRecommendation,
} from './mappers';
import type { Recommendation } from '../types/recommendation';

export type ParsedRecommendation = {
  name: string;
  observation_name?: string;
  audit_object: string[] | string;
  manager: string;
  deadline: string;
  completed_during_audit?: boolean;
};

type RecommendationListResponse = {
  items: ApiRecommendation[];
  total: number;
};

type FetchRecommendationsParams = {
  skip?: number;
  limit?: number;
  search?: string;
  serial_number?: string;
};

export type RecommendationBatchMode = 'append' | 'replace';

export async function fetchRecommendations(
  params: FetchRecommendationsParams = {},
): Promise<{ items: Recommendation[]; total: number }> {
  const { data } = await api.get<RecommendationListResponse>('/api/v1/recommendations', { params });
  return {
    items: data.items.map(mapRecommendationFromApi),
    total: data.total,
  };
}

export async function fetchRecommendation(id: number | string): Promise<Recommendation> {
  const { data } = await api.get<ApiRecommendation>(`/api/v1/recommendations/${id}`);
  return mapRecommendationFromApi(data);
}

export async function createRecommendation(recommendation: Recommendation): Promise<Recommendation> {
  try {
    const { data } = await api.post<ApiRecommendation>(
      '/api/v1/recommendations',
      mapRecommendationToCreate(recommendation),
    );
    return mapRecommendationFromApi(data);
  } catch (error) {
    const message = getErrorMessage(error, 'Не удалось создать рекомендацию.');
    throw new Error(message);
  }
}

export async function batchRecommendations(
  serialNumber: string,
  items: Recommendation[],
  mode: RecommendationBatchMode = 'append',
): Promise<{ items: Recommendation[]; total: number }> {
  try {
    const { data } = await api.post<RecommendationListResponse>('/api/v1/recommendations/batch', {
      serial_number: serialNumber,
      mode,
      items: items.map((item) => ({
        ...mapRecommendationToCreate(item),
        serial_number: serialNumber,
      })),
    });
    return {
      items: data.items.map(mapRecommendationFromApi),
      total: data.total,
    };
  } catch (error) {
    const message = getErrorMessage(error, 'Не удалось сохранить рекомендации.');
    throw new Error(message);
  }
}

export async function updateRecommendation(
  id: number | string,
  recommendation: Recommendation,
): Promise<Recommendation> {
  const { data } = await api.patch<ApiRecommendation>(
    `/api/v1/recommendations/${id}`,
    mapRecommendationToUpdate(recommendation),
  );
  return mapRecommendationFromApi(data);
}

export async function deleteRecommendation(id: number | string): Promise<void> {
  await api.delete(`/api/v1/recommendations/${id}`);
}

export async function batchDeleteRecommendations(ids: Array<number | string>): Promise<void> {
  if (ids.length === 0) {
    return;
  }
  await api.post('/api/v1/recommendations/batch-delete', {
    ids: ids.map((id) => Number(id)),
  });
}

export async function parseRecommendationsFromDocx(file: File): Promise<ParsedRecommendation[]> {
  const formData = new FormData();
  formData.append('file', file);
  try {
    const response = await api.post<ParsedRecommendation[]>(
      '/api/v1/tools/parse-recommendations',
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: DOCX_TOOL_TIMEOUT_MS,
      },
    );
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Не удалось разобрать аудиторское заключение.'));
  }
}
