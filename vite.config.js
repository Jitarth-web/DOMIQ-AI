import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  publicDir: 'landing/public',
  server: {
    port: 8080,
    strictPort: true,
  }
});
