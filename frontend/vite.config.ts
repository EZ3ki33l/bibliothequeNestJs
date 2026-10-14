import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { pyodideAssets } from './vite-plugins/pyodideAssets.ts';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), pyodideAssets()],
});
