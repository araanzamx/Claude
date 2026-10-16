import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  // `npm run artefacto` arma una sola página con todo incluido (logo y fuentes
  // como data URI) para verla como artefacto privado en claude.ai.
  build:
    mode === 'artefacto'
      ? { outDir: 'dist-artefacto', assetsInlineLimit: 10_000_000, modulePreload: false, cssCodeSplit: false }
      : {},
}));
