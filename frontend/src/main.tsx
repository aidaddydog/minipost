import React from "react";
import { createRoot } from "react-dom/client";
import { LayerProvider } from "./systems/LayerManager";
import { App } from "./App";
import "./styles/index.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <LayerProvider>
      <App />
    </LayerProvider>
  </React.StrictMode>
);
