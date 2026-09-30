import { describe, expect, it, vi } from 'vitest';
import { createRequestId, reportClientError } from './clientObservability';

describe('clientObservability', () => {
  it('creates a non-empty request id', () => {
    expect(createRequestId().length).toBeGreaterThan(8);
  });

  it('logs a structured payload without throwing', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    reportClientError({ source: 'boundary', message: 'boom', requestId: 'abc' });
    expect(spy).toHaveBeenCalledWith(
      '[sokol]',
      expect.objectContaining({ source: 'boundary', message: 'boom', requestId: 'abc' }),
    );
    spy.mockRestore();
  });
});
