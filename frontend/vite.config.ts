import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

// 输出到后端静态目录；base 指向 /static/assets/ 便于后端任意路径回退 SPA
export default defineConfig({
  plugins: [react()],
  base: "/static/assets/",
  build: {
    outDir: "../static/assets",
    emptyOutDir: true
  },
  server: {
    port: 5173,
    proxy: {
      "/api": { target: "http://localhost:8000", changeOrigin: true }
    }
  }
})
