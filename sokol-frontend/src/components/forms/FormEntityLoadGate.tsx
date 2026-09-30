import type { ReactNode } from 'react';
import { ErrorState, LoadingState } from '../ui/StateMessage';
import { getErrorMessage } from '../../api/errors';
import { FormPageShell } from './FormPageShell';

type FormEntityLoadGateProps = {
  title: string;
  backTo: string;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  loadingDescription: string;
  errorTitle: string;
  errorFallback: string;
  onRetry: () => void;
  children: ReactNode;
};

/** Shared loading / error early-return for check and recommendation edit forms. */
export function FormEntityLoadGate({
  title,
  backTo,
  isLoading,
  isError,
  error,
  loadingDescription,
  errorTitle,
  errorFallback,
  onRetry,
  children,
}: FormEntityLoadGateProps) {
  if (isLoading) {
    return (
      <FormPageShell title={title} backTo={backTo}>
        <LoadingState description={loadingDescription} />
      </FormPageShell>
    );
  }

  if (isError) {
    return (
      <FormPageShell title={title} backTo={backTo}>
        <ErrorState
          title={errorTitle}
          description={getErrorMessage(error, errorFallback)}
          action={{ label: 'Повторить', onClick: onRetry }}
        />
      </FormPageShell>
    );
  }

  return children;
}
