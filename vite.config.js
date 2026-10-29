import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'


export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    // 29/10/2026: en desarrollo (npm run dev) Vite compila cada pantalla la primera vez que se
    // abre, y eso se sentía al cambiar de menú. warmup las deja compiladas al arrancar.
    warmup: {
      clientFiles: ['./src/pages/**/*.jsx', './src/components/**/*.jsx'],
    },
  },
})
