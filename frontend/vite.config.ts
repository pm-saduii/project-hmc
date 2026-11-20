import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { singleFileHtml } from './vite.singleFile';

export default defineConfig(({ mode }) => {
  const isMockMode = mode === 'mock';

  return {
    plugins: [react(), ...(isMockMode ? [singleFileHtml()] : [])],
    publicDir: isMockMode ? false : 'public',
    define: {
      'import.meta.env.VITE_COMMIT_ID': JSON.stringify(
        process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || 'local'
      ),
    },
    server: {
      port: 5173,
    },
    build: {
      chunkSizeWarningLimit: 1000,
      assetsInlineLimit: isMockMode ? Number.MAX_SAFE_INTEGER : 4096,
      rollupOptions: {
        output: isMockMode
          ? { inlineDynamicImports: true }
          : {
              manualChunks: {
                'vendor-react': ['react', 'react-dom'],
                'vendor-pdf': ['jspdf', 'jspdf-autotable'],
                'vendor-xlsx': ['xlsx'],
                'vendor-charts': ['date-fns'],
              },
            },
      },
    },
  };
});
