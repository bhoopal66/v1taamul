import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Suppress AbortError from Supabase queries when components unmount
// These are expected errors and shouldn't be shown to users
window.addEventListener('unhandledrejection', (event) => {
  const error = event.reason;
  const errorMessage = error?.message || String(error);
  const errorName = error?.name || '';
  
  if (
    errorMessage.toLowerCase().includes('abort') ||
    errorName === 'AbortError' ||
    error?.code === 'ABORT_ERR'
  ) {
    event.preventDefault();
    return;
  }
});

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);