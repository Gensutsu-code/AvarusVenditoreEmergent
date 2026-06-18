import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";

// ---------------------------------------------------------------------------
// Suppress "Maximum call stack size exceeded" errors that originate from
// third-party Chrome extensions (Grammarly, Monica, LinguaLeo, etc.). Their
// content scripts walk the DOM/React fiber tree with getOwnPropertyDescriptor
// proxies and stack-overflow on SPA navigation. Stack frames come from
// `<anonymous>` sources (extension content script), not our bundle, so they
// are safe to swallow — they do not affect our app's behaviour.
// In production this also prevents the CRA dev-overlay/red-screen from blocking
// the UI when such an extension is installed.
// ---------------------------------------------------------------------------
const isExtensionStackOverflow = (errOrMsg, stack) => {
  const msg = (errOrMsg && (errOrMsg.message || errOrMsg)) || "";
  const s = stack || (errOrMsg && errOrMsg.stack) || "";
  if (typeof msg !== "string") return false;
  if (!msg.includes("Maximum call stack size exceeded")) return false;
  // Frames coming from extension content scripts show up as `<anonymous>:1:NNN`
  return typeof s === "string" && s.includes("<anonymous>");
};

window.addEventListener(
  "error",
  (event) => {
    if (isExtensionStackOverflow(event.error || event.message, event.error?.stack)) {
      event.stopImmediatePropagation();
      event.preventDefault();
      return false;
    }
    return undefined;
  },
  true
);

window.addEventListener(
  "unhandledrejection",
  (event) => {
    const reason = event.reason;
    if (isExtensionStackOverflow(reason, reason?.stack)) {
      event.stopImmediatePropagation();
      event.preventDefault();
    }
  },
  true
);

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
