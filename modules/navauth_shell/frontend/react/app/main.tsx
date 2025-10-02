import React from "react"
import { createRoot } from "react-dom/client"
import "./../styles/index.css"
import { LayerProvider } from "./systems/LayerManager"
import { App } from "./App"

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <LayerProvider>
      <App />
    </LayerProvider>
  </React.StrictMode>
)
