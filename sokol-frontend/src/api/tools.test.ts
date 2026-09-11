import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DOCX_TOOL_TIMEOUT_MS, generateControlFile, generateSectionIITemplate } from './tools';
import { api } from './client';

vi.mock('./client', () => ({
  api: {
    post: vi.fn(),
    get: vi.fn(),
  },
}));

const docxFile = () =>
  new File(['pk'], 'az.docx', {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });

describe('generateSectionIITemplate', () => {
  beforeEach(() => {
    vi.mocked(api.post).mockReset();
  });

  it('uses a 10-minute timeout for large DOCX jobs', async () => {
    expect(DOCX_TOOL_TIMEOUT_MS).toBe(600_000);
    vi.mocked(api.post).mockResolvedValue({ data: new Blob(['ok']) });

    await generateSectionIITemplate(docxFile());

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

describe('generateControlFile', () => {
  beforeEach(() => {
    vi.mocked(api.post).mockReset();
  });

  it('sends check leader and date with the document', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: new Blob(['xlsx']) });

    await generateControlFile(docxFile(), {
      checkLeader: 'Иванов И.И.',
      checkDate: '2026-09-02',
    });

    const formData = vi.mocked(api.post).mock.calls[0][1] as FormData;
    expect(formData.get('check_leader')).toBe('Иванов И.И.');
    expect(formData.get('check_date')).toBe('2026-09-02');
    expect(api.post).toHaveBeenCalledWith(
      '/api/v1/tools/control-file',
      expect.any(FormData),
      expect.objectContaining({
        responseType: 'blob',
        timeout: 600_000,
      }),
    );
  });
});

describe('docx tool errors', () => {
  beforeEach(() => {
    vi.mocked(api.post).mockReset();
  });

  it('preserves Retry-After from a 503 queue response', async () => {
    vi.mocked(api.post).mockRejectedValue({
      code: 'http_503',
      message: 'HTTP 503',
      status: 503,
      retryAfterSeconds: 15,
      details: new Blob(
        [JSON.stringify({ detail: 'Сейчас обрабатывается слишком много документов. Повторите через несколько секунд — запрос встанет в очередь.' })],
        { type: 'application/json' },
      ),
    });

    await expect(generateSectionIITemplate(docxFile())).rejects.toMatchObject({
      status: 503,
      retryAfterSeconds: 15,
      message: expect.stringMatching(/очеред/i),
    });
  });
});
