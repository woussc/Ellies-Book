import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import LookBPreview from "../app/look-b-preview";
import "../app/look-b-preview.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode><LookBPreview /></StrictMode>,
);
