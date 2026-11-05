import { defineConfig, loadEnv } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ command, mode }) => {
  if (command === 'build') {
    const env = loadEnv(mode, process.cwd(), 'VITE_')
    const url = env.VITE_SUPABASE_URL?.trim()
    const key = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()
    if (!url || !key) {
      throw new Error('Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY before building. On Cloudflare Workers Builds, add them to Build variables and secrets.')
    }
    if (new URL(url).protocol !== 'https:') {
      throw new Error('VITE_SUPABASE_URL must be the HTTPS URL of the existing Supabase project.')
    }
    let isPublicKey = key.startsWith('sb_publishable_')
    // Existing legacy anon JWTs are also public keys; service-role JWTs are not.
    if (!isPublicKey) {
      try {
        const payload = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString('utf8'))
        isPublicKey = payload.role === 'anon'
      } catch {
        // Reject unrecognized keys without printing their contents in build logs.
      }
    }
    if (!isPublicKey) {
      throw new Error('VITE_SUPABASE_PUBLISHABLE_KEY must be a Supabase publishable key or legacy anon key. Never use a service-role or secret key in a frontend build.')
    }
  }

  return {
    plugins: [
      react(),
      tailwindcss(),
    ],
    resolve: {
      alias: {
        // Alias @ to the src directory
        '@': path.resolve(__dirname, './src'),
      },
    },

    // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
    assetsInclude: ['**/*.svg', '**/*.csv'],
  }
})
