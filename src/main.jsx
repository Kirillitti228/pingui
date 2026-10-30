import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <main role="alert" style={{ maxWidth: 560, margin: "12vh auto", padding: 32, fontFamily: "system-ui, sans-serif", textAlign: "center" }}>
          <h1>Something went wrong</h1>
          <p>Your saved learning progress is still in this browser. Reload PINGUI to try again.</p>
          <button type="button" onClick={() => window.location.reload()}>Reload PINGUI</button>
        </main>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AppErrorBoundary><App /></AppErrorBoundary>
  </React.StrictMode>
);
