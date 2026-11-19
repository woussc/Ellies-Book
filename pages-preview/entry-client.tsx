// Pages and the Worker share one app, one spending path and one report.
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import BudgetApp from "../app/book/budget-app";
import "../app/globals.css";

const container = document.getElementById("root");
if (!container) throw new Error("Ellie’s Book: missing root container");
createRoot(container).render(
  <StrictMode>
    <BudgetApp />
  </StrictMode>,
);
