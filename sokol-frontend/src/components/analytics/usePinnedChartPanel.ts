import { useEffect, useRef, useState } from 'react';

export const PINNED_CHART_HIDE_DELAY_MS = 220;

export function usePinnedChartPanel() {
  const rootRef = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef<number | null>(null);
  const [activeName, setActiveName] = useState<string | null>(null);
  const [pinnedName, setPinnedName] = useState<string | null>(null);

  const visibleName = pinnedName ?? activeName;

  const cancelHide = () => {
    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  };

  const requestHide = () => {
    if (pinnedName) {
      return;
    }
    cancelHide();
    hideTimerRef.current = window.setTimeout(() => {
      setActiveName(null);
    }, PINNED_CHART_HIDE_DELAY_MS);
  };

  const pinVisible = () => {
    if (!visibleName) {
      return;
    }
    cancelHide();
    setPinnedName(visibleName);
    setActiveName(visibleName);
  };

  const unpin = () => {
    setPinnedName(null);
  };

  const closePanel = () => {
    cancelHide();
    setPinnedName(null);
    setActiveName(null);
  };

  const showRow = (name: string) => {
    if (pinnedName) {
      return;
    }
    cancelHide();
    setActiveName((current) => (current === name ? current : name));
  };

  const togglePinnedName = (name: string) => {
    cancelHide();
    setActiveName(name);
    setPinnedName((current) => (current === name ? null : name));
  };

  useEffect(() => {
    return () => cancelHide();
  }, []);

  useEffect(() => {
    if (!pinnedName) {
      return undefined;
    }
    const handlePointer = (event: MouseEvent) => {
      if (rootRef.current?.contains(event.target as Node)) {
        return;
      }
      setPinnedName(null);
      setActiveName(null);
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPinnedName(null);
        setActiveName(null);
      }
    };
    window.addEventListener('mousedown', handlePointer);
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('mousedown', handlePointer);
      window.removeEventListener('keydown', handleKey);
    };
  }, [pinnedName]);

  return {
    rootRef,
    pinnedName,
    visibleName,
    cancelHide,
    requestHide,
    pinVisible,
    unpin,
    closePanel,
    showRow,
    togglePinnedName,
  };
}
