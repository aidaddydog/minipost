import React from "react"
import { createRoot } from "react-dom/client"
import { createBrowserRouter, RouterProvider } from "react-router-dom"
import "./styles/index.css"
import { LayerProvider } from "./systems/LayerManager"
import { ShellLayout } from "./layouts/ShellLayout"
import { SystemUpgradePage } from "./pages/SystemUpgradePage"
import { LogisticsCustomPage } from "./pages/LogisticsCustomPage"
import { LoginPage } from "./pages/LoginPage"
import { NotFound } from "./pages/NotFound"

const router = createBrowserRouter([
  { path: "/", element: <ShellLayout />, children: [
    { index: true, element: <div className="p-4 text-sm text-slate-600">欢迎使用 minipost（React 版外壳）。</div> },
    { path: "/settings/system_settings/system_upgrade", element: <SystemUpgradePage /> },
    { path: "/logistics/channel/custom", element: <LogisticsCustomPage /> },
  ]},
  { path: "/login", element: <LoginPage /> },
  { path: "*", element: <NotFound /> }
])

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <LayerProvider>
      <RouterProvider router={router} />
    </LayerProvider>
  </React.StrictMode>
)
