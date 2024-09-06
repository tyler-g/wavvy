import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import eslint from 'vite-plugin-eslint';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Custom middleware to serve wasm files with the correct MIME type
const wasmMiddleware = () => {
  return {
    name: 'wasm-middleware',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url.endsWith('.wasm')) {
          const wasmPath = path.join(
            __dirname,
            'node_modules/libflacjs/dist',
            path.basename(req.url)
          );
          const wasmFile = fs.readFileSync(wasmPath);
          res.setHeader('Content-Type', 'application/wasm');
          res.end(wasmFile);
          return;
        }
        next();
      });
    },
  };
};

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), eslint(), wasmMiddleware()],
  worker: {
    rollupOptions: {
      output: {
        format: 'iife',
        inlineDynamicImports: true,
      },
    },
    plugins: () => {
      return [wasm(), topLevelAwait()];
    },
    format: 'es',
  },
  server: {
    open: true,
  },
  esbuild: {
    supported: {
      'top-level-await': true,
    },
  },
  optimizeDeps: {
    esbuildOptions: {
      supported: {
        'top-level-await': true,
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: 'src/setupTests',
    mockReset: true,
  },
});
