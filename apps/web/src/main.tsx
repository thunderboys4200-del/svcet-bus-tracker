import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App";
import "./index.css";

// Auto-register service worker for PWA offline caching & updates
registerSW({
  immediate: true,
  onNeedRefresh() {
    console.log("[SVCET-PWA] New version available.");
  },
  onOfflineReady() {
    console.log("[SVCET-PWA] Application cached and ready for offline use.");
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
