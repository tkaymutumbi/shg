import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const rootPackage = require('../package.json') as { version: string }

// https://vite.dev/config/
export default defineConfig({
  define: {
    __SHG_VERSION__: JSON.stringify(rootPackage.version),
  },
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    port: 8000,
  },
})
