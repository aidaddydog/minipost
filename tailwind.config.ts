import type { Config } from 'tailwindcss'

export default {
  content: [
    "./modules/**/frontend/react/**/*.{ts,tsx,js,jsx}",
    "./modules/**/frontend/react/styles/**/*.css",
    "./app/templates/**/*.{html,htm}",
    "./app/**/templates/**/*.{html,htm}",
  ],
  theme: { extend: {} },
  corePlugins: { preflight: true },
  plugins: [],
} satisfies Config
