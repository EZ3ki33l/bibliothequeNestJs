import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { pyodideAssets } from './vite-plugins/pyodideAssets.ts';
import { piperAssets } from './vite-plugins/piperAssets.ts';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), pyodideAssets(), piperAssets()],
  resolve: {
    // Spec 020 : variante d'onnxruntime-web sans son .wasm embarqué. Le moteur de l'écoute lui
    // donne ses octets (servis par /piper/ et mis en cache) : sans cette condition, Vite
    // recopierait dans dist/assets un second exemplaire inutile de 14,8 Mo.
    conditions: ['onnxruntime-web-use-extern-wasm'],
  },
});
