import { api } from './client';

export interface PersonAnalytics {
  person: string;
  recommendations_count: number;
  checks_count: number;
  checks_red_level_count: number;
}

export interface AnalyticsByPersonResponse {
  period: { start_date: string | null; end_date: string | null };
  data: PersonAnalytics[];
}

export async function fetchAnalyticsByPerson(params?: {
  start_date?: string;
  end_date?: string;
  person?: string;
}): Promise<AnalyticsByPersonResponse> {
  const { data } = await api.get<AnalyticsByPersonResponse>('/api/v1/analytics/by-person', {
    params,
  });
  return data;
}
