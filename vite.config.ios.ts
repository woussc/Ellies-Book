import { defineConfig, mergeConfig } from 'vite';
import pages from './vite.config.pages';
import { fileURLToPath } from 'node:url';

export default mergeConfig(pages, defineConfig({
  base: './',
  build: { outDir: fileURLToPath(new URL('./dist-ios', import.meta.url)) },
}));
