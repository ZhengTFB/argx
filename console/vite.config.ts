import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],

  // 构建产物是纯静态文件：全部用相对路径，不写死域名，可以直接丢到任意静态服务器
  base: './',

  server: {
    port: 5173,
    // 允许读到仓库上一层的 device/virtual_device.js
    // （模拟器复用阶段一的同一份文件，不复制、不重写）
    fs: { allow: ['..'] }
  },

  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
});
