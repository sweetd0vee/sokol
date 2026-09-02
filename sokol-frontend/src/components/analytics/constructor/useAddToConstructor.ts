import { useCallback, useEffect, useRef, useState } from 'react';
import { useAnalyticsConstructor } from './analyticsConstructorState';
import type { ConstructorWidgetDraft } from './constructorTypes';

export function useAddToConstructor() {
  const { addWidgets } = useAnalyticsConstructor();
  const [justAdded, setJustAdded] = useState(false);
  const timerRef = useRef<number | null>(null);

  const addToConstructor = useCallback(
    (drafts: ConstructorWidgetDraft[]) => {
      if (drafts.length === 0) {
        window.alert('Отметьте хотя бы один график галочкой');
        return 0;
      }
      const count = addWidgets(drafts);
      setJustAdded(true);
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
      timerRef.current = window.setTimeout(() => setJustAdded(false), 1800);
      return count;
    },
    [addWidgets],
  );

  useEffect(() => () => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
    }
  }, []);

  return { addToConstructor, justAdded };
}
