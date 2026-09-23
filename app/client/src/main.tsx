import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

if (!window.location.hash) {
  window.location.hash = "#/";
}

// No service worker: fresh app files load from the permanent host.
createRoot(document.getElementById("root")!).render(<App />);
