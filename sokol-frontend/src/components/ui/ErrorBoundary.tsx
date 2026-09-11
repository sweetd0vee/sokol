import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ErrorState } from './StateMessage';

type ErrorBoundaryProps = {
  children: ReactNode;
  title?: string;
  description?: string;
  reloadOnError?: boolean;
};

type ErrorBoundaryState = {
  error: Error | null;
};

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary', error, info.componentStack);
  }

  private handleRetry = () => {
    if (this.props.reloadOnError) {
      window.location.reload();
      return;
    }
    this.setState({ error: null });
  };

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <ErrorState
        title={this.props.title ?? 'Не удалось показать содержимое'}
        description={
          this.props.description
          ?? 'Произошла непредвиденная ошибка. Попробуйте ещё раз или обновите страницу.'
        }
        action={{
          label: this.props.reloadOnError ? 'Обновить страницу' : 'Попробовать снова',
          onClick: this.handleRetry,
        }}
      />
    );
  }
}
