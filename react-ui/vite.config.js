import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './', // 🟢 Asta e esențial pentru Electron!
  build: {
    outDir: 'dist',
  },
  server: {
    port: 5173, // Force port 5173
    strictPort: true, // Exit if port is in use
  },
})
