import React from "react";
import { createRoot } from "react-dom/client";
import { ShellLayout } from "./ShellLayout";
import "../styles/index.css";

const mount = document.getElementById("root");
if (mount) {
  createRoot(mount).render(<ShellLayout />);
}
