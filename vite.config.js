import { defineConfig } from 'vite';

// base: './' 让构建产物可以部署在任意子路径（如 GitHub Pages 的 /仓库名/）
export default defineConfig({
  base: './',
  server: { host: true, port: 5173 },
  preview: { host: true, port: 4173 },
  build: {
    target: 'es2020',
    outDir: 'dist',
    chunkSizeWarningLimit: 1500,
  },
});
