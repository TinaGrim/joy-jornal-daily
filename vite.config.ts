import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

// Vercel injects system env vars (VERCEL, VERCEL_ENV, ...) into every build.
// Our Firebase config lives in .env (gitignored), so Vercel builds would get
// no config at all. These are PUBLIC Firebase web credentials (they ship in
// the bundle no matter what), so fall back to them when VITE_FIREBASE_* is
// missing so production behaves exactly like local development.
if (process.env.VERCEL === '1' || process.env.VERCEL_ENV) {
  process.env.VITE_FIREBASE_API_KEY ??= 'AIzaSyCX9uffa9pSzPofTEqbmrveh62XqXvnlE0'
  process.env.VITE_FIREBASE_AUTH_DOMAIN ??= 'jornal-52741.firebaseapp.com'
  process.env.VITE_FIREBASE_PROJECT_ID ??= 'jornal-52741'
  process.env.VITE_FIREBASE_STORAGE_BUCKET ??= 'jornal-52741.firebasestorage.app'
  process.env.VITE_FIREBASE_MESSAGING_SENDER_ID ??= '679052288715'
  process.env.VITE_FIREBASE_APP_ID ??= '1:679052288715:web:c9762dadb1247bdc63f14e'
  process.env.VITE_FIREBASE_DATABASE_URL ??= 'https://jornal-52741-default-rtdb.asia-southeast1.firebasedatabase.app'
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  assetsInclude: ['**/*.svg', '**/*.csv'],
})
