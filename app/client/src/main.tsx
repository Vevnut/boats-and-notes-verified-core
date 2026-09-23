import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { loadTestPreferences } from "./lib/test-preferences";

if (!window.location.hash) {
  window.location.hash = "#/";
}

// Deliberately no service worker and no browser storage in this test copy.
void loadTestPreferences().finally(() => createRoot(document.getElementById("root")!).render(<App />));
