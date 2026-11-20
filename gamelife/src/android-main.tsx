import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AuthProvider } from "@/lib/auth/provider";
import Home from "@/routes/index";
import "@/styles.css";

declare global {
  interface Window {
    __GAME_LAST_ERROR__?: string;
  }
}

window.addEventListener("error", (ev) => {
  window.__GAME_LAST_ERROR__ = ev.message || String(ev.error || "Unknown error");
});
window.addEventListener("unhandledrejection", (ev) => {
  window.__GAME_LAST_ERROR__ = String(ev.reason || "Unhandled promise rejection");
});

const rootEl = document.getElementById("root") ?? document.body.appendChild(Object.assign(document.createElement("div"), { id: "root" }));

createRoot(rootEl).render(
  <StrictMode>
    <AuthProvider>
      <Home />
    </AuthProvider>
  </StrictMode>,
);
