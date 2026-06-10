import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ErrorState } from '@/lib/ui-state';

interface Props {
  children?: ReactNode;
  title?: string;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    errorMessage: '',
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMessage: error.message };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 bg-canvas border border-border rounded-md">
          <ErrorState
            title={this.props.title || 'Something went wrong in this section'}
            detail={this.state.errorMessage}
          />
        </div>
      );
    }

    return this.props.children;
  }
}
