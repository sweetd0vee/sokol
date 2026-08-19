import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DOCX_TOOL_TIMEOUT_MS, generateSectionIITemplate } from './tools';
import { api } from './client';

vi.mock('./client', () => ({
  api: {
    post: vi.fn(),
    get: vi.fn(),
  },
}));

describe('generateSectionIITemplate', () => {
  beforeEach(() => {
    vi.mocked(api.post).mockReset();
  });

  it('uses a 10-minute timeout for large DOCX jobs', async () => {
    expect(DOCX_TOOL_TIMEOUT_MS).toBe(600_000);
    vi.mocked(api.post).mockResolvedValue({ data: new Blob(['ok']) });

    const file = new File(['pk'], 'az.docx', {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
    await generateSectionIITemplate(file);

    expect(api.post).toHaveBeenCalledWith(
      '/api/v1/tools/section-ii',
      expect.any(FormData),
      expect.objectContaining({
        responseType: 'blob',
        timeout: 600_000,
      }),
    );
  });
});
