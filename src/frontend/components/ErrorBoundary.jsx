import React from "react";
import LoadingErrorHandler from "./LoadingErrorHandler";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorMessage: null };
  }

  static getDerivedStateFromError(error) {
    // error can be null or a non-Error object when thrown by WebGL internals
    let message = "An error occurred.";
    if (error != null) {
      if (typeof error.message === "string" && error.message) {
        message = error.message;
      } else if (typeof error === "string" && error) {
        message = error;
      }
    }
    return { hasError: true, errorMessage: message };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, errorMessage: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <LoadingErrorHandler isLoading={false} error={this.state.errorMessage}>
          <button
            onClick={this.handleRetry}
            aria-label="Retry"
            type="button"
            style={{
              marginTop: "1rem",
              padding: "0.5rem 1rem",
              cursor: "pointer",
            }}
          >
            Try Again
          </button>
        </LoadingErrorHandler>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
