import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { ContentProvider } from "./content";
import { initializeMapPerformanceTelemetry } from "./lib/mapPerformance";

export function mountTaleaApp() {
  if (window.__taleaMobileGate || window.__taleaViewportFrameShell) return;

  initializeMapPerformanceTelemetry();
  createRoot(document.getElementById("root")).render(
    <StrictMode>
      <ContentProvider>
        <App />
      </ContentProvider>
    </StrictMode>,
  );

  requestAnimationFrame(() =>
    requestAnimationFrame(() => window.__taleaBoot?.ready("app")),
  );
}
