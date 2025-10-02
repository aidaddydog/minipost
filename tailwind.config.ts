import type { Config } from "tailwindcss"

export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./modules/**/frontend/react/**/*.{ts,tsx,jsx,html}"
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" }
      },
      zIndex: {
        "layer": "1000",
        "layer-popover": "1010",
        "layer-drawer": "1020",
        "layer-modal": "1030"
      }
    }
  },
  plugins: []
} satisfies Config
