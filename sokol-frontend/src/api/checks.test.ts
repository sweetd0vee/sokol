import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchCheck } from './checks';
import { api } from './client';

vi.mock('./client', () => ({
  api: {
    get: vi.fn(),
  },
}));

describe('checks api', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset();
  });

  it('fetches a single check by id for direct edit routes', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: {
        id: 42,
        serial_number: '26IVP3P1',
        check_name: 'Проверка ИТ',
        short_name: null,
        check_type: 'planned',
        check_view: 'ИТ',
        check_quarter: 3,
        start_date: '2026-08-12',
        end_date: null,
        check_leader: 'Иванов И.И.',
        status: 'in_progress',
        created_at: '2026-08-01',
        description: null,
        order_document_number: null,
        order_document_date: null,
        program_document_number: null,
        program_document_date: null,
        az_document_number: null,
        az_document_date: null,
        dz_document_number: null,
        dz_document_date: null,
        process_effectiveness: null,
        svk_effectiveness: null,
        sur_effectiveness: null,
        svik_effectiveness: null,
      },
    });

    const result = await fetchCheck('42');

    expect(api.get).toHaveBeenCalledWith('/api/v1/checks/42');
    expect(result).toMatchObject({
      id: '42',
      serial_number: '26IVP3P1',
      check_name: 'Проверка ИТ',
    });
  });
});
