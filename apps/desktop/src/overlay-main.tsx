import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import OverlayApp from "./OverlayApp";
import "./index.css";

createRoot(document.getElementById("overlay-root")!).render(
  <StrictMode>
    <OverlayApp />
  </StrictMode>
);
