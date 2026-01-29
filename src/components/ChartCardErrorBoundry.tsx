import { Component } from "react";

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}
/**
 * Error boundary component to catch and display errors in chart rendering.
 */
export class ChartErrorBoundary extends Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="text-gray-700 p-4 flex flex-col items-center justify-center h-full">
          <p className="font-semibold text-red-600">Chart rendering error</p>
          <p className="text-sm text-gray-500 mt-1">
            {this.state.error?.message ?? "An unexpected error occurred"}
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}
