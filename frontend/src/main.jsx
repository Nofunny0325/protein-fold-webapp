import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./style.css";

const root = document.getElementById("root");

function renderFatal(error) {
  const message = error?.message || String(error);
  root.innerHTML = `
    <main class="workspace">
      <section class="panel error">
        <strong>Application failed to start.</strong>
        <pre>${message}</pre>
      </section>
      <section class="right">
        <div class="empty">Viewer unavailable</div>
      </section>
    </main>
  `;
}

window.addEventListener("error", (event) => {
  renderFatal(event.error || event.message);
});

window.addEventListener("unhandledrejection", (event) => {
  renderFatal(event.reason || "Unhandled promise rejection");
});

try {
  createRoot(root).render(<App />);
} catch (error) {
  renderFatal(error);
}
