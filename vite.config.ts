import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    plugins: [
      react(), 
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'icon-512.jpg'],
        manifest: {
          id: '/',
          name: 'VETERANS JAWHARA',
          short_name: 'Jawhara',
          description: 'Elite Tactical Hub for the Veterans Jawhara football squad.',
          theme_color: '#090A0F',
          background_color: '#090A0F',
          display: 'standalone',
          start_url: '/',
          scope: '/',
          icons: [
            {
              src: '/icon-512.jpg',
              sizes: '512x512',
              type: 'image/jpeg',
              purpose: 'any'
            },
            {
              src: '/icon-512.jpg',
              sizes: '512x512',
              type: 'image/jpeg',
              purpose: 'maskable'
            }
          ]
        },
        devOptions: {
          enabled: true,
          type: 'module'
        }
      })
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
