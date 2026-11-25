import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
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
    rollupOptions: {
      output: {
        // Only the named packages go into vendor chunks; their own dependencies stay with
        // whoever uses them, so the PDF/Excel libraries are not pulled into the first page.
        manualChunks(id: string) {
          // Vite's preload helper and the CommonJS helpers are shared by every chunk; keep them in the
          // always-loaded React chunk, or Rollup parks them in vendor-pdf and the first page needs it.
          if (id.includes('vite/preload-helper') || id.includes('commonjsHelpers')) return 'vendor-react';
          if (!id.includes('node_modules')) return undefined;
          if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'vendor-react';
          if (/node_modules\/(jspdf|jspdf-autotable)\//.test(id)) return 'vendor-pdf';
          if (/node_modules\/xlsx\//.test(id)) return 'vendor-xlsx';
          if (/node_modules\/date-fns\//.test(id)) return 'vendor-dates';
          return undefined;
        },
      },
    },
  },
});
