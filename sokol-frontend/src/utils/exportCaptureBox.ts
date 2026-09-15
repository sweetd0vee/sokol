export type ExportCaptureBoxInput = {
  rectWidth: number;
  rectHeight: number;
  offsetWidth: number;
  offsetHeight: number;
  scrollWidth: number;
  scrollHeight: number;
  contentWidth?: number;
  contentHeight?: number;
};

/** Prefer full scrollable content over the on-screen viewport when capturing tables. */
export function exportCapturePixelSize(input: ExportCaptureBoxInput) {
  return {
    width: Math.max(
      Math.round(input.rectWidth),
      input.offsetWidth || 0,
      input.scrollWidth || 0,
      input.contentWidth || 0,
      1,
    ),
    height: Math.max(
      Math.round(input.rectHeight),
      input.offsetHeight || 0,
      input.scrollHeight || 0,
      input.contentHeight || 0,
      1,
    ),
  };
}

export function expandOverflowForTableCapture(root: HTMLElement) {
  if (!root.querySelector('table')) {
    return;
  }
  const nodes: HTMLElement[] = [root, ...root.querySelectorAll<HTMLElement>('*')];
  for (const element of nodes) {
    element.style.overflow = 'visible';
    element.style.maxHeight = 'none';
  }
}
