import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const api = `http://localhost:${process.env.PORT ?? 8787}`;

export default defineConfig({
  root: 'web',
  plugins: [react(), tailwindcss()],
  build: { outDir: '../dist', emptyOutDir: true },
  server: {
    host: true,
    proxy: { '/api': api, '/photos': api },
  },
});
