import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { linkedMock } from './local-mock/server.mjs';

export default defineConfig({
  plugins: [react(), linkedMock()],
  server: {
    host: '127.0.0.1',
    port: 5190,
    strictPort: true,
    watch: { ignored: ['**/.linked-mock/**'] },
  },
  build: {
    sourcemap: false,
  },
});
