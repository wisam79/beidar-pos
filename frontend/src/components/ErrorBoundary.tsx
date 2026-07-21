
import React, { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, RotateCcw, Copy, CheckCircle } from 'lucide-react';
import { logger } from '../core/logger';

interface ErrorBoundaryProps {
  children?: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  retryCount: number;
  copied: boolean;
}

const MAX_RETRIES = 3;

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
      copied: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error using centralized logger
    logger.error('ErrorBoundary caught an error', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    }, 'ErrorBoundary');

    this.setState({ errorInfo });

    // Call custom handler if provided
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = () => {
    const { retryCount } = this.state;

    if (retryCount < MAX_RETRIES) {
      logger.info(`Retry attempt ${retryCount + 1}/${MAX_RETRIES}`, undefined, 'ErrorBoundary');
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        retryCount: retryCount + 1,
      });
    } else {
      logger.warn('Max retries reached, reloading page', undefined, 'ErrorBoundary');
      window.location.reload();
    }
  };

  handleCopyError = () => {
    const { error, errorInfo } = this.state;
    const errorText = `
Error: ${error?.message}
Stack: ${error?.stack}
Component Stack: ${errorInfo?.componentStack}
Timestamp: ${new Date().toISOString()}
    `.trim();

    navigator.clipboard.writeText(errorText).then(() => {
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    });
  };

  render() {
    const { hasError, error, retryCount, copied } = this.state;
    const { children, fallback } = this.props;

    if (hasError) {
      // Use custom fallback if provided
      if (fallback) {
        return fallback;
      }

      const canRetry = retryCount < MAX_RETRIES;

      return (
        <div className="min-h-screen bg-bg flex flex-col items-center justify-center text-center p-6 animate-scale-in">
          {/* Error Icon with Glow */}
          <div className="relative mb-6">
            <div className="absolute inset-0 bg-red-500/20 blur-2xl rounded-full animate-pulse" />
            <div className="relative w-24 h-24 bg-red-500/10 rounded-full flex items-center justify-center border border-red-500/20">
              <AlertTriangle size={48} className="text-red-500" />
            </div>
          </div>

          <h1 className="text-3xl font-bold text-text-main mb-2">
            عذراً، حدث خطأ غير متوقع
          </h1>

          <p className="text-text-muted mb-8 max-w-md">
            واجه النظام مشكلة تقنية.
            {canRetry && ` يمكنك المحاولة مرة أخرى (${MAX_RETRIES - retryCount} محاولات متبقية).`}
          </p>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-4 justify-center mb-8">
            {/* Retry Button */}
            <button
              onClick={this.handleRetry}
              className="flex items-center gap-2 bg-primary text-primary-fg px-6 py-3 rounded-xl font-bold btn-native btn-primary-native"
            >
              {canRetry ? (
                <>
                  <RotateCcw size={18} />
                  إعادة المحاولة
                </>
              ) : (
                <>
                  <RefreshCw size={18} />
                  إعادة تشغيل النظام
                </>
              )}
            </button>

            {/* Home Button */}
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null, retryCount: 0 });
                window.location.href = '/';
              }}
              className="flex items-center gap-2 bg-surface text-text-main px-6 py-3 rounded-xl font-bold hover:bg-surface-hover transition-colors border border-border btn-native"
            >
              <Home size={18} />
              العودة للرئيسية
            </button>
          </div>

          {/* Error Details (Collapsible) */}
          {error && (
            <details className="w-full max-w-lg text-left">
              <summary className="text-text-muted text-sm cursor-pointer hover:text-text-main transition-colors mb-2">
                تفاصيل الخطأ (للمطورين)
              </summary>
              <div className="p-4 bg-bg rounded-xl border border-red-500/30 overflow-auto" dir="ltr">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-red-400 text-xs font-bold">Error Details</span>
                  <button
                    onClick={this.handleCopyError}
                    className="text-text-muted hover:text-primary transition-colors p-1 rounded"
                    title="Copy error"
                  >
                    {copied ? <CheckCircle size={14} className="text-primary" /> : <Copy size={14} />}
                  </button>
                </div>
                <p className="text-red-400 font-mono text-xs whitespace-pre-wrap">
                  {error.toString()}
                </p>
                {error.stack && (
                  <pre className="text-gray-500 font-mono text-[10px] mt-2 whitespace-pre-wrap max-h-32 overflow-auto">
                    {error.stack}
                  </pre>
                )}
              </div>
            </details>
          )}

          {/* Retry Counter */}
          {retryCount > 0 && (
            <p className="text-text-muted text-xs mt-4">
              محاولة {retryCount} من {MAX_RETRIES}
            </p>
          )}
        </div>
      );
    }

    return children;
  }
}
