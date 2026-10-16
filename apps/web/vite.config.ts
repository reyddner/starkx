import path from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { starkxCspPlugin } from './vite.csp.ts'

const root = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(root, '../..')

export default defineConfig({
  plugins: [react(), starkxCspPlugin()],
  assetsInclude: ['**/*.ttf'],
  resolve: {
    alias: {
      '@engine': path.resolve(repoRoot, 'calculation-engine'),
      '@domain': path.resolve(repoRoot, 'domain'),
      '@structural': path.resolve(repoRoot, 'structural-engine'),
      '@memorial': path.resolve(repoRoot, 'memorial-engine'),
      '@block': path.resolve(repoRoot, 'block-engine'),
      '@footing': path.resolve(repoRoot, 'footing-engine'),
      '@caisson': path.resolve(repoRoot, 'caisson-engine'),
      '@raft': path.resolve(repoRoot, 'raft-engine'),
      '@assist': path.resolve(repoRoot, 'assist-engine'),
      '@group': path.resolve(repoRoot, 'pile-group-engine'),
      '@drawing': path.resolve(repoRoot, 'drawing-engine'),
      '@conception': path.resolve(repoRoot, 'conception-engine'),
    },
  },
  server: {
    port: 5173,
    fs: {
      allow: [repoRoot],
    },
  },
})
