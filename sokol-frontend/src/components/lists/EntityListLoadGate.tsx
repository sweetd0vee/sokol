import type { ReactNode } from 'react';
import { ErrorState, LoadingState } from '../ui/StateMessage';
import { getErrorMessage } from '../../api/errors';

type EntityListLoadGateProps = {
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  loadingTitle: string;
  errorTitle: string;
  onRetry: () => void;
  children: ReactNode;
};

/** Shared loading / error gate for entity list tabs. */
export function EntityListLoadGate({
  isLoading,
  isError,
  error,
  loadingTitle,
  errorTitle,
  onRetry,
  children,
}: EntityListLoadGateProps) {
  if (isLoading) {
    return <LoadingState title={loadingTitle} />;
  }

  if (isError) {
    return (
      <ErrorState
        title={errorTitle}
        description={getErrorMessage(error, 'Проверьте подключение к API и повторите попытку.')}
        action={{ label: 'Повторить', onClick: onRetry }}
      />
    );
  }

  return children;
}
