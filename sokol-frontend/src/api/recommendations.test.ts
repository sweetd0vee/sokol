import { beforeEach, describe, expect, it, vi } from 'vitest';
import { batchRecommendations } from './recommendations';
import { api } from './client';
import type { Recommendation } from '../types/recommendation';

vi.mock('./client', () => ({
  api: {
    post: vi.fn(),
  },
}));

const recommendation: Recommendation = {
  id: 'tmp',
  serial_number: 'old',
  sequence_number: 1,
  name: 'Рекомендация',
  description: 'Рекомендация',
  indicator: 'не указан',
  materiality_level: 'средний',
  audit_object: ['Процесс'],
  deadline: '',
  auditor: 'Иванов И.И.',
  manager: 'Петров П.П.',
  status: 'on_control',
  additional_status: 'on_control',
  created_at: '2026-08-12',
};

describe('batchRecommendations', () => {
  beforeEach(() => {
    vi.mocked(api.post).mockReset();
  });

  it('posts atomic batch payload and normalizes serial_number', async () => {
    vi.mocked(api.post).mockResolvedValue({
      data: {
        total: 1,
        items: [
          {
            ...recommendation,
            id: 7,
            serial_number: '26IVP1P1',
            deadline: null,
            observation_name: null,
            actual_completion_date: null,
          },
        ],
      },
    });

    const result = await batchRecommendations('26IVP1P1', [recommendation], 'replace');

    expect(api.post).toHaveBeenCalledWith('/api/v1/recommendations/batch', {
      serial_number: '26IVP1P1',
      mode: 'replace',
      items: [expect.objectContaining({ serial_number: '26IVP1P1', name: 'Рекомендация' })],
    });
    expect(result.total).toBe(1);
    expect(result.items[0].id).toBe('7');
    expect(result.items[0].serial_number).toBe('26IVP1P1');
  });
});
