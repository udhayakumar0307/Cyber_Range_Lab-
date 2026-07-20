import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught Error in Component Tree:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[400px] w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-xl flex flex-col items-center justify-center text-center my-6 space-y-5 animate-in fade-in zoom-in-95">
          <div className="w-16 h-16 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 flex items-center justify-center shadow-inner">
            <AlertTriangle className="w-8 h-8" />
          </div>

          <div className="space-y-2 max-w-md">
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
              Unable to load this page
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              An unexpected runtime error occurred while rendering this section. No data was lost.
            </p>
          </div>

          {import.meta.env.DEV && this.state.error && (
            <div className="w-full max-w-lg bg-slate-950 text-rose-300 p-4 rounded-xl text-left overflow-x-auto text-[11px] font-mono border border-slate-800">
              <p className="font-bold text-rose-400 mb-1">{this.state.error.toString()}</p>
              {this.state.errorInfo?.componentStack && (
                <pre className="text-[10px] text-slate-400 opacity-80 whitespace-pre-wrap">
                  {this.state.errorInfo.componentStack}
                </pre>
              )}
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={this.handleReset}
              className="px-5 py-2.5 bg-[#0052CC] hover:bg-blue-600 text-white font-bold text-xs rounded-xl shadow-md transition-all inline-flex items-center gap-2 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Retry Page</span>
            </button>

            <a
              href="/admin/dashboard"
              className="px-5 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl border border-slate-200 dark:border-slate-700 transition-all inline-flex items-center gap-2"
            >
              <Home className="w-4 h-4 text-slate-500 dark:text-slate-400" />
              <span>Admin Dashboard</span>
            </a>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
