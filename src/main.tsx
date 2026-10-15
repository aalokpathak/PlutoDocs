import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./index.css";

// Outside the editor the default WebView context menu (Back, Reload, …) makes no sense.
window.addEventListener("contextmenu", (e) => {
  const target = e.target as HTMLElement;
  if (!target.closest(".ProseMirror, input, textarea")) e.preventDefault();
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
