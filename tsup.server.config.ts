import { defineConfig } from 'tsup';
import dotenv from 'dotenv';

dotenv.config();

export default defineConfig({
  entry: ['server.ts'],
  format: ['cjs'],
  outDir: 'dist-server',
  clean: true,
  splitting: false,
  platform: 'node',
  target: 'node18',
  // Keep all npm packages external — they'll be resolved from
  // the Electron app's node_modules via NODE_PATH at runtime.
  external: [
    '@homebridge/node-pty-prebuilt-multiarch',
    'node-pty',
    'vite',
  ],
  env: {
    GITHUB_OAUTH_CLIENT_ID: process.env.GITHUB_OAUTH_CLIENT_ID || '',
    GITHUB_OAUTH_CLIENT_SECRET: process.env.GITHUB_OAUTH_CLIENT_SECRET || '',
    GITHUB_OAUTH_REDIRECT_URI: process.env.GITHUB_OAUTH_REDIRECT_URI || '',
  }
});
