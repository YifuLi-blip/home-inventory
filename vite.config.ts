import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => ({
  resolve: {
    // `--mode fake` 用内存数据替换 Firebase，只用于界面测试。
    alias: mode === 'fake'
      ? [{ find: /^\.\/data$/, replacement: fileURLToPath(new URL('./tests/fakeData.ts', import.meta.url)) }]
      : [],
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: '家里有数',
        short_name: '家里有数',
        description: '家里的东西，心里有数。',
        lang: 'zh-CN',
        start_url: '/',
        display: 'standalone',
        background_color: '#f7f6ef',
        theme_color: '#f7f6ef',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/__/],
      },
    }),
  ],
}));
