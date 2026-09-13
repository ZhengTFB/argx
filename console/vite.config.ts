import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { cpSync, createReadStream, existsSync, statSync } from 'node:fs';
import { extname, resolve } from 'node:path';

const REPO_ROOT = resolve(import.meta.dirname, '..');

/*
 * 让 dev server 与构建产物都能拿到仓库根上的这几个目录。
 *
 * 为什么需要它：控制台要把 Demo **原样嵌进来**跑（iframe 指向 demo/index.html），
 * 而不是在 React 里重写一遍剧情界面——Demo 是给别人抄的样板，
 * 有两份就一定会有对不上的那一天。
 *
 *   demo/    示例作品（iframe 嵌进来跑）
 *   sdk/     零依赖网页 SDK（demo/index.html 直接 <script src> 它）
 *   landing/ 官网首页（阶段四新建，零构建的静态目录）
 *   design/  设计 token（tokens.css）。放在这里是为了让
 *            「首页 / 控制台 dev / 控制台 dist / 双击 file://」四种打开方式
 *            都拿到同一份 token——不复制、不重写第二份。
 *
 * 这些目录在 console/ 之外，Vite 默认不服务、也不会打进 dist。
 * 复制一份进 console/ 更简单，但那正是这个项目一直在避免的事
 *（device/virtual_device.js 也是直接复用，不复制）。所以这里做两件事：
 *   dev   加一个中间件，把这几个前缀映射到仓库根
 *   build 构建完把目录原样拷进 dist（产物仍然是纯静态，可以直接部署）
 */
const SHARED_DIRS = ['demo', 'sdk', 'landing', 'design'];

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml'
};

function sharedDirs(): Plugin {
  return {
    name: 'argx-shared-dirs',

    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = (req.url ?? '/').split('?')[0];
        const first = url.split('/')[1];
        if (!SHARED_DIRS.includes(first)) return next();

        let file = resolve(REPO_ROOT, url.replace(/^\/+/, ''));
        if (existsSync(file) && statSync(file).isDirectory()) {
          file = resolve(file, 'index.html');
        }
        if (!existsSync(file)) return next();

        res.setHeader('Content-Type', MIME[extname(file)] ?? 'application/octet-stream');
        createReadStream(file).pipe(res);
      });
    },

    closeBundle() {
      for (const dir of SHARED_DIRS) {
        const from = resolve(REPO_ROOT, dir);
        if (existsSync(from)) {
          cpSync(from, resolve(import.meta.dirname, 'dist', dir), { recursive: true });
        }
      }
    }
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), sharedDirs()],

  // 构建产物是纯静态文件：全部用相对路径，不写死域名，可以直接丢到任意静态服务器
  base: './',

  server: {
    port: 5173,
    // 允许读到仓库上一层的 device/virtual_device.js 与 sdk/argx.js
    // （两边都是直接复用同一份文件，不复制、不重写）
    fs: { allow: ['..'] }
  },

  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
});
