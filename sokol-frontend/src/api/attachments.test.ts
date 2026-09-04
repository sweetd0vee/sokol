import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchStorageStatus } from './attachments';
import { api } from './client';

vi.mock('./client', () => ({
  api: {
    get: vi.fn(),
  },
}));

describe('fetchStorageStatus', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset();
  });

  it('reads GET /attachments/storage/status before any upload', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: {
        enabled: true,
        reachable: false,
        bucket_layout: 'check-{serial_number}/{slot}/{uuid}_{filename}',
      },
    });

    const status = await fetchStorageStatus();

    expect(api.get).toHaveBeenCalledWith('/api/v1/attachments/storage/status');
    expect(status).toEqual({
      enabled: true,
      reachable: false,
      bucket_layout: 'check-{serial_number}/{slot}/{uuid}_{filename}',
    });
  });
});
