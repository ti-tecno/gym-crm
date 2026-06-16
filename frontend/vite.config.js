import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Sólo variables con prefijo VITE_ se exponen al bundle.
// Cualquier secreto NUNCA debe ser VITE_*; va en el backend.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': { target: 'https://api.eventopolis.com.mx:4000', changeOrigin: true },
    },
  },
  build: {
    target: 'es2020',
    sourcemap: false, // no exponer mapas en producción
  },
});
