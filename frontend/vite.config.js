import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['logoaprpedregoso.png'],
      manifest: {
        name: 'APR SAFIP',
        short_name: 'SAFIP',
        description: 'Sistema APR Santa Filomena Pedregoso',
        theme_color: '#0284c7',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          {
            src: 'logoaprpedregoso.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'logoaprpedregoso.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
})