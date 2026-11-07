import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
export default defineConfig({
  root: '/home/user/la-grinta',
  plugins: [react()],
  base: './',
  build: { outDir: '/tmp/claude-0/apercu-dist', emptyOutDir: true, assetsInlineLimit: 100000000, modulePreload: false, rollupOptions: { input: 'apercu.html', output: { inlineDynamicImports: true } } },
});
