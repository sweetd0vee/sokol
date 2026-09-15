import { describe, expect, it } from 'vitest';
import { exportCapturePixelSize } from './exportCaptureBox';

describe('exportCapturePixelSize', () => {
  it('uses the full table content height instead of the visible viewport', () => {
    expect(
      exportCapturePixelSize({
        rectWidth: 960,
        rectHeight: 280,
        offsetWidth: 960,
        offsetHeight: 280,
        scrollWidth: 960,
        scrollHeight: 280,
        contentWidth: 960,
        contentHeight: 2400,
      }),
    ).toEqual({ width: 960, height: 2400 });
  });
});
